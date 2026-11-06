/**
 * اختبارات المرحلة 5 — بوابة المدرب + Storage
 * ==========================================
 * 1. التوجيه: مسار ‎#/coach‎ وأولوياته أمام المعاملات القديمة
 * 2. دوال نقية: العمر، تحقق نموذج العداء، ملف الشهادة، MIME→امتداد،
 *    حالة فتح التسجيل (الأجل)
 * 3. قواعد سير التسجيل (سحب/إعادة تقديم — محاكاة منطق العميل)
 * 4. اتساق مفاتيح i18n الجديدة
 */
import { describe, it, expect } from 'vitest';

import { resolveEntry } from '../src/services/entryResolver';
import { ROUTES } from '../src/services/router';
import {
  athleteAgeAt,
  validateAthleteInput,
  validateCertFile,
  extFromMime,
  isRegistrationOpen,
  MAX_CERT_BYTES,
} from '../src/services/coachCloudService';
import { ar, fr } from '../src/i18n/dictionaries';

// ═══ 1) التوجيه ═══

describe('resolveEntry — مسار بوابة المدرب', () => {
  it('#/coach → coach', () => {
    expect(resolveEntry('#/coach', '')).toEqual({ screen: 'coach', leagueId: null });
    expect(resolveEntry('coach/', '')).toEqual({ screen: 'coach', leagueId: null });
  });

  it('المعاملات القديمة أقوى من ‎#/coach‎', () => {
    expect(resolveEntry('#/coach', '?admin').screen).toBe('admin');
    expect(resolveEntry('#/coach', '?role=finish').screen).toBe('compete');
    expect(resolveEntry('#/coach', '?room=R9').screen).toBe('compete');
  });

  it('ROUTES يحوي COACH ثابتاً', () => {
    expect(ROUTES.COACH).toBe('/coach');
  });
});

// ═══ 2) الدوال النقية ═══

describe('athleteAgeAt — حساب العمر', () => {
  it('عمر كامل يزداد في ذكرى الميلاد', () => {
    expect(athleteAgeAt('2005-03-15', '2026-03-15')).toBe(21);
    expect(athleteAgeAt('2005-03-15', '2026-03-14')).toBe(20);
    expect(athleteAgeAt('2005-03-15', '2026-03-16')).toBe(21);
  });

  it('قيم تالفة → null (بلا انفجار)', () => {
    expect(athleteAgeAt('', '2026-01-01')).toBeNull();
    expect(athleteAgeAt('bad-date', '2026-01-01')).toBeNull();
    expect(athleteAgeAt('2005-13-40', '2026-01-01')).toBeNull();
    expect(athleteAgeAt('2200-01-01', '2026-01-01')).toBeNull(); // مستقبلي → سالب → null
  });
});

describe('validateAthleteInput — تحقق النموذج', () => {
  const TODAY = '2026-11-07';
  const valid = {
    first_name: 'يوسف', last_name: 'العبدلي', gender: 'M' as const,
    birth_date: '2008-05-10', license_no: '', wilaya: '', medical_cert_expiry: '',
  };

  it('نموذج سليم يمرّ', () => {
    expect(validateAthleteInput(valid, TODAY).ok).toBe(true);
  });

  it('أسماء فارغة → form_required_missing', () => {
    expect(validateAthleteInput({ ...valid, first_name: '  ' }, TODAY)).toEqual({ ok: false, error: 'form_required_missing' });
    expect(validateAthleteInput({ ...valid, last_name: '' }, TODAY).error).toBe('form_required_missing');
  });

  it('جنس غير صالح', () => {
    expect(validateAthleteInput({ ...valid, gender: 'X' as never }, TODAY).error).toBe('athlete_bad_gender');
  });

  it('تاريخ ميلاد مشوه أو غير معقول', () => {
    expect(validateAthleteInput({ ...valid, birth_date: '10/05/2008' }, TODAY).error).toBe('form_bad_dates');
    expect(validateAthleteInput({ ...valid, birth_date: '1920-01-01' }, TODAY).error).toBe('athlete_bad_birth');
  });

  it('ترخيص بنمط خاطئ', () => {
    expect(validateAthleteInput({ ...valid, license_no: 'ليس ترخيصا!' }, TODAY).error).toBe('athlete_bad_license');
    expect(validateAthleteInput({ ...valid, license_no: 'AB-123' }, TODAY).ok).toBe(true);
  });

  it('صلاحية شهادة بنمط خاطئ', () => {
    expect(validateAthleteInput({ ...valid, medical_cert_expiry: '2027/01/01' }, TODAY).error).toBe('form_bad_dates');
  });
});

describe('validateCertFile — ملف الشهادة', () => {
  it('PDF/JPG/PNG ضمن الحجم تمرّ', () => {
    expect(validateCertFile({ type: 'application/pdf', size: 100_000 })).toBeNull();
    expect(validateCertFile({ type: 'image/jpeg', size: MAX_CERT_BYTES })).toBeNull();
    expect(validateCertFile({ type: 'image/png', size: 1 })).toBeNull();
  });

  it('نوع مرفوض', () => {
    expect(validateCertFile({ type: 'application/zip', size: 10 })).toBe('file_bad_type');
    expect(validateCertFile({ type: 'application/x-msdownload', size: 10 })).toBe('file_bad_type');
  });

  it('حجم أكبر من 5MB أو فارغ', () => {
    expect(validateCertFile({ type: 'application/pdf', size: MAX_CERT_BYTES + 1 })).toBe('file_too_large');
    expect(validateCertFile({ type: 'application/pdf', size: 0 })).toBe('file_bad_type');
    expect(validateCertFile(null)).toBe('athlete_cert_required_file');
  });
});

describe('extFromMime — امتداد آمن', () => {
  it('خرائط معروفة وافتراضي آمن', () => {
    expect(extFromMime('application/pdf')).toBe('pdf');
    expect(extFromMime('image/jpeg')).toBe('jpg');
    expect(extFromMime('image/png')).toBe('png');
    expect(extFromMime('application/zip')).toBe('bin'); // لا يسمح بمسار بشع
    expect(extFromMime(undefined)).toBe('bin');
  });
});

describe('isRegistrationOpen — الأجل والحالة', () => {
  const NOW = '2026-11-07T10:00:00Z';

  it('registration_open بلا أجل → مفتوحة', () => {
    expect(isRegistrationOpen({ status: 'registration_open', registration_deadline: null }, NOW)).toBe(true);
  });

  it('أجل مستقبلي → مفتوحة، أجل منقضٍ → مغلقة', () => {
    expect(isRegistrationOpen({ status: 'registration_open', registration_deadline: '2026-12-01T00:00:00Z' }, NOW)).toBe(true);
    expect(isRegistrationOpen({ status: 'registration_open', registration_deadline: '2026-10-01T00:00:00Z' }, NOW)).toBe(false);
  });

  it('حالة غير مفتوحة → مغلقة مهما كان الأجل', () => {
    expect(isRegistrationOpen({ status: 'published', registration_deadline: '2026-12-01T00:00:00Z' }, NOW)).toBe(false);
    expect(isRegistrationOpen({ status: 'registration_closed', registration_deadline: null }, NOW)).toBe(false);
  });
});

// ═══ 4) i18n ═══

describe('i18n — مفاتيح المرحلة 5', () => {
  it('تطابق كامل بين العربية والفرنسية بعد الإضافة', () => {
    const arKeys = Object.keys(ar);
    const frKeys = Object.keys(fr);
    expect(frKeys.length).toBe(arKeys.length);
    for (const k of arKeys) {
      expect(fr).toHaveProperty(k);
      expect((fr[k as keyof typeof fr] as string).length).toBeGreaterThan(0);
    }
  });

  it('كل مفاتيح بوابة المدرب موجودة', () => {
    const keys = [
      'coach_title', 'coach_subtitle', 'coach_no_club', 'coach_contact_league',
      'coach_club_pick', 'coach_club_not_approved', 'coach_readonly_note', 'coach_quota_note',
      'tab_athletes', 'tab_open_comps', 'tab_my_regs',
      'athlete_add', 'athlete_edit', 'athlete_first_name', 'athlete_last_name',
      'athlete_gender', 'athlete_gender_m', 'athlete_gender_f', 'athlete_birth_date',
      'athlete_license', 'athlete_license_hint', 'athlete_wilaya', 'athlete_cert_expiry',
      'athlete_cert_upload', 'athlete_cert_hint', 'athlete_cert_ok', 'athlete_cert_missing',
      'athlete_cert_required_file', 'athlete_bad_gender', 'athlete_bad_birth', 'athlete_bad_license',
      'athlete_delete_title', 'athlete_delete_body', 'athlete_empty', 'athlete_years',
      'comp_open_empty', 'reg_submit_open', 'reg_pick_event', 'reg_pick_athletes_note',
      'reg_no_events', 'reg_pick_athletes', 'reg_submit_ok', 'reg_deadline_passed',
      'reg_withdraw', 'reg_resubmit', 'reg_mine_empty', 'file_bad_type', 'file_too_large',
      'quota_warning',
    ] as const;
    for (const k of keys) {
      expect(ar).toHaveProperty(k);
      expect(fr).toHaveProperty(k);
    }
  });
});
