/**
 * Photo Finish Pro — لوحة مدير الرابطة (League Manager Portal)
 * ===========================================================
 * المرحلة 4: بوابة إدارة رابطة واحدة عبر ‎#/manage‎:
 *   1. زائر → نموذج دخول (بريد + كلمة مرور، Supabase Auth)
 *   2. مسجّل بلا عضويات → إرشاد للتواصل مع إدارة المنصة
 *   3. مسجّل بعضويات → اختيار الرابطة + تبويبات:
 *        الأندية / التظاهرات / التسجيلات
 *   4. كل عملية كتابة حساسة تمر عبر withMfa(): إن كانت الجلسة aal1
 *      تُفتح بوابة MFA (تحدي أو تسجيل أول عامل) ثم تُنفّذ العملية.
 *
 * ملاحظة أمنية: القراءة فقط للأدوار غير التنفيذية وللرابطات غير النشطة —
 * والخادم يفرض الأذون نفسها عبر RLS (لا نعتمد على إخفاء الأزرار).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader, Input, Modal } from '../ui';
import { SignInForm } from '../auth/SignInForm';
import { MfaGateModal, type MfaGateRequest } from './MfaGateModal';
import { PublicHeader } from '../public/PublicHeader';
import {
  canWriteLeague,
  ensureAal2,
  fetchMyMemberships,
  onSessionChange,
  signOut,
  type AppSession,
  type EnsureAal2Outcome,
  type MyMembership,
} from '../../services/authService';
import { useLiveSignals } from '../../hooks/useLiveSignals';
import { liveBadge } from '../../services/realtimeService';
import {
  allowedStatusTransitions,
  createClub,
  createCompetition,
  decideRegistration,
  isDecisionAllowed,
  isStatusTransitionAllowed,
  listClubs,
  listCompetitions,
  listRegistrations,
  setClubApproval,
  updateCompetitionStatus,
  type ClubRow,
  type CompetitionInput,
  type CompetitionRow,
  type CompetitionStatus,
  type CompetitionType,
  type RegistrationDecision,
  type RegistrationRow,
} from '../../services/leagueAdminService';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { formatDmy } from '../../services/publicApi';
import { useI18n } from '../../i18n';
import type { DictKey } from '../../i18n/dictionaries';

type Tab = 'clubs' | 'competitions' | 'registrations';

const ROLE_KEY: Record<MyMembership['role'], DictKey> = {
  executive_manager: 'role_executive_manager',
  tech_manager: 'role_tech_manager',
  secretary: 'role_secretary',
  results_clerk: 'role_results_clerk',
};

const CLUB_STATUS_TONE = { approved: 'success', pending: 'warning', suspended: 'danger' } as const;
const CLUB_STATUS_KEY = { approved: 'club_status_approved', pending: 'club_status_pending', suspended: 'club_status_suspended' } as const;

const COMP_TYPE_KEY: Record<CompetitionType, DictKey> = {
  track: 'comp_type_track',
  field: 'comp_type_field',
  cross_country: 'comp_type_cross',
  road: 'comp_type_road',
};

const REG_STATUS_TONE = {
  draft: 'neutral', submitted: 'warning', approved: 'success', rejected: 'danger', needs_edit: 'accent',
} as const;
const REG_STATUS_KEY = {
  draft: 'reg_status_draft', submitted: 'reg_status_submitted', approved: 'reg_status_approved',
  rejected: 'reg_status_rejected', needs_edit: 'reg_status_needs_edit',
} as const;

// ═══ اللوحة ═══

export const LeagueManagerPortal: React.FC = () => {
  const { t } = useI18n();
  const [session, setSession] = useState<AppSession | null>(null);
  const [ready, setReady] = useState(false);
  const [memberships, setMemberships] = useState<MyMembership[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('clubs');
  const [mfaRequest, setMfaRequest] = useState<MfaGateRequest | null>(null);
  const pendingAction = useRef<(() => Promise<void>) | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => onSessionChange((s) => { setSession(s); setReady(true); }), []);

  useEffect(() => {
    if (!session) { setMemberships([]); setSelectedLeagueId(null); return; }
    void fetchMyMemberships(session.userId).then((m) => {
      setMemberships(m);
      if (m.length > 0) setSelectedLeagueId((cur) => cur ?? m[0].leagueId);
    });
  }, [session]);

  const selected = useMemo(
    () => memberships.find((m) => m.leagueId === selectedLeagueId) ?? null,
    [memberships, selectedLeagueId]
  );

  const flash = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /** منسّق العمليات الحساسة: ضمان AAL2 ثم تنفيذ — أو فتح بوابة MFA */
  const withMfa = useCallback((action: () => Promise<void>) => {
    void (async () => {
      const outcome: EnsureAal2Outcome = await ensureAal2();
      if (outcome.kind === 'ok') { await action(); return; }
      if (outcome.kind === 'error') { flash('err', `${t('action_error_prefix')} ${t(outcome.errorKey as DictKey)}`); return; }
      pendingAction.current = action;
      setMfaRequest(outcome.kind === 'need-code'
        ? { kind: 'need-code', factorId: outcome.factorId, challengeId: outcome.challengeId }
        : { kind: 'need-enroll' });
    })();
  }, [flash, t]);

  const onMfaResolved = useCallback((aal2: boolean) => {
    setMfaRequest(null);
    if (!aal2) { flash('err', t('mfa_bad_code')); return; }
    flash('ok', t('mfa_success'));
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) void action();
  }, [flash, t]);

  // ═══ العرض ═══

  let body: React.ReactNode;

  if (!isSupabaseConfigured) {
    body = (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-3" aria-hidden>📴</div>
        <p className="font-bold text-slate-300">{t('common_offline')}</p>
      </div>
    );
  } else if (!ready) {
    body = (
      <div className="max-w-md mx-auto px-4 py-16 text-center" aria-busy>
        <div className="w-10 h-10 mx-auto rounded-full border-2 border-slate-700 border-t-[var(--pf-primary,#f59e0b)] animate-spin" />
      </div>
    );
  } else if (!session) {
    body = <SignInForm onBack={() => { window.location.hash = '#/'; }} />;
  } else if (memberships.length === 0) {
    body = (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-3" aria-hidden>🏛️</div>
        <p className="font-bold text-slate-200">{t('manage_no_membership')}</p>
        <p className="text-sm text-slate-500 mt-2">{t('manage_contact_platform')}</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => void signOut()}>
          {t('auth_sign_out')}
        </Button>
      </div>
    );
  } else {
    const writable = !!selected && canWriteLeague(selected.role) && selected.leagueStatus === 'active';
    body = (
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* الترويسة المحلية */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black">{t('manage_title')}</h1>
            <p className="text-xs text-slate-500 truncate max-w-[60vw]">
              {t('manage_signed_in_as')}: <span dir="ltr" className="font-mono">{session.email}</span>
            </p>
          </div>
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>🚪 {t('auth_sign_out')}</Button>
        </div>

        {/* مختار الرابطة + الدور */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <label htmlFor="league-pick" className="text-xs font-bold text-slate-400">{t('manage_league_pick')}:</label>
          <select
            id="league-pick"
            value={selectedLeagueId ?? ''}
            onChange={(e) => { setSelectedLeagueId(e.target.value); setTab('clubs'); }}
            className="bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 px-3 py-2 focus:outline-[var(--pf-accent,#06b6d4)]"
          >
            {memberships.map((m) => (
              <option key={m.leagueId} value={m.leagueId}>
                {m.leagueNameAr} — {m.leagueWilaya} ({m.leagueCode})
              </option>
            ))}
          </select>
          {selected && (
            <>
              <Badge tone="primary">{t('manage_role')}: {t(ROLE_KEY[selected.role])}</Badge>
              {selected.leagueStatus !== 'active' && <Badge tone="danger">{t('manage_league_inactive')}</Badge>}
              {!canWriteLeague(selected.role) && selected.leagueStatus === 'active' && (
                <Badge tone="warning">{t('manage_readonly_warn')}</Badge>
              )}
            </>
          )}
        </div>

        {/* التبويبات */}
        <div className="flex gap-1 mb-4 border-b border-slate-800">
          {([
            ['clubs', `🏟️ ${t('tab_clubs')}`],
            ['competitions', `🏁 ${t('tab_competitions')}`],
            ['registrations', `📋 ${t('tab_registrations')}`],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? 'px-4 py-2 text-sm font-black border-b-2 border-[var(--pf-primary,#f59e0b)] text-[var(--pf-primary,#f59e0b)] cursor-pointer'
                  : 'px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-200 border-b-2 border-transparent cursor-pointer'
              }
            >
              {label}
            </button>
          ))}
        </div>

        {selected && tab === 'clubs' && (
          <ClubsTab leagueId={selected.leagueId} writable={writable} withMfa={withMfa} flash={flash} />
        )}
        {selected && tab === 'competitions' && (
          <CompetitionsTab leagueId={selected.leagueId} writable={writable} withMfa={withMfa} flash={flash} />
        )}
        {selected && tab === 'registrations' && (
          <RegistrationsTab leagueId={selected.leagueId} writable={writable} withMfa={withMfa} flash={flash} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PublicHeader />
      <main className="flex-1">{body}</main>
      <footer className="border-t border-slate-800/70 py-4 text-center text-xs text-slate-600">
        {t('manage_title')} ⏱️
      </footer>

      {/* إشعار عابر */}
      {toast && (
        <div
          role="status"
          className={
            'fixed top-4 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[80] px-4 py-2.5 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-2xl border ' +
            (toast.kind === 'ok'
              ? 'bg-emerald-600 border-emerald-300'
              : 'bg-red-600 border-red-300')
          }
        >
          {toast.text}
        </div>
      )}

      <MfaGateModal
        request={mfaRequest}
        onResolved={onMfaResolved}
        onClose={() => { setMfaRequest(null); pendingAction.current = null; }}
      />
    </div>
  );
};

// ═══ أنواع مشتركة للتبويبات ═══

interface TabProps {
  leagueId: string;
  writable: boolean;
  withMfa: (action: () => Promise<void>) => void;
  flash: (kind: 'ok' | 'err', text: string) => void;
}

function opError(t: (k: DictKey) => string, error: string): string {
  // أخطاء النماذج المعروفة → ترجمة؛ سواها → رسالة الخادم الخام (تشخيص ميداني)
  const known: string[] = ['form_required_missing', 'form_bad_club_code', 'form_bad_dates', 'form_dates_reversed', 'common_offline'];
  return known.includes(error) ? t(error as DictKey) : `${t('action_error_prefix')} ${error}`;
}

// ═══ تبويب الأندية ═══

const ClubsTab: React.FC<TabProps> = ({ leagueId, writable, withMfa, flash }) => {
  const { t } = useI18n();
  const [clubs, setClubs] = useState<ClubRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [quota, setQuota] = useState('2');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    const res = await listClubs(leagueId);
    if (res.ok) setClubs(res.data ?? []);
    else { setClubs([]); setLoadErr(res.error); }
  }, [leagueId]);

  useEffect(() => { setClubs(null); void load(); }, [load]);

  // الإشارات اللحظية: تغيّر أندية الرابطة (اعتماد من مدير آخر مثلاً) → تحديث فوري
  const live = useLiveSignals(leagueId, { clubs_changed: () => void load() });
  const liveInfo = liveBadge(live);

  const submitAdd = async () => {
    setBusy(true);
    setFormErr(null);
    const res = await createClub(leagueId, { name_ar: name, code, quota_per_event: Number(quota) || 2 });
    setBusy(false);
    if (!res.ok) { setFormErr(opError(t, res.error)); return; }
    setShowAdd(false); setName(''); setCode(''); setQuota('2');
    flash('ok', '✓');
    void load();
  };

  const setApproval = (club: ClubRow, status: ClubRow['approval_status']) => {
    withMfa(async () => {
      const res = await setClubApproval(club.id, status);
      if (!res.ok) flash('err', opError(t, res.error));
      else { flash('ok', '✓'); void load(); }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <p className="text-xs text-slate-500">{writable ? t('mfa_required_note') : t('manage_readonly_warn')}</p>
          {liveInfo && (
            <Badge tone={liveInfo.tone} pulse={liveInfo.pulse} title={t(liveInfo.labelKey)}>
              {t(liveInfo.labelKey)}
            </Badge>
          )}
        </div>
        {writable && (
          <Button variant="primary" size="sm" onClick={() => { setShowAdd((v) => !v); setFormErr(null); }}>
            ➕ {t('club_add')}
          </Button>
        )}
      </div>

      {writable && showAdd && (
        <Card>
          <CardBody>
            <form
              className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
              onSubmit={(e) => { e.preventDefault(); if (!busy) void submitAdd(); }}
            >
              <Input label={t('club_name')} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
              <Input label={t('club_code')} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} dir="ltr" disabled={busy} />
              <Input label={t('club_quota')} type="number" min={0} max={20} value={quota} onChange={(e) => setQuota(e.target.value)} disabled={busy} />
              <Button type="submit" variant="success" loading={busy}>{t('common_save')}</Button>
            </form>
            {formErr && <p role="alert" className="text-xs font-bold text-red-400 mt-2">{formErr}</p>}
          </CardBody>
        </Card>
      )}

      {loadErr && (
        <Card className="border-red-500/40"><CardBody>
          <p className="text-sm font-bold text-red-300">{opError(t, loadErr)}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => void load()}>🔄 {t('site_retry')}</Button>
        </CardBody></Card>
      )}

      {clubs && clubs.length === 0 && !loadErr && (
        <Card><CardBody className="text-center py-10">
          <div className="text-3xl mb-2" aria-hidden>🏟️</div>
          <p className="font-bold text-slate-300">{t('club_empty')}</p>
        </CardBody></Card>
      )}

      {clubs && clubs.length > 0 && (
        <div className="space-y-2">
          {clubs.map((club) => (
            <Card key={club.id}>
              <CardBody className="flex flex-wrap items-center gap-3 py-3">
                <span className="font-black text-sm">{club.name_ar}</span>
                <Badge tone="accent">#{club.code}</Badge>
                <Badge tone={CLUB_STATUS_TONE[club.approval_status]}>{t(CLUB_STATUS_KEY[club.approval_status])}</Badge>
                <span className="text-[11px] text-slate-500">{t('club_quota')}: {club.quota_per_event}</span>
                <span className="flex-1" />
                {writable && club.approval_status !== 'approved' && (
                  <Button variant="success" size="xs" onClick={() => setApproval(club, 'approved')}>✓ {t('club_status_approved')}</Button>
                )}
                {writable && club.approval_status !== 'suspended' && (
                  <Button variant="danger" size="xs" onClick={() => setApproval(club, 'suspended')}>⛔ {t('club_status_suspended')}</Button>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══ تبويب التظاهرات ═══

const CompetitionsTab: React.FC<TabProps> = ({ leagueId, writable, withMfa, flash }) => {
  const { t } = useI18n();
  const [comps, setComps] = useState<CompetitionRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [form, setForm] = useState<CompetitionInput>({
    title_ar: '', title_fr: '', type: 'track', venue: '',
    start_date: '', end_date: '', registration_deadline: '', visibility: 'public',
  });

  const load = useCallback(async () => {
    setLoadErr(null);
    const res = await listCompetitions(leagueId);
    if (res.ok) setComps(res.data ?? []);
    else { setComps([]); setLoadErr(res.error); }
  }, [leagueId]);

  useEffect(() => { setComps(null); void load(); }, [load]);

  // الإشارات اللحظية: انتقالات حالة التظاهرات (من مدير آخر أو نشر النتائج) → تحديث فوري
  const live = useLiveSignals(leagueId, { comps_changed: () => void load() });
  const liveInfo = liveBadge(live);

  const submitAdd = async () => {
    setBusy(true);
    setFormErr(null);
    const res = await createCompetition(leagueId, form);
    setBusy(false);
    if (!res.ok) { setFormErr(opError(t, res.error)); return; }
    setShowAdd(false);
    setForm({ title_ar: '', title_fr: '', type: 'track', venue: '', start_date: '', end_date: '', registration_deadline: '', visibility: 'public' });
    flash('ok', '✓');
    void load();
  };

  const advance = (comp: CompetitionRow, to: CompetitionStatus) => {
    if (!isStatusTransitionAllowed(comp.status, to)) return;
    withMfa(async () => {
      const res = await updateCompetitionStatus(comp.id, to);
      if (!res.ok) flash('err', opError(t, res.error));
      else { flash('ok', '✓'); void load(); }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <p className="text-xs text-slate-500">{writable ? t('mfa_required_note') : t('manage_readonly_warn')}</p>
          {liveInfo && (
            <Badge tone={liveInfo.tone} pulse={liveInfo.pulse} title={t(liveInfo.labelKey)}>
              {t(liveInfo.labelKey)}
            </Badge>
          )}
        </div>
        {writable && (
          <Button variant="primary" size="sm" onClick={() => { setShowAdd((v) => !v); setFormErr(null); }}>
            ➕ {t('comp_add')}
          </Button>
        )}
      </div>

      {writable && showAdd && (
        <Card>
          <CardHeader title={t('comp_add')} />
          <CardBody>
            <form
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
              onSubmit={(e) => { e.preventDefault(); if (!busy) void submitAdd(); }}
            >
              <Input label={t('comp_title_ar')} value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} disabled={busy} />
              <Input label={t('comp_title_fr')} value={form.title_fr ?? ''} onChange={(e) => setForm({ ...form, title_fr: e.target.value })} dir="ltr" disabled={busy} />
              <Input label={t('comp_venue')} value={form.venue ?? ''} onChange={(e) => setForm({ ...form, venue: e.target.value })} disabled={busy} />
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">{t('comp_type')}</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as CompetitionType })}
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-slate-100 px-3 py-2.5"
                >
                  <option value="track">{t('comp_type_track')}</option>
                  <option value="field">{t('comp_type_field')}</option>
                  <option value="cross_country">{t('comp_type_cross')}</option>
                  <option value="road">{t('comp_type_road')}</option>
                </select>
              </div>
              <Input label={t('comp_start')} type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} disabled={busy} />
              <Input label={t('comp_end')} type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} disabled={busy} />
              <Input
                label={`${t('comp_deadline')} (${t('comp_from')} / UTC)`}
                type="datetime-local"
                value={form.registration_deadline ?? ''}
                onChange={(e) => setForm({ ...form, registration_deadline: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                dir="ltr"
                disabled={busy}
              />
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">{t('comp_visibility')}</label>
                <select
                  value={form.visibility ?? 'public'}
                  onChange={(e) => setForm({ ...form, visibility: e.target.value as 'public' | 'unlisted' })}
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-slate-100 px-3 py-2.5"
                >
                  <option value="public">{t('comp_visibility_public')}</option>
                  <option value="unlisted">{t('comp_visibility_unlisted')}</option>
                </select>
              </div>
              <Button type="submit" variant="success" loading={busy}>{t('common_save')}</Button>
            </form>
            {formErr && <p role="alert" className="text-xs font-bold text-red-400 mt-2">{formErr}</p>}
          </CardBody>
        </Card>
      )}

      {loadErr && (
        <Card className="border-red-500/40"><CardBody>
          <p className="text-sm font-bold text-red-300">{opError(t, loadErr)}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => void load()}>🔄 {t('site_retry')}</Button>
        </CardBody></Card>
      )}

      {comps && comps.length === 0 && !loadErr && (
        <Card><CardBody className="text-center py-10">
          <div className="text-3xl mb-2" aria-hidden>🏁</div>
          <p className="font-bold text-slate-300">{t('comp_empty')}</p>
        </CardBody></Card>
      )}

      {comps && comps.length > 0 && (
        <div className="space-y-2">
          {comps.map((comp) => {
            const transitions = writable ? allowedStatusTransitions(comp.status) : [];
            return (
              <Card key={comp.id}>
                <CardBody className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-sm">{comp.title_ar}</span>
                    <Badge tone="neutral">{t(COMP_TYPE_KEY[comp.type])}</Badge>
                    <Badge tone={comp.status === 'running' ? 'accent' : comp.status === 'results_published' ? 'success' : 'neutral'} pulse={comp.status === 'running'}>
                      {comp.status}
                    </Badge>
                    {!writable && <Badge tone="warning">{t('manage_readonly_warn')}</Badge>}
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono" dir="ltr">
                    {formatDmy(comp.start_date)} → {formatDmy(comp.end_date)}
                    {comp.venue ? ` · ${comp.venue}` : ''}
                    {comp.visibility === 'unlisted' ? ' · 🔒' : ''}
                  </p>
                  {transitions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {transitions.map((s) => (
                        <Button key={s} variant="ghost" size="xs" onClick={() => advance(comp, s)}>
                          → {s}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══ تبويب التسجيلات ═══

const RegistrationsTab: React.FC<TabProps> = ({ leagueId, writable, withMfa, flash }) => {
  const { t } = useI18n();
  const [comps, setComps] = useState<CompetitionRow[]>([]);
  const [compId, setCompId] = useState<string>('');
  const [filter, setFilter] = useState<'all' | RegistrationRow['status']>('all');
  const [regs, setRegs] = useState<RegistrationRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<{ reg: RegistrationRow; decision: RegistrationDecision } | null>(null);
  const [note, setNote] = useState('');

  const loadComps = useCallback(async () => {
    const res = await listCompetitions(leagueId);
    if (res.ok) {
      setComps(res.data ?? []);
      if (res.data && res.data.length > 0) setCompId((cur) => cur || res.data![0].id);
    }
  }, [leagueId]);

  useEffect(() => { void loadComps(); }, [loadComps]);

  const load = useCallback(async () => {
    if (!compId) { setRegs([]); return; }
    setLoadErr(null);
    setRegs(null);
    const res = await listRegistrations(compId, filter === 'all' ? undefined : [filter]);
    if (res.ok) setRegs(res.data ?? []);
    else { setRegs([]); setLoadErr(res.error); }
  }, [compId, filter]);

  useEffect(() => { void load(); }, [load]);

  // الإشارات اللحظية: تسجيلات جديدة/قرارات مدير آخر → تحديث فوري لقائمة الانتظار،
  // وتغيّر التظاهرات → تحديث قائمة المختار
  const live = useLiveSignals(leagueId, {
    regs_changed: () => void load(),
    comps_changed: () => void loadComps(),
  });
  const liveInfo = liveBadge(live);

  const decide = (reg: RegistrationRow, decision: RegistrationDecision, reviewNote?: string) => {
    if (!isDecisionAllowed(reg.status, decision)) return;
    withMfa(async () => {
      const res = await decideRegistration(reg.id, decision, reviewNote);
      if (!res.ok) flash('err', opError(t, res.error));
      else { flash('ok', '✓'); setNoteFor(null); setNote(''); void load(); }
    });
  };

  const askDecision = (reg: RegistrationRow, decision: RegistrationDecision) => {
    if (decision === 'approved') { decide(reg, decision); return; }
    setNote(''); setNoteFor({ reg, decision });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {comps.length === 0 ? (
          <p className="text-sm text-slate-400">{t('comp_empty')}</p>
        ) : (
          <>
            <label htmlFor="reg-comp" className="text-xs font-bold text-slate-400">{t('tab_competitions')}:</label>
            <select
              id="reg-comp"
              value={compId}
              onChange={(e) => setCompId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 px-3 py-2 max-w-[60vw] truncate"
            >
              {comps.map((c) => (
                <option key={c.id} value={c.id}>{c.title_ar} ({formatDmy(c.start_date)})</option>
              ))}
            </select>
            <label htmlFor="reg-filter" className="text-xs font-bold text-slate-400 ms-2">{t('reg_filter')}:</label>
            <select
              id="reg-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | RegistrationRow['status'])}
              className="bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 px-3 py-2"
            >
              <option value="all">{t('reg_all')}</option>
              <option value="submitted">{t('reg_status_submitted')}</option>
              <option value="approved">{t('reg_status_approved')}</option>
              <option value="needs_edit">{t('reg_status_needs_edit')}</option>
              <option value="rejected">{t('reg_status_rejected')}</option>
              <option value="draft">{t('reg_status_draft')}</option>
            </select>
            {liveInfo && (
              <Badge tone={liveInfo.tone} pulse={liveInfo.pulse} title={t(liveInfo.labelKey)} className="ms-auto">
                {t(liveInfo.labelKey)}
              </Badge>
            )}
          </>
        )}
      </div>

      {!compId && comps.length === 0 && (
        <Card><CardBody className="text-center py-10">
          <div className="text-3xl mb-2" aria-hidden>📋</div>
          <p className="font-bold text-slate-300">{t('reg_pick_comp')}</p>
        </CardBody></Card>
      )}

      {loadErr && (
        <Card className="border-red-500/40"><CardBody>
          <p className="text-sm font-bold text-red-300">{opError(t, loadErr)}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => void load()}>🔄 {t('site_retry')}</Button>
        </CardBody></Card>
      )}

      {regs && regs.length === 0 && !loadErr && compId && (
        <Card><CardBody className="text-center py-10">
          <div className="text-3xl mb-2" aria-hidden>📋</div>
          <p className="font-bold text-slate-300">{t('reg_empty')}</p>
        </CardBody></Card>
      )}

      {regs && regs.length > 0 && (
        <div className="space-y-2">
          {regs.map((reg) => {
            const athlete = reg.athletes ? `${reg.athletes.first_name} ${reg.athletes.last_name}` : `#${reg.athlete_id.slice(0, 8)}`;
            const ev = reg.events ? `${reg.events.discipline} · ${reg.events.gender === 'M' ? '♂' : '♀'} · ${reg.events.category}` : '—';
            return (
              <Card key={reg.id}>
                <CardBody className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-40">
                    <p className="font-black text-sm">{athlete}</p>
                    {reg.athletes?.license_no && (
                      <p className="text-[10px] text-slate-500 font-mono" dir="ltr"> LIC {reg.athletes.license_no}</p>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    <p>{t('results_club')}: <span className="font-bold text-slate-300">{reg.clubs?.name_ar ?? '—'}</span></p>
                    <p>{t('reg_event')}: <span className="font-bold text-slate-300">{ev}</span></p>
                  </div>
                  <Badge tone={REG_STATUS_TONE[reg.status]}>{t(REG_STATUS_KEY[reg.status])}</Badge>
                  {reg.bib_number != null && <Badge tone="neutral">#{reg.bib_number}</Badge>}
                  <span className="flex-1" />
                  {writable && reg.status === 'submitted' && (
                    <div className="flex gap-1.5 flex-wrap">
                      <Button variant="success" size="xs" onClick={() => askDecision(reg, 'approved')}>✓ {t('reg_approve')}</Button>
                      <Button variant="accent" size="xs" onClick={() => askDecision(reg, 'needs_edit')}>✎ {t('reg_ask_edit')}</Button>
                      <Button variant="danger" size="xs" onClick={() => askDecision(reg, 'rejected')}>✕ {t('reg_reject')}</Button>
                    </div>
                  )}
                  {writable && reg.status === 'approved' && (
                    <Button variant="accent" size="xs" onClick={() => askDecision(reg, 'needs_edit')}>✎ {t('reg_ask_edit')}</Button>
                  )}
                  {reg.review_note && (
                    <p className="w-full text-[11px] text-slate-500">📝 {reg.review_note}</p>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* نافذة ملاحظة المراجعة (رفض/طلب تعديل) */}
      <Modal
        open={!!noteFor}
        onClose={() => setNoteFor(null)}
        title={noteFor ? (noteFor.decision === 'rejected' ? `✕ ${t('reg_reject')}` : `✎ ${t('reg_ask_edit')}`) : ''}
        size="sm"
      >
        <div className="space-y-3">
          <Input label={t('reg_note')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          <div className="flex gap-2">
            <Button
              variant={noteFor?.decision === 'rejected' ? 'danger' : 'accent'}
              block
              onClick={() => noteFor && decide(noteFor.reg, noteFor.decision, note)}
            >
              {noteFor?.decision === 'rejected' ? t('reg_reject') : t('reg_ask_edit')}
            </Button>
            <Button variant="ghost" onClick={() => setNoteFor(null)}>{t('common_cancel')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
