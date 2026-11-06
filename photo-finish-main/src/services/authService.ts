/**
 * Photo Finish Pro — خدمة المصادقة وبوابة MFA (Auth + MFA Gate Service)
 * ====================================================================
 * المرحلة 4: دخول مديري الرابطات عبر Supabase Auth مع فرض AAL2 على
 * العمليات الحساسة (متسق مع سياسات RLS التقييدية من المرحلة 1).
 *
 * المبدأ الذهبي: الخادم هو سلطة الإذن النهائية — هذه الخدمة توفر تجربة
 * استخدام سلسة فقط (رفع الجلسة إلى aal2 قبل العمليات الحساسة)، فلو خُطئ
 * هنا يرفض الخادم العملية، لا العكس.
 *
 * المكونات:
 *  • session tracking (onAuthStateChange) + حالة AAL الحالية
 *  • signIn / signOut مع خرائط أخطاء عربية/فرنسية (مفاتيح i18n)
 *  • عضوياتي: الرابطات والأدوار من league_members (قراءة RLS آمنة)
 *  • MFA: listFactors / enroll / challenge+verify / ensureAal2
 *    (إن كان المستوى aal1: إن كان له عامل → تحدي، وإلا → تسجيل أول عامل)
 *  • DOM-optional: كل دوال window محمية (اختبارات Node).
 */

import { getSupabase } from './supabaseClient';

// ═══ الأنواع ═══

export type AalLevel = 'aal1' | 'aal2';

export interface AppSession {
  userId: string;
  email: string | null;
  aal: AalLevel;
}

export interface MyMembership {
  leagueId: string;
  role: 'executive_manager' | 'tech_manager' | 'secretary' | 'results_clerk';
  leagueNameAr: string;
  leagueNameFr: string | null;
  leagueStatus: string;
  leagueCode: string;
  leagueWilaya: string;
}

export type AuthResult =
  | { ok: true }
  | { ok: false; errorKey: string; detail?: string };

// ═══ خرائط أخطاء Supabase → مفاتيح i18n (آمنة للعرض) ═══

export function mapAuthError(message: string | undefined | null): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'auth_wrong_credentials';
  if (m.includes('email not confirmed')) return 'auth_email_unconfirmed';
  if (m.includes('too many requests')) return 'auth_rate_limited';
  if (m.includes('rate limit')) return 'auth_rate_limited';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'auth_bad_email';
  if (m.includes('password') && (m.includes('short') || m.includes('weak') || m.includes('at least'))) return 'auth_weak_password';
  if (m.includes('signup requires a password') || m.includes('password should be')) return 'auth_weak_password';
  if (m.includes('user already registered') || m.includes('already been registered')) return 'auth_email_taken';
  if (m.includes('failed to fetch') || m.includes('network')) return 'common_offline';
  return 'auth_error_generic';
}

// ═══ الجلسة ═══

/** الجلسة الحالية مبسطة (أو null للزائر) — تقرأ AAL من خصائص الجلسة الرسمية */
export async function getAppSession(): Promise<AppSession | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    const session = data.session;
    if (!session?.user) return null;
    return {
      userId: session.user.id,
      email: session.user.email ?? null,
      aal: (session as { authenticator_assurance_level?: string }).authenticator_assurance_level === 'aal2'
        ? 'aal2'
        : 'aal1',
    };
  } catch {
    return null;
  }
}

/** الاشتراك في تغييرات الجلسة (دخول/خروج/رفع MFA) — يعيد دالة إلغاء */
export function onSessionChange(cb: (session: AppSession | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => undefined;
  let disposed = false;
  const push = async () => {
    if (disposed) return;
    cb(await getAppSession());
  };
  // دفعة أولى فورية ثم الاستماع
  void push();
  const { data } = sb.auth.onAuthStateChange(() => { void push(); });
  return () => {
    disposed = true;
    try { data.subscription.unsubscribe(); } catch { /* */ }
  };
}

// ═══ الدخول والخروج ═══

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, errorKey: 'common_offline' };
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, errorKey: 'auth_bad_email' };
  if (!password) return { ok: false, errorKey: 'auth_missing_password' };
  try {
    const { error } = await sb.auth.signInWithPassword({ email: clean, password });
    if (error) return { ok: false, errorKey: mapAuthError(error.message), detail: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, errorKey: mapAuthError(e instanceof Error ? e.message : null) };
  }
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try { await sb.auth.signOut(); } catch { /* */ }
}

// ═══ عضوياتي (الرابطات والأدوار) ═══

/**
 * رابطات المستخدم من league_members — قراءة محمية بـ RLS
 * (members_self_read تسمح بقراءة عضوياتي فقط). الأدوار المنتهية
 * برابطات غير نشطة تُعرض لكن الواجهة تحذر (الكتابة يرفضها الخادم).
 */
export async function fetchMyMemberships(userId: string): Promise<MyMembership[]> {
  const sb = getSupabase();
  if (!sb || !userId) return [];
  try {
    const { data, error } = await sb
      .from('league_members')
      .select('role, league_id, leagues(id, name_ar, name_fr, status, code, wilaya)')
      .eq('user_id', userId);
    if (error || !data) return [];
    type LeagueEmbed = {
      id: string; name_ar: string; name_fr: string | null;
      status: string; code: string; wilaya: string;
    };
    type Row = {
      role: MyMembership['role'];
      league_id: string;
      leagues: LeagueEmbed | LeagueEmbed[] | null;
    };
    const out: MyMembership[] = [];
    for (const raw of data as unknown as Row[]) {
      // PostgREST قد يعيد الربط مصفوفة أو كائناً حسب الإصدار — نطبّعهما
      const lg = Array.isArray(raw.leagues) ? raw.leagues[0] : raw.leagues;
      if (!lg) continue;
      out.push({
        leagueId: raw.league_id,
        role: raw.role,
        leagueNameAr: lg.name_ar,
        leagueNameFr: lg.name_fr,
        leagueStatus: lg.status,
        leagueCode: lg.code,
        leagueWilaya: lg.wilaya,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** هل دوري في هذه الرابطة يسمح بالكتابة؟ (مطابق لمنطق has_league_role الخادمية) */
export function canWriteLeague(role: MyMembership['role'] | string): boolean {
  return role === 'executive_manager';
}

// ═══ MFA (TOTP) ═══

export interface TotpFactor {
  id: string;
  friendlyName?: string;
}

export interface MfaEnrollment {
  factorId: string;
  qrSvgDataUrl: string | null;
  secret: string | null;
}

/** مستوى الضمان الحالي — مصدر الحقيقة الوحيد (bypass الـ AAL لسياسات RLS) */
export async function currentAal(): Promise<AalLevel> {
  const sb = getSupabase();
  if (!sb) return 'aal1';
  try {
    const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.currentLevel === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

export async function listTotpFactors(): Promise<TotpFactor[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb.auth.mfa.listFactors();
    return (data?.totp ?? []).map((f) => ({ id: f.id, friendlyName: f.friendly_name ?? undefined }));
  } catch {
    return [];
  }
}

/** بدء تسجيل عامل TOTP جديد — يعيد رمز QR (SVG data-uri) والسر النصي */
export async function enrollTotp(friendlyName = 'Photo Finish Pro'): Promise<MfaEnrollment | { errorKey: string; detail?: string }> {
  const sb = getSupabase();
  if (!sb) return { errorKey: 'common_offline' };
  try {
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName });
    if (error) return { errorKey: mapAuthError(error.message), detail: error.message };
    return {
      factorId: data.id,
      qrSvgDataUrl: data.totp?.qr_code ?? null,
      secret: data.totp?.secret ?? null,
    };
  } catch (e) {
    return { errorKey: mapAuthError(e instanceof Error ? e.message : null) };
  }
}

/** تفعيل عامل التسجيل: تحدٍّ ثم تحقق (وفق واجهة supabase-js v2 الرسمية) */
export async function verifyEnrollment(factorId: string, code: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, errorKey: 'common_offline' };
  const clean = code.replace(/\D/g, '');
  if (clean.length !== 6) return { ok: false, errorKey: 'mfa_bad_code' };
  try {
    // بعد enroll يلزم إنشاء تحدٍّ ثم التحقق منه — لا تحقق مباشر
    const { data: ch, error: chErr } = await sb.auth.mfa.challenge({ factorId });
    if (chErr || !ch) return { ok: false, errorKey: mapAuthError(chErr?.message), detail: chErr?.message };
    const { error } = await sb.auth.mfa.verify({ factorId, challengeId: ch.id, code: clean });
    if (error) return { ok: false, errorKey: mapAuthError(error.message), detail: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, errorKey: mapAuthError(e instanceof Error ? e.message : null) };
  }
}

/** بدء تحدٍّ جديد لعامل قائم */
export async function challengeTotp(factorId: string): Promise<{ challengeId: string } | { errorKey: string; detail?: string }> {
  const sb = getSupabase();
  if (!sb) return { errorKey: 'common_offline' };
  try {
    const { data, error } = await sb.auth.mfa.challenge({ factorId });
    if (error || !data) return { errorKey: mapAuthError(error?.message), detail: error?.message };
    return { challengeId: data.id };
  } catch (e) {
    return { errorKey: mapAuthError(e instanceof Error ? e.message : null) };
  }
}

/** التحقق من رمز تحدٍّ قائم (رفع الجلسة إلى aal2) */
export async function verifyChallenge(factorId: string, challengeId: string, code: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, errorKey: 'common_offline' };
  const clean = code.replace(/\D/g, '');
  if (clean.length !== 6) return { ok: false, errorKey: 'mfa_bad_code' };
  try {
    const { error } = await sb.auth.mfa.verify({ factorId, challengeId, code: clean });
    if (error) return { ok: false, errorKey: mapAuthError(error.message), detail: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, errorKey: mapAuthError(e instanceof Error ? e.message : null) };
  }
}

/**
 * إلغاء تحدٍّ جارٍ عند إغلاق النافذة — إن لم تدعم نسخة العميل واجهة
 * challengeUnmount نتجاهل بصمت (التحديات تنتهي صلاحيتها خادمياً تلقائياً).
 */
export async function cancelChallenge(challengeId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb || !challengeId) return;
  try {
    const mfa = sb.auth.mfa as unknown as {
      challengeUnmount?: (args: { challengeId: string }) => Promise<{ error: unknown }>;
    };
    if (typeof mfa.challengeUnmount === 'function') {
      await mfa.challengeUnmount({ challengeId });
    }
  } catch { /* تجاهل — لا أثر جانبي */ }
}

// ═══ المنسّق: ضمان aal2 قبل عملية حساسة ═══

export type EnsureAal2Outcome =
  | { kind: 'ok' }
  | { kind: 'need-code'; factorId: string; challengeId: string }
  | { kind: 'need-enroll' }
  | { kind: 'error'; errorKey: string; detail?: string };

/**
 * فحص مستوى الجلسة قبل عملية حساسة:
 *  • aal2 بالفعل → 'ok' (تستمر العملية فوراً)
 *  • له عامل TOTP → 'need-code' (الواجهة تعرض حقل الرمز)
 *  • بلا عامل → 'need-enroll' (الواجهة تعرض QR + السر)
 */
export async function ensureAal2(): Promise<EnsureAal2Outcome> {
  const aal = await currentAal();
  if (aal === 'aal2') return { kind: 'ok' };
  const factors = await listTotpFactors();
  if (factors.length === 0) return { kind: 'need-enroll' };
  const ch = await challengeTotp(factors[0].id);
  if ('errorKey' in ch) return { kind: 'error', errorKey: ch.errorKey, detail: ch.detail };
  return { kind: 'need-code', factorId: factors[0].id, challengeId: ch.challengeId };
}
