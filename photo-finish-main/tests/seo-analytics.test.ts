/**
 * اختبارات المرحلة 8 — تحسين الظهور (SEO) والتحليلات الخصوصية
 * ==========================================================
 * 1. بنّاؤو meta النقيون: الرئيسية/الرابطة + JSON-LD (SportsOrganization/SportsEvent/WebSite)
 * 2. applyMeta/applyRobots بمستند وهمي (DOM-optional — بلا تسريب عناصر)
 * 3. خدمة التحليلات: التطبيع، فئة الجهاز، مضيف المُحيل، DNT، مضاد التكرار
 * 4. الطابور المحلي: الحد الأقصى، الإرسال الناجح/الفاشل، الأوفلاين
 * 5. طبقة إحصاءات المدير: التجميع، تسمية المسارات، الكاش عند الفشل
 * 6. مولّد sitemap (نقي — بلا كتابة عند الاستيراد)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  SITE_NAME,
  buildHomeMeta,
  buildLeagueMeta,
  leagueJsonLd,
  sportsEventJsonLd,
  websiteJsonLd,
  applyMeta,
  applyRobots,
  shareUrl,
  type SeoDocument,
} from '../src/services/seoService';
import {
  normalizeTrackPath,
  deviceHint,
  referrerHost,
  dntAllowsTracking,
  isDuplicateView,
  wouldBeDuplicateView,
  resetViewDedupe,
  enqueueEvent,
  readQueue,
  flushQueue,
  track,
  toAnalyticsRow,
  fetchLeagueAnalytics,
  pathLabelKey,
  summarizeDaily,
  MAX_QUEUE,
  type SupabaseLike,
  type DailyRow,
} from '../src/services/analyticsService';
import { generateSitemapXml } from '../scripts/generate-sitemap.mjs';
import { ar, fr } from '../src/i18n/dictionaries';

const UUID_A = '11111111-1111-4111-8111-111111111111';

// ═══ محفزات ═══

const leagueRow = () => ({
  id: UUID_A,
  name_ar: 'رابطة الجزائر لألعاب القوى',
  name_fr: 'Ligue d\'Alger d\'athlétisme',
  wilaya: 'الجزائر',
  code: 'ALG-16',
  logo_url: null,
  colors: null,
});

const compRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'c-1',
  league_id: UUID_A,
  title_ar: 'بطولة الربيع',
  title_fr: 'Championnat du Printemps',
  type: 'track',
  venue: 'ملعب 5 جويلية',
  start_date: '2026-12-10',
  end_date: '2026-12-11',
  status: 'registration_open',
  registration_deadline: null,
  ...over,
});

// ═══ 1) بنّاؤو meta ═══

describe('buildHomeMeta — الرئيسية', () => {
  it('العنوان يجمع اسم المنصة وعنوان البطل (عربي)', () => {
    const m = buildHomeMeta(3, 'ar');
    expect(m.title).toBe(`${SITE_NAME} — ${ar.site_hero_title}`);
    expect(m.description).toContain(ar.site_hero_subtitle);
    expect(m.canonicalPath).toBe('/');
    expect(m.ogType).toBe('website');
  });

  it('الوصف يذكر عدد الرابطات عندما توجد، ولا يذكره عند الصفر', () => {
    expect(buildHomeMeta(5, 'ar').description).toContain('5');
    expect(buildHomeMeta(0, 'fr').description).not.toContain('0');
  });

  it('JSON-LD للرئيسية = WebSite باسم المنصة', () => {
    const m = buildHomeMeta(0, 'fr');
    expect(m.jsonLd).toHaveLength(1);
    expect(m.jsonLd[0]['@type']).toBe('WebSite');
    expect(m.jsonLd[0]).toEqual(websiteJsonLd());
  });
});

describe('buildLeagueMeta — صفحة الرابطة', () => {
  it('العنوان = اسم الرابطة + اسم المنصة، والوصف بالولاية', () => {
    const m = buildLeagueMeta(leagueRow(), [], 'ar');
    expect(m.title).toBe('رابطة الجزائر لألعاب القوى — Photo Finish Pro');
    expect(m.description).toContain('رابطة الجزائر لألعاب القوى');
    expect(m.description).toContain('الجزائر');
    expect(m.canonicalPath).toBe(`/league/${UUID_A}`);
  });

  it('JSON-LD: منظمة رياضية أولاً ثم SportsEvent للقادمة/الجارية حصراً', () => {
    const comps = [
      compRow({ id: 'c-1', status: 'registration_open' }),
      compRow({ id: 'c-2', status: 'running' }),
      compRow({ id: 'c-3', status: 'results_published' }), // منتهية → مستبعدة
      compRow({ id: 'c-4', status: 'published', end_date: '2020-01-01' }), // تجاوزها الزمن → مستبعدة
    ];
    const m = buildLeagueMeta(leagueRow(), comps, 'ar');
    expect(m.jsonLd).toHaveLength(3); // منظمة + حدثان
    expect(m.jsonLd[0]['@type']).toBe('SportsOrganization');
    const events = m.jsonLd.slice(1);
    expect(events.every((e) => e['@type'] === 'SportsEvent')).toBe(true);
  });

  it('حد أقصى 10 أحداث في JSON-LD', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      compRow({ id: `c-${i}`, status: 'published' })
    );
    const m = buildLeagueMeta(leagueRow(), many, 'fr');
    expect(m.jsonLd).toHaveLength(11); // منظمة + 10
  });

  it('اللغة الفرنسية تستعمل الاسم الفرنسي', () => {
    const m = buildLeagueMeta(leagueRow(), [], 'fr');
    expect(m.title.startsWith('Ligue d\'Alger d\'athlétisme — ')).toBe(true);
  });
});

describe('sportsEventJsonLd — بيانات منظّمة للتظاهرة', () => {
  it('كل الحقول الأساسية + المكان والمُنظّم', () => {
    const e = sportsEventJsonLd({
      title: 'بطولة الربيع',
      startDate: '2026-12-10',
      endDate: '2026-12-11',
      venue: 'ملعب 5 جويلية',
      organizerName: 'رابطة الجزائر',
    });
    expect(e['@context']).toBe('https://schema.org');
    expect(e['@type']).toBe('SportsEvent');
    expect(e.name).toBe('بطولة الربيع');
    expect(e.startDate).toBe('2026-12-10');
    expect(e.endDate).toBe('2026-12-11');
    expect(e.eventStatus).toBe('https://schema.org/EventScheduled');
    expect((e.location as Record<string, unknown>)['@type']).toBe('Place');
    expect((e.location as Record<string, unknown>).name).toBe('ملعب 5 جويلية');
    expect((e.organizer as Record<string, unknown>).name).toBe('رابطة الجزائر');
  });

  it('بلا مكان → بلا خاصية location إطلاقاً', () => {
    const e = sportsEventJsonLd({
      title: 'X', startDate: '2026-01-01', endDate: '2026-01-02',
      venue: null, organizerName: 'L',
    });
    expect('location' in e).toBe(false);
  });

  it('leagueJsonLd يتضمن الولاية كعنوان بريدي', () => {
    const l = leagueJsonLd('L', 'وهران');
    expect(l['@type']).toBe('SportsOrganization');
    expect((l.address as Record<string, unknown>).addressRegion).toBe('وهران');
  });
});

// ═══ 2) applyMeta / applyRobots بمستند وهمي ═══

function fakeDoc(): SeoDocument & { metas(): string[]; ldScripts(): number } {
  const elements: Record<string, HTMLElement> = {};
  const mk = (tag: string, id?: string): HTMLElement => {
    const attrs: Record<string, string> = {};
    const el = {
      tagName: tag.toUpperCase(),
      id: id ?? '',
      attributes: attrs,
      setAttribute(k: string, v: string) { attrs[k] = v; },
      getAttribute(k: string) { return attrs[k] ?? null; },
      set textContent(v: string) { attrs.__text = v; },
      get textContent() { return attrs.__text ?? ''; },
    } as unknown as HTMLElement;
    return el;
  };
  const head: HTMLElement[] = [];
  const doc: SeoDocument = {
    title: '',
    head: { appendChild: (n: HTMLElement) => { head.push(n); return n; } },
    createElement: (tag: string) => mk(tag),
    querySelector: ((sel: string) => elements[sel] ?? null) as SeoDocument['querySelector'],
  };
  const reg = (sel: string, el: HTMLElement) => { elements[sel] = el; return el; };
  const d = doc as SeoDocument & { metas(): string[]; ldScripts(): number };
  // نُعيد تسجيل العناصر المُنشأة ليقرأها querySelector في الاستدعاءات التالية
  const origCreate = doc.createElement.bind(doc);
  doc.createElement = (tag: string) => {
    const el = origCreate(tag);
    if (el.getAttribute('name')) reg(`meta[name="${el.getAttribute('name')}"]`, el);
    if (el.getAttribute('property')) reg(`meta[property="${el.getAttribute('property')}"]`, el);
    if (el.getAttribute('id') === 'pf-jsonld') reg('script#pf-jsonld', el);
    return el;
  };
  d.metas = () => Object.keys(elements).filter((k) => k.startsWith('meta['));
  d.ldScripts = () => Object.keys(elements).filter((k) => k === 'script#pf-jsonld').length;
  // تحايل: upsertMeta يستدعي querySelector ثم appendChild — نربط appendChild بالتسجيل
  const origAppend = doc.head.appendChild.bind(doc.head);
  doc.head.appendChild = ((n: HTMLElement) => {
    if (n.getAttribute('name')) reg(`meta[name="${n.getAttribute('name')}"]`, n);
    if (n.getAttribute('property')) reg(`meta[property="${n.getAttribute('property')}"]`, n);
    if (n.getAttribute('id') === 'pf-jsonld') reg('script#pf-jsonld', n);
    return origAppend(n);
  }) as typeof doc.head.appendChild;
  return d;
}

describe('applyMeta — مستند وهمي', () => {
  it('يضبط العنوان والوصف وOG ويخلق JSON-LD واحداً', () => {
    const doc = fakeDoc();
    const m = buildHomeMeta(2, 'ar');
    applyMeta(m, doc, 'https://example.com');
    expect(doc.title).toBe(m.title);
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(m.description);
    expect(doc.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(m.title);
    expect(doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe(SITE_NAME);
    const ld = doc.querySelector('script#pf-jsonld');
    expect(ld).toBeTruthy();
    expect(JSON.parse(ld!.textContent!)).toEqual(m.jsonLd);
    expect(doc.ldScripts()).toBe(1);
  });

  it('استدعاء ثانٍ يُحدّث ولا يراكم عناصر (idempotent)', () => {
    const doc = fakeDoc();
    applyMeta(buildHomeMeta(1, 'ar'), doc, 'https://example.com');
    applyMeta(buildLeagueMeta(leagueRow(), [compRow()], 'fr'), doc, 'https://example.com');
    expect(doc.ldScripts()).toBe(1);
    const ld = doc.querySelector('script#pf-jsonld')!;
    const parsed = JSON.parse(ld.textContent!) as { length: number }[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2); // منظمة + حدث واحد
    expect(doc.title).toContain('Ligue d\'Alger d\'athlétisme');
  });

  it('og:url يُبنى من الأصل المحقون + المسار الداخلي', () => {
    const doc = fakeDoc();
    applyMeta(buildLeagueMeta(leagueRow(), [], 'ar'), doc, 'https://pf.dz/');
    expect(doc.querySelector('meta[property="og:url"]')?.getAttribute('content'))
      .toBe(`https://pf.dz/#/league/${UUID_A}`);
    expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content'))
      .toBe('https://pf.dz/icons/icon-512.png');
  });

  it('بلا origin → لا og:url ولا og:image (وليس رابطاً معطوباً)', () => {
    const doc = fakeDoc();
    applyMeta(buildHomeMeta(0, 'ar'), doc, null);
    expect(doc.querySelector('meta[property="og:url"]')).toBeNull();
    expect(doc.querySelector('meta[property="og:image"]')).toBeNull();
  });

  it('بلا مستند → صمت تام', () => {
    expect(() => applyMeta(buildHomeMeta(0, 'ar'), null)).not.toThrow();
  });

  it('shareUrl يطبع النطاق والمسار الداخلي', () => {
    expect(shareUrl('https://x.io', '/')).toBe('https://x.io/#/');
    expect(shareUrl('https://x.io/', '/league/u')).toBe('https://x.io/#/league/u');
  });
});

describe('applyRobots — حجب الشاشات غير العمومية', () => {
  it('ينشئ meta robots ويُحدّث قيمتها', () => {
    const doc = fakeDoc();
    applyRobots('index,follow', doc);
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow');
    applyRobots('noindex', doc);
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });
});

// ═══ 3) التحليلات — الدوال النقية ═══

describe('normalizeTrackPath — تطبيع المسار', () => {
  it('قص الفراغات وquery والحد 300', () => {
    expect(normalizeTrackPath('  /league/x?a=1 ')).toBe('/league/x');
    expect(normalizeTrackPath('')).toBe('/');
    expect(normalizeTrackPath('compete')).toBe('/compete');
    expect(normalizeTrackPath(`/${'a'.repeat(400)}`)).toHaveLength(300);
  });
});

describe('deviceHint / referrerHost — فئة تقريبية بلا بصمة', () => {
  it('UA متنقلة → mobile، مكتبية → desktop، غائبة → unknown', () => {
    expect(deviceHint('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('mobile');
    expect(deviceHint('Mozilla/5.0 (Android 14; Mobile)')).toBe('mobile');
    expect(deviceHint('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
    expect(deviceHint(null)).toBe('unknown');
    expect(deviceHint('')).toBe('unknown');
  });

  it('مضيف المُحيل: hostname فقط، أو null للمدخلات الرديئة', () => {
    expect(referrerHost('https://google.com/search?q=x')).toBe('google.com');
    expect(referrerHost('http://sport.dz/page')).toBe('sport.dz');
    expect(referrerHost('not a url')).toBeNull();
    expect(referrerHost(null)).toBeNull();
    expect(referrerHost('')).toBeNull();
  });
});

describe('dntAllowsTracking — احترام Do Not Track', () => {
  it('1/yes تمنع — 0/غائب تسمح', () => {
    expect(dntAllowsTracking('1')).toBe(false);
    expect(dntAllowsTracking('yes')).toBe(false);
    expect(dntAllowsTracking('0')).toBe(true);
    expect(dntAllowsTracking(null)).toBe(true);
    expect(dntAllowsTracking(undefined)).toBe(true);
  });
});

describe('مضاد تكرار المشاهدات', () => {
  it('isDuplicateView: فاصل أصغر من الحد = مكرر', () => {
    expect(isDuplicateView(null, 1000, 15000)).toBe(false);
    expect(isDuplicateView(1000, 1000 + 14999, 15000)).toBe(true);
    expect(isDuplicateView(1000, 1000 + 15000, 15000)).toBe(false);
  });

  it('track يحترم DNT ويمنع تكرار المشاهدة ويتجاهل تكرار النقرات', async () => {
    resetViewDedupe();
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    try {
      const sb = fakeSb();
      // DNT → لا شيء
      track({ kind: 'page_view', path: '/', lang: 'ar' }, { dnt: '1', sb });
      expect(sb.rows).toHaveLength(0);
      // أول مشاهدة تُقبل
      track({ kind: 'page_view', path: '/', lang: 'ar' }, { dnt: null, now: 1000, sb });
      // تكرار خلال 15 ث → مرفوض
      track({ kind: 'page_view', path: '/', lang: 'ar' }, { dnt: null, now: 1000 + 100, sb });
      // نقرتان متتاليتان تُعدّان كلتاهما
      track({ kind: 'cta_click', path: '/', lang: 'ar' }, { dnt: null, now: 1100, sb });
      track({ kind: 'cta_click', path: '/', lang: 'ar' }, { dnt: null, now: 1200, sb });
      // الإرسال fire-and-forget — نمنح microtasks فرصة لإتمامها
      await new Promise((r) => setTimeout(r, 0));
      expect(sb.rows).toHaveLength(3);
      expect(readQueue()).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
      resetViewDedupe();
    }
  });
});

// ═══ 4) الطابور المحلي ═══

function fakeSb(fail = false): SupabaseLike & { rows: unknown[] } {
  const rows: unknown[] = [];
  return {
    rows,
    from(_table: string) {
      return {
        async insert(r: unknown[]) {
          if (fail) return { error: { message: 'boom' } };
          rows.push(...r);
          return { error: null };
        },
      };
    },
  };
}

describe('الطابور المحلي — أوفلاين أولاً', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('إضافة ثم إرسال ناجح يُفرّغ الطابور ويعيد العدد', async () => {
    enqueueEvent({ kind: 'page_view', path: '/', lang: 'ar' });
    enqueueEvent({ kind: 'cta_click', path: '/', lang: 'ar' });
    expect(readQueue()).toHaveLength(2);
    const sb = fakeSb();
    const sent = await flushQueue(sb);
    expect(sent).toBe(2);
    expect(readQueue()).toHaveLength(0);
    expect(sb.rows).toHaveLength(2);
    expect(sb.rows[0]).toMatchObject({ kind: 'page_view', path: '/', league_id: null });
  });

  it('الحد الأقصى: الأقدم يُسقط عند التجاوز', () => {
    for (let i = 0; i < MAX_QUEUE + 10; i++) {
      enqueueEvent({ kind: 'page_view', path: `/p${i}`, lang: 'ar' });
    }
    const q = readQueue();
    expect(q).toHaveLength(MAX_QUEUE);
    expect(q[0].path).toBe(`/p${10}`); // أول 10 سقطت
    expect(q[q.length - 1].path).toBe(`/p${MAX_QUEUE + 9}`);
  });

  it('فشل الإرسال يحفظ الأحداث للمرة القادمة', async () => {
    enqueueEvent({ kind: 'page_view', path: '/', lang: 'ar' });
    const sent = await flushQueue(fakeSb(true));
    expect(sent).toBe(0);
    expect(readQueue()).toHaveLength(1);
  });

  it('بلا عميل (أوفلاين تام) → صفر مرسل والطابو محفوظ', async () => {
    enqueueEvent({ kind: 'page_view', path: '/', lang: 'fr' });
    expect(await flushQueue(null)).toBe(0);
    expect(readQueue()).toHaveLength(1);
  });

  it('toAnalyticsRow يعيّن أعمدة 0011 حصراً', () => {
    const row = toAnalyticsRow(
      { kind: 'page_view', path: '/league/u', leagueId: UUID_A, referrerHost: 'https://g.co/s', lang: 'fr' },
      'mobile'
    );
    expect(Object.keys(row).sort()).toEqual(
      ['device', 'kind', 'lang', 'league_id', 'path', 'referrer_host'].sort()
    );
    expect(row.league_id).toBe(UUID_A);
    expect(row.referrer_host).toBe('g.co');
    expect(row.device).toBe('mobile');
  });

  it('wouldBeDuplicateView بعد reset → ليست مكررة', () => {
    resetViewDedupe();
    expect(wouldBeDuplicateView(999999)).toBe(false);
  });
});

// ═══ 5) إحصاءات المدير ═══

describe('summarizeDaily / pathLabelKey — تجميع وتسمية', () => {
  it('تلخيص الصفوف اليومية (int8 قد يصل نصاً)', () => {
    const rows: DailyRow[] = [
      { day: '2026-11-01', views: 4, cta_clicks: 1 },
      { day: '2026-11-02', views: '7' as unknown as number, cta_clicks: 0 },
    ];
    const s = summarizeDaily(rows);
    expect(s.totalViews).toBe(11);
    expect(s.totalCta).toBe(1);
    expect(s.activeDays).toBe(2);
    expect(summarizeDaily([])).toEqual({ totalViews: 0, totalCta: 0, activeDays: 0 });
  });

  it('تسمية المسارات المعروفة فقط — غيرها null', () => {
    expect(pathLabelKey('/')).toBe('nav_home');
    expect(pathLabelKey('/compete')).toBe('site_cta_compete');
    expect(pathLabelKey(`/league/${UUID_A}`)).toBe('an_page_league');
    expect(pathLabelKey('/coach')).toBeNull();
  });
});

describe('fetchLeagueAnalytics — كاش أوفلاين عند الفشل', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  function fakeRpc(err: string | null, daily: unknown[], top: unknown[]) {
    return {
      async rpc(fn: string) {
        if (err) return { data: null, error: { message: `${fn}: ${err}` } };
        return { data: fn === 'league_analytics_daily' ? daily : top, error: null };
      },
    };
  }

  it('نجاح: يطبع الأرقام ويكتب الكاش', async () => {
    const sb = fakeRpc(null, [{ day: '2026-11-01', views: '5', cta_clicks: 2 }], [{ path: '/', views: 5 }]);
    const res = await fetchLeagueAnalytics(UUID_A, 7, sb as never);
    expect(res.fromCache).toBe(false);
    expect(res.error).toBeNull();
    expect(res.daily[0].views).toBe(5);
    expect(res.top[0].path).toBe('/');
    expect(store.has(`pf_analytics_daily_v1:${UUID_A}:7`)).toBe(true);
  });

  it('فشل شبكة مع كاش → يعيد الكاش مع fromCache', async () => {
    store.set(
      `pf_analytics_daily_v1:${UUID_A}:30`,
      JSON.stringify({ at: 1, rows: [{ day: '2026-11-01', views: 9, cta_clicks: 0 }] })
    );
    const res = await fetchLeagueAnalytics(UUID_A, 30, fakeRpc('down', [], []) as never);
    expect(res.fromCache).toBe(true);
    expect(res.daily).toHaveLength(1);
    expect(res.daily[0].views).toBe(9);
  });

  it('فشل بلا كاش → خطأ للعرض', async () => {
    const res = await fetchLeagueAnalytics(UUID_A, 7, fakeRpc('down', [], []) as never);
    expect(res.fromCache).toBe(false);
    expect(res.error).toContain('league_analytics_daily');
  });

  it('بلا عميل → كاش فقط (أو فراغ بلا خطأ)', async () => {
    const res = await fetchLeagueAnalytics(UUID_A, 7, null);
    expect(res.fromCache).toBe(true);
    expect(res.error).toBeNull();
    expect(res.daily).toHaveLength(0);
  });
});

// ═══ 6) sitemap ═══

describe('generateSitemapXml — مولّد الخريطة', () => {
  it('XML صالح بالمسار الرئيسي والأصل مقصوص المائل', () => {
    const xml = generateSitemapXml('https://example.com/');
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('<loc>https://example.com/</loc>');
    expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    expect(xml).toContain('<priority>1.0</priority>');
    expect(xml).toContain('<changefreq>daily</changefreq>');
    // لا أجزاء # في الخريطة (بروتوكول sitemap)
    expect(xml).not.toContain('#');
  });

  it('قائمة مسارات فارغة → urlset فارغ صالح', () => {
    const xml = generateSitemapXml('https://x.io', []);
    expect(xml).toContain('<urlset');
    expect(xml).not.toContain('<url>');
  });
});

// ═══ 7) محاذاة القاموسين ═══

describe('مفاتيح المرحلة 8 موجودة في اللغتين', () => {
  it('seo_league_desc + مفاتيح التحليلات متطابقة الوجود', () => {
    const keys = [
      'seo_league_desc', 'tab_analytics', 'an_privacy_note', 'an_total_views',
      'an_cta_clicks', 'an_active_days', 'an_daily_views', 'an_top_pages',
      'an_no_data', 'an_no_data_hint', 'an_error_load', 'an_period',
      'an_days_7', 'an_days_30', 'an_page_league', 'an_retry',
    ] as const;
    for (const k of keys) {
      expect(typeof ar[k]).toBe('string');
      expect(typeof fr[k]).toBe('string');
    }
  });
});
