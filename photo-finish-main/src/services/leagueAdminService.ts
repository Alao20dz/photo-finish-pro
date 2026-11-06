/**
 * Photo Finish Pro — خدمة إدارة الرابطة (League Admin Data Service)
 * ================================================================
 * المرحلة 4: عمليات مدير الرابطة عبر Supabase (RLS يحسم الأذون خادمياً):
 *   • الأندية: قائمة/إنشاء/تعديل حالة الاعتماد (executive_manager + AAL2 خادمياً)
 *   • التظاهرات: قائمة/إنشاء/تعديل/انتقال حالة الحياة
 *   • التسجيلات: قائمة مفصّلة (عداء/نادي/مسابقة) + بتّ (اعتماد/رفض/طلب تعديل)
 *
 * ملاحظة أمنية: كل الكتابات هنا سيرفضها الخادم إن لم تكن الجلسة aal2
 * (سياسات RESTRICTIVE من 0004/0005) أو إن لم يكن الدور executive_manager
 * (has_league_role). الواجهة تستخدم ensureAal2() قبلها فقط لتجربة أفضل.
 * كل الدوال تعيد نتيجة موحدة { ok, error? } بلا استثناءات هاربة.
 */

import { getSupabase } from './supabaseClient';

// ═══ الأنواع (أعمدة حقيقية من تهجير 0001) ═══

export interface ClubRow {
  id: string;
  league_id: string;
  name_ar: string;
  code: string;
  logo_url: string | null;
  approval_status: 'pending' | 'approved' | 'suspended';
  quota_per_event: number;
}

export type CompetitionType = 'track' | 'field' | 'cross_country' | 'road';
export type CompetitionStatus =
  | 'draft' | 'published' | 'registration_open' | 'registration_closed'
  | 'frozen' | 'running' | 'finished' | 'results_published';

export interface CompetitionRow {
  id: string;
  league_id: string;
  title_ar: string;
  title_fr: string | null;
  type: CompetitionType;
  venue: string | null;
  start_date: string;
  end_date: string;
  status: CompetitionStatus;
  registration_deadline: string | null;
  visibility: 'public' | 'unlisted';
}

export interface RegistrationRow {
  id: string;
  competition_id: string;
  event_id: string;
  athlete_id: string;
  club_id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_edit';
  review_note: string | null;
  bib_number: number | null;
  created_at: string;
  // حقول الربط للعرض فقط (embed)
  athletes?: { first_name: string; last_name: string; license_no: string | null } | null;
  clubs?: { name_ar: string; code: string } | null;
  events?: { discipline: string; gender: string; category: string } | null;
  competitions?: { title_ar: string; title_fr: string | null } | null;
}

export type OpResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) return String((e as { message: unknown }).message);
  return 'unexpected_error';
}

// ═══ قواعد الحياة (نفس قيد CHECK في الخادم) ═══

export const COMPETITION_STATUSES: readonly CompetitionStatus[] = [
  'draft', 'published', 'registration_open', 'registration_closed',
  'frozen', 'running', 'finished', 'results_published',
] as const;

/** الانتقالات المسموحة أمامياً (الخادم يفرضها عبر RLS/قيد CHECK أيضاً) */
export function allowedStatusTransitions(from: CompetitionStatus): CompetitionStatus[] {
  const idx = COMPETITION_STATUSES.indexOf(from);
  if (idx < 0) return [];
  const next = COMPETITION_STATUSES[idx + 1];
  // مسموح: التقدم خطوة، أو التراجع خطوة (إعادة فتح)، أو البقاء
  const prev = idx > 0 ? COMPETITION_STATUSES[idx - 1] : null;
  return next ? [next, ...(prev ? [prev] : [])] : prev ? [prev] : [];
}

export function isStatusTransitionAllowed(from: CompetitionStatus, to: CompetitionStatus): boolean {
  return from === to || allowedStatusTransitions(from).includes(to);
}

// ═══ الأندية ═══

export async function listClubs(leagueId: string): Promise<OpResult<ClubRow[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { data, error } = await sb
      .from('clubs')
      .select('id,league_id,name_ar,code,logo_url,approval_status,quota_per_event')
      .eq('league_id', leagueId)
      .order('name_ar');
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as ClubRow[] };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export interface ClubInput {
  name_ar: string;
  code: string;
  quota_per_event?: number;
}

export async function createClub(leagueId: string, input: ClubInput): Promise<OpResult<ClubRow>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  const name = input.name_ar.trim();
  const code = input.code.trim().toUpperCase();
  if (!name) return { ok: false, error: 'form_required_missing' };
  if (!/^[A-Z0-9-]{2,12}$/.test(code)) return { ok: false, error: 'form_bad_club_code' };
  const quota = Math.min(Math.max(Math.floor(input.quota_per_event ?? 2), 0), 20);
  try {
    const { data, error } = await sb
      .from('clubs')
      .insert({ league_id: leagueId, name_ar: name, code, quota_per_event: quota, approval_status: 'approved' })
      .select('id,league_id,name_ar,code,logo_url,approval_status,quota_per_event')
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as ClubRow };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function setClubApproval(clubId: string, status: ClubRow['approval_status']): Promise<OpResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { error } = await sb.from('clubs').update({ approval_status: status }).eq('id', clubId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

// ═══ التظاهرات ═══

export interface CompetitionInput {
  title_ar: string;
  title_fr?: string | null;
  type: CompetitionType;
  venue?: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  registration_deadline?: string | null; // ISO
  visibility?: 'public' | 'unlisted';
}

function validateCompetitionInput(input: CompetitionInput): string | null {
  if (!input.title_ar.trim()) return 'form_required_missing';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(input.end_date)) return 'form_bad_dates';
  if (input.end_date < input.start_date) return 'form_dates_reversed';
  return null;
}

export async function listCompetitions(leagueId: string): Promise<OpResult<CompetitionRow[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { data, error } = await sb
      .from('competitions')
      .select('id,league_id,title_ar,title_fr,type,venue,start_date,end_date,status,registration_deadline,visibility')
      .eq('league_id', leagueId)
      .is('deleted_at', null)
      .order('start_date', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as CompetitionRow[] };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function createCompetition(leagueId: string, input: CompetitionInput): Promise<OpResult<CompetitionRow>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  const invalid = validateCompetitionInput(input);
  if (invalid) return { ok: false, error: invalid };
  try {
    const { data, error } = await sb
      .from('competitions')
      .insert({
        league_id: leagueId,
        title_ar: input.title_ar.trim(),
        title_fr: input.title_fr?.trim() || null,
        type: input.type,
        venue: input.venue?.trim() || null,
        start_date: input.start_date,
        end_date: input.end_date,
        registration_deadline: input.registration_deadline || null,
        visibility: input.visibility ?? 'public',
        status: 'draft',
      })
      .select('id,league_id,title_ar,title_fr,type,venue,start_date,end_date,status,registration_deadline,visibility')
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as CompetitionRow };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function updateCompetitionStatus(id: string, status: CompetitionStatus): Promise<OpResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { error } = await sb.from('competitions').update({ status }).eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

// ═══ التسجيلات ═══

export type RegistrationDecision = 'approved' | 'rejected' | 'needs_edit';

/** هل الانتقال مسموح؟ (المدرب لا يعتمد ذاته — الخادم يفرض ذلك أيضاً) */
export function isDecisionAllowed(from: RegistrationRow['status'], to: RegistrationDecision): boolean {
  if (from === 'draft') return false; // مسودة المدرب الخاصة لا تُبتّ
  if (to === 'approved') return from === 'submitted';
  if (to === 'rejected') return from === 'submitted';
  if (to === 'needs_edit') return from === 'submitted' || from === 'approved';
  return false;
}

export async function listRegistrations(
  competitionId: string,
  statuses?: RegistrationRow['status'][]
): Promise<OpResult<RegistrationRow[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    let q = sb
      .from('registrations')
      .select(`
        id, competition_id, event_id, athlete_id, club_id, status, review_note, bib_number, created_at,
        athletes ( first_name, last_name, license_no ),
        clubs ( name_ar, code ),
        events ( discipline, gender, category ),
        competitions ( title_ar, title_fr )
      `)
      .eq('competition_id', competitionId)
      .order('created_at', { ascending: false });
    if (statuses && statuses.length) q = q.in('status', statuses);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    // PostgREST يعيد الربط مصفوفة أو كائناً حسب الإصدار — نطبّعها إلى كائن
    type Embed1 = { first_name: string; last_name: string; license_no: string | null };
    type Embed2 = { name_ar: string; code: string };
    type Embed3 = { discipline: string; gender: string; category: string };
    type Embed4 = { title_ar: string; title_fr: string | null };
    type Raw = Omit<RegistrationRow, 'athletes' | 'clubs' | 'events' | 'competitions'> & {
      athletes?: Embed1 | Embed1[] | null;
      clubs?: Embed2 | Embed2[] | null;
      events?: Embed3 | Embed3[] | null;
      competitions?: Embed4 | Embed4[] | null;
    };
    const one = <T,>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
    const rows = (data ?? []).map((raw: unknown) => {
      const r = raw as Raw;
      return {
        ...r,
        athletes: one(r.athletes),
        clubs: one(r.clubs),
        events: one(r.events),
        competitions: one(r.competitions),
      } as RegistrationRow;
    });
    return { ok: true, data: rows };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function decideRegistration(
  regId: string,
  decision: RegistrationDecision,
  reviewNote?: string
): Promise<OpResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { error } = await sb
      .from('registrations')
      .update({ status: decision, review_note: reviewNote?.trim() || null })
      .eq('id', regId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}
