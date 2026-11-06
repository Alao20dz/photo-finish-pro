/**
 * Photo Finish Pro — صفحة رابطة عمومية (Public League Page)
 * ========================================================
 * تعرض تظاهرات الرابطة من public_competitions مجمّعة زمنياً:
 *   القادمة / الجارية / المنتهية — مع شارات الحالة الرسمية.
 * - عند التحميل تُطبَّق هوية الرابطة (ألوان + شعار) عبر loadAndApplyLeagueTheme.
 * - بيانات الرابطة نفسها تُجلب من public_leagues (صف واحد).
 * - RTL/LTR تلقائي، وأوفلاين أولاً (آخر نسخة معروفة تُعرض عند فشل الشبكة).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, type BadgeTone } from '../ui';
import { PublicHeader } from './PublicHeader';
import { router, ROUTES } from '../../services/router';
import {
  fetchPublicCompetitions,
  fetchPublicLeagueById,
  formatDmy,
  groupCompetitionsByStatus,
  pickTitle,
  todayIso,
  type CompetitionStatus,
  type FetchResult,
  type PublicCompetitionRow,
  type PublicLeagueRow,
} from '../../services/publicApi';
import { loadAndApplyLeagueTheme, sanitizeLogoUrl } from '../../services/leagueTheme';
import { useI18n } from '../../i18n';
import type { DictKey } from '../../i18n/dictionaries';

// ═══ خرائط الحالة ═══

const STATUS_KEY: Record<CompetitionStatus, DictKey> = {
  published: 'comp_status_published',
  registration_open: 'comp_status_registration_open',
  registration_closed: 'comp_closed',
  frozen: 'comp_status_frozen',
  running: 'comp_running',
  finished: 'comp_finished',
  results_published: 'comp_status_results_published',
};

const STATUS_TONE: Record<CompetitionStatus, BadgeTone> = {
  published: 'neutral',
  registration_open: 'success',
  registration_closed: 'warning',
  frozen: 'neutral',
  running: 'accent',
  finished: 'neutral',
  results_published: 'primary',
};

/** تنسيق التاريخ عبر formatDmy من publicApi (نقية وقابلة للاختبار) */

interface LeagueState {
  loading: boolean;
  league: PublicLeagueRow | null;
  error: string | null;
  fromCache: boolean;
}

export const LeaguePage: React.FC<{ leagueId: string }> = ({ leagueId }) => {
  const { t, lang } = useI18n();
  const [leagueState, setLeagueState] = useState<LeagueState>({ loading: true, league: null, error: null, fromCache: false });
  const [compsState, setCompsState] = useState<FetchResult<PublicCompetitionRow> | null>(null);

  const load = useCallback(async () => {
    setLeagueState({ loading: true, league: null, error: null, fromCache: false });
    setCompsState(null);
    const [leagueRes, compsRes] = await Promise.all([
      fetchPublicLeagueById(leagueId),
      fetchPublicCompetitions(leagueId),
    ]);
    setLeagueState({
      loading: false,
      league: leagueRes.rows[0] ?? null,
      error: leagueRes.error,
      fromCache: leagueRes.fromCache,
    });
    setCompsState(compsRes);
  }, [leagueId]);

  useEffect(() => { void load(); }, [load]);

  // هوية الرابطة تُطبَّق فور فتح صفحتها (تُحفظ محلياً أيضاً للدخول لاحقاً لوضع المنافسة)
  useEffect(() => {
    void loadAndApplyLeagueTheme(leagueId);
  }, [leagueId]);

  const grouped = useMemo(
    () => groupCompetitionsByStatus(compsState?.rows ?? [], todayIso()),
    [compsState]
  );

  const compsError = compsState?.error ?? null;
  const compsLoading = compsState === null;

  const name = leagueState.league ? pickTitle(leagueState.league, lang) : '';
  const logoUrl = sanitizeLogoUrl(leagueState.league?.logo_url ?? null);

  const renderSection = (
    id: keyof ReturnType<typeof groupCompetitionsByStatus>,
    titleKey: DictKey,
    tone: BadgeTone,
    pulse = false
  ) => {
    const list = grouped[id];
    if (list.length === 0) return null;
    return (
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-base sm:text-lg font-black">{t(titleKey)}</h3>
          <Badge tone={tone} pulse={pulse}>{list.length}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((comp) => {
            const statusTone = STATUS_TONE[comp.status];
            const statusPulse = comp.status === 'running';
            return (
              <Card key={comp.id} className="h-full">
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-black text-sm sm:text-base leading-snug">
                      {pickTitle(comp, lang)}
                    </h4>
                    <Badge tone={statusTone} pulse={statusPulse}>
                      {t(STATUS_KEY[comp.status])}
                    </Badge>
                  </div>

                  <ul className="space-y-1.5 text-xs text-slate-400">
                    {comp.venue && (
                      <li className="flex items-center gap-1.5">
                        <span aria-hidden>📍</span>
                        <span className="text-slate-500">{t('comp_venue')}:</span>
                        <span className="font-bold text-slate-300">{comp.venue}</span>
                      </li>
                    )}
                    <li className="flex items-center gap-1.5">
                      <span aria-hidden>🗓️</span>
                      <span className="text-slate-500">{t('comp_from')}</span>
                      <span className="font-mono font-bold text-slate-300">{formatDmy(comp.start_date)}</span>
                      <span className="text-slate-500">{t('comp_to')}</span>
                      <span className="font-mono font-bold text-slate-300">{formatDmy(comp.end_date)}</span>
                    </li>
                    {comp.registration_deadline && comp.status === 'registration_open' && (
                      <li className="flex items-center gap-1.5">
                        <span aria-hidden>⏳</span>
                        <span className="text-slate-500">{t('comp_deadline')}:</span>
                        <span className="font-mono font-bold text-amber-300">{formatDmy(comp.registration_deadline)}</span>
                      </li>
                    )}
                  </ul>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PublicHeader />

      {/* ترويسة الرابطة */}
      <section className="border-b border-slate-800/70">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" onClick={() => router.navigate(ROUTES.HOME)}>
            <span aria-hidden className="inline-block rtl:rotate-180">‹</span> {t('common_back')}
          </Button>

          {leagueState.loading ? (
            <div className="mt-5 flex items-center gap-4 animate-pulse" aria-busy>
              <div className="w-16 h-16 rounded-2xl bg-slate-800 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-slate-800 rounded w-1/2" />
                <div className="h-3 bg-slate-800/70 rounded w-1/3" />
              </div>
            </div>
          ) : leagueState.league ? (
            <div className="mt-5 flex items-center gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="w-16 h-16 rounded-2xl object-contain bg-slate-900 border border-slate-700/60 shrink-0"
                />
              ) : (
                <span
                  aria-hidden
                  className="w-16 h-16 rounded-2xl bg-[var(--pf-primary,#f59e0b)]/10 border border-[var(--pf-primary,#f59e0b)]/30 flex items-center justify-center text-3xl shrink-0"
                >
                  🏟️
                </span>
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-black truncate">{name}</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge tone="primary">📍 {leagueState.league.wilaya}</Badge>
                  <Badge tone="accent">#{leagueState.league.code}</Badge>
                  {leagueState.fromCache && <Badge tone="warning">📴 {t('site_offline_cached')}</Badge>}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center py-10">
              <div className="text-4xl mb-3" aria-hidden>🔍</div>
              <p className="font-bold text-slate-300">{t('league_not_found')}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => router.navigate(ROUTES.HOME)}>
                {t('nav_home')}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* التظاهرات */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {leagueState.league && (
          <>
            {compsLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardBody className="space-y-3">
                      <div className="h-4 bg-slate-800 rounded w-3/4" />
                      <div className="h-3 bg-slate-800/70 rounded w-1/2" />
                      <div className="h-3 bg-slate-800/70 rounded w-2/3" />
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}

            {!compsLoading && compsError && (
              <Card className="border-red-500/40">
                <CardBody className="text-center py-8">
                  <div className="text-3xl mb-2" aria-hidden>⚠️</div>
                  <p className="font-bold text-red-300">{t('site_error_load')}</p>
                  <p className="text-xs text-slate-500 mt-1 break-all max-w-md mx-auto">{compsError}</p>
                  <Button variant="danger" size="sm" className="mt-4" onClick={() => void load()}>
                    🔄 {t('site_retry')}
                  </Button>
                </CardBody>
              </Card>
            )}

            {!compsLoading && !compsError && compsState?.rows.length === 0 && (
              <Card>
                <CardBody className="text-center py-12">
                  <div className="text-4xl mb-3" aria-hidden>🏁</div>
                  <p className="font-bold text-slate-200">{t('league_no_comps')}</p>
                </CardBody>
              </Card>
            )}

            {!compsLoading && !compsError && compsState && compsState.rows.length > 0 && (
              <>
                {renderSection('running', 'comp_running', 'accent', true)}
                {renderSection('upcoming', 'comp_upcoming', 'primary')}
                {renderSection('finished', 'comp_finished', 'neutral')}
              </>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-800/70 py-5 text-center text-xs text-slate-600">
        {t('site_footer')} ⏱️
      </footer>
    </div>
  );
};
