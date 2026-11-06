/**
 * Photo Finish Pro — الصفحة الرئيسية العمومية (Public Home)
 * ========================================================
 * دليل الرابطات المعتمدة (public_leagues) — واجهة المنصة الأمامية:
 *  • بطل (Hero) بهوية الرابطة النشطة أو هوية المنصة الافتراضية
 *  • شبكة بطاقات الرابطات (شعار، اسم بلغة الزائر، الولاية، الرمز)
 *  • حالات: تحميل / خطأ مع إعادة محاولة / فراغ / بيانات مخزنة دون اتصال
 *  • عند عدم وجود ‎?league=‎ تُستعاد هوية المنصة الافتراضية (reset)
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardBody } from '../ui';
import { PublicHeader } from './PublicHeader';
import { router, ROUTES } from '../../services/router';
import {
  fetchPublicLeagues,
  lastCacheAt,
  pickTitle,
  type FetchResult,
  type PublicLeagueRow,
} from '../../services/publicApi';
import { resetLeagueTheme } from '../../services/leagueTheme';
import { buildHomeMeta, applyMeta } from '../../services/seoService';
import { track } from '../../services/analyticsService';
import { useI18n } from '../../i18n';

interface HomeState {
  loading: boolean;
  result: FetchResult<PublicLeagueRow> | null;
}

export const PublicHome: React.FC = () => {
  const { t, lang } = useI18n();
  const [state, setState] = useState<HomeState>({ loading: true, result: null });

  const load = useCallback(async () => {
    setState({ loading: true, result: null });
    const result = await fetchPublicLeagues();
    setState({ loading: false, result });
  }, []);

  useEffect(() => { void load(); }, [load]);

  // هوية المنصة الافتراضية على الرئيسية — إلا إذا حُددت رابطة في الرابط
  useEffect(() => {
    try {
      const hasLeagueParam = new URLSearchParams(window.location.search).has('league');
      if (!hasLeagueParam) resetLeagueTheme();
    } catch { /* بيئة بلا نافذة */ }
  }, []);

  const leagues = state.result?.rows ?? [];
  const fromCache = state.result?.fromCache ?? false;
  const error = state.result?.error ?? null;
  const updatedAt = lastCacheAt('leagues');

  // meta الرئيسية (المرحلة 8): عنوان/وصف/OG/JSON-LD — تتحدث مع العدد واللغة
  useEffect(() => {
    applyMeta(buildHomeMeta(leagues.length, lang));
  }, [leagues.length, lang]);

  const scrollToLeagues = () => {
    document.getElementById('leagues-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PublicHeader />

      {/* البطل */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 50% -10%, var(--pf-primary-soft, rgba(245,158,11,0.35)), transparent 60%),' +
              'radial-gradient(ellipse 55% 45% at 80% 20%, var(--pf-accent-soft, rgba(6,182,212,0.35)), transparent 65%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 pt-14 pb-10 text-center">
          <h1 className="text-3xl sm:text-5xl font-black leading-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
            {t('site_hero_title')}
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-sm sm:text-base text-slate-400 leading-relaxed">
            {t('site_hero_subtitle')}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Badge tone="primary">⏱️ {t('site_chip_timing')}</Badge>
            <Badge tone="accent">📡 {t('site_chip_live')}</Badge>
            <Badge tone="neutral">📴 {t('site_chip_offline')}</Badge>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button variant="primary" size="lg" onClick={scrollToLeagues}>
              🏟️ {t('site_cta_explore')}
            </Button>
            <Button variant="outline" size="lg" onClick={() => {
              track({ kind: 'cta_click', path: '/', leagueId: null, lang });
              router.navigate(ROUTES.COMPETE);
            }}>
              🏁 {t('site_cta_compete')}
            </Button>
          </div>
        </div>
      </section>

      {/* الرابطات */}
      <section id="leagues-section" className="flex-1 max-w-6xl w-full mx-auto px-4 pb-16">
        <div className="flex items-end justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-black">{t('league_leagues')}</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">{t('site_leagues_subtitle')}</p>
          </div>
          {fromCache && leagues.length > 0 && (
            <Badge tone="warning" pulse>📴 {t('site_offline_cached')}</Badge>
          )}
        </div>

        {/* حالة التحميل */}
        {state.loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy>
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardBody className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-slate-800/70 rounded w-1/2" />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {/* حالة الخطأ */}
        {!state.loading && error && (
          <Card className="border-red-500/40">
            <CardBody className="text-center py-8">
              <div className="text-3xl mb-2" aria-hidden>⚠️</div>
              <p className="font-bold text-red-300">{t('site_error_load')}</p>
              <p className="text-xs text-slate-500 mt-1 break-all max-w-md mx-auto">{error}</p>
              <Button variant="danger" size="sm" className="mt-4" onClick={() => void load()}>
                🔄 {t('site_retry')}
              </Button>
            </CardBody>
          </Card>
        )}

        {/* حالة الفراغ */}
        {!state.loading && !error && leagues.length === 0 && (
          <Card>
            <CardBody className="text-center py-12">
              <div className="text-4xl mb-3" aria-hidden>🏟️</div>
              <p className="font-bold text-slate-200">{t('site_empty_leagues')}</p>
              <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">{t('site_empty_leagues_hint')}</p>
            </CardBody>
          </Card>
        )}

        {/* شبكة الرابطات */}
        {!state.loading && !error && leagues.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {leagues.map((league) => (
                <button
                  key={league.id}
                  type="button"
                  onClick={() => router.navigate(ROUTES.LEAGUE.replace(':id', league.id))}
                  className="text-start cursor-pointer group focus-visible:outline-2 focus-visible:outline-[var(--pf-accent,#06b6d4)] rounded-2xl"
                >
                  <Card className="h-full transition-all group-hover:border-[var(--pf-primary,#f59e0b)]/50 group-hover:-translate-y-0.5">
                    <CardBody className="flex items-center gap-3">
                      {league.logo_url ? (
                        <img
                          src={league.logo_url}
                          alt=""
                          className="w-14 h-14 rounded-2xl object-contain bg-slate-900 border border-slate-700/60 shrink-0"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="w-14 h-14 rounded-2xl bg-[var(--pf-primary,#f59e0b)]/10 border border-[var(--pf-primary,#f59e0b)]/30 flex items-center justify-center text-2xl shrink-0"
                        >
                          🏟️
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-black text-sm sm:text-base text-slate-100 truncate group-hover:text-[var(--pf-primary,#f59e0b)] transition-colors">
                          {pickTitle(league, lang)}
                        </span>
                        <span className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <Badge tone="neutral">📍 {league.wilaya}</Badge>
                          <Badge tone="accent">#{league.code}</Badge>
                        </span>
                      </span>
                      <span aria-hidden className="text-slate-600 group-hover:text-[var(--pf-primary,#f59e0b)] transition-colors text-lg inline-block rtl:rotate-180">‹</span>
                    </CardBody>
                  </Card>
                </button>
              ))}
            </div>
            {updatedAt && (
              <p className="text-center text-[11px] text-slate-600 mt-6">
                {t('site_last_update')}: {new Date(updatedAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'ar-DZ')}
              </p>
            )}
          </>
        )}
      </section>

      <footer className="border-t border-slate-800/70 py-5 text-center text-xs text-slate-600">
        {t('site_footer')} ⏱️
      </footer>
    </div>
  );
};
