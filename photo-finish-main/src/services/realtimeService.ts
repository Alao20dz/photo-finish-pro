/**
 * Photo Finish Pro — خدمة الإشارات اللحظية (Realtime Signals Service)
 * ===================================================================
 * المرحلة 7: بثّ «إشارات تغيّر» من قاعدة البيانات إلى الواجهات عبر
 * Supabase Realtime Broadcast (realtime.send من مشغّلات خادمية — تهجير 0010).
 *
 * المبدأ الأمني: الإشارة تحمل معرفات حصراً (league_id/competition_id) —
 * صفر بيانات مستخدم. عند الإشارة تُعيد الشاشة الجلب عبر قراءات RLS/Views
 * القائمة (المصدر الواحد للحقيقة — نفس مسار «أوفلاين أولاً»).
 *
 * الاتصال:
 *  • قناة لكل رابطة: pf:league:{uuid} — أحداث:
 *      clubs_changed / comps_changed / regs_changed / results_changed
 *  • نبضات متكررة (نشر دفعي مثلاً) تُجمَّع (debounce) في نداء واحد لكل نوع.
 *  • فشل الاتصال → إعادة محاولة بتراجع أسّي (1s→30s) حتى 5 محاولات،
 *    بعدها تتحول الشاشة إلى تحديث دوري خفيف (polling fallback).
 *  • التبويب المخفي لا يستهلك شيئاً؛ العودة إليه تعيد الاشتراك فوراً.
 *  • التبعيات قابلة للحقن (العميل/المؤقتات/الرؤية) → منطق قابل للاختبار
 *    دون شبكة ودون DOM.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { DictKey } from '../i18n/dictionaries';
import { getSupabase } from './supabaseClient';

// ═══ الأنواع والثوابت ═══

/** أنواع الإشارات الصادرة من مشغّلات تهجير 0010 (أسماء ملزمة) */
export type SignalEvent =
  | 'clubs_changed'
  | 'comps_changed'
  | 'regs_changed'
  | 'results_changed';

export const SIGNAL_EVENTS: readonly SignalEvent[] = [
  'clubs_changed',
  'comps_changed',
  'regs_changed',
  'results_changed',
];

/** حالات القناة كما تعرضها الواجهة */
export type LiveStatus = 'off' | 'connecting' | 'live' | 'retrying' | 'polling';

/** بادئة قناة الرابطة — مطابقة لـ v_topic في مشغّل 0010 */
export const CHANNEL_PREFIX = 'pf:league:';

/** أقصى فاصل للتحديث الدوري الاحتياطي (وضع polling) */
export const POLL_INTERVAL_MS = 60_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** إشارة موحّدة بعد التحقق (لا تصل الواجهة إلا صالحة) */
export interface LeagueSignal {
  event: SignalEvent;
  leagueId: string;
  competitionId: string | null;
  /** وقت الاستقبال محلياً (ms منذ epoch) */
  at: number;
}

// ═══ دوال نقية ═══

/** اسم قناة الرابطة — يفرض UUID صالحاً (لا قنوات من مدخلات فاسدة) */
export function leagueChannelName(leagueId: string): string | null {
  const id = String(leagueId ?? '').trim().toLowerCase();
  return UUID_RE.test(id) ? `${CHANNEL_PREFIX}${id}` : null;
}

/**
 * تحليل رسالة بث واردة إلى إشارة صالحة — يعيد null عند أي شكّ
 * (حدث غير معروف / league_id غائب أو فاسد). competition_id الفاسد
 * يُهمل ويبقى مستوى الرابطة صالحاً (الإشارة أنفع من سقوطها كلياً).
 */
export function parseSignalPayload(
  event: string,
  raw: unknown,
  nowMs: number = Date.now()
): LeagueSignal | null {
  if (!SIGNAL_EVENTS.includes(event as SignalEvent)) return null;
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as Record<string, unknown>;
  const leagueId = typeof p.league_id === 'string' ? p.league_id.trim().toLowerCase() : '';
  if (!UUID_RE.test(leagueId)) return null;
  let competitionId: string | null = null;
  if (typeof p.competition_id === 'string' && UUID_RE.test(p.competition_id.trim().toLowerCase())) {
    competitionId = p.competition_id.trim().toLowerCase();
  }
  return { event: event as SignalEvent, leagueId, competitionId, at: nowMs };
}

// ═══ سياسة إعادة الاتصال (تراجع أسّي مُسقّف) ═══

export interface ReconnectPolicy {
  /** تأخير أول محاولة (ms) */
  baseMs: number;
  /** سقف التأخير (ms) */
  capMs: number;
  /** أقصى عدد محاولات متتالية — بعده وضع polling */
  maxRetries: number;
}

export const DEFAULT_RECONNECT: ReconnectPolicy = { baseMs: 1000, capMs: 30_000, maxRetries: 5 };

/**
 * تأخير المحاولة رقم attempt (يبدأ من 1): base×2^(n-1) مُسقّف بالسقف.
 * يعيد null بعد استنفاد المحاولات → الإشارة للتحول إلى polling.
 */
export function retryDelayMs(attempt: number, p: ReconnectPolicy = DEFAULT_RECONNECT): number | null {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > p.maxRetries) return null;
  return Math.min(p.baseMs * 2 ** (attempt - 1), p.capMs);
}

export interface ConnState {
  attempt: number;
  status: LiveStatus;
}

/**
 * تقليل حالة الاتصال من حادثة supabase-js الخام:
 *  SUBSCRIBED → live (تصفير المحاولات) | CHANNEL_ERROR/TIMED_OUT → retrying
 *  أو polling بعد استنفاد المحاولات | CLOSED → بلا تغيير (الإغلاق المتعمد
 *  يُدار من إلغاء الاشتراك، والبركة الأولية تبقى كما هي).
 */
export function applyChannelStatus(
  s: ConnState,
  rawStatus: string,
  p: ReconnectPolicy = DEFAULT_RECONNECT
): ConnState {
  switch (rawStatus) {
    case 'SUBSCRIBED':
      return { attempt: 0, status: 'live' };
    case 'CHANNEL_ERROR':
    case 'TIMED_OUT': {
      const attempt = s.attempt + 1;
      return retryDelayMs(attempt, p)
        ? { attempt, status: 'retrying' }
        : { attempt, status: 'polling' };
    }
    default:
      return s;
  }
}

// ═══ مُجمّع النبضات (debounce لكل نوع حدث) ═══

export interface DispatcherDeps {
  fire: (event: SignalEvent, signal: LeagueSignal) => void;
  delayMs: number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
}

export interface SignalDispatcher {
  push: (signal: LeagueSignal) => void;
  dispose: () => void;
}

/**
 * نشر متأخر trailing: عدة إشارات من النوع نفسه داخل النافذة →
 * نداء واحد بآخر إشارة. أنواع مختلفة لا تتداخل (لكل نوع مؤقته).
 */
export function createSignalDispatcher(deps: DispatcherDeps): SignalDispatcher {
  const pending = new Map<SignalEvent, { signal: LeagueSignal; timer: unknown }>();
  return {
    push(signal: LeagueSignal) {
      const prev = pending.get(signal.event);
      if (prev) deps.clearTimeout(prev.timer);
      const timer = deps.setTimeout(() => {
        pending.delete(signal.event);
        deps.fire(signal.event, signal);
      }, deps.delayMs);
      pending.set(signal.event, { signal, timer });
    },
    dispose() {
      for (const { timer } of pending.values()) deps.clearTimeout(timer);
      pending.clear();
    },
  };
}

// ═══ الشارة الحية (خريطة موحّدة للواجهات) ═══

export interface LiveBadge {
  tone: 'neutral' | 'success' | 'warning';
  labelKey: DictKey;
  pulse: boolean;
}

/** شارة الحالة للعرض — null عند off (لا تُعرض شارة) */
export function liveBadge(status: LiveStatus): LiveBadge | null {
  switch (status) {
    case 'live': return { tone: 'success', labelKey: 'rt_live', pulse: true };
    case 'connecting': return { tone: 'neutral', labelKey: 'rt_connecting', pulse: false };
    case 'retrying': return { tone: 'warning', labelKey: 'rt_retrying', pulse: false };
    case 'polling': return { tone: 'warning', labelKey: 'rt_polling', pulse: false };
    default: return null;
  }
}

// ═══ الاشتراك الحقيقي (تبعيات قابلة للحقن) ═══

export interface SignalHandlers {
  /** إشارة مجمّعة صالحة — النوع يحدد ماذا يُحدَّث */
  onSignal?: (event: SignalEvent, signal: LeagueSignal) => void;
  /** تغيّر حالة القناة (للشارة الحية) */
  onStatus?: (status: LiveStatus) => void;
}

export interface RealtimeDeps {
  getClient?: () => SupabaseClient | null;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (id: unknown) => void;
  /** مستمع تغيّر رؤية الصفحة — يعيد دالة إلغاء */
  onVisibility?: (cb: () => void) => () => void;
  isHidden?: () => boolean;
  reconnect?: Partial<ReconnectPolicy>;
  debounceMs?: number;
}

const defaultGetClient: () => SupabaseClient | null = () => getSupabase();
const defaultSetTimeout: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms);
const defaultClearTimeout: (id: unknown) => void = (id) => clearTimeout(id as NodeJS.Timeout);

function defaultIsHidden(): boolean {
  try {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
  } catch {
    return false;
  }
}

function defaultOnVisibility(cb: () => void): () => void {
  try {
    if (typeof document === 'undefined') return () => undefined;
    document.addEventListener('visibilitychange', cb);
    return () => document.removeEventListener('visibilitychange', cb);
  } catch {
    return () => undefined;
  }
}

interface BroadcastMessage {
  event?: unknown;
  payload?: unknown;
}

/**
 * الاشتراك في إشارات رابطة واحدة. يعيد دالة إيقاف كاملة التنظيف.
 * بلا عميل Supabase أو بمعرف فاسد → حالة off فوراً (وضع أوفلاين سليم).
 */
export function subscribeLeagueSignals(
  leagueId: string,
  handlers: SignalHandlers,
  deps: RealtimeDeps = {}
): () => void {
  const getClient = deps.getClient ?? defaultGetClient;
  const sched = deps.setTimeout ?? defaultSetTimeout;
  const unsched = deps.clearTimeout ?? defaultClearTimeout;
  const isHidden = deps.isHidden ?? defaultIsHidden;
  const onVisibility = deps.onVisibility ?? defaultOnVisibility;
  const policy: ReconnectPolicy = { ...DEFAULT_RECONNECT, ...(deps.reconnect ?? {}) };
  const debounceMs = deps.debounceMs ?? 800;

  const emit = (st: LiveStatus) => handlers.onStatus?.(st);
  const topic = leagueChannelName(leagueId);
  const client = topic ? getClient() : null;
  if (!client || !topic) {
    emit('off');
    return () => undefined;
  }

  let disposed = false;
  let state: ConnState = { attempt: 0, status: 'connecting' };
  let retryTimer: unknown = null;
  let channel: RealtimeChannel | null = null;

  const dispatcher = createSignalDispatcher({
    fire: (event, signal) => {
      if (!disposed) handlers.onSignal?.(event, signal);
    },
    delayMs: debounceMs,
    setTimeout: sched,
    clearTimeout: unsched,
  });

  const onBroadcast = (msg: BroadcastMessage) => {
    const ev = typeof msg?.event === 'string' ? msg.event : '';
    const sig = parseSignalPayload(ev, msg?.payload);
    // دفاع عمق: إشارة رابطة أخرى على قناتنا (خطأ خادمي نظرياً) تُسقط بصمت —
    // إعادة الجلب تبقى دائماً بمعرف رابطتنا من props لا من الحمولة.
    if (sig && sig.leagueId === leagueId.trim().toLowerCase()) dispatcher.push(sig);
  };

  const subscribe = () => {
    if (disposed || channel) return;
    if (isHidden()) {
      // الصفحة مخفية — لا اتصال الآن؛ العودة إليها تعيد المحاولة فوراً
      state = { attempt: state.attempt, status: 'off' };
      emit('off');
      return;
    }
    state = { attempt: state.attempt, status: 'connecting' };
    emit('connecting');
    channel = client!.channel(topic);
    for (const ev of SIGNAL_EVENTS) {
      channel.on('broadcast', { event: ev }, (msg: unknown) => onBroadcast(msg as BroadcastMessage));
    }
    channel.subscribe((rawStatus: string) => {
      if (disposed) return;
      state = applyChannelStatus(state, rawStatus, policy);
      emit(state.status);
      if (
        (rawStatus === 'CHANNEL_ERROR' || rawStatus === 'TIMED_OUT') &&
        state.status === 'retrying'
      ) {
        const delay = retryDelayMs(state.attempt, policy);
        if (delay == null) return; // polling — لا إعادة اتصال بعد الآن
        if (retryTimer !== null) unsched(retryTimer);
        retryTimer = sched(() => {
          retryTimer = null;
          resubscribe();
        }, delay);
      }
    });
  };

  const resubscribe = () => {
    if (disposed) return;
    if (channel) {
      try { client!.removeChannel(channel); } catch { /* تجاهل */ }
      channel = null;
    }
    subscribe();
  };

  const offVis = onVisibility(() => {
    if (disposed) return;
    if (isHidden()) return; // الإخفاء لا يفعل شيئاً (المحاولات تتفقد الرؤية ذاتياً)
    if (state.status !== 'live') resubscribe(); // العودة للظهور مع قناة غير حية → فوراً
  });

  subscribe();

  return () => {
    if (disposed) return;
    disposed = true;
    try { offVis?.(); } catch { /* */ }
    dispatcher.dispose();
    if (retryTimer !== null) unsched(retryTimer);
    retryTimer = null;
    if (channel) {
      try { client!.removeChannel(channel); } catch { /* */ }
      channel = null;
    }
    emit('off');
  };
}
