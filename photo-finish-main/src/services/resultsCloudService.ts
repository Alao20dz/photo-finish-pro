/**
 * Photo Finish Pro — خدمة النشر السحابي للنتائج (Results Cloud Service)
 * ======================================================================
 * المرحلة 6: إغلاق الحلقة بين وضع المنافسة المحلي والسحابة:
 *   1. النتائج المحلية (منصّة التتويج) تُطابق بالتسجيلات المعتمدة (بالرواق/رقم الصدر)
 *   2. الرفع إلى event_results (رفع idempotent على قيد event_id,registration_id)
 *      + إغلاق الاختصاص (done) + إعلان النتائج (results_published)
 *   3. الموقع العمومي يقرأ من View عامة آمنة (public_event_results) —
 *      نتائج التظاهرات results_published العامة حصراً، مع كاش أوفلاين.
 *
 * مبدأ الحكم الذهبي نفسه: الخادم سلطة الإذن النهائية (RLS من تهجير 0008) —
 * هذه الخدمة تجربة استخدام فقط. كل الدوال النقية قابلة للاختبار دون شبكة.
 */

import { getSupabase } from './supabaseClient';

// ═══ الأنواع ═══

export type ResultStatus = 'ok' | 'dq' | 'dnf' | 'dns';
export type ResultSource = 'photo_finish' | 'multi_judge' | 'cross_country' | 'manual';

/** تسجيل معتمد كما تُحمّله listApprovedRegistrations (للمطابقة بالصدر) */
export interface RegistrableRow {
  id: string;
  bib_number: number | null;
  athlete_id: string;
  club_id: string;
  athletes?: { first_name: string; last_name: string } | null;
  clubs?: { code: string; name_ar: string } | null;
}

/** عدّاء منصّة التتويج المحلية (أصغر قاطع نحتاجه من Runner) */
export interface FinisherRow {
  bib: number;
  name: string;
  finishTime: number; // ms
}

export interface PublishContext {
  leagueId: string;
  competitionId: string;
  eventId: string;
  publishedBy: string | null;
}

export interface ResultRowInput {
  registration_id: string;
  athlete_id: string;
  club_id: string;
  league_id: string;
  competition_id: string;
  event_id: string;
  bib_number: number | null;
  athlete_name: string;
  club_code: string | null;
  position: number;
  mark_ms: number;
  mark_text: string;
  status: ResultStatus;
  source: ResultSource;
  published_by: string | null;
}

export interface PublishMapping {
  rows: ResultRowInput[];
  /** صدر بلا تسجيل مطابق — لا يُنشر (حوكمة: نتائج رسمية للمسجلين حصراً) */
  unmatched: { bib: number; name: string }[];
}

export type OpResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) return String((e as { message: unknown }).message);
  return 'unexpected_error';
}

// ═══ دوال نقية (قابلة للاختبار دون شبكة) ═══

/**
 * تنسيق زمن وصول (ms) إلى صيغة ألعاب مضيئة قياسية:
 *   ‹ 1 دقيقة      → «10.23»
 *   ‹ ساعة          → «1:03.40»
 *   غير ذلك          → «1:01:01.50»
 * قيمة غير صالحة (صفر/سالب/غير منتهٍ) → «—»
 */
export function formatMarkMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const totalCs = Math.round(ms / 10); // سنتي ثانية
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr = Math.floor(totalSec / 3600);
  const p2 = (n: number) => String(n).padStart(2, '0');
  if (hr > 0) return `${hr}:${p2(min)}:${p2(sec)}.${p2(cs)}`;
  if (totalSec >= 60) return `${min}:${p2(sec)}.${p2(cs)}`;
  return `${(totalSec + cs / 100).toFixed(2)}`;
}

/** حالة العدّاء المحلية → حالة النتيجة الرسمية */
export function rankingStatusToResultStatus(
  s: 'active' | 'finished' | 'dnf' | 'dq' | string
): ResultStatus {
  if (s === 'dq') return 'dq';
  if (s === 'dnf') return 'dnf';
  if (s === 'dns') return 'dns';
  return 'ok'; // finished/active
}

/** هل تظاهرة في حالة تسمح بالنشر الرسمي؟ (جارية أو منتهية — قبل الإعلان) */
export function canPublishCompetition(status: string | null | undefined): boolean {
  return status === 'running' || status === 'finished';
}

/** هل الدور يسمح بنشر النتائج؟ (مرآة سياسة results_staff_write الخادمية) */
export function canPublishResults(role: string | null | undefined): boolean {
  return role === 'executive_manager' || role === 'results_clerk';
}

/**
 * المطابقة الحاكمة: كل عدّاء منتهٍ يُطابق بتسجيل معتمد برقم الصدر في الاختصاص.
 *  • بلا مطابقة → unmatched (لا يُنشر — النتائج الرسمية للمسجلين حصراً)
 *  • صدر مكرر → أول (أسرع) يفوز بالمقعد والتكرار يُهمل بصمت (القيد الفريد خادمياً)
 *  • الترتيب حسب زمن الوصول تصاعدياً — position تسلسلي على المنشور فقط
 */
export function mapRunnersToResultRows(
  runners: readonly FinisherRow[],
  registrations: readonly RegistrableRow[],
  ctx: PublishContext,
  source: ResultSource = 'photo_finish'
): PublishMapping {
  const byBib = new Map<number, RegistrableRow>();
  for (const r of registrations ?? []) {
    if (r?.bib_number == null) continue;
    if (!byBib.has(r.bib_number)) byBib.set(r.bib_number, r);
  }
  const finishers = (runners ?? [])
    .filter((r) => r && Number.isFinite(r.finishTime) && r.finishTime > 0)
    .sort((a, b) => a.finishTime - b.finishTime);

  const rows: ResultRowInput[] = [];
  const unmatched: { bib: number; name: string }[] = [];
  const usedRegs = new Set<string>();
  for (const f of finishers) {
    const reg = byBib.get(f.bib);
    if (!reg) {
      unmatched.push({ bib: f.bib, name: f.name });
      continue;
    }
    if (usedRegs.has(reg.id)) continue; // صدر مكرر — الأسرع أُخذ
    usedRegs.add(reg.id);
    const fullName = reg.athletes
      ? `${reg.athletes.first_name} ${reg.athletes.last_name}`.trim()
      : f.name;
    rows.push({
      registration_id: reg.id,
      athlete_id: reg.athlete_id,
      club_id: reg.club_id,
      league_id: ctx.leagueId,
      competition_id: ctx.competitionId,
      event_id: ctx.eventId,
      bib_number: reg.bib_number,
      athlete_name: fullName || f.name,
      club_code: reg.clubs?.code ?? null,
      position: 0, // يُحسم بعد الحلقة
      mark_ms: Math.round(f.finishTime),
      mark_text: formatMarkMs(f.finishTime),
      status: 'ok',
      source,
      published_by: ctx.publishedBy,
    });
  }
  rows.forEach((r, i) => { r.position = i + 1; });
  return { rows, unmatched };
}

// ═══ تخزين دون اتصال للنتائج العمومية (نمط publicApi نفسه) ═══

const RESULTS_CACHE_PREFIX = 'pf_public_results_v1:';

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

export function lastResultsCacheAt(leagueId: string): number | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(`${RESULTS_CACHE_PREFIX}${leagueId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number };
    return typeof parsed.at === 'number' ? parsed.at : null;
  } catch {
    return null;
  }
}

// ═══ عمليات سحابية — مسار النشر (موظف رسمي) ═══

export interface PublishableCompetition {
  id: string;
  title_ar: string;
  title_fr: string | null;
  type: string;
  venue: string | null;
  start_date: string;
  end_date: string;
  status: string;
}

/** التظاهرات القابلة للنشر (running/finished) — RLS: أعضاء الرابطة يقرؤون */
export async function listPublishableCompetitions(
  leagueId: string
): Promise<OpResult<PublishableCompetition[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { data, error } = await sb
      .from('competitions')
      .select('id,title_ar,title_fr,type,venue,start_date,end_date,status')
      .eq('league_id', leagueId)
      .in('status', ['running', 'finished'])
      .is('deleted_at', null)
      .order('start_date', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as PublishableCompetition[] };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export interface EventOption {
  id: string;
  discipline: string;
  gender: string;
  category: string;
  status: string;
}

export async function listEventOptions(competitionId: string): Promise<OpResult<EventOption[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { data, error } = await sb
      .from('events')
      .select('id,discipline,gender,category,status')
      .eq('competition_id', competitionId)
      .order('discipline', { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as EventOption[] };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** تسجيلات معتمدة لاختصاص معيّن (للمطابقة برقم الصدر) */
export async function listApprovedRegistrations(
  eventId: string
): Promise<OpResult<RegistrableRow[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { data, error } = await sb
      .from('registrations')
      .select('id,bib_number,athlete_id,club_id,athletes(first_name,last_name),clubs(code,name_ar)')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .order('bib_number', { ascending: true, nullsFirst: false });
    if (error) return { ok: false, error: error.message };
    type Raw = RegistrableRow & {
      athletes?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
      clubs?: { code: string; name_ar: string } | { code: string; name_ar: string }[] | null;
    };
    const one = <T,>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
    const rows = (data ?? []).map((raw: unknown) => {
      const r = raw as Raw;
      return { ...r, athletes: one(r.athletes), clubs: one(r.clubs) } as RegistrableRow;
    });
    return { ok: true, data: rows };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/**
 * رفع النتائج (idempotent على event_id,registration_id).
 * الخادم يفرض: دور results_clerk/التنفيذي + جلسة aal2 (بوابة MFA RESTRICTIVE).
 */
export async function publishEventResults(rows: readonly ResultRowInput[]): Promise<OpResult<number>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  if (!rows?.length) return { ok: true, data: 0 };
  try {
    const { error } = await sb
      .from('event_results')
      .upsert(rows as unknown as Record<string, unknown>[], { onConflict: 'event_id,registration_id' });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: rows.length };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** إغلاق الاختصاص بعد نشر نتائجه (status → done) */
export async function closeEvent(eventId: string): Promise<OpResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { error } = await sb.from('events').update({ status: 'done' }).eq('id', eventId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** إعلان نتائج التظاهرة رسمياً (status → results_published — تظهر للعموم فوراً) */
export async function finalizeCompetitionResults(competitionId: string): Promise<OpResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { error } = await sb
      .from('competitions')
      .update({ status: 'results_published' })
      .eq('id', competitionId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

// ═══ قراءات عمومية — الموقع (View آمنة + كاش أوفلاين) ═══

/** صف نتيجة كما تعيده View العامة public_event_results (تهجير 0008) */
export interface PublicResultRow {
  id: string;
  event_id: string;
  competition_id: string;
  league_id: string;
  bib_number: number | null;
  athlete_name: string | null;
  club_code: string | null;
  position: number | null;
  mark_text: string | null;
  mark_ms: number | null;
  status: ResultStatus;
  source: ResultSource;
  discipline: string;
  gender: string;
  category: string;
  title_ar: string;
  title_fr: string | null;
  venue: string | null;
  start_date: string;
  end_date: string;
}

export interface FetchResult<T> {
  rows: T[];
  fromCache: boolean;
  error: string | null;
}

/**
 * نتائج رابطة معيّنة من الـ View العمومية (results_published العامة حصراً).
 * عند فشل الشبكة: آخر نسخة مخزّنة (أوفلاين أولاً — نمط publicApi نفسه).
 */
export async function fetchLeaguePublishedResults(leagueId: string): Promise<FetchResult<PublicResultRow>> {
  const key = `${RESULTS_CACHE_PREFIX}${leagueId}`;
  const sb = getSupabase();
  if (!sb) {
    const cached = readCache<PublicResultRow>(key);
    return { rows: cached ?? [], fromCache: true, error: null };
  }
  try {
    const { data, error } = await sb
      .from('public_event_results')
      .select('*')
      .eq('league_id', leagueId)
      .order('end_date', { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as PublicResultRow[];
    writeCache(key, rows);
    return { rows, fromCache: false, error: null };
  } catch (e) {
    const cached = readCache<PublicResultRow>(key);
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

/** تجميع النتائج حسب التظاهرة ثم الاختصاص — نقية وقابلة للاختبار */
export interface ResultsByCompetition {
  competition: {
    id: string;
    titleAr: string;
    titleFr: string | null;
    venue: string | null;
    endDate: string;
  };
  events: {
    eventId: string;
    discipline: string;
    gender: string;
    category: string;
    rows: PublicResultRow[];
  }[];
}

export function groupResultsByCompetition(rows: readonly PublicResultRow[]): ResultsByCompetition[] {
  const byComp = new Map<string, ResultsByCompetition>();
  for (const r of rows ?? []) {
    let bucket = byComp.get(r.competition_id);
    if (!bucket) {
      bucket = {
        competition: {
          id: r.competition_id,
          titleAr: r.title_ar,
          titleFr: r.title_fr,
          venue: r.venue,
          endDate: r.end_date,
        },
        events: [],
      };
      byComp.set(r.competition_id, bucket);
    }
    let ev = bucket.events.find((e) => e.eventId === r.event_id);
    if (!ev) {
      ev = {
        eventId: r.event_id,
        discipline: r.discipline,
        gender: r.gender,
        category: r.category,
        rows: [],
      };
      bucket.events.push(ev);
    }
    ev.rows.push(r);
  }
  // الترتيب داخل الاختصاص: المركز أولاً (nulls آخراً)، ثم الصدر
  for (const bucket of byComp.values()) {
    for (const ev of bucket.events) {
      ev.rows.sort((a, b) =>
        (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)
        || (a.bib_number ?? 0) - (b.bib_number ?? 0));
    }
  }
  // التظاهرات: الأحدث نهايةً أولاً
  return [...byComp.values()].sort((a, b) => b.competition.endDate.localeCompare(a.competition.endDate));
}
