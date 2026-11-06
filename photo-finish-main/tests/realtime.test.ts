/**
 * اختبارات المرحلة 7 — الإشارات اللحظية (Realtime Signals)
 * ========================================================
 * 1. أسماء القنوات leagueChannelName (فرض UUID)
 * 2. تحليل الحمولات parseSignalPayload (أمان الشكل)
 * 3. سياسة إعادة الاتصال: retryDelayMs (تراجع أسّي مُسقّف) + applyChannelStatus
 * 4. مُجمّع النبضات createSignalDispatcher (debounce لكل نوع)
 * 5. شارة الحالة liveBadge
 * 6. الاشتراك الكامل subscribeLeagueSignals بعميل وهمي وتبعيات محقونة:
 *    فتح القناة، استقبال الإشارات، إعادة الاتصال، polling، الرؤية، التنظيف
 * 7. اتساق مفاتيح i18n للمرحلة 7 (عربي/فرنسي)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  applyChannelStatus,
  CHANNEL_PREFIX,
  createSignalDispatcher,
  DEFAULT_RECONNECT,
  leagueChannelName,
  liveBadge,
  parseSignalPayload,
  retryDelayMs,
  SIGNAL_EVENTS,
  subscribeLeagueSignals,
  type ConnState,
  type LiveStatus,
  type SignalEvent,
} from '../src/services/realtimeService';
import { ar, fr } from '../src/i18n/dictionaries';

const LIGA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LIGB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COMP = 'd1111111-1111-4111-8111-111111111111';

// ═══ 1) أسماء القنوات ═══

describe('leagueChannelName — فرض معرف صالح', () => {
  it('UUID صالح → قناة موحّدة صغيرة الأحرف (مع قص الفراغات)', () => {
    expect(leagueChannelName(LIGA)).toBe(`${CHANNEL_PREFIX}${LIGA}`);
    expect(leagueChannelName(`  ${LIGA.toUpperCase()}  `)).toBe(`${CHANNEL_PREFIX}${LIGA}`);
  });

  it('معرفات فاسدة → null (لا قنوات من مدخلات مشكوك فيها)', () => {
    expect(leagueChannelName('')).toBeNull();
    expect(leagueChannelName('123')).toBeNull();
    expect(leagueChannelName('pf:league:x')).toBeNull();
    expect(leagueChannelName('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaz')).toBeNull();
    expect(leagueChannelName(undefined as unknown as string)).toBeNull();
  });
});

// ═══ 2) تحليل الحمولات ═══

describe('parseSignalPayload — أمان الشكل', () => {
  it('حمولة صالحة → إشارة معايرة (أحرف صغيرة + وقت محلي)', () => {
    const s = parseSignalPayload('results_changed', { league_id: LIGA.toUpperCase(), competition_id: COMP }, 1700000000000);
    expect(s).toEqual({ event: 'results_changed', leagueId: LIGA, competitionId: COMP, at: 1700000000000 });
  });

  it('competition_id الغائب → null دون إسقاط الإشارة', () => {
    const s = parseSignalPayload('comps_changed', { league_id: LIGA });
    expect(s).not.toBeNull();
    expect(s!.competitionId).toBeNull();
  });

  it('competition_id الفاسد يُهمل (تبقى إشارة الرابطة)', () => {
    const s = parseSignalPayload('regs_changed', { league_id: LIGA, competition_id: 'trash' });
    expect(s).not.toBeNull();
    expect(s!.competitionId).toBeNull();
  });

  it('حدث غير معروف → null', () => {
    expect(parseSignalPayload('hacked_changed', { league_id: LIGA })).toBeNull();
    expect(parseSignalPayload('', { league_id: LIGA })).toBeNull();
  });

  it('حمولة غير كائن أو league_id غائب/فاسد → null', () => {
    expect(parseSignalPayload('comps_changed', null)).toBeNull();
    expect(parseSignalPayload('comps_changed', 'str')).toBeNull();
    expect(parseSignalPayload('comps_changed', {})).toBeNull();
    expect(parseSignalPayload('comps_changed', { league_id: 42 })).toBeNull();
    expect(parseSignalPayload('comps_changed', { league_id: 'zzzz' })).toBeNull();
  });

  it('أسماء أحداث التهجير 0010 ملزمة وأربعة فريدة', () => {
    expect(SIGNAL_EVENTS).toEqual(['clubs_changed', 'comps_changed', 'regs_changed', 'results_changed']);
  });
});

// ═══ 3) سياسة إعادة الاتصال ═══

describe('retryDelayMs — تراجع أسّي مُسقّف', () => {
  it('التسلسل القياسي 1s→2s→4s→8s→16s ثم null (polling)', () => {
    expect(retryDelayMs(1)).toBe(1000);
    expect(retryDelayMs(2)).toBe(2000);
    expect(retryDelayMs(3)).toBe(4000);
    expect(retryDelayMs(4)).toBe(8000);
    expect(retryDelayMs(5)).toBe(16000);
    expect(retryDelayMs(6)).toBeNull();
  });

  it('السقف يُطبَّق ولا يُتجاوز', () => {
    const p = { baseMs: 20_000, capMs: 30_000, maxRetries: 5 };
    expect(retryDelayMs(1, p)).toBe(20_000);
    expect(retryDelayMs(2, p)).toBe(30_000);
    expect(retryDelayMs(3, p)).toBe(30_000);
  });

  it('مدخلات غير منطقية → null', () => {
    expect(retryDelayMs(0)).toBeNull();
    expect(retryDelayMs(-1)).toBeNull();
    expect(retryDelayMs(2.5)).toBeNull();
    expect(retryDelayMs(Number.NaN)).toBeNull();
  });
});

describe('applyChannelStatus — آلة حالة الاتصال', () => {
  it('SUBSCRIBED → live مع تصفير المحاولات', () => {
    const s = applyChannelStatus({ attempt: 3, status: 'retrying' }, 'SUBSCRIBED');
    expect(s).toEqual({ attempt: 0, status: 'live' });
  });

  it('CHANNEL_ERROR/TIMED_OUT → retrying مع تزايد المحاولات', () => {
    let s: ConnState = { attempt: 0, status: 'live' };
    s = applyChannelStatus(s, 'TIMED_OUT');
    expect(s).toEqual({ attempt: 1, status: 'retrying' });
    s = applyChannelStatus(s, 'CHANNEL_ERROR');
    expect(s).toEqual({ attempt: 2, status: 'retrying' });
  });

  it('بعد maxRetries → polling (بلا إعادة اتصال)', () => {
    const s = applyChannelStatus({ attempt: DEFAULT_RECONNECT.maxRetries, status: 'retrying' }, 'TIMED_OUT');
    expect(s).toEqual({ attempt: DEFAULT_RECONNECT.maxRetries + 1, status: 'polling' });
  });

  it('CLOSED وحوادث مجهولة → بلا تغيير', () => {
    const st: ConnState = { attempt: 2, status: 'retrying' };
    expect(applyChannelStatus(st, 'CLOSED')).toBe(st);
    expect(applyChannelStatus(st, 'SOMETHING_ELSE')).toBe(st);
  });
});

// ═══ 4) مُجمّع النبضات ═══

describe('createSignalDispatcher — تجميع النبضات لكل نوع', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('نبضات متكررة من النوع نفسه داخل النافذة → نداء واحد بآخر إشارة', () => {
    const fired: { ev: SignalEvent; at: number }[] = [];
    const d = createSignalDispatcher({
      fire: (ev, sig) => fired.push({ ev, at: sig.at }),
      delayMs: 500,
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id as NodeJS.Timeout),
    });
    d.push({ event: 'results_changed', leagueId: LIGA, competitionId: null, at: 1 });
    d.push({ event: 'results_changed', leagueId: LIGA, competitionId: COMP, at: 2 });
    d.push({ event: 'results_changed', leagueId: LIGA, competitionId: null, at: 3 });
    vi.advanceTimersByTime(499);
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual([{ ev: 'results_changed', at: 3 }]);
    d.dispose();
  });

  it('أنواع مختلفة لا تتداخل — لكل نوع نداء مستقل', () => {
    const fired: SignalEvent[] = [];
    const d = createSignalDispatcher({
      fire: (ev) => fired.push(ev),
      delayMs: 400,
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id as NodeJS.Timeout),
    });
    d.push({ event: 'comps_changed', leagueId: LIGA, competitionId: null, at: 1 });
    d.push({ event: 'regs_changed', leagueId: LIGA, competitionId: null, at: 2 });
    d.push({ event: 'comps_changed', leagueId: LIGA, competitionId: null, at: 3 });
    vi.advanceTimersByTime(400);
    expect([...fired].sort()).toEqual(['comps_changed', 'regs_changed']);
    d.dispose();
  });

  it('dispose يُلغي النبضات المعلّقة (لا fire بعد التنظيف)', () => {
    const fired: SignalEvent[] = [];
    const d = createSignalDispatcher({
      fire: (ev) => fired.push(ev),
      delayMs: 300,
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id as NodeJS.Timeout),
    });
    d.push({ event: 'clubs_changed', leagueId: LIGA, competitionId: null, at: 1 });
    d.dispose();
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual([]);
  });
});

// ═══ 5) شارة الحالة ═══

describe('liveBadge — خريطة الشارة الموحدة', () => {
  it('off → بلا شارة', () => {
    expect(liveBadge('off')).toBeNull();
  });
  it('live → نجاح نابضة؛ connecting → محايدة؛ retrying/polling → تحذير', () => {
    expect(liveBadge('live')).toMatchObject({ tone: 'success', labelKey: 'rt_live', pulse: true });
    expect(liveBadge('connecting')).toMatchObject({ tone: 'neutral', labelKey: 'rt_connecting', pulse: false });
    expect(liveBadge('retrying')).toMatchObject({ tone: 'warning', labelKey: 'rt_retrying', pulse: false });
    expect(liveBadge('polling')).toMatchObject({ tone: 'warning', labelKey: 'rt_polling', pulse: false });
  });
});

// ═══ 6) الاشتراك الكامل بعميل وهمي ═══

interface FakeChannel {
  name: string;
  handlers: Map<string, (msg: unknown) => void>;
  onCalls: { type: string; event: string }[];
  subscribeCbs: ((status: string) => void)[];
  on(type: string, opts: { event: string }, cb: (msg: unknown) => void): FakeChannel;
  subscribe(cb?: (status: string) => void): FakeChannel;
}

function makeFakeClient() {
  const channels: FakeChannel[] = [];
  const removed: FakeChannel[] = [];
  const client = {
    channel(name: string): FakeChannel {
      const ch: FakeChannel = {
        name,
        handlers: new Map(),
        onCalls: [],
        subscribeCbs: [],
        on(type, opts, cb) {
          this.onCalls.push({ type, event: opts.event });
          this.handlers.set(opts.event, cb);
          return this;
        },
        subscribe(cb) {
          if (cb) this.subscribeCbs.push(cb);
          return this;
        },
      };
      channels.push(ch);
      return ch;
    },
    removeChannel(ch: FakeChannel) {
      removed.push(ch);
      return Promise.resolve('ok');
    },
  };
  return { client: client as unknown as SupabaseClient, channels, removed };
}

describe('subscribeLeagueSignals — الدورة الكاملة بتبعيات محقونة', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('بلا عميل أو بمعرف فاسد → off فوراً بلا قنوات وتنظيف آمن', () => {
    const statuses: LiveStatus[] = [];
    const d1 = subscribeLeagueSignals(LIGA, { onStatus: (s) => statuses.push(s) }, { getClient: () => null });
    d1();
    const d2 = subscribeLeagueSignals('not-a-uuid', { onStatus: (s) => statuses.push(s) }, {
      getClient: () => makeFakeClient().client,
    });
    d2();
    expect(statuses).toEqual(['off', 'off']);
  });

  it('يفتح قناة الرابطة ويسجّل الأحداث الأربعة ويصل live', () => {
    const { client, channels } = makeFakeClient();
    const statuses: LiveStatus[] = [];
    const dispose = subscribeLeagueSignals(LIGA, { onStatus: (s) => statuses.push(s) }, { getClient: () => client });
    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe(`${CHANNEL_PREFIX}${LIGA}`);
    expect([...channels[0].onCalls.map((c) => c.event)].sort()).toEqual([...SIGNAL_EVENTS].sort());
    for (const c of channels[0].onCalls) expect(c.type).toBe('broadcast');
    channels[0].subscribeCbs.forEach((cb) => cb('SUBSCRIBED'));
    expect(statuses).toEqual(['connecting', 'live']);
    dispose();
  });

  it('إشارة صالحة تصل مجمّعة (نبضة واحدة)؛ الفاسدة تُسقط بصمت', () => {
    const { client, channels } = makeFakeClient();
    const received: SignalEvent[] = [];
    const dispose = subscribeLeagueSignals(LIGA, { onSignal: (ev) => received.push(ev) }, { getClient: () => client });
    channels[0].subscribeCbs.forEach((cb) => cb('SUBSCRIBED'));
    const cb = channels[0].handlers.get('results_changed')!;
    cb({ event: 'results_changed', payload: { league_id: LIGA, competition_id: COMP } });
    cb({ event: 'results_changed', payload: { league_id: LIGA, competition_id: COMP } });
    cb({ event: 'results_changed', payload: { league_id: LIGA } });
    expect(received).toEqual([]); // داخل نافذة التجميع
    vi.advanceTimersByTime(850);
    expect(received).toEqual(['results_changed']);
    // إشارات فاسدة أو لا تعنينا: حدث غريب / league_id فاسد / رابطة أخرى على قناتنا / حمولة غير كائن
    cb({ event: 'hacked', payload: { league_id: LIGA } });
    cb({ event: 'results_changed', payload: { league_id: LIGB } }); // دفاع عمق: تُسقط
    channels[0].handlers.get('comps_changed')!({ event: 'comps_changed', payload: { league_id: 'bad' } });
    channels[0].handlers.get('comps_changed')!('garbage');
    vi.advanceTimersByTime(1000);
    expect(received).toEqual(['results_changed']);
    dispose();
  });

  it('فشل القناة → retrying ثم إعادة اشتراك قناة جديدة بعد 1s', () => {
    const { client, channels, removed } = makeFakeClient();
    const statuses: LiveStatus[] = [];
    const dispose = subscribeLeagueSignals(LIGA, { onStatus: (s) => statuses.push(s) }, { getClient: () => client });
    channels[0].subscribeCbs.forEach((cb) => cb('CHANNEL_ERROR'));
    expect(statuses[statuses.length - 1]).toBe('retrying');
    vi.advanceTimersByTime(1000);
    expect(removed).toHaveLength(1);
    expect(channels).toHaveLength(2);
    expect(channels[1].name).toBe(`${CHANNEL_PREFIX}${LIGA}`);
    channels[1].subscribeCbs.forEach((cb) => cb('SUBSCRIBED'));
    expect(statuses).toContain('live');
    dispose();
  });

  it('استنفاد المحاولات (6 فشل متتالٍ) → polling بلا مؤقتات إعادة اتصال', () => {
    const { client, channels } = makeFakeClient();
    const statuses: LiveStatus[] = [];
    const dispose = subscribeLeagueSignals(LIGA, { onStatus: (s) => statuses.push(s) }, { getClient: () => client });
    for (const delay of [1000, 2000, 4000, 8000, 16000]) {
      channels[channels.length - 1].subscribeCbs.forEach((cb) => cb('TIMED_OUT'));
      vi.advanceTimersByTime(delay);
    }
    channels[channels.length - 1].subscribeCbs.forEach((cb) => cb('TIMED_OUT'));
    expect(statuses[statuses.length - 1]).toBe('polling');
    expect(vi.getTimerCount()).toBe(0); // لا إعادة اتصال بعد الآن
    dispose();
  });

  it('نجاح بعد فشل يصفّر المحاولات (دورة جديدة كاملة)', () => {
    const { client, channels } = makeFakeClient();
    const statuses: LiveStatus[] = [];
    const dispose = subscribeLeagueSignals(LIGA, { onStatus: (s) => statuses.push(s) }, { getClient: () => client });
    channels[0].subscribeCbs.forEach((cb) => cb('CHANNEL_ERROR'));
    vi.advanceTimersByTime(1000);
    channels[1].subscribeCbs.forEach((cb) => cb('SUBSCRIBED'));
    expect(statuses).toContain('live');
    // فشل جديد يبدأ من المحاولة 1 (تأخير 1s لا 2s)
    channels[1].subscribeCbs.forEach((cb) => cb('TIMED_OUT'));
    vi.advanceTimersByTime(1000);
    expect(channels).toHaveLength(3);
    dispose();
  });

  it('الصفحة المخفية لا تفتح اتصالاً؛ العودة إليها تشترك فوراً', () => {
    let hidden = true;
    const visCbs: (() => void)[] = [];
    const { client, channels } = makeFakeClient();
    const statuses: LiveStatus[] = [];
    const dispose = subscribeLeagueSignals(LIGA, { onStatus: (s) => statuses.push(s) }, {
      getClient: () => client,
      isHidden: () => hidden,
      onVisibility: (cb) => { visCbs.push(cb); return () => undefined; },
    });
    expect(channels).toHaveLength(0);
    expect(statuses[statuses.length - 1]).toBe('off');
    hidden = false;
    visCbs.forEach((cb) => cb());
    expect(channels).toHaveLength(1);
    expect(statuses[statuses.length - 1]).toBe('connecting');
    dispose();
  });

  it('التنظيف يزيل القناة ويصل off ويسكّت الإشارات اللاحقة بأمان', () => {
    const { client, channels, removed } = makeFakeClient();
    const statuses: LiveStatus[] = [];
    let signals = 0;
    const dispose = subscribeLeagueSignals(
      LIGA,
      { onStatus: (s) => statuses.push(s), onSignal: () => { signals++; } },
      { getClient: () => client }
    );
    channels[0].subscribeCbs.forEach((cb) => cb('SUBSCRIBED'));
    dispose();
    expect(removed).toHaveLength(1);
    expect(statuses[statuses.length - 1]).toBe('off');
    // إشارة بعد التنظيف → تُتجاهل بلا أثر
    channels[0].handlers.get('comps_changed')?.({ event: 'comps_changed', payload: { league_id: LIGA } });
    vi.advanceTimersByTime(2000);
    expect(signals).toBe(0);
  });
});

// ═══ 7) اتساق i18n ═══

describe('i18n — مفاتيح الإشارات اللحظية', () => {
  it('كل مفاتيح المرحلة 7 موجودة في اللغتين وغير فارغة', () => {
    const keys: (keyof typeof ar)[] = ['rt_live', 'rt_connecting', 'rt_retrying', 'rt_polling'];
    for (const k of keys) {
      expect(ar[k]).toBeTruthy();
      expect(fr[k]).toBeTruthy();
    }
  });

  it('كل مفتاح يشارة liveBadge مفهوم في القاموسين', () => {
    for (const st of ['live', 'connecting', 'retrying', 'polling'] as LiveStatus[]) {
      const b = liveBadge(st);
      if (b) {
        expect(ar[b.labelKey]).toBeTruthy();
        expect(fr[b.labelKey]).toBeTruthy();
      }
    }
  });
});
