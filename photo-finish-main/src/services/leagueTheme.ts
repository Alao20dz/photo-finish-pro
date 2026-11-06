/**
 * Photo Finish Pro — خدمة ثيم هوية الرابطة (League Branding Design Tokens)
 * =========================================================================
 * المرحلة 2: نظام التصميم — كل رابطة تُخصّص هويتها البصرية (ألوان + شعار)
 * عبر عمود leagues.colors (jsonb) في Supabase، وتُطبَّق كمتغيرات CSS
 * على مستوى الجذر ليستهلكها كل المكوّنات دون تعديلها.
 *
 * مبادئ:
 * 1. أوفلاين أولاً: الهوية تُخزَّن محلياً وتُطبَّق فوراً عند الإقلاع،
 *    ثم تُحدَّث من Supabase عند توفر الشبكة (تعمل التطبيقات بلا إنترنت).
 * 2. صفر حقن CSS: الألوان تُقبل فقط بصيغة ‎#RGB/#RRGGBB‎ والشعار
 *    فقط عبر https:// — أي قيمة مشبوهة تُسقط لصالح الافتراضي.
 * 3. بلا Supabase؟ التطبيق يعمل بهويته الافتراضية كاملة (Lazy null-safe).
 * 4. DOM-optional: آمنة للاستيراد في بيئات بلا نافذة (اختبارات Node/SSR).
 */

import { getSupabase } from './supabaseClient';

// ═══ الأنواع ═══

export interface LeagueColors {
  /** اللون الأساسي للرابطة (أزرار، تمييزات، توهجات) */
  primary?: string;
  /** لون التمييز الثانوي (معلومات، روابط) */
  accent?: string;
  /** خلفية الداكنة (يفضَّل أدكن جداً) */
  background?: string;
}

export interface LeagueBranding {
  leagueId: string;
  nameAr: string;
  nameFr?: string;
  logoUrl?: string;
  colors: LeagueColors;
}

// ═══ الهوية الافتراضية (هوية Photo Finish Pro الحالية) ═══

export const DEFAULT_BRANDING: Readonly<LeagueBranding> = Object.freeze({
  leagueId: '',
  nameAr: 'Photo Finish Pro',
  colors: Object.freeze({
    primary: '#f59e0b',   // amber-500
    accent: '#06b6d4',    // cyan-500
    background: '#020617' // slate-950
  })
});

const THEME_STORAGE_KEY = 'pf_league_theme_v1';

// ═══ أدوات التحقق (صفر حقن CSS) ═══

const HEX3 = /^#([0-9a-f]{3})$/i;
const HEX6 = /^#([0-9a-f]{6})$/i;

/** تطبيع لون hex: يقبل ‎#RGB أو ‎#RRGGBB ويعيد ‎#RRGGBB أو null عند البطلان */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const v = input.trim();
  let m = HEX6.exec(v);
  if (m) return `#${m[1].toLowerCase()}`;
  m = HEX3.exec(v);
  if (m) {
    const [r, g, b] = m[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

/** تحويل ‎#RRGGBB إلى "r, g, b" لمتغيرات -soft */
export function hexToRgbTriplet(hex: string): string {
  const n = normalizeHex(hex) ?? '#000000';
  return `${parseInt(n.slice(1, 3), 16)}, ${parseInt(n.slice(3, 5), 16)}, ${parseInt(n.slice(5, 7), 16)}`;
}

/** الشعار يُقبل عبر https (أو http محلياً في التطوير) حصراً — لا data: ولا javascript: */
export function sanitizeLogoUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const v = input.trim();
  if (/^https:\/\//i.test(v)) return v;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(v)) return v;
  return null;
}

/** تنظيف كائن الألوان: كل قيمة غير سليمة تُسقط (وليس التطبيق كله) */
export function sanitizeColors(raw: unknown): LeagueColors {
  const src = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const out: LeagueColors = {};
  const p = normalizeHex(src.primary);
  const a = normalizeHex(src.accent);
  const b = normalizeHex(src.background);
  if (p) out.primary = p;
  if (a) out.accent = a;
  if (b) out.background = b;
  return out;
}

/** تنظيف كائن الهوية الكامل: يضمن leagueId/nameAr نصيان آمنين */
export function sanitizeBranding(raw: unknown): LeagueBranding | null {
  const src = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const leagueId = typeof src.leagueId === 'string' ? src.leagueId.trim() : '';
  const nameAr = typeof src.nameAr === 'string' ? src.nameAr.trim() : '';
  if (!leagueId || !nameAr) return null;
  const branding: LeagueBranding = {
    leagueId: leagueId.slice(0, 64),
    nameAr: nameAr.slice(0, 80),
    colors: sanitizeColors(src.colors)
  };
  const nameFr = typeof src.nameFr === 'string' ? src.nameFr.trim() : '';
  if (nameFr) branding.nameFr = nameFr.slice(0, 80);
  const logoUrl = sanitizeLogoUrl(src.logoUrl);
  if (logoUrl) branding.logoUrl = logoUrl;
  return branding;
}

// ═══ تطبيق الثيم على مستوى الجذر ═══

function rootStyle(): CSSStyleDeclaration | null {
  if (typeof document === 'undefined') return null;
  return document.documentElement.style;
}

function pushColorsToDom(colors: LeagueColors) {
  const s = rootStyle();
  if (!s) return;
  const primary = colors.primary ?? (DEFAULT_BRANDING.colors.primary as string);
  const accent = colors.accent ?? (DEFAULT_BRANDING.colors.accent as string);
  const background = colors.background ?? (DEFAULT_BRANDING.colors.background as string);
  s.setProperty('--pf-primary', primary);
  s.setProperty('--pf-accent', accent);
  s.setProperty('--pf-bg', background);
  s.setProperty('--pf-primary-soft', `rgba(${hexToRgbTriplet(primary)}, 0.35)`);
  s.setProperty('--pf-accent-soft', `rgba(${hexToRgbTriplet(accent)}, 0.35)`);
}

// ═══ الحالة والاشتراك ═══

let activeBranding: LeagueBranding | null = null;
const listeners = new Set<() => void>();

export function getActiveLeagueTheme(): LeagueBranding | null {
  return activeBranding;
}

export function subscribeLeagueTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify() {
  listeners.forEach(fn => fn());
}

/**
 * تطبيق هوية رابطة (أو إعادتها للافتراضي بتمرير null) + حفظ محلي.
 */
export function applyLeagueTheme(branding: LeagueBranding | null): LeagueBranding | null {
  activeBranding = branding;

  const s = rootStyle();
  if (branding) {
    pushColorsToDom(branding.colors);
    s?.setProperty('--pf-league-logo', branding.logoUrl ? `url("${branding.logoUrl}")` : 'none');
  } else {
    pushColorsToDom(DEFAULT_BRANDING.colors as LeagueColors);
    s?.setProperty('--pf-league-logo', 'none');
  }

  try {
    if (typeof localStorage !== 'undefined') {
      if (branding) localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(branding));
      else localStorage.removeItem(THEME_STORAGE_KEY);
    }
  } catch { /* تخزين غير متاح */ }

  notify();
  return activeBranding;
}

/** إعادة الهوية الافتراضية ومسح المحفوظ */
export function resetLeagueTheme(): void {
  applyLeagueTheme(null);
}

// ═══ الإقلاع الأوفلاين: استرجاع الهوية المحفوظة فوراً ═══

export function restorePersistedLeagueTheme(): LeagueBranding | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
    if (!raw) return null;
    const parsed = sanitizeBranding(JSON.parse(raw));
    if (parsed) applyLeagueTheme(parsed); // إعادة تطبيع الألوان والشعار
    return parsed;
  } catch {
    return null;
  }
}

// ═══ الجلب من Supabase (يحدّث المحفوظ عند توفر الشبكة) ═══

/**
 * جلب هوية رابطة من Supabase وتطبيقها. آمنة أوفلاين: تعيد null بهدوء
 * إن لم تُضبط البيئة أو تعذر الاتصال — تبقى الهوية المحفوظة معروضة.
 */
export async function loadAndApplyLeagueTheme(leagueId: string): Promise<LeagueBranding | null> {
  const sb = getSupabase();
  if (!sb || !leagueId) return null;
  try {
    const { data, error } = await sb
      .from('leagues')
      .select('id, name_ar, name_fr, logo_url, colors, status')
      .eq('id', leagueId)
      .maybeSingle();
    if (error || !data) return null;

    // الرابطات غير النشطة تُعرض بهويتها لكن دون الاعتماد عليها؟ — نقبل النشطة فقط
    if (data.status !== 'active') return null;

    const branding = sanitizeBranding({
      leagueId: data.id,
      nameAr: data.name_ar,
      nameFr: data.name_fr ?? undefined,
      logoUrl: data.logo_url ?? undefined,
      colors: data.colors ?? {}
    });
    return branding ? applyLeagueTheme(branding) : null;
  } catch {
    return null; // أوفلاين — تبقى الهوية المحفوظة
  }
}

// استرجاع فوري عند الاستيراد (أوفلاين أولاً)
restorePersistedLeagueTheme();
