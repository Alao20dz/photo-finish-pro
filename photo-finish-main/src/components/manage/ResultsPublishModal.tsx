/**
 * Photo Finish Pro — نافذة النشر السحابي للنتائج (Results Publish Modal)
 * ======================================================================
 * المرحلة 6: تُفتح من منصّة التتويج في وضع المنافسة، وتغلق الحلقة:
 *   منصّة محلية → مطابقة بالتسجيلات المعتمدة (رقم الصدر) → رفع idempotent
 *   إلى event_results → إغلاق الاختصاص → إعلان النتائج رسمياً.
 *
 * الأمان (نفس معمارية لوحة المدير):
 *   • دخول موظف رابطة عبر Supabase Auth (SignInForm المشترك)
 *   • كل عملية كتابة عبر withMfa(): إن كانت الجلسة aal1 تُفتح بوابة MFA
 *     (تحدي TOTP أو تسجيل أول عامل) — والخادم يفرض البوابة نفسها وفق 0008.
 *   • الأصدرار بلا تسجيل معتمد لا تُنشر إطلاقاً (حوكمة — تُعرض كتحذير فقط).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Modal } from '../ui';
import { SignInForm } from '../auth/SignInForm';
import { MfaGateModal, type MfaGateRequest } from './MfaGateModal';
import {
  canPublishCompetition,
  canPublishResults,
  closeEvent,
  finalizeCompetitionResults,
  formatMarkMs,
  listApprovedRegistrations,
  listEventOptions,
  listPublishableCompetitions,
  mapRunnersToResultRows,
  publishEventResults,
  type EventOption,
  type FinisherRow,
  type PublishMapping,
  type PublishableCompetition,
  type RegistrableRow,
} from '../../services/resultsCloudService';
import { ensureAal2, fetchMyMemberships, onSessionChange, type AppSession, type EnsureAal2Outcome, type MyMembership } from '../../services/authService';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { useI18n } from '../../i18n';
import type { DictKey } from '../../i18n/dictionaries';

interface Props {
  open: boolean;
  onClose: () => void;
  /** منتهو السباق من المنصّة المحلية (finishTime > 0) */
  finishers: readonly FinisherRow[];
  /** تسمية سياقية للسباق المحلي (اختيارية — مثل المسافة) */
  raceLabel?: string;
}

interface PublishReport {
  published: number;
  unmatched: number;
  finalized: boolean;
  eventClosed: boolean;
}

const selectCls =
  'w-full bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 px-3 py-2 focus:outline-[var(--pf-accent,#06b6d4)]';

export const ResultsPublishModal: React.FC<Props> = ({ open, onClose, finishers, raceLabel }) => {
  const { t } = useI18n();
  const [session, setSession] = useState<AppSession | null>(null);
  const [ready, setReady] = useState(false);
  const [memberships, setMemberships] = useState<MyMembership[]>([]);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [role, setRole] = useState<MyMembership['role'] | null>(null);

  const [comps, setComps] = useState<PublishableCompetition[]>([]);
  const [compId, setCompId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [regs, setRegs] = useState<RegistrableRow[] | null>(null);

  const [closeEventFlag, setCloseEventFlag] = useState(true);
  const [finalizeFlag, setFinalizeFlag] = useState(false);

  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [report, setReport] = useState<PublishReport | null>(null);

  const [mfaRequest, setMfaRequest] = useState<MfaGateRequest | null>(null);
  const pendingAction = useRef<(() => Promise<void>) | null>(null);

  // الجلسة والعضويات
  useEffect(() => onSessionChange((s) => { setSession(s); setReady(true); }), []);
  useEffect(() => {
    if (!session) { setMemberships([]); setLeagueId(null); setRole(null); return; }
    void fetchMyMemberships(session.userId).then((m) => {
      setMemberships(m);
      if (m.length > 0) {
        setLeagueId((cur) => cur ?? m[0].leagueId);
        setRole((cur) => cur ?? m[0].role);
      }
    });
  }, [session]);

  // تحميل التظاهرات عند اختيار الرابطة
  useEffect(() => {
    setComps([]); setCompId(null);
    if (!open || !leagueId) return;
    let alive = true;
    void listPublishableCompetitions(leagueId).then((r) => {
      if (!alive) return;
      if (r.ok && r.data) setComps(r.data);
    });
    return () => { alive = false; };
  }, [open, leagueId]);

  // تحميل الاختصاصات عند اختيار التظاهرة
  useEffect(() => {
    setEvents([]); setEventId(null); setRegs(null);
    if (!compId) return;
    let alive = true;
    void listEventOptions(compId).then((r) => {
      if (!alive) return;
      if (r.ok && r.data) setEvents(r.data);
    });
    return () => { alive = false; };
  }, [compId]);

  // تحميل التسجيلات المعتمدة عند اختيار الاختصاص
  useEffect(() => {
    setRegs(null);
    if (!eventId) return;
    let alive = true;
    void listApprovedRegistrations(eventId).then((r) => {
      if (!alive) return;
      setRegs(r.ok && r.data ? r.data : []);
    });
    return () => { alive = false; };
  }, [eventId]);

  // إعادة ضبط جزئي عند فتح النافذة (الجلسة تبقى)
  useEffect(() => {
    if (open) { setErrorKey(null); setReport(null); setMfaRequest(null); }
  }, [open]);

  const ctx = { leagueId: leagueId ?? '', competitionId: compId ?? '', eventId: eventId ?? '', publishedBy: session?.userId ?? null };
  const mapping: PublishMapping | null =
    regs != null && leagueId && compId && eventId
      ? mapRunnersToResultRows(finishers, regs, ctx, 'photo_finish')
      : null;

  /** منسّق العمليات الحساسة: ضمان AAL2 ثم تنفيذ — أو فتح بوابة MFA */
  const withMfa = useCallback((action: () => Promise<void>) => {
    void (async () => {
      const outcome: EnsureAal2Outcome = await ensureAal2();
      if (outcome.kind === 'ok') { await action(); return; }
      if (outcome.kind === 'error') { setErrorKey(outcome.errorKey); return; }
      pendingAction.current = action;
      setMfaRequest(outcome.kind === 'need-code'
        ? { kind: 'need-code', factorId: outcome.factorId, challengeId: outcome.challengeId }
        : { kind: 'need-enroll' });
    })();
  }, []);

  const onMfaResolved = useCallback((aal2: boolean) => {
    setMfaRequest(null);
    if (!aal2) { setErrorKey('mfa_bad_code'); return; }
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) void action();
  }, []);

  const doPublish = useCallback(async () => {
    if (!mapping || mapping.rows.length === 0) return;
    setBusy(true);
    setErrorKey(null);
    try {
      const up = await publishEventResults(mapping.rows);
      if (!up.ok) { setErrorKey('auth_error_generic'); return; }
      let eventClosed = false;
      let finalized = false;
      if (closeEventFlag && eventId) {
        const ce = await closeEvent(eventId);
        eventClosed = ce.ok;
      }
      if (finalizeFlag && compId && canPublishCompetition('finished')) {
        const fin = await finalizeCompetitionResults(compId);
        finalized = fin.ok;
      }
      setReport({ published: mapping.rows.length, unmatched: mapping.unmatched.length, finalized, eventClosed });
    } finally {
      setBusy(false);
    }
  }, [mapping, closeEventFlag, finalizeFlag, eventId, compId]);

  const doFinalize = useCallback(async () => {
    if (!compId) return;
    setBusy(true);
    setErrorKey(null);
    try {
      const fin = await finalizeCompetitionResults(compId);
      if (fin.ok) setReport((r) => (r ? { ...r, finalized: true } : { published: 0, unmatched: 0, finalized: true, eventClosed: false }));
      else setErrorKey('auth_error_generic');
    } finally {
      setBusy(false);
    }
  }, [compId]);

  if (!open) return null;

  const writable = canPublishResults(role);

  let body: React.ReactNode;

  if (!isSupabaseConfigured) {
    body = (
      <div className="py-10 text-center">
        <div className="text-4xl mb-3" aria-hidden>📴</div>
        <p className="font-bold text-slate-300">{t('common_offline')}</p>
      </div>
    );
  } else if (!ready) {
    body = (
      <div className="py-10 text-center" aria-busy>
        <div className="w-10 h-10 mx-auto rounded-full border-2 border-slate-700 border-t-[var(--pf-primary,#f59e0b)] animate-spin" />
      </div>
    );
  } else if (!session) {
    body = (
      <div>
        <p className="text-xs font-bold text-amber-400 mb-2 text-center">🔐 {t('rp_sign_in_hint')}</p>
        <SignInForm title={t('rp_need_signin')} subtitle={t('rp_subtitle')} onBack={onClose} />
      </div>
    );
  } else if (memberships.length === 0) {
    body = (
      <div className="py-10 text-center">
        <div className="text-4xl mb-3" aria-hidden>🏛️</div>
        <p className="font-bold text-slate-200">{t('rp_need_signin')}</p>
      </div>
    );
  } else {
    const matched = mapping?.rows.length ?? 0;
    const unmatched = mapping?.unmatched.length ?? 0;
    body = (
      <div className="space-y-4">
        {/* معلومات السباق المحلي */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-400">
            🏁 {raceLabel ? `${raceLabel} — ` : ''}
            <span dir="ltr" className="font-mono font-bold text-slate-200">{finishers.length}</span> ⏱
          </span>
          <Badge tone={writable ? 'success' : 'warning'}>
            {writable ? '✓' : '👁'} {role ? t(`role_${role === 'executive_manager' ? 'executive_manager' : role}` as DictKey) : ''}
          </Badge>
        </div>

        {/* الاختيارات */}
        <div className="grid gap-3">
          <label className="block">
            <span className="block text-xs font-bold text-slate-400 mb-1">{t('rp_pick_league')}</span>
            <select className={selectCls} value={leagueId ?? ''} onChange={(e) => { setLeagueId(e.target.value); setRole(memberships.find((m) => m.leagueId === e.target.value)?.role ?? null); }}>
              {memberships.map((m) => (
                <option key={m.leagueId} value={m.leagueId}>{m.leagueNameAr} — {m.leagueWilaya}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-slate-400 mb-1">{t('rp_pick_competition')}</span>
            <select className={selectCls} value={compId ?? ''} disabled={comps.length === 0} onChange={(e) => setCompId(e.target.value || null)}>
              <option value="">—</option>
              {comps.map((c) => (
                <option key={c.id} value={c.id}>{c.title_ar} ({t('comp_status_' + c.status as DictKey)})</option>
              ))}
            </select>
            {comps.length === 0 && <span className="block text-[11px] text-slate-500 mt-1">{t('rp_no_competitions')}</span>}
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-slate-400 mb-1">{t('rp_pick_event')}</span>
            <select className={selectCls} value={eventId ?? ''} disabled={events.length === 0} onChange={(e) => setEventId(e.target.value || null)}>
              <option value="">—</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.discipline} — {ev.gender === 'M' ? '♂' : '♀'} {ev.category}</option>
              ))}
            </select>
            {events.length === 0 && compId && <span className="block text-[11px] text-slate-500 mt-1">{t('rp_no_events')}</span>}
          </label>
        </div>

        {/* المعاينة */}
        {mapping && regs != null && (
          <div className="rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-3 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300">{t('rp_match_summary', { matched, unmatched })}</span>
              <span className="font-mono text-amber-400">{formatMarkMs(mapping.rows[0]?.mark_ms ?? 0)}</span>
            </div>
            {regs.length === 0 ? (
              <p className="p-3 text-xs text-slate-400">{t('rp_no_registrations')}</p>
            ) : mapping.rows.length === 0 ? (
              <p className="p-3 text-xs text-slate-400">{t('rp_empty_finishers')}</p>
            ) : (
              <div className="max-h-44 overflow-y-auto divide-y divide-slate-800/60">
                {mapping.rows.map((r) => (
                  <div key={r.registration_id} className="px-3 py-1.5 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-6 text-center font-black text-amber-400">{r.position}</span>
                      <span className="truncate text-slate-100">{r.athlete_name}</span>
                      <span className="text-slate-500 font-mono">#{r.bib_number}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400 font-mono">{r.club_code}</span>
                      <span dir="ltr" className="font-mono font-bold text-cyan-300">{r.mark_text}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {unmatched > 0 && (
              <div className="px-3 py-2 bg-amber-500/10 border-t border-amber-500/30">
                <p className="text-[11px] font-bold text-amber-400 mb-1">⚠️ {t('rp_unmatched_title')}</p>
                <p className="text-[11px] text-amber-300/90 font-mono">
                  {mapping.unmatched.map((u) => `#${u.bib} ${u.name}`).join(' • ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* الخيارات */}
        <div className="flex flex-col gap-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-[var(--pf-primary,#f59e0b)]" checked={closeEventFlag} onChange={(e) => setCloseEventFlag(e.target.checked)} />
            <span className="text-slate-300">{t('rp_close_event')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-[var(--pf-primary,#f59e0b)]" checked={finalizeFlag} onChange={(e) => setFinalizeFlag(e.target.checked)} />
            <span className="text-slate-300">{t('rp_finalize')}</span>
          </label>
        </div>

        {errorKey && <p role="alert" className="text-xs font-bold text-red-400">{t('action_error_prefix')} {t(errorKey as DictKey)}</p>}

        {report && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs space-y-1">
            <p className="font-bold text-emerald-400">
              {report.unmatched > 0 ? t('rp_publish_partial', { count: report.published }) : t('rp_publish_ok', { count: report.published })}
            </p>
            {report.eventClosed && <p className="text-emerald-300">✓ {t('rp_close_event_ok')}</p>}
            {report.finalized && <p className="text-emerald-300">✓ {t('rp_finalize_ok')}</p>}
          </div>
        )}

        {/* الإجراءات */}
        <div className="flex gap-2">
          {!report && (
            <Button
              variant="primary"
              block
              loading={busy}
              disabled={!mapping || mapping.rows.length === 0 || !writable}
              onClick={() => withMfa(() => doPublish())}
            >
              ☁️ {busy ? t('rp_publishing') : t('rp_publish')}
            </Button>
          )}
          {report && !report.finalized && (
            <Button variant="primary" block loading={busy} disabled={!writable} onClick={() => withMfa(() => doFinalize())}>
              📣 {t('rp_finalize')}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common_cancel')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Modal open onClose={onClose} title={`☁️ ${t('rp_title')}`} subtitle={t('rp_subtitle')} size="md">
        {body}
      </Modal>
      <MfaGateModal request={mfaRequest} onResolved={onMfaResolved} onClose={() => setMfaRequest(null)} />
    </>
  );
};
