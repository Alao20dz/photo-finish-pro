/**
 * Photo Finish Pro — طبقة بيانات الموقع العمومي (Public Site Data Layer)
 * ======================================================================
 * المرحلة 3: قراءة الرابطات والتظاهرات من Views العامة (anon) في Supabase:
 *   • public_leagues      — الرابطات النشطة فقط (id, name_ar, name_fr, wilaya, code, logo_url, colors)
 *   • public_competitions  — التظاهرات العامة غير المسودّة (بدون draft)
 *
 * مبادئ (اتساق مع بنية المشروع):
 * 1. أوفلاين أولاً: آخر نتيجة ناجحة تُخزَّن في localStorage وتُعاد عند فشل
 *    الشبكة أو غياب إعداد Supabase — الزائر يرى دائماً آخر دليل معروف.
 * 2. لا أسرار: عمليات قراءة anon عبر العميل المنشور فقط (getSupabase).
 * 3. نقاء: دوال التجميع والترتيب والاختيار اللغوي نقية وقابلة للاختبار
 *    دون شبكة (تُستهلك في tests/public-site.test.ts).
 * 4. DOM-optional: آمنة في بيئات بلا نافذة.
 */

import { getSupabase } from './supabaseClient';
import type { Lang } from '../i18n/dictionaries';

// ═══ الأنواع (مطابقة لأعمدة Views في تهجير 0002) ═══

/** صف الرابطة كما تعيده الـ View العامة */
export interface PublicLeagueRow {
  id: string;
  name_ar: string;
  name_fr: string | null;
  wilaya: string;
  code: string;
  logo_url: string | null;
  colors: Record<string, unknown> | null;
}

/** صف التظاهرة كما تعيده الـ View العامة */
export interface PublicCompetitionRow {
  id: string;
  league_id: string;
  title_ar: string;
  title_fr: string | null;
  type: string | null;
  venue: string | null;
  start_date: string; // date YYYY-MM-DD
  end_date: string;   // date YYYY-MM-DD
  status: CompetitionStatus;
  registration_deadline: string | null; // timestamptz
}

/** حالات التظاهرة الممكنة (قيد CHECK في 0001 — بدون draft لأنه محجوب بالـ View) */
export type CompetitionStatus =
  | 'published'
  | 'registration_open'
  | 'registration_closed'
  | 'frozen'
  | 'running'
  | 'finished'
  | 'results_published';

/** مجموعة التظاهرات بعد التجميع الزمني */
export interface GroupedCompetitions {
  upcoming: PublicCompetitionRow[];
  running: PublicCompetitionRow[];
  finished: PublicCompetitionRow[];
}

// ═══ أدوات نقية (قابلة للاختبار دون شبكة) ═══

/** اختيار العنوان حسب اللغة مع سقوط آمن إلى العربي ثم إلى أي نص متاح */
export function pickTitle(
  row: Pick<PublicLeagueRow, 'name_ar' | 'name_fr'> | Pick<PublicCompetitionRow, 'title_ar' | 'title_fr'>,
  lang: Lang
): string {
  if (lang === 'fr') {
    const fr = 'name_fr' in row ? row.name_fr : 'title_fr' in row ? row.title_fr : null;
    if (fr && fr.trim()) return fr.trim();
  }
  const ar = 'name_ar' in row ? row.name_ar : 'title_ar' in row ? row.title_ar : '';
  return (ar ?? '').trim() || '—';
}

const UPCOMING_STATUSES: ReadonlySet<string> = new Set([
  'published', 'registration_open', 'registration_closed', 'frozen',
]);
const RUNNING_STATUSES: ReadonlySet<string> = new Set(['running']);
const FINISHED_STATUSES: ReadonlySet<string> = new Set(['finished', 'results_published']);

/** مقارنة نصّية آمنة لتواريخ YYYY-MM-DD (كافية ترتيبياً دون تحويل Date) */
export function groupCompetitionsByStatus(
  rows: PublicCompetitionRow[],
  todayIso: string
): GroupedCompetitions {
  const out: GroupedCompetitions = { upcoming: [], running: [], finished: [] };
  for (const row of rows ?? []) {
    if (RUNNING_STATUSES.has(row.status)) {
      out.running.push(row);
    } else if (FINISHED_STATUSES.has(row.status)) {
      out.finished.push(row);
    } else if (UPCOMING_STATUSES.has(row.status)) {
      // منتهية فعلياً بالتقويم لكن ما زالت بلا اعتماد نتائج؟ تُعرض منتهية.
      if (row.end_date && row.end_date < todayIso) out.finished.push(row);
      else out.upcoming.push(row);
    }
  }
  // الترتيب: القادمة أبكر تاريخ أولاً؛ الجارية أبكر أولاً؛ المنتهية أحدث نهاية أولاً
  out.upcoming.sort((a, b) => a.start_date.localeCompare(b.start_date));
  out.running.sort((a, b) => a.start_date.localeCompare(b.start_date));
  out.finished.sort((a, b) => b.end_date.localeCompare(a.end_date));
  return out;
}

/** تاريخ اليوم بصيغة YYYY-MM-DD (تعتمد التوقيت المحلي للجهاز — ميدانياً كافية) */
export function todayIso(): string {
  try {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  } catch {
    return '1970-01-01';
  }
}

/** تنسيق تاريخ YYYY-MM-DD (أو timestamptz) إلى DD/MM/YYYY — صيغة مألوفة جزائرياً باللغتين */
export function formatDmy(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// ═══ تخزين دون اتصال (آخر دليل معروف) ═══

const LEAGUES_CACHE_KEY = 'pf_public_leagues_v1';
const COMPS_CACHE_PREFIX = 'pf_public_comps_v1:';

function writeCache(key: string, rows: unknown[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), rows }));
  } catch { /* تخزين ممتلئ أو محجوب — تجاهل بصمت */ }
}

function readCache<T>(key: string): T[] | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; rows?: T[] };
    return Array.isArray(parsed.rows) ? parsed.rows : null;
  } catch {
    return null;
  }
}

/** وقت آخر تحديث ناجح للدليل (مللي منذ epoch) — يعرضه الموقع كـ«آخر تحديث» */
export function lastCacheAt(kind: 'leagues' | 'competitions', leagueId = ''): number | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const key = kind === 'leagues' ? LEAGUES_CACHE_KEY : `${COMPS_CACHE_PREFIX}${leagueId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number };
    return typeof parsed.at === 'number' ? parsed.at : null;
  } catch {
    return null;
  }
}

// ═══ القراءات ═══

export interface FetchResult<T> {
  rows: T[];
  /** true إذا أُتيّت النتائج من التخزين المحلي (شبكة فاشلة أو بلا إعداد) */
  fromCache: boolean;
  /** رسالة خطأ مبسطة عند فشل الشبكة (للعرض) */
  error: string | null;
}

/**
 * جلب الرابطات النشطة. عند فشل الشبكة يعيد آخر نسخة مخزّنة (fromCache).
 * بلا Supabase إطلاقاً؟ يعيد المخزن إن وجد وإلا قائمة فارغة بلا خطأ
 * (الموقع يبقى صالحاً أوفلاين — لا نعرض رسالة خطأ زائفة).
 */
export async function fetchPublicLeagues(): Promise<FetchResult<PublicLeagueRow>> {
  const sb = getSupabase();
  if (!sb) {
    const cached = readCache<PublicLeagueRow>(LEAGUES_CACHE_KEY);
    return { rows: cached ?? [], fromCache: true, error: null };
  }
  try {
    const { data, error } = await sb
      .from('public_leagues')
      .select('id,name_ar,name_fr,wilaya,code,logo_url,colors')
      .order('name_ar', { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as PublicLeagueRow[];
    writeCache(LEAGUES_CACHE_KEY, rows);
    return { rows, fromCache: false, error: null };
  } catch (e) {
    const cached = readCache<PublicLeagueRow>(LEAGUES_CACHE_KEY);
    if (cached && cached.length) {
      return { rows: cached, fromCache: true, error: null };
    }
    return {
      rows: [],
      fromCache: false,
      error: e instanceof Error ? e.message : 'network_error',
    };
  }
}

/**
 * جلب رابطة واحدة بالمعرف (لصفحة الرابطة). يفحص المخزن المحلي أولاً عند الفشل.
 */
export async function fetchPublicLeagueById(id: string): Promise<FetchResult<PublicLeagueRow>> {
  const scanCache = (): PublicLeagueRow[] | null => {
    const all = readCache<PublicLeagueRow>(LEAGUES_CACHE_KEY);
    const hit = all?.find((l) => l.id === id);
    return hit ? [hit] : null;
  };
  const sb = getSupabase();
  if (!sb) {
    const cached = scanCache();
    return { rows: cached ?? [], fromCache: true, error: null };
  }
  try {
    const { data, error } = await sb
      .from('public_leagues')
      .select('id,name_ar,name_fr,wilaya,code,logo_url,colors')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const rows = data ? [data as PublicLeagueRow] : [];
    return { rows, fromCache: false, error: null };
  } catch (e) {
    const cached = scanCache();
    if (cached) return { rows: cached, fromCache: true, error: null };
    return {
      rows: [],
      fromCache: false,
      error: e instanceof Error ? e.message : 'network_error',
    };
  }
}

/**
 * جلب التظاهرات العامة لرابطة محددة (أو الكل عند إهمال المعرف).
 * نفس سياسة الأوفلاين: مخزن لكل رابطة على حدة.
 */
export async function fetchPublicCompetitions(leagueId?: string): Promise<FetchResult<PublicCompetitionRow>> {
  const key = `${COMPS_CACHE_PREFIX}${leagueId ?? 'all'}`;
  const sb = getSupabase();
  if (!sb) {
    const cached = readCache<PublicCompetitionRow>(key);
    return { rows: cached ?? [], fromCache: true, error: null };
  }
  try {
    let q = sb
      .from('public_competitions')
      .select('id,league_id,title_ar,title_fr,type,venue,start_date,end_date,status,registration_deadline')
      .order('start_date', { ascending: true });
    if (leagueId) q = q.eq('league_id', leagueId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as PublicCompetitionRow[];
    writeCache(key, rows);
    return { rows, fromCache: false, error: null };
  } catch (e) {
    const cached = readCache<PublicCompetitionRow>(key);
    if (cached && cached.length) {
      return { rows: cached, fromCache: true, error: null };
    }
    return {
      rows: [],
      fromCache: false,
      error: e instanceof Error ? e.message : 'network_error',
    };
  }
}
