/**
 * اختبارات المرحلة 3 — الموقع العمومي
 * ===================================
 * 1. resolveEntry: حسم شاشة الدخول (حماية QR الهواتف و‎?admin‎ القديمة)
 * 2. طبقة publicApi النقية: اختيار العنوان اللغوي، التجميع الزمني، التواريخ
 * 3. سلوك التخزين المحلي (أوفلاين أولاً) مع localStorage وهمي
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  resolveEntry,
  isUuid,
  type EntryResolution,
} from '../src/services/entryResolver';
import {
  pickTitle,
  groupCompetitionsByStatus,
  todayIso,
  formatDmy,
  fetchPublicLeagues,
  fetchPublicLeagueById,
  fetchPublicCompetitions,
  lastCacheAt,
  type PublicCompetitionRow,
  type PublicLeagueRow,
} from '../src/services/publicApi';
import { ar, fr } from '../src/i18n/dictionaries';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

// ═══ 1) حسم شاشة الدخول ═══

describe('resolveEntry — حماية السلوك القديم أولاً', () => {
  it('?admin يفوز على كل شيء (بوابة المنصة كالقديم)', () => {
    expect(resolveEntry(`#/league/${UUID_A}`, '?admin')).toEqual({ screen: 'admin', leagueId: null });
    expect(resolveEntry('', '?admin&role=finish')).toEqual({ screen: 'admin', leagueId: null });
  });

  it('?role أو ?room → وضع المنافسة (أكواد QR للهواتف محفوظة حرفياً)', () => {
    expect(resolveEntry('', '?role=finish&room=ABC123')).toEqual({ screen: 'compete', leagueId: null });
    expect(resolveEntry('', '?room=ABC')).toEqual({ screen: 'compete', leagueId: null });
    // حتى لو كان hash يشير لرابطة — معاملات الهواتف أقوى
    expect(resolveEntry(`#/league/${UUID_A}`, '?role=judge')).toEqual({ screen: 'compete', leagueId: null });
  });

  it('#/league/:id صالح → صفحة الرابطة مع المعرف', () => {
    const res: EntryResolution = resolveEntry(`#/league/${UUID_B}`, '');
    expect(res.screen).toBe('league');
    expect(res.leagueId).toBe(UUID_B);
    // بلا # أو بمسافة — تطبيع شامل
    expect(resolveEntry(`league/${UUID_B}`, '').leagueId).toBe(UUID_B);
    expect(resolveEntry(`#/league/${UUID_B}/`, '').screen).toBe('league');
  });

  it('#/league/:id بمعرف مشوه → موقع عمومي (حماية)', () => {
    expect(resolveEntry('#/league/not-a-uuid', '').screen).toBe('public-home');
    expect(resolveEntry('#/league/../../etc', '').screen).toBe('public-home');
    expect(resolveEntry(`#/league/${'x'.repeat(36)}`, '').screen).toBe('public-home');
  });

  it('#/compete → وضع المنافسة صراحة', () => {
    expect(resolveEntry('#/compete', '')).toEqual({ screen: 'compete', leagueId: null });
    expect(resolveEntry('compete', '')).toEqual({ screen: 'compete', leagueId: null });
  });

  it('الفراغ و#/ والمسارات المجهولة → الموقع العمومي', () => {
    expect(resolveEntry('', '')).toEqual({ screen: 'public-home', leagueId: null });
    expect(resolveEntry('#', '')).toEqual({ screen: 'public-home', leagueId: null });
    expect(resolveEntry('#/', '')).toEqual({ screen: 'public-home', leagueId: null });
    expect(resolveEntry('#/whatever', '')).toEqual({ screen: 'public-home', leagueId: null });
  });
});

describe('isUuid', () => {
  it('يقبل UUID قياسي ويرفض غيره', () => {
    expect(isUuid(UUID_A)).toBe(true);
    expect(isUuid(UUID_A.toUpperCase())).toBe(true);
    expect(isUuid('')).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid('abc')).toBe(false);
    expect(isUuid('11111111-1111-1111-1111-11111111111z')).toBe(false);
  });
});

// ═══ 2) دوال publicApi النقية ═══

const leagueRow = (over: Partial<PublicLeagueRow> = {}): PublicLeagueRow => ({
  id: UUID_A,
  name_ar: 'رابطة الجزائر',
  name_fr: 'Ligue d\'Alger',
  wilaya: 'الجزائر',
  code: 'ALG-16',
  logo_url: null,
  colors: {},
  ...over,
});

const compRow = (over: Partial<PublicCompetitionRow> = {}): PublicCompetitionRow => ({
  id: UUID_B,
  league_id: UUID_A,
  title_ar: 'بطولة الربيع',
  title_fr: 'Championnat du Printemps',
  type: 'track',
  venue: 'ملعب 5 جويلية',
  start_date: '2026-03-10',
  end_date: '2026-03-12',
  status: 'published',
  registration_deadline: null,
  ...over,
});

describe('pickTitle — الاختيار اللغوي مع سقوط آمن', () => {
  it('عربي افتراضياً وفرنسي عند الطلب', () => {
    expect(pickTitle(leagueRow(), 'ar')).toBe('رابطة الجزائر');
    expect(pickTitle(leagueRow(), 'fr')).toBe('Ligue d\'Alger');
  });

  it('فرنسي بلا ترجمة → سقوط إلى العربي', () => {
    expect(pickTitle(leagueRow({ name_fr: null }), 'fr')).toBe('رابطة الجزائر');
    expect(pickTitle(leagueRow({ name_fr: '  ' }), 'fr')).toBe('رابطة الجزائر');
  });

  it('تظاهرات: title_ar/title_fr', () => {
    expect(pickTitle(compRow(), 'ar')).toBe('بطولة الربيع');
    expect(pickTitle(compRow(), 'fr')).toBe('Championnat du Printemps');
    expect(pickTitle(compRow({ title_ar: '', title_fr: null }), 'fr')).toBe('—');
  });
});

describe('groupCompetitionsByStatus — التجميع الزمني', () => {
  const TODAY = '2026-11-07';

  it('running → الجارية', () => {
    const g = groupCompetitionsByStatus([compRow({ status: 'running' })], TODAY);
    expect(g.running).toHaveLength(1);
    expect(g.upcoming).toHaveLength(0);
    expect(g.finished).toHaveLength(0);
  });

  it('finished وresults_published → المنتهية', () => {
    const g = groupCompetitionsByStatus(
      [compRow({ status: 'finished' }), compRow({ status: 'results_published' })],
      TODAY
    );
    expect(g.finished).toHaveLength(2);
  });

  it('منشورة/تسجيل مفتوح/مغلق/مجمدة بتاريخ مستقبلي → القادمة', () => {
    const g = groupCompetitionsByStatus(
      [
        compRow({ status: 'published', end_date: '2026-12-20' }),
        compRow({ status: 'registration_open', end_date: '2026-12-21' }),
        compRow({ status: 'registration_closed', end_date: '2026-12-22' }),
        compRow({ status: 'frozen', end_date: '2026-12-23' }),
      ],
      TODAY
    );
    expect(g.upcoming).toHaveLength(4);
  });

  it('مجمدة انتهى تقويمها دون اعتماد نتائج → تعرض منتهية', () => {
    const g = groupCompetitionsByStatus(
      [compRow({ status: 'frozen', end_date: '2026-01-01' })],
      TODAY
    );
    expect(g.finished).toHaveLength(1);
    expect(g.upcoming).toHaveLength(0);
  });

  it('الترتيب: القادمة بأبكر بداية، المنتهية بأحدث نهاية', () => {
    const g = groupCompetitionsByStatus(
      [
        compRow({ id: 'b', start_date: '2026-12-02', end_date: '2026-12-03', status: 'published' }),
        compRow({ id: 'a', start_date: '2026-11-20', end_date: '2026-11-21', status: 'published' }),
        compRow({ id: 'x', start_date: '2026-01-10', end_date: '2026-01-11', status: 'finished' }),
        compRow({ id: 'y', start_date: '2026-02-10', end_date: '2026-02-28', status: 'results_published' }),
      ],
      TODAY
    );
    expect(g.upcoming.map((c) => c.id)).toEqual(['a', 'b']);
    expect(g.finished.map((c) => c.id)).toEqual(['y', 'x']);
  });

  it('قوائم فارغة/undefined آمنة', () => {
    expect(groupCompetitionsByStatus([], TODAY).upcoming).toEqual([]);
    expect(groupCompetitionsByStatus(undefined as unknown as PublicCompetitionRow[], TODAY).running).toEqual([]);
  });
});

describe('formatDmy وtodayIso', () => {
  it('تنسيق التاريخ DD/MM/YYYY', () => {
    expect(formatDmy('2026-11-07')).toBe('07/11/2026');
    expect(formatDmy('2026-11-07T14:30:00Z')).toBe('07/11/2026'); // يقبل timestamptz
    expect(formatDmy(null)).toBe('—');
    expect(formatDmy('')).toBe('—');
    expect(formatDmy('غير تاريخ')).toBe('غير تاريخ');
  });

  it('todayIso بصيغة YYYY-MM-DD', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ═══ 3) الأوفلاين أولاً — سلوك التخزين المحلي ═══

describe('publicApi — بلا Supabase: قراءة من المخزن المحلي', () => {
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

  it('fetchPublicLeagues يقرأ الكاش ويعيد fromCache=true', async () => {
    const rows = [leagueRow()];
    store.set('pf_public_leagues_v1', JSON.stringify({ at: 1700000000000, rows }));
    const res = await fetchPublicLeagues();
    expect(res.fromCache).toBe(true);
    expect(res.error).toBeNull();
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].code).toBe('ALG-16');
    expect(lastCacheAt('leagues')).toBe(1700000000000);
  });

  it('fetchPublicLeagues بلا كاش → قائمة فارغة بلا خطأ (وضع أوفلاين صالح)', async () => {
    const res = await fetchPublicLeagues();
    expect(res).toEqual({ rows: [], fromCache: true, error: null });
  });

  it('fetchPublicLeagueById يجد الرابطة في كاش القوائم', async () => {
    const rows = [leagueRow(), leagueRow({ id: UUID_B, code: 'ORO-31' })];
    store.set('pf_public_leagues_v1', JSON.stringify({ at: Date.now(), rows }));
    const res = await fetchPublicLeagueById(UUID_B);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].code).toBe('ORO-31');
    // غير موجودة → فارغة بلا انفجار
    const miss = await fetchPublicLeagueById('99999999-9999-4999-8999-999999999999');
    expect(miss.rows).toEqual([]);
  });

  it('fetchPublicCompetitions يفصل كاش كل رابطة', async () => {
    const rows = [compRow()];
    store.set(`pf_public_comps_v1:${UUID_A}`, JSON.stringify({ at: Date.now(), rows }));
    const hit = await fetchPublicCompetitions(UUID_A);
    expect(hit.rows).toHaveLength(1);
    const other = await fetchPublicCompetitions(UUID_B);
    expect(other.rows).toEqual([]);
    // بلا معرف → مفتاح 'all' مختلف
    const all = await fetchPublicCompetitions();
    expect(all.rows).toEqual([]);
  });

  it('كاش تالف (JSON مكسور) لا يُسقط القراءة', async () => {
    store.set('pf_public_leagues_v1', '{broken json');
    const res = await fetchPublicLeagues();
    expect(res.rows).toEqual([]);
    expect(res.fromCache).toBe(true);
  });
});

// ═══ 4) اتساق القواميس بعد إضافة مفاتيح المرحلة 3 ═══

describe('i18n — مفاتيح الموقع العمومي', () => {
  it('تطابق كامل بين العربية والفرنسية', () => {
    const arKeys = Object.keys(ar);
    const frKeys = Object.keys(fr);
    expect(frKeys.length).toBe(arKeys.length);
    for (const k of arKeys) {
      expect(fr).toHaveProperty(k);
      expect(typeof fr[k as keyof typeof fr]).toBe('string');
      expect((fr[k as keyof typeof fr] as string).length).toBeGreaterThan(0);
    }
  });

  it('كل مفاتيح المرحلة 3 الجديدة موجودة في اللغتين', () => {
    const newKeys = [
      'site_hero_title', 'site_hero_subtitle', 'site_cta_compete', 'site_cta_explore',
      'site_leagues_subtitle', 'site_retry', 'site_error_load', 'site_offline_cached',
      'site_last_update', 'site_empty_leagues', 'site_empty_leagues_hint', 'site_footer',
      'site_chip_offline', 'site_chip_timing', 'site_chip_live',
      'league_no_comps', 'league_not_found',
      'comp_status_published', 'comp_status_registration_open', 'comp_status_frozen',
      'comp_status_results_published', 'comp_venue', 'comp_from', 'comp_to',
    ] as const;
    for (const k of newKeys) {
      expect(ar).toHaveProperty(k);
      expect(fr).toHaveProperty(k);
    }
  });
});
