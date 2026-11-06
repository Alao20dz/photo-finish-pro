/**
 * Photo Finish Pro — بوابة التحقق الثنائي (MFA Gate Modal)
 * =======================================================
 * تُفتح قبل أي عملية حساسة إن كانت الجلسة aal1 (متسق مع سياسات
 * RESTRICTIVE من المرحلة 1 — الخادم يفرضها ولو تخلّت الواجهة):
 *   • need-code: حقل رمز 6 أرقام → verifyChallenge
 *   • need-enroll: عرض QR (SVG) + السر النصي → verifyEnrollment
 * بعد النجاح يُعاد التحقق من AAL فعلياً (currentAal) قبل إبلاغ المستدعي.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal } from '../ui';
import {
  cancelChallenge,
  currentAal,
  enrollTotp,
  verifyChallenge,
  verifyEnrollment,
  type MfaEnrollment,
} from '../../services/authService';
import { useI18n } from '../../i18n';

export type MfaGateRequest =
  | { kind: 'need-code'; factorId: string; challengeId: string }
  | { kind: 'need-enroll' };

interface Props {
  request: MfaGateRequest | null;
  /** يُستدعى بـ true إذا ارتفعت الجلسة فعلاً إلى aal2 */
  onResolved: (aal2: boolean) => void;
  onClose: () => void;
}

export const MfaGateModal: React.FC<Props> = ({ request, onResolved, onClose }) => {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const isEnroll = request?.kind === 'need-enroll';

  // بدء التسجيل عند فتح وضع need-enroll
  useEffect(() => {
    if (request?.kind !== 'need-enroll') return;
    let alive = true;
    setEnrollment(null);
    setErrorKey(null);
    void (async () => {
      const res = await enrollTotp();
      if (!alive) return;
      if ('errorKey' in res) setErrorKey(res.errorKey);
      else setEnrollment(res);
    })();
    return () => { alive = false; };
  }, [request]);

  // إلغاء التحدي الجارٍ عند الإغلاق
  useEffect(() => {
    if (request?.kind === 'need-code' && request.challengeId) {
      const chId = request.challengeId;
      return () => { void cancelChallenge(chId); };
    }
    return undefined;
  }, [request]);

  useEffect(() => {
    if (request) {
      setCode('');
      setErrorKey(null);
      setTimeout(() => codeRef.current?.focus(), 120);
    }
  }, [request]);

  if (!request) return null;

  const submit = async () => {
    setBusy(true);
    setErrorKey(null);
    try {
      if (request.kind === 'need-code') {
        const res = await verifyChallenge(request.factorId, request.challengeId, code);
        if (!res.ok) { setErrorKey(res.errorKey); return; }
      } else {
        if (!enrollment) { setErrorKey('auth_error_generic'); return; }
        const res = await verifyEnrollment(enrollment.factorId, code);
        if (!res.ok) { setErrorKey(res.errorKey); return; }
      }
      // تحقق فعلي من المستوى قبل إبلاغ المستدعي (لا نعتمد الافتراض)
      const aal = await currentAal();
      onResolved(aal === 'aal2');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEnroll ? `🔐 ${t('mfa_enroll_title')}` : `🔐 ${t('mfa_gate_title')}`}
      subtitle={isEnroll ? t('mfa_enroll_body') : t('mfa_gate_body')}
      size="sm"
      hideClose={busy}
      dismissable={!busy}
    >
      <div className="space-y-4">
        {isEnroll && (
          <div className="flex flex-col items-center gap-3">
            {enrollment?.qrSvgDataUrl ? (
              <img
                src={enrollment.qrSvgDataUrl}
                alt="TOTP QR"
                className="w-44 h-44 rounded-xl bg-white p-2 border border-slate-700"
              />
            ) : (
              <div className="w-44 h-44 rounded-xl bg-slate-800 animate-pulse" aria-busy />
            )}
            {enrollment?.secret && (
              <div className="w-full text-center">
                <p className="text-[11px] text-slate-500 mb-1">{t('mfa_secret_label')}:</p>
                <code className="text-xs font-mono text-slate-300 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 select-all break-all">
                  {enrollment.secret}
                </code>
              </div>
            )}
          </div>
        )}

        <Input
          ref={codeRef}
          label={t('mfa_code_placeholder')}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6 && !busy) void submit(); }}
          error={errorKey ? t(errorKey as never) : null}
          disabled={busy || (isEnroll && !enrollment)}
          placeholder="••••••"
          className="text-center text-lg font-mono tracking-[0.4em]"
          dir="ltr"
        />

        <div className="flex gap-2">
          <Button variant="primary" block loading={busy} disabled={code.length !== 6} onClick={() => void submit()}>
            {isEnroll ? t('mfa_enroll_confirm') : t('mfa_verify')}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common_cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
