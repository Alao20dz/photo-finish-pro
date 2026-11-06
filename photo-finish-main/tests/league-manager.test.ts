/**
 * اختبارات المرحلة 4 — لوحة مدير الرابطة
 * =====================================
 * 1. entryResolver: مسار ‎#/manage‎ وأولوياته أمام المعاملات القديمة
 * 2. قواعد حياة التظاهرات (الانتقالات المسموحة)
 * 3. قواعد بتّ التسجيلات (لا اعتماد ذاتي من مسودة — مطابقة للخادم)
 * 4. خرائط أخطاء المصادقة → مفاتيح i18n
 * 5. تحقق الأدوار canWriteLeague (مطابق has_league_role الخادمية)
 * 6. اتساق مفاتيح i18n الجديدة
 */
import { describe, it, expect } from 'vitest';

import { resolveEntry } from '../src/services/entryResolver';
import { ROUTES } from '../src/services/router';
import {
  allowedStatusTransitions,
  isStatusTransitionAllowed,
  isDecisionAllowed,
  type CompetitionStatus,
} from '../src/services/leagueAdminService';
import { mapAuthError, canWriteLeague } from '../src/services/authService';
import { ar, fr } from '../src/i18n/dictionaries';

const UUID = '11111111-1111-4111-8111-111111111111';

// ═══ 1) التوجيه ═══

describe('resolveEntry — مسار لوحة المدير', () => {
  it('#/manage → manage', () => {
    expect(resolveEntry('#/manage', '')).toEqual({ screen: 'manage', leagueId: null });
    expect(resolveEntry('manage/', '')).toEqual({ screen: 'manage', leagueId: null });
    expect(resolveEntry('#//manage', '')).toEqual({ screen: 'manage', leagueId: null });
  });

  it('المعاملات القديمة أقوى من ‎#/manage‎ (QR الهواتف و‎?admin‎)', () => {
    expect(resolveEntry('#/manage', '?admin').screen).toBe('admin');
    expect(resolveEntry('#/manage', '?role=judge').screen).toBe('compete');
    expect(resolveEntry('#/manage', '?room=R2').screen).toBe('compete');
  });

  it('ROUTES يحوي MANAGE ثابتاً', () => {
    expect(ROUTES.MANAGE).toBe('/manage');
  });
});

// ═══ 2) حياة التظاهرات ═══

describe('allowedStatusTransitions — سلسلة الحالات', () => {
  const FLOW: CompetitionStatus[] = [
    'draft', 'published', 'registration_open', 'registration_closed',
    'frozen', 'running', 'finished', 'results_published',
  ];

  it('كل حالة تسمح بالتقدم خطوة والتراجع خطوة فقط', () => {
    for (let i = 0; i < FLOW.length; i++) {
      const allowed = allowedStatusTransitions(FLOW[i]);
      const expected: CompetitionStatus[] = [];
      if (i + 1 < FLOW.length) expected.push(FLOW[i + 1]);
      if (i - 1 >= 0) expected.push(FLOW[i - 1]);
      expect(allowed.sort()).toEqual(expected.sort());
    }
  });

  it('الحالات الطرفية: draft لا يتراجع، results_published لا يتقدم', () => {
    expect(allowedStatusTransitions('draft')).toEqual(['published']);
    expect(allowedStatusTransitions('results_published')).toEqual(['finished']);
  });

  it('isStatusTransitionAllowed: نفس الحالة مسموحة، القفزات مرفوضة', () => {
    expect(isStatusTransitionAllowed('draft', 'draft')).toBe(true);
    expect(isStatusTransitionAllowed('published', 'registration_open')).toBe(true);
    expect(isStatusTransitionAllowed('registration_open', 'published')).toBe(true); // تراجع خطوة
    expect(isStatusTransitionAllowed('draft', 'running')).toBe(false);              // قفزة
    expect(isStatusTransitionAllowed('draft', 'results_published')).toBe(false);    // قفزة كبرى
    expect(isStatusTransitionAllowed('frozen', 'published')).toBe(false);           // تراجع خطوتين
  });
});

// ═══ 3) بتّ التسجيلات ═══

describe('isDecisionAllowed — مطابقة قواعد الخادم', () => {
  it('submitted يقبل البتّ بكل الأشكال', () => {
    expect(isDecisionAllowed('submitted', 'approved')).toBe(true);
    expect(isDecisionAllowed('submitted', 'rejected')).toBe(true);
    expect(isDecisionAllowed('submitted', 'needs_edit')).toBe(true);
  });

  it('المسودة لا تُبتّ أبداً (حماية الاعتماد الذاتي)', () => {
    expect(isDecisionAllowed('draft', 'approved')).toBe(false);
    expect(isDecisionAllowed('draft', 'rejected')).toBe(false);
    expect(isDecisionAllowed('draft', 'needs_edit')).toBe(false);
  });

  it('المعتمد يمكن طلبه للتعديل فقط، والمرفوض/needs_edit لا يُلمسان', () => {
    expect(isDecisionAllowed('approved', 'needs_edit')).toBe(true);
    expect(isDecisionAllowed('approved', 'rejected')).toBe(false);
    expect(isDecisionAllowed('approved', 'approved')).toBe(false);
    expect(isDecisionAllowed('rejected', 'approved')).toBe(false);
    expect(isDecisionAllowed('needs_edit', 'approved')).toBe(false);
  });
});

// ═══ 4) أخطاء المصادقة ═══

describe('mapAuthError — خرائط أخطاء Supabase', () => {
  it('بيانات دخول خاطئة', () => {
    expect(mapAuthError('Invalid login credentials')).toBe('auth_wrong_credentials');
  });
  it('بريد غير مؤكد', () => {
    expect(mapAuthError('Email not confirmed')).toBe('auth_email_unconfirmed');
  });
  it('حد المحاولات', () => {
    expect(mapAuthError('Too many requests')).toBe('auth_rate_limited');
  });
  it('بريد تالف/مستعمل', () => {
    expect(mapAuthError('Unable to validate email address: invalid format')).toBe('auth_bad_email');
    expect(mapAuthError('User already registered')).toBe('auth_email_taken');
  });
  it('شبكة / غير معروف', () => {
    expect(mapAuthError('Failed to fetch')).toBe('common_offline');
    expect(mapAuthError('some weird server error')).toBe('auth_error_generic');
    expect(mapAuthError(null)).toBe('auth_error_generic');
  });
});

// ═══ 5) الأدوار ═══

describe('canWriteLeague — مطابق لـ has_league_role الخادمية', () => {
  it('executive_manager فقط يكتب', () => {
    expect(canWriteLeague('executive_manager')).toBe(true);
    expect(canWriteLeague('tech_manager')).toBe(false);
    expect(canWriteLeague('secretary')).toBe(false);
    expect(canWriteLeague('results_clerk')).toBe(false);
    expect(canWriteLeague('hack')).toBe(false);
  });
});

// ═══ 6) i18n ═══

describe('i18n — مفاتيح المرحلة 4', () => {
  it('تطابق كامل بين العربية والفرنسية بعد الإضافة', () => {
    const arKeys = Object.keys(ar);
    const frKeys = Object.keys(fr);
    expect(frKeys.length).toBe(arKeys.length);
    for (const k of arKeys) {
      expect(fr).toHaveProperty(k);
      expect((fr[k as keyof typeof fr] as string).length).toBeGreaterThan(0);
    }
  });

  it('كل مفاتيح اللوحة والمصادقة وMFA موجودة', () => {
    const keys = [
      'manage_title', 'manage_subtitle', 'manage_no_membership', 'manage_league_pick',
      'manage_role', 'manage_readonly_warn', 'manage_league_inactive', 'manage_signed_in_as',
      'role_executive_manager', 'role_tech_manager', 'role_secretary', 'role_results_clerk',
      'mfa_gate_title', 'mfa_gate_body', 'mfa_code_placeholder', 'mfa_verify', 'mfa_bad_code',
      'mfa_enroll_title', 'mfa_enroll_body', 'mfa_secret_label', 'mfa_enroll_confirm', 'mfa_success',
      'auth_email_unconfirmed', 'auth_rate_limited', 'auth_bad_email', 'auth_weak_password',
      'auth_email_taken', 'auth_missing_password', 'auth_error_generic',
      'tab_clubs', 'tab_competitions', 'tab_registrations',
      'club_add', 'club_name', 'club_code', 'club_quota', 'club_status_approved',
      'club_status_pending', 'club_status_suspended', 'club_empty',
      'comp_add', 'comp_title_ar', 'comp_title_fr', 'comp_type', 'comp_type_track',
      'comp_type_field', 'comp_type_cross', 'comp_type_road', 'comp_start', 'comp_end',
      'comp_visibility', 'comp_visibility_public', 'comp_visibility_unlisted', 'comp_advance',
      'comp_empty', 'comp_venue',
      'reg_status_submitted', 'reg_status_draft', 'reg_status_approved', 'reg_status_rejected',
      'reg_status_needs_edit', 'reg_athlete', 'reg_event', 'reg_approve', 'reg_reject',
      'reg_ask_edit', 'reg_note', 'reg_filter', 'reg_all', 'reg_empty', 'reg_pick_comp',
      'form_required_missing', 'form_bad_club_code', 'form_bad_dates', 'form_dates_reversed',
      'action_error_prefix', 'mfa_required_note',
    ] as const;
    for (const k of keys) {
      expect(ar).toHaveProperty(k);
      expect(fr).toHaveProperty(k);
    }
  });
});
