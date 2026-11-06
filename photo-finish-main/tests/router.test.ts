/**
 * اختبارات موجّه Hash — تطبيع المسارات، مطابقة القوالب، الاشتراك، التنقل.
 * بيئة Node بلا window: يُحقن RouterLocation وهمي.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  normalizePath,
  matchRoute,
  createRouter,
  ROUTES,
  windowLocation,
} from '../src/services/router';

function fakeLocation(initial = '') {
  let current = initial;
  const listeners = new Set<() => void>();
  const loc = {
    get hash() { return current; },
    assign(to: string) { current = to; listeners.forEach((f) => f()); },
    replace(to: string) { current = to; listeners.forEach((f) => f()); },
    __emit: () => listeners.forEach((f) => f()),
  };
  return loc as ReturnType<typeof Object.assign> & { __emit: () => void };
}

describe('normalizePath', () => {
  it('يطبّع الصيغ المختلفة إلى مسار نظيف', () => {
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('#')).toBe('/');
    expect(normalizePath('#/league/x/')).toBe('/league/x');
    expect(normalizePath('league/x')).toBe('/league/x');
    expect(normalizePath('  #/compete  ')).toBe('/compete');
    expect(normalizePath('/')).toBe('/');
  });
});

describe('matchRoute', () => {
  it('يطابق القوالب الثابتة والمُعاملات', () => {
    expect(matchRoute(ROUTES.HOME, '/')).toEqual({ route: '/', params: {} });
    expect(matchRoute(ROUTES.COMPETE, '/compete')).toEqual({ route: '/compete', params: {} });

    const m = matchRoute(ROUTES.LEAGUE, '/league/abc-123');
    expect(m).not.toBeNull();
    expect(m!.params.id).toBe('abc-123');

    // معاملات تُفكّ تشفيرها
    expect(matchRoute('/league/:id', '/league/%D8%A3')!.params.id).toBe('أ');
  });

  it('يرفض المسارات غير المتطابقة', () => {
    expect(matchRoute(ROUTES.HOME, '/other')).toBeNull();
    expect(matchRoute(ROUTES.LEAGUE, '/league')).toBeNull();       // معامل ناقص
    expect(matchRoute(ROUTES.LEAGUE, '/league/a/b')).toBeNull();   // قطع زائد
    expect(matchRoute('/compete', '/compete2')).toBeNull();        // قطعة مختلفة
  });
});

describe('createRouter', () => {
  it('يقرأ المسار الحالي من الموقع المحقون', () => {
    const loc = fakeLocation('#/league/x');
    const r = createRouter(loc as never);
    expect(r.current()).toBe('/league/x');
    expect(r.match(ROUTES.LEAGUE)!.params.id).toBe('x');
  });

  it('navigate يبلّغ المشتركين ويسجل السابق لـ back', () => {
    const loc = fakeLocation('#/');
    const r = createRouter(loc as never);
    const seen: string[] = [];
    const unsub = r.subscribe((p) => seen.push(p));

    r.navigate('/league/a1');
    expect(r.current()).toBe('/league/a1');
    expect(seen).toEqual(['/league/a1']);

    r.back();
    expect(r.current()).toBe('/');
    unsub();
  });

  it('navigate إلى نفس المسار لا يبلّغ مرتين', () => {
    const loc = fakeLocation('#/compete');
    const r = createRouter(loc as never);
    const fn = vi.fn();
    r.subscribe(fn);
    r.navigate('/compete');
    expect(fn).not.toHaveBeenCalled();
  });

  it('replace يستبدل دون تسجيل سجل رجوع', () => {
    const loc = fakeLocation('#/');
    const r = createRouter(loc as never);
    r.navigate('/compete');
    r.replace('/admin');
    expect(r.current()).toBe('/admin');
    r.back(); // يعود إلى '/' (المدخل الوحيد في السجل)
    expect(r.current()).toBe('/');
  });

  it('إلغاء الاشتراك يوقف التبليغ', () => {
    const loc = fakeLocation('#/');
    const r = createRouter(loc as never);
    const fn = vi.fn();
    const unsub = r.subscribe(fn);
    unsub();
    r.navigate('/compete');
    expect(fn).not.toHaveBeenCalled();
  });

  it('الموجّه الافتراضي يعمل ببيئة بلا نافذة دون انفجار', () => {
    // في بيئة Node (بلا window) يجب أن يبقى الاستيراد والقراءة آمنين
    expect(() => windowLocation.hash).not.toThrow();
    expect(typeof windowLocation.assign).toBe('function');
  });
});
