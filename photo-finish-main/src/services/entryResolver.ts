/**
 * Photo Finish Pro — مُقرّر شاشة الدخول (Entry Resolver)
 * =====================================================
 * المرحلة 3+4: جسر بين الموقع العمومي الجديد (#/) ووضع المنافسة الموجود
 * (?role=&room=) ولوحة الإدارة (?admin) ولوحة مدير الرابطة (#/manage).
 * قرار نقّي قابل للاختبار.
 *
 * أولويات الحسم (الأقدم يغلب):
 * 1. ‎?admin‎                → بوابة إدارة المنصة (سلوك قديم محفوظ حرفياً)
 * 2. ‎?role= أو ‎?room=      → وضع المنافسة مباشرة (أكواد QR للهواتف — محفوظة حرفياً)
 * 3. ‎#/league/:id‎          → صفحة رابطة في الموقع العمومي
 * 4. ‎#/compete‎             → وضع المنافسة (مدخل صريح من الموقع العمومي)
 * 5. ‎#/manage‎              → لوحة مدير الرابطة (Supabase Auth + MFA)
 * 6. ‎#/coach‎               → بوابة المدرب (العدائون + الشهادات + التقديم)
 * 7. ما عدى (بما فيه الفراغ) → الموقع العمومي (الواجهة الأمامية للمنصة)
 *
 * ملاحظة: hash وsearch مستقلان في المتصفح، لذا يتعايش المسار ‎#/league/x‎
 * مع ‎?league=x‎ (قناة الهوية) دون تعارض.
 */

import { matchRoute, normalizePath, ROUTES } from './router';

export type EntryScreen = 'admin' | 'compete' | 'public-home' | 'league' | 'manage' | 'coach';

export interface EntryResolution {
  screen: EntryScreen;
  /** معرف الرابطة عند screen === 'league' وإلا null */
  leagueId: string | null;
}

/** هل النص معرف UUID صالح؟ (يحمي من مسارات مشوهة مثل ‎#/league/..‎) */
export function isUuid(value: string | undefined | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

/**
 * حسم الشاشة الظاهرة من (hash, search) الخامين.
 * مقاوم للقيم الفارغة وبيئات بلا نافذة — لا يقرأ window بنفسه.
 */
export function resolveEntry(rawHash: string, rawSearch: string): EntryResolution {
  // 1+2) المعاملات القديمة أولاً (QR الهواتف + بوابة الأدمن) — كسر صفر
  let hasAdmin = false;
  let hasRole = false;
  let hasRoom = false;
  try {
    const params = new URLSearchParams(rawSearch || '');
    hasAdmin = params.has('admin');
    hasRole = params.has('role');
    hasRoom = params.has('room');
  } catch { /* بحث مشوه → اعتبره غائباً */ }

  if (hasAdmin) return { screen: 'admin', leagueId: null };
  if (hasRole || hasRoom) return { screen: 'compete', leagueId: null };

  // 3) صفحة رابطة في الموقع العمومي
  const path = normalizePath(rawHash || '');
  const leagueMatch = matchRoute(ROUTES.LEAGUE, path);
  if (leagueMatch && isUuid(leagueMatch.params.id)) {
    return { screen: 'league', leagueId: leagueMatch.params.id };
  }

  // 4) مدخل وضع المنافسة الصريح
  if (path === normalizePath(ROUTES.COMPETE)) {
    return { screen: 'compete', leagueId: null };
  }

  // 5) لوحة مدير الرابطة
  if (path === normalizePath(ROUTES.MANAGE)) {
    return { screen: 'manage', leagueId: null };
  }

  // 5-ب) بوابة المدرب
  if (path === normalizePath(ROUTES.COACH)) {
    return { screen: 'coach', leagueId: null };
  }

  // 6) الافتراضي: الموقع العمومي (يشمل ‎#/‎ والفراغ وأي مسار غير معروف)
  return { screen: 'public-home', leagueId: null };
}
