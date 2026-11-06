/**
 * اختبارات المرحلة 6 — النشر السحابي للنتائج (Competition Mode → السحابة)
 * ======================================================================
 * 1. الدوال النقية: formatMarkMs / rankingStatusToResultStatus /
 *    canPublishCompetition / canPublishResults
 * 2. المطابقة الحاكمة mapRunnersToResultRows: رقم الصدر، غير المطابق،
 *    التكرار، الترتيب، اللقطات
 * 3. تجميع النتائج العمومية groupResultsByCompetition
 * 4. الأوفلاين أولاً: كاش النتائج العمومية مع localStorage وهمي
 * 5. اتساق مفاتيح i18n للمرحلة 6 (عربي/فرنسي)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  formatMarkMs,
  rankingStatusToResultStatus,
  canPublishCompetition,
  canPublishResults,
  mapRunnersToResultRows,
  groupResultsByCompetition,
  fetchLeaguePublishedResults,
  lastResultsCacheAt,
  type FinisherRow,
  type PublicResultRow,
  type RegistrableRow,
  type ResultRowInput,
} from '../src/services/resultsCloudService';
import { ar, fr } from '../src/i18n/dictionaries';

const LIGA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COMP = 'd1111111-1111-4111-8111-111111111111';
const EV1 = 'e1111111-1111-4111-8111-111111111111';
const REG1 = '1a111111-1111-4111-8111-111111111111';
const REG2 = '1a222222-2222-4222-8222-222222222222';
const REG3 = '1a333333-3333-4333-8333-333333333333';

const ctx = { leagueId: LIGA, competitionId: COMP, eventId: EV1, publishedBy: 'user-1' };

// ═══ 1) الدوال النقية ═══

describe('formatMarkMs — صيغة الأزمنة القياسية', () => {
  it('أقل من دقيقة → ثوانٍ بمنزلتين', () => {
    expect(formatMarkMs(10234)).toBe('10.23');
    // 59.999 تقريب منزليّن → 60.00 — عرف التوقيت الرياضيد (لا يعرض 59.99×)
    expect(formatMarkMs(59999)).toBe('1:00.00');
    expect(formatMarkMs(9)).toBe('0.01');
  });

  it('دقيقة أو أكثر → M:SS.hh', () => {
    expect(formatMarkMs(60000)).toBe('1:00.00');
    expect(formatMarkMs(63400)).toBe('1:03.40');
    // 59:59.999 التقريب → ساعة كاملة
    expect(formatMarkMs(3599999)).toBe('1:00:00.00');
  });

  it('ساعة أو أكثر → H:MM:SS.hh', () => {
    expect(formatMarkMs(3600000)).toBe('1:00:00.00');
    expect(formatMarkMs(3661500)).toBe('1:01:01.50');
  });

  it('قيم غير صالحة → «—»', () => {
    expect(formatMarkMs(0)).toBe('—');
    expect(formatMarkMs(-5)).toBe('—');
    expect(formatMarkMs(Number.NaN)).toBe('—');
    expect(formatMarkMs(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('تحويلات الحالة والدور', () => {
  it('rankingStatusToResultStatus', () => {
    expect(rankingStatusToResultStatus('finished')).toBe('ok');
    expect(rankingStatusToResultStatus('active')).toBe('ok');
    expect(rankingStatusToResultStatus('dnf')).toBe('dnf');
    expect(rankingStatusToResultStatus('dq')).toBe('dq');
    expect(rankingStatusToResultStatus('dns')).toBe('dns');
    expect(rankingStatusToResultStatus('مجهول')).toBe('ok');
  });

  it('canPublishCompetition — جارية/منتهية فقط', () => {
    expect(canPublishCompetition('running')).toBe(true);
    expect(canPublishCompetition('finished')).toBe(true);
    expect(canPublishCompetition('results_published')).toBe(false);
    expect(canPublishCompetition('draft')).toBe(false);
    expect(canPublishCompetition(null)).toBe(false);
    expect(canPublishCompetition('')).toBe(false);
  });

  it('canPublishResults — التنفيذي وأمين النتائج حصراً (مرآة الخادم)', () => {
    expect(canPublishResults('executive_manager')).toBe(true);
    expect(canPublishResults('results_clerk')).toBe(true);
    expect(canPublishResults('tech_manager')).toBe(false);
    expect(canPublishResults('secretary')).toBe(false);
    expect(canPublishResults(null)).toBe(false);
    expect(canPublishResults('')).toBe(false);
  });
});

// ═══ 2) المطابقة الحاكمة ═══

function reg(id: string, bib: number | null, name: string, code: string): RegistrableRow {
  const [first_name, ...rest] = name.split(' ');
  return {
    id,
    bib_number: bib,
    athlete_id: `f0000000-0000-4000-8000-${id.slice(0, 12).padEnd(12, '0')}`,
    club_id: 'c1111111-1111-4111-8111-111111111111',
    athletes: { first_name, last_name: rest.join(' ') },
    clubs: { code, name_ar: 'نادي' },
  };
}

describe('mapRunnersToResultRows — المطابقة برقم الصدر', () => {
  const regs: RegistrableRow[] = [
    reg(REG1, 7, 'كريم بن عيسى', 'CA1'),
    reg(REG2, 12, 'سارة حمداني', 'CA2'),
    reg(REG3, 33, 'يوسف زروقي', 'CB1'),
  ];

  it('مطابقة كاملة: ترتيب حسب الزمن + مواقع تسلسلية + لقطات الاسم والنادي', () => {
    const runners: FinisherRow[] = [
      { bib: 12, name: 'Sara H.', finishTime: 11450 },
      { bib: 7, name: 'Karim B.', finishTime: 10234 },
      { bib: 33, name: 'Yacine Z.', finishTime: 12980 },
    ];
    const m = mapRunnersToResultRows(runners, regs, ctx);
    expect(m.unmatched).toEqual([]);
    expect(m.rows.map((r) => r.position)).toEqual([1, 2, 3]);
    // الأسرع أولاً رغم ترتيب الإدخال
    expect(m.rows[0].registration_id).toBe(REG1);
    expect(m.rows[0].mark_ms).toBe(10234);
    expect(m.rows[0].mark_text).toBe('10.23');
    // اللقطات من التسجيل المعتمد (ليس من المنصّة المحلية)
    expect(m.rows[0].athlete_name).toBe('كريم بن عيسى');
    expect(m.rows[0].club_code).toBe('CA1');
    expect(m.rows[1].athlete_name).toBe('سارة حمداني');
    // السياق والنشر
    expect(m.rows.every((r) => r.league_id === LIGA && r.competition_id === COMP && r.event_id === EV1)).toBe(true);
    expect(m.rows.every((r) => r.published_by === 'user-1')).toBe(true);
    expect(m.rows.every((r) => r.source === 'photo_finish' && r.status === 'ok')).toBe(true);
  });

  it('صدر بلا تسجيل → unmatched ولا يُنشر', () => {
    const runners: FinisherRow[] = [
      { bib: 7, name: 'كريم', finishTime: 10234 },
      { bib: 99, name: 'غريب', finishTime: 11000 },
    ];
    const m = mapRunnersToResultRows(runners, regs, ctx);
    expect(m.rows).toHaveLength(1);
    expect(m.unmatched).toEqual([{ bib: 99, name: 'غريب' }]);
    // المواقع تبقى تسلسلية على المنشور فقط
    expect(m.rows[0].position).toBe(1);
  });

  it('صدر مكرر → الأسرع يفوز بالمقعد والتكرار يُهمل (قيد فريد خادمياً)', () => {
    const runners: FinisherRow[] = [
      { bib: 7, name: 'كريم-بطيء', finishTime: 12000 },
      { bib: 7, name: 'كريم-سريع', finishTime: 10234 },
    ];
    const m = mapRunnersToResultRows(runners, regs, ctx);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].mark_ms).toBe(10234);
    expect(m.rows[0].athlete_name).toBe('كريم بن عيسى');
  });

  it('من لا زمن له (0) يُستبعد من النشر', () => {
    const runners: FinisherRow[] = [
      { bib: 7, name: 'كريم', finishTime: 10234 },
      { bib: 12, name: 'سارة', finishTime: 0 },
    ];
    const m = mapRunnersToResultRows(runners, regs, ctx);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].registration_id).toBe(REG1);
  });

  it('مدخلات فارغة/غير معرفة آمنة', () => {
    expect(mapRunnersToResultRows([], regs, ctx).rows).toEqual([]);
    const m = mapRunnersToResultRows([{ bib: 7, name: 'كريم', finishTime: 1000 }], [], ctx);
    expect(m.rows).toEqual([]);
    expect(m.unmatched).toEqual([{ bib: 7, name: 'كريم' }]);
    // تسجيل بلا صدر يُهمل في الفهرس
    const m2 = mapRunnersToResultRows([{ bib: 7, name: 'كريم', finishTime: 1000 }], [reg(REG1, null, 'بلا صدر', 'CA1')], ctx);
    expect(m2.rows).toEqual([]);
    expect(m2.unmatched).toHaveLength(1);
  });
});

// ═══ 3) تجميع النتائج العمومية ═══

function pubRow(over: Partial<PublicResultRow>): PublicResultRow {
  return {
    id: 'r1',
    event_id: EV1,
    competition_id: COMP,
    league_id: LIGA,
    bib_number: 7,
    athlete_name: 'كريم بن عيسى',
    club_code: 'CA1',
    position: 1,
    mark_text: '10.23',
    mark_ms: 10234,
    status: 'ok',
    source: 'photo_finish',
    discipline: '100m',
    gender: 'M',
    category: 'elite',
    title_ar: 'تظاهرة أ',
    title_fr: 'Comp A',
    venue: 'ملعب أ',
    start_date: '2026-11-01',
    end_date: '2026-11-01',
    ...over,
  };
}

describe('groupResultsByCompetition — تجميع وترتيب', () => {
  it('يجمع حسب التظاهرة ثم الاختصاص ويرتب بالمراكز', () => {
    const rows = [
      pubRow({ id: 'r2', position: 2, event_id: EV1 }),
      pubRow({ id: 'r1', position: 1, event_id: EV1 }),
      pubRow({ id: 'r3', position: null, event_id: EV1 }),
    ];
    const g = groupResultsByCompetition(rows);
    expect(g).toHaveLength(1);
    expect(g[0].competition.id).toBe(COMP);
    expect(g[0].events).toHaveLength(1);
    expect(g[0].events[0].rows.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
  });

  it('التظاهرات الأحدث نهايةً أولاً + اختصاصات متعددة', () => {
    const rows = [
      pubRow({ id: 'old', competition_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', end_date: '2026-10-01' }),
      pubRow({ id: 'new', end_date: '2026-12-01', event_id: 'e9999999-9999-4999-8999-999999999999', discipline: '200m' }),
      pubRow({ id: 'new2', end_date: '2026-12-01', event_id: 'e8888888-8888-4888-8888-888888888888', discipline: '800m' }),
    ];
    const g = groupResultsByCompetition(rows);
    expect(g[0].competition.id).toBe(COMP);
    expect(g[0].events.map((e) => e.discipline)).toEqual(['200m', '800m']);
  });

  it('قوائم فارغة/undefined آمنة', () => {
    expect(groupResultsByCompetition([])).toEqual([]);
    expect(groupResultsByCompetition(undefined as unknown as PublicResultRow[])).toEqual([]);
  });
});

// ═══ 4) الأوفلاين أولاً — كاش النتائج العمومية ═══

describe('fetchLeaguePublishedResults — كاش محلي (بلا Supabase)', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('يقرأ الكاش لكل رابطة على حدة ويعيد fromCache=true', async () => {
    const rows = [pubRow({})];
    store.set(`pf_public_results_v1:${LIGA}`, JSON.stringify({ at: 1700000000000, rows }));
    const res = await fetchLeaguePublishedResults(LIGA);
    expect(res.fromCache).toBe(true);
    expect(res.error).toBeNull();
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].mark_text).toBe('10.23');
    expect(lastResultsCacheAt(LIGA)).toBe(1700000000000);
    // رابطة أخرى → مفتاح معزول
    const other = await fetchLeaguePublishedResults('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(other.rows).toEqual([]);
  });

  it('بلا كاش → قائمة فارغة بلا خطأ (وضع أوفلاين صالح)', async () => {
    const res = await fetchLeaguePublishedResults(LIGA);
    expect(res).toEqual({ rows: [], fromCache: true, error: null });
  });

  it('كاش تالف (JSON مكسور) لا يُسقط القراءة', async () => {
    store.set(`pf_public_results_v1:${LIGA}`, '{broken');
    const res = await fetchLeaguePublishedResults(LIGA);
    expect(res.rows).toEqual([]);
    expect(res.fromCache).toBe(true);
  });
});

// ═══ 5) اتساق مفاتيح i18n للمرحلة 6 ═══

describe('i18n — مفاتيح النشر السحابي', () => {
  it('كل مفاتيح المرحلة 6 موجودة في اللغتين وغير فارغة', () => {
    const keys: (keyof typeof ar)[] = [
      'rp_title', 'rp_subtitle', 'rp_sign_in_hint', 'rp_need_signin',
      'rp_pick_league', 'rp_pick_competition', 'rp_pick_event', 'rp_loading',
      'rp_no_competitions', 'rp_no_events', 'rp_no_registrations',
      'rp_match_summary', 'rp_unmatched_title', 'rp_publish', 'rp_publishing',
      'rp_publish_ok', 'rp_publish_partial', 'rp_close_event', 'rp_close_event_ok',
      'rp_finalize', 'rp_finalize_ok', 'rp_empty_finishers',
      'res_status_ok', 'res_status_dq', 'res_status_dnf', 'res_status_dns',
      'res_source_photo_finish', 'res_source_multi_judge', 'res_source_cross_country',
      'res_source_manual', 'site_results_title', 'site_results_empty',
    ];
    for (const k of keys) {
      expect(ar[k]).toBeTruthy();
      expect(fr[k]).toBeTruthy();
    }
  });

  it('المتغيرات القابلة للاستبدال {count}/{matched}/{unmatched} موجودة في اللغتين', () => {
    expect(ar.rp_publish_ok).toContain('{count}');
    expect(fr.rp_publish_ok).toContain('{count}');
    expect(ar.rp_match_summary).toContain('{matched}');
    expect(fr.rp_match_summary).toContain('{unmatched}');
  });
});

// فحص شكلي: النتائج المرفوعة لا تحمل حقولاً فارغة إلزامية (تحذير تجميعي للفريق)
describe('ResultRowInput — سلامة الصف المرفوع', () => {
  it('كل صف يحمل سياقاً كاملاً ونص زمن متسقاً مع mark_ms', () => {
    const rows: ResultRowInput[] = mapRunnersToResultRows(
      [{ bib: 7, name: 'كريم', finishTime: 10234 }],
      [reg(REG1, 7, 'كريم بن عيسى', 'CA1')],
      ctx,
    ).rows;
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.registration_id).toBe(REG1);
    expect(r.league_id && r.competition_id && r.event_id).toBeTruthy();
    expect(r.mark_text).toBe(formatMarkMs(r.mark_ms));
    expect(r.position).toBeGreaterThanOrEqual(1);
  });
});
