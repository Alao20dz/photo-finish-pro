/**
 * Photo Finish Pro — نموذج الدخول المشترك (Shared Sign-in Form)
 * ============================================================
 * يُستهلك من لوحة مدير الرابطة (#/manage) وبوابة المدرب (#/coach).
 * الأخطاء تُترجم عبر مفاتيح i18n القياسية من authService.
 */

import React, { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input } from '../ui';
import { signIn } from '../../services/authService';
import { useI18n } from '../../i18n';
import type { DictKey } from '../../i18n/dictionaries';

export const SignInForm: React.FC<{
  title?: string;
  subtitle?: string;
  onBack: () => void;
}> = ({ title, subtitle, onBack }) => {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await signIn(email, password);
    setBusy(false);
    if (!res.ok) setError(t(res.errorKey as DictKey));
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <Card>
        <CardHeader title={title ?? `🔐 ${t('auth_sign_in')}`} subtitle={subtitle ?? t('manage_subtitle')} />
        <CardBody className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); if (!busy) void submit(); }}
          >
            <Input
              label={t('auth_email')}
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              disabled={busy}
            />
            <Input
              label={t('auth_password')}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              disabled={busy}
            />
            {error && <p role="alert" className="text-xs font-bold text-red-400">{error}</p>}
            <Button type="submit" variant="primary" block loading={busy}>
              {t('auth_sign_in')}
            </Button>
          </form>
          <Button variant="ghost" size="sm" onClick={onBack}>
            <span aria-hidden className="inline-block rtl:rotate-180">‹</span> {t('common_back')}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
};
