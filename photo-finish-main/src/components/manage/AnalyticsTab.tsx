/**
 * Photo Finish Pro — تبويب التحليلات (Manager Analytics Tab)
 * =========================================================
 * المرحلة 8: قراءة إحصاءات الرابطة المجمّعة من دالتي 0011
 * (league_analytics_daily / league_analytics_top):
 *   • بطاقات: إجمالي الزيارات، نقرات دعوة المنافسة، أيام النشاط
 *   • مخطط أعمدة يومي خالص CSS (اتجاه-آمن — أعمدة من الأسفل)
 *   • أكثر الصفحات زيارة بتسميات مترجمة
 *   • أوفلاين أولاً: آخر نسخة ناجحة من المخزن + شارة «محفوظة محلياً»
 *   • خصوصية: بلا كوكيز ولا تتبّع شخصي — شارة توضيحية دائمة
 *
 * قراءة فقط: لا withMfa ولا كتابة — RLS/الدالتان المجمّعتان هما السلطة.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody } from '../ui';
import { useI18n } from '../../i18n';
import { formatDmy } from '../../services/publicApi';
import {
  fetchLeagueAnalytics,
  pathLabelKey,
  summarizeDaily,
  type DailyRow,
  type LeagueAnalyticsResult,
} from '../../services/analyticsService';
import type { DictKey } from '../../i18n/dictionaries';

type Period = 7 | 30;

const PERIOD_KEYS: Record<Period, DictKey> = { 7: 'an_days_7', 30: 'an_days_30' };

/** أعلى قيمة يومية (لمقياس الأعمدة) — نقية */
function maxDailyViews(rows: DailyRow[]): number {
  return rows.reduce((m, r) => Math.max(m, r.views), 0);
}

export const AnalyticsTab: React.FC<{ leagueId: string }> = ({ leagueId }) => {
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>(30);
  const [state, setState] = useState<LeagueAnalyticsResult | null>(null);

  const load = useCallback(async () => {
    setState(null);
    const res = await fetchLeagueAnalytics(leagueId, period);
    setState(res);
  }, [leagueId, period]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => summarizeDaily(state?.daily ?? []), [state]);
  const maxViews = useMemo(() => maxDailyViews(state?.daily ?? []), [state]);

  return (
    <div className="space-y-4">
      {/* شريط الأدوات: الفترة + الخصوصية */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-400">{t('an_period')}:</span>
        {([7, 30] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={
              period === p
                ? 'px-3 py-1.5 rounded-xl text-xs font-black bg-[var(--pf-primary,#f59e0b)]/15 text-[var(--pf-primary,#f59e0b)] border border-[var(--pf-primary,#f59e0b)]/40 cursor-pointer'
                : 'px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 border border-slate-700 hover:text-slate-200 cursor-pointer'
            }
          >
            {t(PERIOD_KEYS[p])}
          </button>
        ))}
        <span className="flex-1" />
        <Badge tone="neutral" title={t('an_privacy_note')}>🛡️ {t('an_privacy_note')}</Badge>
        {state?.fromCache && <Badge tone="warning">📴 {t('site_offline_cached')}</Badge>}
      </div>

      {/* خطأ التحميل */}
      {state?.error && (
        <Card className="border-red-500/40">
          <CardBody>
            <p className="text-sm font-bold text-red-300">{t('an_error_load')}</p>
            <p className="text-xs text-slate-500 mt-1 break-all max-w-md">{state.error}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => void load()}>
              🔄 {t('an_retry')}
            </Button>
          </CardBody>
        </Card>
      )}

      {/* حالة التحميل */}
      {!state && (
        <Card className="animate-pulse" aria-busy>
          <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 bg-slate-800 rounded-xl" />)}
          </CardBody>
        </Card>
      )}

      {/* فراغ */}
      {state && !state.error && state.daily.length === 0 && state.top.length === 0 && (
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-4xl mb-3" aria-hidden>📈</div>
            <p className="font-bold text-slate-200">{t('an_no_data')}</p>
            <p className="text-xs text-slate-500 mt-2">{t('an_no_data_hint')}</p>
          </CardBody>
        </Card>
      )}

      {/* البطاقات + المخطط */}
      {state && !state.error && (state.daily.length > 0 || state.top.length > 0) && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card><CardBody className="py-4 text-center">
              <p className="text-2xl font-black text-[var(--pf-primary,#f59e0b)]">{totals.totalViews}</p>
              <p className="text-xs text-slate-500 mt-1">👁️ {t('an_total_views')}</p>
            </CardBody></Card>
            <Card><CardBody className="py-4 text-center">
              <p className="text-2xl font-black text-cyan-300">{totals.totalCta}</p>
              <p className="text-xs text-slate-500 mt-1">🏁 {t('an_cta_clicks')}</p>
            </CardBody></Card>
            <Card><CardBody className="py-4 text-center">
              <p className="text-2xl font-black text-slate-100">{totals.activeDays}</p>
              <p className="text-xs text-slate-500 mt-1">📅 {t('an_active_days')}</p>
            </CardBody></Card>
          </div>

          {/* المخطط اليومي (أعمدة CSS — اتجاه-آمن) */}
          {state.daily.length > 0 && (
            <Card>
              <CardBody className="space-y-3">
                <h4 className="text-sm font-black">{t('an_daily_views')}</h4>
                <div className="flex items-end gap-1.5 h-36" role="img" aria-label={t('an_daily_views')}>
                  {state.daily.map((row) => {
                    const h = maxViews > 0 ? Math.max(6, Math.round((row.views / maxViews) * 100)) : 6;
                    return (
                      <div key={row.day} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0" title={`${formatDmy(row.day)} — ${row.views}`}>
                        <span className="text-[10px] font-black text-slate-400">{row.views > 0 ? row.views : ''}</span>
                        <div
                          className="w-full rounded-t-md bg-[var(--pf-primary,#f59e0b)]/70"
                          style={{ height: `${h}%` }}
                        />
                        <span className="text-[9px] text-slate-600 font-mono truncate w-full text-center">
                          {row.day.slice(8)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          )}

          {/* أكثر الصفحات */}
          {state.top.length > 0 && (
            <Card>
              <CardBody className="space-y-2">
                <h4 className="text-sm font-black">🔗 {t('an_top_pages')}</h4>
                {state.top.map((row) => {
                  const key = pathLabelKey(row.path);
                  const maxTop = state.top[0]?.views || 1;
                  return (
                    <div key={row.path} className="flex items-center gap-3 text-xs">
                      <span className="w-14 text-end font-black text-slate-200 shrink-0">{row.views}</span>
                      <span className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <span
                          className="block h-full rounded-full bg-[var(--pf-accent,#06b6d4)]/70"
                          style={{ width: `${Math.max(8, Math.round((row.views / maxTop) * 100))}%` }}
                        />
                      </span>
                      <span className="font-bold text-slate-300 shrink-0">
                        {key ? t(key) : <span dir="ltr" className="font-mono">{row.path}</span>}
                      </span>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
