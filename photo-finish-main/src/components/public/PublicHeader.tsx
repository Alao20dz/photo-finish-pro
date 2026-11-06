/**
 * Photo Finish Pro — ترويسة الموقع العمومي (Public Header)
 * =======================================================
 * شريط علوي رفيع: هوية المنصة/الرابطة + مبدّل اللغة + مدخل وضع المنافسة
 * + مدخل إدارة المنصة (?admin — إعادة تحميل كاملة كمدخل رسمي قديم).
 * RTL/LTR تلقائي عبر الأصناف المنطقية حصراً.
 */

import React from 'react';
import { Button, LanguageSwitcher } from '../ui';
import { router, ROUTES } from '../../services/router';
import { useLeagueTheme } from '../../hooks/useLeagueTheme';
import { useI18n } from '../../i18n';

export const PublicHeader: React.FC = () => {
  const { t } = useI18n();
  const branding = useLeagueTheme();

  const logoUrl = (() => {
    try {
      // الشعار يُضبط كقيمة url(...) في المتغير — نستخرج الرابط للعرض
      const raw = typeof getComputedStyle !== 'undefined'
        ? getComputedStyle(document.documentElement).getPropertyValue('--pf-league-logo').trim()
        : 'none';
      const m = raw.match(/^url\("(.+)"\)$/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  })();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        {/* الشعار والاسم */}
        <button
          type="button"
          onClick={() => router.navigate(ROUTES.HOME)}
          className="flex items-center gap-2.5 cursor-pointer group min-w-0"
          aria-label={t('nav_home')}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="w-9 h-9 rounded-xl object-contain bg-slate-900 border border-slate-700/60 shrink-0"
            />
          ) : (
            <span
              aria-hidden
              className="w-9 h-9 rounded-xl bg-[var(--pf-primary,#f59e0b)]/15 border border-[var(--pf-primary,#f59e0b)]/40 flex items-center justify-center text-lg shrink-0"
            >
              ⏱️
            </span>
          )}
          <span className="flex flex-col items-start min-w-0">
            <span className="font-black text-sm sm:text-base text-slate-100 truncate max-w-[45vw] group-hover:text-[var(--pf-primary,#f59e0b)] transition-colors">
              {branding?.nameAr || t('app_name')}
            </span>
            <span className="text-[10px] text-slate-500 truncate max-w-[45vw]">
              {branding?.nameFr || t('site_footer')}
            </span>
          </span>
        </button>

        <span className="flex-1" />

        {/* المداخل */}
        <nav className="flex items-center gap-2" aria-label={t('nav_home')}>
          <LanguageSwitcher className="shrink-0" />
          <Button
            variant="accent"
            size="sm"
            onClick={() => router.navigate(ROUTES.COMPETE)}
          >
            🏁 {t('site_cta_compete')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => router.navigate(ROUTES.MANAGE)}
          >
            🏛️ {t('saas_league_portal')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:inline-flex"
            onClick={() => router.navigate(ROUTES.COACH)}
          >
            🏃 {t('coach_title')}
          </Button>
          <a
            href="?admin"
            title={t('saas_admin_suite')}
            className="hidden sm:inline-flex items-center justify-center text-xs font-bold px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-slate-700/60 transition-colors"
          >
            ⚙️
          </a>
        </nav>
      </div>
    </header>
  );
};
