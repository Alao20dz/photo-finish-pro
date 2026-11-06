/**
 * Photo Finish Pro — موجّه Hash خفيف (Phase 2 Routing Layer)
 * =========================================================
 * - بنية ‎#/path/with/:params‎ تعمل داخل ملف PWA الأحادي ودون خادم.
 * - يتعايش مع نظام الادوار الحالي (?role=&room=) لأن hash وsearch منفصلان.
 * - الوصول إلى الموقع قابل للحقن (tests بيئة Node بلا window).
 * - المرحلة 3 (الموقع العمومي) سيبني على هذه الطبقة: #/ ثم #/league/:id.
 */

// ═══ تجريد الموقع (للاختبار وبيئات بلا نافذة) ═══

export interface RouterLocation {
  /** الجزء الحالي بعد # (بدون #) — قد يكون فارغاً */
  readonly hash: string;
  /** تنقّل فعلي */
  assign(to: string): void;
  /** استبدال التاريخ دون إضافة مدخل */
  replace(to: string): void;
}

export const windowLocation: RouterLocation = {
  get hash() {
    try {
      return typeof window !== 'undefined' ? window.location.hash : '';
    } catch {
      return '';
    }
  },
  assign(to) {
    try { window.location.hash = to; } catch { /* بيئة بلا نافذة */ }
  },
  replace(to) {
    try {
      if (typeof history !== 'undefined') history.replaceState(null, '', `#${to}`);
      else window.location.hash = to;
    } catch { /* بيئة بلا نافذة */ }
  },
};

// ═══ أدوات مسار نقية (قابلة للاختبار مباشرة) ═══

/** تطبيع مسار: يزيل # الزائد والمسافات والمائل النهائي ويطوي المائل المتكرر — '' يصبح '/' */
export function normalizePath(raw: string): string {
  let p = (raw ?? '').trim();
  if (p.startsWith('#')) p = p.slice(1);
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  p = p.replace(/\/{2,}/g, '/'); // ‎#//manage‎ → ‎#/manage‎ (مدخلات مشوهة من الروابط)
  return p === '' ? '/' : p;
}

export interface RouteMatch {
  /** اسم القالب المتطابق */
  route: string;
  /** قيم معاملات ‎:param‎ في المسار */
  params: Record<string, string>;
}

/** مطابقة مسار فعلي ضد قالب يدعم ‎:param‎ — ترجع null عند عدم التطابق */
export function matchRoute(pattern: string, actual: string): RouteMatch | null {
  const pp = normalizePath(pattern).split('/').filter(Boolean);
  const ap = normalizePath(actual).split('/').filter(Boolean);
  if (pp.length !== ap.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    const seg = pp[i];
    if (seg.startsWith(':')) {
      const name = seg.slice(1);
      const value = decodeURIComponent(ap[i]);
      if (!value) return null;
      params[name] = value;
    } else if (seg !== ap[i]) {
      return null;
    }
  }
  return { route: normalizePath(pattern), params };
}

// ═══ المسارات المعتمدة للمنصة (المرحلة 3+ تستهلكها) ═══

export const ROUTES = {
  /** الموقع العمومي (قائمة الرابطات والتظاهرات) */
  HOME: '/',
  /** بوابة رابطة محددة */
  LEAGUE: '/league/:id',
  /** وضع المنافسة (المدخل الحالي للهواتف — يمرر الادوار كبحث) */
  COMPETE: '/compete',
  /** إدارة المنصة (AdminGate) */
  ADMIN: '/admin',
  /** لوحة مدير الرابطة (دخول Supabase Auth + MFA) */
  MANAGE: '/manage',
  /** بوابة المدرب (تسجيل العدائين + الشهادات الطبية) */
  COACH: '/coach',
} as const;

// ═══ الموجّه القابل للاشتراك ═══

export type RouterListener = (path: string) => void;

export interface Router {
  /** المسار الحالي المطبّع */
  current(): string;
  /** تنقّل مع إضافة لسجل المتصفح */
  navigate(to: string): void;
  /** تنقّل مع استبدال مدخل التاريخ (لا يزيد زر الرجوع) */
  replace(to: string): void;
  /** اشتراك بتغييرات المسار — يعيد دالة إلغاء */
  subscribe(fn: RouterListener): () => void;
  /** محاولة مطابقة المسار الحالي ضد قالب */
  match(pattern: string): RouteMatch | null;
  /** استعادة المسار السابق إن وُجد */
  back(): void;
}

export function createRouter(loc: RouterLocation = windowLocation): Router {
  const listeners = new Set<RouterListener>();
  // تتبع محلي للتنقلات لتفعيل back عبر assign إلى المسار السابق
  const stack: string[] = [];

  const read = () => normalizePath(loc.hash);

  const emit = (path: string) => listeners.forEach((fn) => {
    try { fn(path); } catch { /* مستمع خاطئ لا يُسقط البقية */ }
  });

  // التقط تغييرات المتصفح (زر الرجوع/الأمام)
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('hashchange', () => emit(read()));
  }

  return {
    current: read,

    navigate(to) {
      const from = read();
      const toPath = normalizePath(to);
      if (toPath === from) return;
      stack.push(from);
      loc.assign(toPath);
      emit(toPath);
    },

    replace(to) {
      const toPath = normalizePath(to);
      loc.replace(toPath);
      emit(toPath);
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },

    match(pattern) {
      return matchRoute(pattern, read());
    },

    back() {
      const prev = stack.pop();
      if (prev !== undefined) {
        loc.assign(prev);
        emit(prev);
      }
    },
  };
}

/** موجّه مفرد للتطبيق (المرحلة 3 تستورده) */
export const router = createRouter();
