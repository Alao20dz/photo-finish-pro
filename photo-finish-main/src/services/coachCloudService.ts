/**
 * Photo Finish Pro — خدمة المدرب السحابية (Coach Cloud Service)
 * ============================================================
 * المرحلة 5: بوابة المدرب عبر Supabase (RLS يحسم الأذون خادمياً):
 *   • سياقي: أندية المدرب المعتمدة (club_coaches → clubs → leagues)
 *   • العدائون: قائمة/إنشاء/تعديل/حذف منطقي لنادي المدرب حصراً
 *   • الشهادة الطبية: رفع PDF/JPG/PNG (≤5MB) إلى حاوية خاصة
 *     medical-certificates بمسار ‎{club_id}/{athlete_id}-{ts}.{ext}‎
 *   • التظاهرات المفتوحة: registration_open ضمن الأجل (من View عامة)
 *   • التقديم: إدراج تسجيلات بحالة submitted (صف واحد لكل عداء)
 *   • تسجيلاتي: تتبّع الحالة + سحب submitted→draft + إعادة تقديم
 *
 * أمان: لا MFA مطلوب للمدرب (الكتابات الحساسة للمدير التنفيذي فقط وفق
 * سياسات المرحلة 1) — الخادم يرفض أي كتابة خارج نادي المدرب.
 */

import { getSupabase } from './supabaseClient';
import type { Lang } from '../i18n/dictionaries';

// ═══ الأنواع ═══

export interface CoachClubContext {
  clubId: string;
  clubNameAr: string;
  clubCode: string;
  clubApproval: 'pending' | 'approved' | 'suspended';
  quotaPerEvent: number;
  leagueId: string;
  leagueNameAr: string;
  leagueStatus: string;
}

export interface AthleteRow {
  id: string;
  club_id: string;
  first_name: string;
  last_name: string;
  gender: 'M' | 'F';
  birth_date: string; // YYYY-MM-DD
  license_no: string | null;
  wilaya: string | null;
  medical_cert_path: string | null;
  medical_cert_expiry: string | null;
}

export interface AthleteInput {
  first_name: string;
  last_name: string;
  gender: 'M' | 'F';
  birth_date: string;
  license_no?: string | null;
  wilaya?: string | null;
  medical_cert_expiry?: string | null;
}

export interface OpenCompetition {
  id: string;
  league_id: string;
  title_ar: string;
  title_fr: string | null;
  type: string;
  venue: string | null;
  start_date: string;
  end_date: string;
  status: string;
  registration_deadline: string | null;
}

export interface EventRow {
  id: string;
  competition_id: string;
  discipline: string;
  gender: 'M' | 'F';
  category: string;
  status: string;
}

export interface MyRegistrationRow {
  id: string;
  competition_id: string;
  event_id: string;
  athlete_id: string;
  club_id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_edit';
  review_note: string | null;
  bib_number: number | null;
  created_at: string;
  athletes?: { first_name: string; last_name: string } | null;
  events?: { discipline: string; gender: string; category: string } | null;
  competitions?: { title_ar: string; status: string } | null;
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** عمر العداء بتاريخ مرجعي (سنة كاملة) — أو null عند بيانات تالفة */
export function athleteAgeAt(birthDate: string, refIso: string): number | null {
  if (!DATE_RE.test(birthDate ?? '') || !DATE_RE.test(refIso ?? '')) return null;
  const b = birthDate.split('-').map(Number);
  const r = refIso.split('-').map(Number);
  if (b.some(Number.isNaN) || r.some(Number.isNaN)) return null;
  // سلامة تقويمية أساسية: شهر 1-12 ويوم 1-31 (التحقق الدقيق عبر Date خادمياً)
  if (b[1] < 1 || b[1] > 12 || b[2] < 1 || b[2] > 31) return null;
  if (r[1] < 1 || r[1] > 12 || r[2] < 1 || r[2] > 31) return null;
  let age = r[0] - b[0];
  if (r[1] < b[1] || (r[1] === b[1] && r[2] < b[2])) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

export interface AthleteValidation {
  ok: boolean;
  error?: string;
}

/** تحقق نموذج العداء — نفس القيود المنطقية لقيد CHECK الخادمية */
export function validateAthleteInput(
  input: Partial<AthleteInput>,
  todayIso: string
): AthleteValidation {
  const first = (input.first_name ?? '').trim();
  const last = (input.last_name ?? '').trim();
  if (!first || !last) return { ok: false, error: 'form_required_missing' };
  if (input.gender !== 'M' && input.gender !== 'F') return { ok: false, error: 'athlete_bad_gender' };
  const bd = (input.birth_date ?? '').trim();
  if (!DATE_RE.test(bd)) return { ok: false, error: 'form_bad_dates' };
  const age = athleteAgeAt(bd, todayIso);
  if (age === null) return { ok: false, error: 'athlete_bad_birth' };
  if (age > 90) return { ok: false, error: 'athlete_bad_birth' };
  const lic = (input.license_no ?? '').trim();
  if (lic && !/^[A-Za-z0-9-]{2,20}$/.test(lic)) return { ok: false, error: 'athlete_bad_license' };
  const exp = (input.medical_cert_expiry ?? '').trim();
  if (exp && !DATE_RE.test(exp)) return { ok: false, error: 'form_bad_dates' };
  return { ok: true };
}

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
export const MAX_CERT_BYTES = 5 * 1024 * 1024; // 5MB — مطابق للحاوية

export function validateCertFile(file: { type?: string; size?: number } | null | undefined): string | null {
  if (!file) return 'athlete_cert_required_file';
  if (file.type && !ALLOWED_MIME.has(file.type)) return 'file_bad_type';
  if (typeof file.size === 'number' && file.size > MAX_CERT_BYTES) return 'file_too_large';
  if (typeof file.size === 'number' && file.size <= 0) return 'file_bad_type';
  return null;
}

/** امتداد آمن من MIME (لن ينتج مساراً بشعاً) */
export function extFromMime(mime: string | undefined | null): string {
  switch (mime) {
    case 'application/pdf': return 'pdf';
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    default: return 'bin';
  }
}

/** هل التسجيل مفتوح على هذه التظاهرة الآن؟ (حالة + أجل) */
export function isRegistrationOpen(
  comp: Pick<OpenCompetition, 'status' | 'registration_deadline'>,
  nowIso: string
): boolean {
  if (comp.status !== 'registration_open') return false;
  if (!comp.registration_deadline) return true;
  return new Date(comp.registration_deadline).getTime() > new Date(nowIso).getTime();
}

/** لقب العداء حسب لغة العرض */
export function athleteDisplayName(a: Pick<AthleteRow, 'first_name' | 'last_name'>, _lang?: Lang): string {
  return `${(a.first_name ?? '').trim()} ${(a.last_name ?? '').trim()}`.trim() || '—';
}

// ═══ السياق ═══

/** أندية المدرب المعتمدة مع رابطاتها (قراءة محمية بـ coaches_self) */
export async function fetchCoachContext(): Promise<OpResult<CoachClubContext[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { data, error } = await sb
      .from('club_coaches')
      .select('status, clubs(id, name_ar, code, approval_status, quota_per_event, league_id, leagues(id, name_ar, status))')
      .eq('user_id', (await sb.auth.getUser()).data.user?.id ?? '');
    if (error) return { ok: false, error: error.message };
    type ClubEmbed = {
      id: string; name_ar: string; code: string;
      approval_status: CoachClubContext['clubApproval'];
      quota_per_event: number;
      league_id: string;
      leagues: { id: string; name_ar: string; status: string } | { id: string; name_ar: string; status: string }[] | null;
    };
    type Row = { status: string; clubs: ClubEmbed | ClubEmbed[] | null };
    const out: CoachClubContext[] = [];
    for (const raw of (data ?? []) as unknown as Row[]) {
      if (raw.status !== 'approved') continue;
      const c = Array.isArray(raw.clubs) ? raw.clubs[0] : raw.clubs;
      if (!c) continue;
      const lg = Array.isArray(c.leagues) ? c.leagues[0] : c.leagues;
      out.push({
        clubId: c.id,
        clubNameAr: c.name_ar,
        clubCode: c.code,
        clubApproval: c.approval_status,
        quotaPerEvent: c.quota_per_event,
        leagueId: c.league_id,
        leagueNameAr: lg?.name_ar ?? '—',
        leagueStatus: lg?.status ?? 'unknown',
      });
    }
    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

// ═══ العدائون ═══

export async function listMyAthletes(clubId: string): Promise<OpResult<AthleteRow[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { data, error } = await sb
      .from('athletes')
      .select('id,club_id,first_name,last_name,gender,birth_date,license_no,wilaya,medical_cert_path,medical_cert_expiry')
      .eq('club_id', clubId)
      .is('deleted_at', null)
      .order('last_name');
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as AthleteRow[] };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function createAthlete(clubId: string, input: AthleteInput): Promise<OpResult<AthleteRow>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { data, error } = await sb
      .from('athletes')
      .insert({
        club_id: clubId,
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        gender: input.gender,
        birth_date: input.birth_date,
        license_no: input.license_no?.trim() || null,
        wilaya: input.wilaya?.trim() || null,
        medical_cert_expiry: input.medical_cert_expiry || null,
      })
      .select('id,club_id,first_name,last_name,gender,birth_date,license_no,wilaya,medical_cert_path,medical_cert_expiry')
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as AthleteRow };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function updateAthlete(athleteId: string, input: AthleteInput): Promise<OpResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { error } = await sb
      .from('athletes')
      .update({
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        gender: input.gender,
        birth_date: input.birth_date,
        license_no: input.license_no?.trim() || null,
        wilaya: input.wilaya?.trim() || null,
        medical_cert_expiry: input.medical_cert_expiry || null,
      })
      .eq('id', athleteId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** حذف منطقي — السجل يبقى للسجلات والتدقيق */
export async function softDeleteAthlete(athleteId: string): Promise<OpResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { error } = await sb.from('athletes').update({ deleted_at: new Date().toISOString() }).eq('id', athleteId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

// ═══ الشهادة الطبية (حاوية خاصة) ═══

/**
 * رفع شهادة + تحديث مسارها على العداء. المسار: ‎{clubId}/{athleteId}-{ts}.{ext}‎
 * سياسات الحاوية تقبل مجلد نادي المدرب حصراً (الخادم يفرض ذلك).
 */
export async function uploadMedicalCert(
  clubId: string,
  athleteId: string,
  file: File
): Promise<OpResult<{ path: string }>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  const bad = validateCertFile({ type: file.type, size: file.size });
  if (bad) return { ok: false, error: bad };
  const path = `${clubId}/${athleteId}-${Date.now()}.${extFromMime(file.type)}`;
  try {
    const { error } = await sb.storage
      .from('medical-certificates')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { ok: false, error: error.message };
    const upd = await sb.from('athletes').update({ medical_cert_path: path }).eq('id', athleteId);
    if (upd.error) return { ok: false, error: upd.error.message };
    return { ok: true, data: { path } };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** رابط تنزيل موقّع قصير العمر (ساعة) لعرض الشهادة — يتطلب جلسة مصرّح لها */
export async function signedCertUrl(path: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !path) return null;
  try {
    const { data } = await sb.storage.from('medical-certificates').createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

// ═══ التظاهرات والمسابقات والتقديم ═══

/** التظاهرات المفتوحة للتسجيل (من الـ View العامة) */
export async function listOpenCompetitions(): Promise<OpResult<OpenCompetition[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { data, error } = await sb
      .from('public_competitions')
      .select('id,league_id,title_ar,title_fr,type,venue,start_date,end_date,status,registration_deadline')
      .eq('status', 'registration_open')
      .order('start_date');
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as OpenCompetition[] };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function listEvents(competitionId: string): Promise<OpResult<EventRow[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { data, error } = await sb
      .from('events')
      .select('id,competition_id,discipline,gender,category,status')
      .eq('competition_id', competitionId)
      .order('discipline');
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as EventRow[] };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/**
 * تقديم تسجيلات: صف submitted لكل عداء على المسابقة المختارة.
 * يفحص الأجل أولاً (تحذيراً) — الخادم يبقى سلطة القبول النهائية.
 */
export async function submitRegistrations(
  args: {
    competitionId: string;
    eventId: string;
    clubId: string;
    athleteIds: string[];
    deadlinePassed?: boolean;
  }
): Promise<OpResult<{ inserted: number }>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  if (args.deadlinePassed) return { ok: false, error: 'reg_deadline_passed' };
  const ids = [...new Set(args.athleteIds)].filter(Boolean);
  if (ids.length === 0) return { ok: false, error: 'reg_pick_athletes' };
  try {
    const { data, error } = await sb
      .from('registrations')
      .insert(ids.map((athleteId) => ({
        competition_id: args.competitionId,
        event_id: args.eventId,
        athlete_id: athleteId,
        club_id: args.clubId,
        status: 'submitted' as const,
      })))
      .select('id');
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { inserted: data?.length ?? ids.length } };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function listMyRegistrations(clubId: string): Promise<OpResult<MyRegistrationRow[]>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { data, error } = await sb
      .from('registrations')
      .select(`
        id, competition_id, event_id, athlete_id, club_id, status, review_note, bib_number, created_at,
        athletes ( first_name, last_name ),
        events ( discipline, gender, category ),
        competitions ( title_ar, status )
      `)
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });
    if (error) return { ok: false, error: error.message };
    const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
    type Raw = Omit<MyRegistrationRow, 'athletes' | 'events' | 'competitions'> & {
      athletes?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
      events?: { discipline: string; gender: string; category: string } | { discipline: string; gender: string; category: string }[] | null;
      competitions?: { title_ar: string; status: string } | { title_ar: string; status: string }[] | null;
    };
    const rows = ((data ?? []) as unknown as Raw[]).map((r) => ({
      ...r,
      athletes: one(r.athletes),
      events: one(r.events),
      competitions: one(r.competitions),
    })) as MyRegistrationRow[];
    return { ok: true, data: rows };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** سحب تسجيل مُقدَّم (إعادته إلى مسودة) — يُسمح به عبر registrations_coach_update */
export async function withdrawRegistration(regId: string): Promise<OpResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { error } = await sb.from('registrations').update({ status: 'draft' }).eq('id', regId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** إعادة تقديم تسجيل في حالة needs_edit (بعد تصحيح المدرب) */
export async function resubmitRegistration(regId: string): Promise<OpResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'common_offline' };
  try {
    const { error } = await sb.from('registrations').update({ status: 'submitted' }).eq('id', regId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}
