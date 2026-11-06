/**
 * Photo Finish Pro — مبدّل اللغة الثنائي (AR/FR)
 * =============================================
 * يستخدم مفاتيح القاموس الحالية (language/lang_ar/lang_fr) ويكشف
 * اتجاه الواجهة تلقائياً عبر I18nProvider. علامة Globe توحي بالعالمية.
 */
import React from 'react';
import { Globe } from 'lucide-react';
import { useI18n } from '../../i18n';
import { cn } from '../../utils/cn';

export const LanguageSwitcher: React.FC<{ className?: string }> = ({ className }) => {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 bg-slate-800/80 border border-slate-700 rounded-xl p-0.5',
        className
      )}
      role="group"
      aria-label={t('language')}
      title={t('language')}
    >
      <Globe className="w-3 h-3 text-slate-400 ms-1.5 shrink-0" aria-hidden />
      {(['ar', 'fr'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={cn(
            'px-2 py-1 rounded-lg text-[10px] font-black transition-colors cursor-pointer',
            lang === code
              ? 'bg-[var(--pf-primary,#f59e0b)] text-slate-950'
              : 'text-slate-300 hover:bg-slate-700/70'
          )}
        >
          {t(code === 'ar' ? 'lang_ar' : 'lang_fr')}
        </button>
      ))}
    </div>
  );
};
