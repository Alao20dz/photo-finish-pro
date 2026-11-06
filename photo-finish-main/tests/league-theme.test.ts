import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeHex,
  hexToRgbTriplet,
  sanitizeLogoUrl,
  sanitizeColors,
  sanitizeBranding,
  applyLeagueTheme,
  resetLeagueTheme,
  getActiveLeagueTheme,
  subscribeLeagueTheme,
  restorePersistedLeagueTheme,
  DEFAULT_BRANDING
} from '../src/services/leagueTheme';

describe('Phase 2: League Branding Design Tokens', () => {
  beforeEach(() => {
    resetLeagueTheme();
  });

  it('normalizes hex colors and rejects injection attempts', () => {
    expect(normalizeHex('#f59e0b')).toBe('#f59e0b');
    expect(normalizeHex('#F59E0B')).toBe('#f59e0b');
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('url(javascript:alert(1))')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex(null)).toBeNull();
    expect(normalizeHex(42)).toBeNull();
    // محاولة حقن عبر CSS var — يجب ألا تمر أبداً
    expect(normalizeHex('#000;--evil:1')).toBeNull();
  });

  it('converts hex to rgb triplets for soft glow variables', () => {
    expect(hexToRgbTriplet('#f59e0b')).toBe('245, 158, 11');
    expect(hexToRgbTriplet('#abc')).toBe('170, 187, 204');
    expect(hexToRgbTriplet('nonsense')).toBe('0, 0, 0'); // أمان عند الفشل
  });

  it('accepts only safe logo URLs (no data:/javascript:)', () => {
    expect(sanitizeLogoUrl('https://league.dz/logo.png')).toBe('https://league.dz/logo.png');
    expect(sanitizeLogoUrl('http://localhost:5173/logo.png')).toBe('http://localhost:5173/logo.png');
    expect(sanitizeLogoUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeLogoUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(sanitizeLogoUrl('//evil.example/x')).toBeNull();
    expect(sanitizeLogoUrl(undefined)).toBeNull();
  });

  it('sanitizes colors object by dropping invalid entries only', () => {
    const out = sanitizeColors({ primary: '#10b981', accent: 'garbage', background: 123 });
    expect(out).toEqual({ primary: '#10b981' });
    expect(sanitizeColors(null)).toEqual({});
    expect(sanitizeColors('not-an-object')).toEqual({});
  });

  it('sanitizes full branding and requires identity fields', () => {
    const ok = sanitizeBranding({
      leagueId: 'uuid-1',
      nameAr: 'رابطة وهران',
      nameFr: 'Ligue d\'Oran',
      logoUrl: 'https://x.dz/l.png',
      colors: { primary: '#22d3ee' }
    });
    expect(ok).not.toBeNull();
    expect(ok!.leagueId).toBe('uuid-1');
    expect(ok!.nameFr).toBe('Ligue d\'Oran');
    expect(ok!.colors.primary).toBe('#22d3ee');

    // بلا معرف أو اسم → رفض كامل
    expect(sanitizeBranding({ nameAr: 'بلا معرف' })).toBeNull();
    expect(sanitizeBranding({ leagueId: 'x' })).toBeNull();
    expect(sanitizeBranding(null)).toBeNull();

    // أسماء طويلة تُقتطع (حماية التخطيط)
    const long = sanitizeBranding({ leagueId: 'u', nameAr: 'ا'.repeat(200) });
    expect(long!.nameAr.length).toBe(80);

    // شعار خبيث يُسقط مع بقاء باقي الهوية
    const mixed = sanitizeBranding({ leagueId: 'u', nameAr: 'ر', logoUrl: 'javascript:x' });
    expect(mixed!.logoUrl).toBeUndefined();
  });

  it('applies, subscribes, and resets the league theme (DOM-safe in Node)', () => {
    let notified = 0;
    const unsub = subscribeLeagueTheme(() => { notified++; });

    expect(getActiveLeagueTheme()).toBeNull();

    const branding = sanitizeBranding({
      leagueId: 'L1',
      nameAr: 'رابطة الاختبار',
      colors: { primary: '#ef4444', accent: '#8b5cf6' }
    })!;
    const applied = applyLeagueTheme(branding);

    expect(applied!.leagueId).toBe('L1');
    expect(getActiveLeagueTheme()!.colors.primary).toBe('#ef4444');
    expect(notified).toBe(1);

    resetLeagueTheme();
    expect(getActiveLeagueTheme()).toBeNull();
    expect(notified).toBe(2);

    unsub();
    applyLeagueTheme(branding);
    expect(notified).toBe(2); // لا إشعار بعد إلغاء الاشتراك
    resetLeagueTheme();
  });

  it('keeps default branding integrity (no mutation possible)', () => {
    expect(DEFAULT_BRANDING.colors.primary).toBe('#f59e0b');
    expect(DEFAULT_BRANDING.colors.accent).toBe('#06b6d4');
    expect(DEFAULT_BRANDING.colors.background).toBe('#020617');
    expect(Object.isFrozen(DEFAULT_BRANDING)).toBe(true);
  });

  it('restorePersistedLeagueTheme is null-safe without storage', () => {
    // في بيئة Node بلا localStorage — يجب أن تعيد null بهدوء بلا استثناءات
    expect(restorePersistedLeagueTheme()).toBeNull();
  });
});
