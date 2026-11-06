/**
 * Photo Finish Pro — خدمة تحسين الظهور والفهرسة (SEO Service)
 * ==========================================================
 * المرحلة 8: علامات meta ديناميكية + بيانات منظّمة JSON-LD للموقع العمومي.
 *
 * المبادئ (اتساق مع بنية المشروع):
 * 1. نقاء: بنّاؤو الـ meta دالات نقية تعيد كائنات وصفية — سهلة الاختبار بلا DOM.
 * 2. DOM-optional: applyMeta/applyRobots تقبل مستنداً محقوناً (نمط الخدمات القائمة)،
 *    وافتراضياً تستخدم document المحمي try/catch (آمنة في Node/الاختبارات).
 * 3. بلا أسرار: كل ما تُنتجه هنا علني أصلاً (عناوين الرابطات والتظاهرات المنشورة).
 * 4. حدود تقنية معلنة: التطبيق SPA ذو مسارات hash — جوجل يعرض JS ويقرأ
 *    title/description/JSON-LD من DOM المُصيَّر، لكن المحركات القديمة قد لا
 *    تفهرس مسارات #/ منفصلة؛ canonical يُترك لمستوى النطاق (لا canonical لكل مسار
 *    حتى لا نُرسل إشارة «صفحة مكررة» مضللة). og:url معلوماتي بالمسار الكامل.
 */

import { dictionaries, type Lang } from '../i18n/dictionaries';
import { pickTitle, type PublicCompetitionRow, type PublicLeagueRow } from './publicApi';

// ═══ الثوابت ═══

export const SITE_NAME = 'Photo Finish Pro';
/** صورة المشاركة الافتراضية (أيقونة PWA الأكبر) */
export const OG_IMAGE_PATH = '/icons/icon-512.png';
/** أقصى عدد تظاهرات تُحوَّل إلى SportsEvent في JSON-LD (حجم DOM معقول) */
export const MAX_JSONLD_EVENTS = 10;

// ═══ الأنواع ═══

export interface SeoMeta {
  title: string;
  description: string;
  /** المسار الداخلي (بعد #) لغرض og:url المعلوماتي */
  canonicalPath: string;
  ogType: 'website';
  /** كائنات schema.org — تُسلسل مصفوفةً في عنصر script واحد */
  jsonLd: Record<string, unknown>[];
}

export interface SeoCompInput {
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  venue?: string | null;
  organizerName: string;
}

/** أصغر واجهة مستند تحتاجها الخدمة — تُحقن في الاختبارات */
export interface SeoDocument {
  title: string;
  head: { appendChild<T>(node: T): T };
  createElement(tag: string): HTMLElement;
  querySelector<E extends Element = Element>(selectors: string): E | null;
}

export type RobotsContent = 'index,follow' | 'noindex';

// ═══ بنّاؤو JSON-LD (نقية) ═══

/** منظمة رياضية = الرابطة (schema.org/SportsOrganization) */
export function leagueJsonLd(name: string, wilaya: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name,
    address: { '@type': 'PostalAddress', addressRegion: wilaya },
  };
}

/** تظاهرة رياضية = موسم مؤهل (schema.org/SportsEvent) */
export function sportsEventJsonLd(input: SeoCompInput): Record<string, unknown> {
  const out: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: input.title,
    startDate: input.startDate,
    endDate: input.endDate,
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: { '@type': 'SportsOrganization', name: input.organizerName },
  };
  if (input.venue && input.venue.trim()) {
    out.location = { '@type': 'Place', name: input.venue.trim() };
  }
  return out;
}

/** موقع إلكتروني (schema.org/WebSite) — للرئيسية */
export function websiteJsonLd(): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME };
}

// ═══ بنّاؤو الـ meta (نقية) ═══

/** meta للرئيسية: دليل الرابطات */
export function buildHomeMeta(leaguesCount: number, lang: Lang): SeoMeta {
  const d = dictionaries[lang];
  const suffix =
    leaguesCount > 0
      ? ` — ${leaguesCount} ${lang === 'ar' ? 'رابطة معتمدة' : 'ligues certifiées'}`
      : '';
  return {
    title: `${SITE_NAME} — ${d.site_hero_title}`,
    description: `${d.site_hero_subtitle}${suffix}`,
    canonicalPath: '/',
    ogType: 'website',
    jsonLd: [websiteJsonLd()],
  };
}

/** meta لصفحة رابطة: العنوان باسم الرابطة + SportsEvent للقادمة/الجارية */
export function buildLeagueMeta(
  league: Pick<PublicLeagueRow, 'id' | 'name_ar' | 'name_fr' | 'wilaya'>,
  comps: PublicCompetitionRow[],
  lang: Lang
): SeoMeta {
  const d = dictionaries[lang];
  const name = pickTitle(league, lang);
  // المؤهلة للفهرسة: القادمة/الجارية حصراً — المنتهية والمنسدرة لا
  const today = todayIsoLocal();
  const eligible = comps.filter(
    (c) =>
      (c.status === 'running' ||
        c.status === 'published' ||
        c.status === 'registration_open' ||
        c.status === 'registration_closed' ||
        c.status === 'frozen') &&
      !(c.end_date && c.end_date < today)
  );
  const events = eligible.slice(0, MAX_JSONLD_EVENTS).map((c) =>
    sportsEventJsonLd({
      title: pickTitle(c, lang),
      startDate: c.start_date,
      endDate: c.end_date,
      venue: c.venue,
      organizerName: name,
    })
  );
  return {
    title: `${name} — ${SITE_NAME}`,
    description: `${name} (${league.wilaya}) — ${d.seo_league_desc}`,
    canonicalPath: `/league/${league.id}`,
    ogType: 'website',
    jsonLd: [leagueJsonLd(name, league.wilaya), ...events],
  };
}

/** تاريخ اليوم YYYY-MM-DD محلياً — نسخة محلية لتفادي استيراد دائري من publicApi */
function todayIsoLocal(): string {
  try {
    const dt = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
  } catch {
    return '1970-01-01';
  }
}

/** رابط مشاركة/og:url كامل من أصل ومسار داخلي — نقية */
export function shareUrl(origin: string, canonicalPath: string): string {
  const base = origin.replace(/\/+$/, '');
  const p = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
  return `${base}/#${p}`;
}

// ═══ المطبِّق (DOM — قابل للحقن) ═══

const JSONLD_ID = 'pf-jsonld';

function defaultDoc(): SeoDocument | null {
  try {
    if (typeof document === 'undefined') return null;
    return document as unknown as SeoDocument;
  } catch {
    return null;
  }
}

/** يضبط meta موجودة أو ينشئها — يعيد العنصر للاختبار */
function upsertMeta(
  doc: SeoDocument,
  attr: 'name' | 'property',
  key: string,
  content: string
): HTMLElement {
  let el: HTMLElement | null = doc.querySelector<HTMLElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = doc.createElement('meta');
    el.setAttribute(attr, key);
    doc.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return el;
}

/**
 * تطبيق meta كاملة على مستند: العنوان، الوصف، OG (site_name/type/url/image عند
 * توفر origin)، وعنصر JSON-LD واحد (id ثابت يُستبدل محتواه — لا تراكم).
 * بلا مستند (Node) → لا شيء، بصمت.
 */
export function applyMeta(
  meta: SeoMeta,
  doc: SeoDocument | null = defaultDoc(),
  origin: string | null = safeOrigin()
): void {
  if (!doc) return;
  doc.title = meta.title;
  upsertMeta(doc, 'name', 'description', meta.description);
  upsertMeta(doc, 'property', 'og:title', meta.title);
  upsertMeta(doc, 'property', 'og:description', meta.description);
  upsertMeta(doc, 'property', 'og:type', meta.ogType);
  upsertMeta(doc, 'property', 'og:site_name', SITE_NAME);
  if (origin) {
    upsertMeta(doc, 'property', 'og:url', shareUrl(origin, meta.canonicalPath));
    upsertMeta(doc, 'property', 'og:image', `${origin.replace(/\/+$/, '')}${OG_IMAGE_PATH}`);
  }

  // JSON-LD: عنصر واحد ثابت الهوية — يُحدَّث محتواه كل مرة
  let script: HTMLElement | null = doc.querySelector<HTMLElement>(`script#${JSONLD_ID}`);
  if (!script) {
    script = doc.createElement('script');
    script.setAttribute('id', JSONLD_ID);
    script.setAttribute('type', 'application/ld+json');
    doc.head.appendChild(script);
  }
  script.textContent = JSON.stringify(meta.jsonLd);
}

/** ضبط meta robots — الشاشات العمومية مفهرسة وبقية الشاشات (لوحات/هواتف) محجوبة */
export function applyRobots(
  content: RobotsContent,
  doc: SeoDocument | null = defaultDoc()
): void {
  if (!doc) return;
  upsertMeta(doc, 'name', 'robots', content);
}

function safeOrigin(): string | null {
  try {
    if (typeof window === 'undefined' || !window.location) return null;
    return window.location.origin || null;
  } catch {
    return null;
  }
}
