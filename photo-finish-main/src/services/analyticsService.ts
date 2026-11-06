/**
 * Photo Finish Pro — خدمة التحليلات الخصوصية (Privacy-first Analytics)
 * ===================================================================
 * المرحلة 8: عدّ مجهول لزيارات الموقع العمومي — بلا كوكيز، بلا IP، بلا PII.
 *
 * المبادئ:
 * 1. لا تعقب إن طلب الزائر ذلك (Do Not Track) — نحترم الترويسة القديمة كراقة.
 * 2. عناصر محدودة حصراً: المسار المطبّع، نوع الحدث، اللغة، فئة الجهاز
 *    (من فئة user-agent — لا بصمة)، مضيف المُحيل فقط، ومعرّف الرابطة.
 * 3. أوفلاين أولاً: الطابور في localStorage (حد أقصى 50 حدثاً — الأقدم يُسقط)،
 *    ويُرسل على دفعات كلما توفر العميل؛ فشل الشبكة لا يفقد الأحداث.
 * 4. تكرار مضاد: مشاهدة نفس الجلسة خلال 15 ثانية لا تُعدّ مرة أخرى.
 * 5. الخادم سلطة القراءة النهائية: الزائر يُدرج حصراً (RLS) — لا قراءة عموماً،
 *    والدالتا المجمّعتان لعضو الرابطة حصراً (0011).
 * 6. نقية قدر الإمكان: track تقبل حقن (dnt/now/sb) للاختبار بلا شبكة ولا نافذة.
 */

import { getSupabase } from './supabaseClient';

// ═══ الأنواع ═══

export type TrackKind = 'page_view' | 'cta_click' | 'share';
export type DeviceHint = 'mobile' | 'desktop' | 'unknown';
export type TrackLang = 'ar' | 'fr';

export interface TrackEvent {
  kind: TrackKind;
  path: string;
  leagueId?: string | null;
  referrerHost?: string | null;
  lang: TrackLang;
}

export interface TrackOptions {
  /** قيمة Do Not Track — افتراضياً تُقرأ من navigator */
  dnt?: string | null;
  /** زمن الحدث (مللي) — افتراضياً Date.now() */
  now?: number;
  /** أصغر فاصل بين مشاهدتين (مللي) — افتراضي 15000 */
  minGapMs?: number;
  /** عميل Supabase محقون للاختبار — افتراضياً getSupabase() */
  sb?: SupabaseLike | null;
}

/** أصغر واجهة عميل تحتاجها الإرسالية (قابلة للتزييف في الاختبارات) */
export interface SupabaseLike {
  from(table: string): {
    insert(rows: unknown[]): Promise<{ error: { message: string } | null }>;
  };
}

export interface AnalyticsRow {
  kind: TrackKind;
  path: string;
  league_id: string | null;
  referrer_host: string | null;
  lang: TrackLang;
  device: DeviceHint;
}

// ═══ دوال نقية (قابلة للاختبار مباشرة) ═══

/** تطبيع المسار: قصّ الفراغات، بلا query، حد 300 حرف — '' يصبح '/' */
export function normalizeTrackPath(raw: string): string {
  let p = (raw ?? '').trim();
  const q = p.indexOf('?');
  if (q >= 0) p = p.slice(0, q);
  if (!p.startsWith('/')) p = `/${p}`;
  return p.slice(0, 300) || '/';
}

/** فئة الجهاز من فئة الـ UA (كشف تقريبي — لا بصمة جهاز) */
export function deviceHint(ua: string | null | undefined): DeviceHint {
  if (!ua) return 'unknown';
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'mobile' : 'desktop';
}

/** مضيف المُحيل فقط (hostname بلا مسار) — يفشل بصمت إلى null */
export function referrerHost(ref: string | null | undefined): string | null {
  if (!ref) return null;
  try {
    const u = new URL(ref);
    return u.hostname || null;
  } catch {
    return null;
  }
}

/** هل تسمح تفضيلات الزائر (DNT) بالتعّد؟ */
export function dntAllowsTracking(dnt: string | null | undefined): boolean {
  const v = (dnt ?? '').trim().toLowerCase();
  return !(v === '1' || v === 'yes');
}

/** مشاهدة مكررة داخل فاصل أقل من الحد؟ (last=null → ليست مكررة) */
export function isDuplicateView(
  lastMs: number | null,
  nowMs: number,
  minGapMs: number
): boolean {
  if (lastMs === null) return false;
  return nowMs - lastMs < minGapMs;
}

// ═══ الطابور المحلي (أوفلاين أولاً) ═══

const QUEUE_KEY = 'pf_analytics_queue_v1';
export const MAX_QUEUE = 50;

function readQueueRaw(): TrackEvent[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TrackEvent[]) : [];
  } catch {
    return [];
  }
}

/** الطابور الحالي (نسخة للعرض/الاختبار) */
export function readQueue(): TrackEvent[] {
  return readQueueRaw().slice();
}

function writeQueue(events: TrackEvent[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(QUEUE_KEY, JSON.stringify(events));
  } catch { /* تخزين ممتلئ أو محجوب — تجاهل بصمت */ }
}

/** إضافة حدث للطابور — يتجاوز الحد الأقصى بإسقاط الأقدم */
export function enqueueEvent(ev: TrackEvent): void {
  const q = readQueueRaw();
  q.push(ev);
  writeQueue(q.length > MAX_QUEUE ? q.slice(q.length - MAX_QUEUE) : q);
}

/** تحويل حدث مسار → صف قاعدة بيانات (أعمدة 0011 حصراً — المُحيل يُطبَّع إلى hostname) */
export function toAnalyticsRow(ev: TrackEvent, device: DeviceHint): AnalyticsRow {
  return {
    kind: ev.kind,
    path: normalizeTrackPath(ev.path),
    league_id: ev.leagueId ?? null,
    referrer_host: referrerHost(ev.referrerHost),
    lang: ev.lang,
    device,
  };
}

/**
 * إرسال الطابور على دفعة واحدة. نجاح → يُفرَّغ؛ فشل/بلا عميل → يبقى للمرات القادمة.
 * يعيد عدد الأحداث المُرسلة.
 * تمرير null صريح = أوفلاين مفروض (للاختبار)؛ إهمال المعامل = قراءة العميل الفعلي.
 */
export async function flushQueue(sb?: SupabaseLike | null): Promise<number> {
  const client = sb === undefined
    ? (getSupabase() as unknown as SupabaseLike | null)
    : sb;
  if (!client) return 0;
  // حجز فوري للأحداث من الطابور قبل التعليق على الشبكة —
  // يمنع الإرسال المزدوج عند تداخل flushات متتالية (كشفه اختبار track)
  const q = takeQueue();
  if (!q.length) return 0;
  try {
    const rows = q.map((ev) => toAnalyticsRow(ev, deviceHint(safeUa())));
    const { error } = await client.from('page_views').insert(rows);
    if (error) { restoreQueue(q); return 0; }
    return q.length;
  } catch {
    restoreQueue(q);
    return 0;
  }
}

/** حجز الأحداث: إزالتها من التخزين فوراً (تُعاد عند فشل الإرسال) */
function takeQueue(): TrackEvent[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const q = readQueueRaw();
    if (q.length) writeQueue([]);
    return q;
  } catch {
    return [];
  }
}

/** إرجاع أحداث محجوزة عند فشل الإرسال — الأقدم أولاً، وحدّ MAX_QUEUE محفوظ */
function restoreQueue(events: TrackEvent[]): void {
  try {
    if (!events.length) return;
    const cur = readQueueRaw();
    const merged = [...events, ...cur];
    writeQueue(merged.length > MAX_QUEUE ? merged.slice(merged.length - MAX_QUEUE) : merged);
  } catch { /* تجاهل بصمت */ }
}

// ═══ المضاد الداخلي للتكرار (جلسة SPA) ═══

const MIN_VIEW_GAP_MS = 15000;
let lastViewMs: number | null = null;

/** فحص الاختبار: هل ستُعدّ المشاهدة التالية مكررة الآن؟ */
export function wouldBeDuplicateView(nowMs: number, minGapMs = MIN_VIEW_GAP_MS): boolean {
  return isDuplicateView(lastViewMs, nowMs, minGapMs);
}

/** تصفير المضاد (للاختبارات) */
export function resetViewDedupe(): void {
  lastViewMs = null;
}

// ═══ نقطة الدخول ═══

/**
 * تسجيل حدث (fire-and-forget): يحترم DNT، يطبّع المسار، يمنع تكرار المشاهدات،
 * يضع الحدث في الطابور ثم يحاول الإرسال. لا يُلقي استثناءات إطلاقاً.
 */
export function track(input: TrackEvent, opts: TrackOptions = {}): void {
  try {
    const dnt = opts.dnt !== undefined ? opts.dnt : readDnt();
    if (!dntAllowsTracking(dnt)) return;

    const ev: TrackEvent = {
      kind: input.kind,
      path: normalizeTrackPath(input.path),
      leagueId: input.leagueId ?? null,
      referrerHost: input.referrerHost ?? null,
      lang: input.lang,
    };

    // مشاهدات الصفحات فقط لها مضاد تكرار (النقرات تُعدّ دائماً)
    const now = opts.now ?? safeNow();
    if (ev.kind === 'page_view') {
      if (isDuplicateView(lastViewMs, now, opts.minGapMs ?? MIN_VIEW_GAP_MS)) return;
      lastViewMs = now;
    }

    enqueueEvent(ev);
    // sb صريح (حتى null) يُحترم حرفياً — إهماله يعني استخدم العميل الفعلي
    void flushQueue('sb' in opts ? opts.sb : undefined);
  } catch { /* لا شيء يُسقط الواجهة بسبب التحليلات */ }
}

function readDnt(): string | null {
  try {
    if (typeof navigator === 'undefined') return null;
    return (navigator as { doNotTrack?: string }).doNotTrack ?? null;
  } catch {
    return null;
  }
}

function safeUa(): string | null {
  try {
    if (typeof navigator === 'undefined') return null;
    return navigator.userAgent ?? null;
  } catch {
    return null;
  }
}

function safeNow(): number {
  try {
    return Date.now();
  } catch {
    return 0;
  }
}

// ═══ طبقة قراءة إحصاءات المدير (RPC مجمّعة — أوفلاين أولاً) ═══

export interface DailyRow {
  day: string; // YYYY-MM-DD
  views: number;
  cta_clicks: number;
}

export interface TopRow {
  path: string;
  views: number;
}

export interface AnalyticsTotals {
  totalViews: number;
  totalCta: number;
  activeDays: number;
}

export interface LeagueAnalyticsResult {
  daily: DailyRow[];
  top: TopRow[];
  fromCache: boolean;
  error: string | null;
}

/** مجموعات عامة من صفوف اليومية — نقية (تُستهلك بالواجهة والاختبارات) */
export function summarizeDaily(rows: DailyRow[]): AnalyticsTotals {
  const safe = rows ?? [];
  return {
    totalViews: safe.reduce((s, r) => s + (Number(r.views) || 0), 0),
    totalCta: safe.reduce((s, r) => s + (Number(r.cta_clicks) || 0), 0),
    activeDays: safe.length,
  };
}

/** مفتاح ترجمة تسمية المسار — null يعني اعرض المسار الخام (مسارات جديدة) */
export function pathLabelKey(
  path: string
): 'nav_home' | 'site_cta_compete' | 'an_page_league' | null {
  const p = normalizeTrackPath(path);
  if (p === '/') return 'nav_home';
  if (p === '/compete') return 'site_cta_compete';
  if (p.startsWith('/league/')) return 'an_page_league';
  return null;
}

// ─── تخزين محلي لآخر إحصاءات ناجحة (لكل رابطة وفترة) ───

const DAILY_CACHE_PREFIX = 'pf_analytics_daily_v1:';
const TOP_CACHE_PREFIX = 'pf_analytics_top_v1:';

function writeCache(key: string, rows: unknown[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), rows }));
  } catch { /* تجاهل بصمت */ }
}

function readCache<T>(key: string): T[] | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { rows?: T[] };
    return Array.isArray(parsed.rows) ? parsed.rows : null;
  } catch {
    return null;
  }
}

/** تحويل صف RPC إلى صف يومية (int8 قد يصل نصاً — نمّطه رقمياً) */
function normalizeDailyRow(raw: unknown): DailyRow {
  const r = (raw ?? {}) as { day?: unknown; views?: unknown; cta_clicks?: unknown };
  return {
    day: typeof r.day === 'string' ? r.day : String(r.day ?? ''),
    views: Number(r.views) || 0,
    cta_clicks: Number(r.cta_clicks) || 0,
  };
}

function normalizeTopRow(raw: unknown): TopRow {
  const r = (raw ?? {}) as { path?: unknown; views?: unknown };
  return {
    path: typeof r.path === 'string' ? r.path : String(r.path ?? ''),
    views: Number(r.views) || 0,
  };
}

/** RPC ترجع أي بيانات — نضيّقها إلى شكل العميل المستخدم هنا */
interface RpcLike {
  rpc(fn: string, params: Record<string, unknown>): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

/**
 * جلب إحصاءات رابطة (يومية + أكثر الصفحات) عبر دالتي 0011 المجمّعتين.
 * فشل الشبكة → آخر نسخة مخزّنة (fromCache)؛ بلا Supabase → المخزن فقط.
 */
export async function fetchLeagueAnalytics(
  leagueId: string,
  days: 7 | 30,
  sb: RpcLike | null = getSupabase() as unknown as RpcLike | null
): Promise<LeagueAnalyticsResult> {
  const dKey = `${DAILY_CACHE_PREFIX}${leagueId}:${days}`;
  const tKey = `${TOP_CACHE_PREFIX}${leagueId}:${days}`;
  const cached = (): { daily: DailyRow[]; top: TopRow[] } => ({
    daily: readCache<DailyRow>(dKey) ?? [],
    top: readCache<TopRow>(tKey) ?? [],
  });
  if (!sb) {
    const c = cached();
    return { daily: c.daily, top: c.top, fromCache: true, error: null };
  }
  try {
    const [dailyRes, topRes] = await Promise.all([
      sb.rpc('league_analytics_daily', { p_league_id: leagueId, p_days: days }),
      sb.rpc('league_analytics_top', { p_league_id: leagueId, p_days: days, p_limit: 8 }),
    ]);
    if (dailyRes.error) throw new Error(dailyRes.error.message);
    if (topRes.error) throw new Error(topRes.error.message);
    const daily = (Array.isArray(dailyRes.data) ? dailyRes.data : []).map(normalizeDailyRow);
    const top = (Array.isArray(topRes.data) ? topRes.data : []).map(normalizeTopRow);
    writeCache(dKey, daily);
    writeCache(tKey, top);
    return { daily, top, fromCache: false, error: null };
  } catch (e) {
    const c = cached();
    if (c.daily.length || c.top.length) {
      return { daily: c.daily, top: c.top, fromCache: true, error: null };
    }
    return {
      daily: [],
      top: [],
      fromCache: false,
      error: e instanceof Error ? e.message : 'network_error',
    };
  }
}
