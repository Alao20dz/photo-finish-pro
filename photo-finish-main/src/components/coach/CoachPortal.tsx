/**
 * Photo Finish Pro — بوابة المدرب (Coach Portal)
 * =============================================
 * المرحلة 5: مدخل المدرب السحابي عبر ‎#/coach‎:
 *   1. زائر → دخول (نموذج مشترك)
 *   2. مسجّل → أندية المدرب المعتمدة → تبويبات:
 *       • عدائيّي: قائمة/إضافة/تعديل/حذف منطقي + رفع الشهادة الطبية
 *       • التظاهرات: المفتوحة للتسجيل → اختيار مسابقة → اختيار عدائين → تقديم
 *       • تسجيلاتي: تتبّع الحالة + سحب + إعادة تقديم بعد التصحيح
 *
 * ملاحظات:
 *  • لا MFA مطلوب هنا (الكتابات ليست حساسة وفق سياسات المرحلة 1).
 *  • النادي غير المعتمد/الرابطة غير النشطة → قراءة فقط.
 *  • الخادم يفرض كل الأذون عبر RLS — الواجهة تحسن التجربة فقط.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, CardBody, Input, Modal } from '../ui';
import { SignInForm } from '../auth/SignInForm';
import { PublicHeader } from '../public/PublicHeader';
import {
  athleteAgeAt,
  athleteDisplayName,
  fetchCoachContext,
  listEvents,
  listMyAthletes,
  listMyRegistrations,
  listOpenCompetitions,
  resubmitRegistration,
  softDeleteAthlete,
  submitRegistrations,
  updateAthlete,
  createAthlete,
  uploadMedicalCert,
  validateAthleteInput,
  validateCertFile,
  withdrawRegistration,
  type AthleteInput,
  type AthleteRow,
  type CoachClubContext,
  type EventRow,
  type MyRegistrationRow,
  type OpenCompetition,
} from '../../services/coachCloudService';
import { onSessionChange, signOut, type AppSession } from '../../services/authService';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { formatDmy } from '../../services/publicApi';
import { useI18n } from '../../i18n';
import type { DictKey } from '../../i18n/dictionaries';

type Tab = 'athletes' | 'open' | 'mine';

const REG_STATUS_TONE = {
  draft: 'neutral', submitted: 'warning', approved: 'success', rejected: 'danger', needs_edit: 'accent',
} as const;
const REG_STATUS_KEY = {
  draft: 'reg_status_draft', submitted: 'reg_status_submitted', approved: 'reg_status_approved',
  rejected: 'reg_status_rejected', needs_edit: 'reg_status_needs_edit',
} as const;

function opError(t: (k: DictKey) => string, error: string): string {
  const known: string[] = [
    'form_required_missing', 'form_bad_dates', 'form_dates_reversed', 'common_offline',
    'athlete_bad_gender', 'athlete_bad_birth', 'athlete_bad_license', 'athlete_cert_required_file',
    'file_bad_type', 'file_too_large', 'reg_deadline_passed', 'reg_pick_athletes',
  ];
  return known.includes(error) ? t(error as DictKey) : `${t('action_error_prefix')} ${error}`;
}

// ═══ البوابة ═══

export const CoachPortal: React.FC = () => {
  const { t } = useI18n();
  const [session, setSession] = useState<AppSession | null>(null);
  const [ready, setReady] = useState(false);
  const [clubs, setClubs] = useState<CoachClubContext[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('athletes');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => onSessionChange((s) => { setSession(s); setReady(true); }), []);

  const loadClubs = useCallback(async () => {
    setLoadErr(null);
    const res = await fetchCoachContext();
    if (res.ok) {
      setClubs(res.data ?? []);
      setSelectedClubId((cur) => cur ?? res.data?.[0]?.clubId ?? null);
    } else {
      setClubs([]);
      setLoadErr(res.error);
    }
  }, []);

  useEffect(() => {
    if (session) void loadClubs();
    else { setClubs(null); setSelectedClubId(null); }
  }, [session, loadClubs]);

  const flash = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const selectedClub = useMemo(
    () => clubs?.find((c) => c.clubId === selectedClubId) ?? null,
    [clubs, selectedClubId]
  );
  const writable = !!selectedClub && selectedClub.clubApproval === 'approved' && selectedClub.leagueStatus === 'active';

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
    body = <SignInForm title={`🏃 ${t('coach_title')}`} subtitle={t('coach_subtitle')} onBack={() => { window.location.hash = '#/'; }} />;
  } else if (clubs && clubs.length === 0) {
    body = (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-3" aria-hidden>🏃</div>
        <p className="font-bold text-slate-200">{t('coach_no_club')}</p>
        <p className="text-sm text-slate-500 mt-2">{t('coach_contact_league')}</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => void signOut()}>
          {t('auth_sign_out')}
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black">{t('coach_title')}</h1>
            <p className="text-xs text-slate-500 truncate max-w-[60vw]">
              {t('manage_signed_in_as')}: <span dir="ltr" className="font-mono">{session.email}</span>
            </p>
          </div>
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>🚪 {t('auth_sign_out')}</Button>
        </div>

        {loadErr && (
          <Card className="border-red-500/40 mb-4"><CardBody>
            <p className="text-sm font-bold text-red-300">{opError(t, loadErr)}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => void loadClubs()}>🔄 {t('site_retry')}</Button>
          </CardBody></Card>
        )}

        {/* مختار النادي */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <label htmlFor="club-pick" className="text-xs font-bold text-slate-400">{t('coach_club_pick')}:</label>
          <select
            id="club-pick"
            value={selectedClubId ?? ''}
            onChange={(e) => setSelectedClubId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 px-3 py-2"
          >
            {(clubs ?? []).map((c) => (
              <option key={c.clubId} value={c.clubId}>{c.clubNameAr} — {c.leagueNameAr} ({c.clubCode})</option>
            ))}
          </select>
          {selectedClub && selectedClub.clubApproval !== 'approved' && (
            <Badge tone="danger">{t('coach_club_not_approved')}</Badge>
          )}
          {selectedClub && selectedClub.leagueStatus !== 'active' && (
            <Badge tone="danger">{t('manage_league_inactive')}</Badge>
          )}
        </div>

        {/* التبويبات */}
        <div className="flex gap-1 mb-4 border-b border-slate-800">
          {([
            ['athletes', `🎽 ${t('tab_athletes')}`],
            ['open', `🏁 ${t('tab_open_comps')}`],
            ['mine', `📋 ${t('tab_my_regs')}`],
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

        {selectedClub && tab === 'athletes' && (
          <AthletesTab club={selectedClub} writable={writable} flash={flash} />
        )}
        {selectedClub && tab === 'open' && (
          <OpenCompetitionsTab club={selectedClub} writable={writable} flash={flash} />
        )}
        {selectedClub && tab === 'mine' && (
          <MyRegistrationsTab clubId={selectedClub.clubId} flash={flash} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PublicHeader />
      <main className="flex-1">{body}</main>
      <footer className="border-t border-slate-800/70 py-4 text-center text-xs text-slate-600">
        {t('coach_title')} ⏱️
      </footer>

      {toast && (
        <div
          role="status"
          className={
            'fixed top-4 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[80] px-4 py-2.5 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-2xl border ' +
            (toast.kind === 'ok' ? 'bg-emerald-600 border-emerald-300' : 'bg-red-600 border-red-300')
          }
        >
          {toast.text}
        </div>
      )}
    </div>
  );
};

interface TabProps {
  club: CoachClubContext;
  writable: boolean;
  flash: (kind: 'ok' | 'err', text: string) => void;
}

// ═══ تبويب العدائين ═══

const AthletesTab: React.FC<TabProps> = ({ club, writable, flash }) => {
  const { t } = useI18n();
  const [athletes, setAthletes] = useState<AthleteRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ mode: 'add' | 'edit'; row?: AthleteRow } | null>(null);
  const [confirmDel, setConfirmDel] = useState<AthleteRow | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    const res = await listMyAthletes(club.clubId);
    if (res.ok) setAthletes(res.data ?? []);
    else { setAthletes([]); setLoadErr(res.error); }
  }, [club.clubId]);

  useEffect(() => { setAthletes(null); void load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{writable ? t('coach_quota_note').replace('{quota}', String(club.quotaPerEvent)) : t('coach_readonly_note')}</p>
        {writable && (
          <Button variant="primary" size="sm" onClick={() => setEditing({ mode: 'add' })}>
            ➕ {t('athlete_add')}
          </Button>
        )}
      </div>

      {loadErr && (
        <Card className="border-red-500/40"><CardBody>
          <p className="text-sm font-bold text-red-300">{opError(t, loadErr)}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => void load()}>🔄 {t('site_retry')}</Button>
        </CardBody></Card>
      )}

      {athletes && athletes.length === 0 && !loadErr && (
        <Card><CardBody className="text-center py-10">
          <div className="text-3xl mb-2" aria-hidden>🎽</div>
          <p className="font-bold text-slate-300">{t('athlete_empty')}</p>
        </CardBody></Card>
      )}

      {athletes && athletes.length > 0 && (
        <div className="space-y-2">
          {athletes.map((a) => {
            const age = athleteAgeAt(a.birth_date, new Date().toISOString().slice(0, 10));
            return (
              <Card key={a.id}>
                <CardBody className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-36">
                    <p className="font-black text-sm">{athleteDisplayName(a)}</p>
                    <p className="text-[10px] text-slate-500 font-mono" dir="ltr">{a.birth_date} · {age ?? '—'} {t('athlete_years')}</p>
                  </div>
                  <Badge tone={a.gender === 'M' ? 'accent' : 'primary'}>{a.gender === 'M' ? t('athlete_gender_m') : t('athlete_gender_f')}</Badge>
                  {a.license_no && <Badge tone="neutral">LIC {a.license_no}</Badge>}
                  {a.wilaya && <Badge tone="neutral">📍 {a.wilaya}</Badge>}
                  {a.medical_cert_path ? (
                    <Badge tone="success">🩺 {t('athlete_cert_ok')}</Badge>
                  ) : (
                    <Badge tone="warning">🩺 {t('athlete_cert_missing')}</Badge>
                  )}
                  {a.medical_cert_expiry && (
                    <span className="text-[10px] text-slate-500 font-mono" dir="ltr">⏳ {formatDmy(a.medical_cert_expiry)}</span>
                  )}
                  <span className="flex-1" />
                  {writable && (
                    <div className="flex gap-1.5">
                      <Button variant="ghost" size="xs" onClick={() => setEditing({ mode: 'edit', row: a })}>✎ {t('common_edit')}</Button>
                      <Button variant="danger" size="xs" onClick={() => setConfirmDel(a)}>🗑️</Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <AthleteFormModal
        open={!!editing}
        mode={editing?.mode ?? 'add'}
        row={editing?.row}
        clubId={club.clubId}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); void load(); }}
        flash={flash}
      />

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={`🗑️ ${t('athlete_delete_title')}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            {confirmDel ? athleteDisplayName(confirmDel) : ''} — {t('athlete_delete_body')}
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              block
              onClick={() => {
                const row = confirmDel;
                setConfirmDel(null);
                if (!row) return;
                void (async () => {
                  const res = await softDeleteAthlete(row.id);
                  if (!res.ok) flash('err', opError(t, res.error));
                  else { flash('ok', '✓'); void load(); }
                })();
              }}
            >
              {t('common_confirm')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>{t('common_cancel')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ═══ نموذج العداء (إضافة/تعديل + رفع الشهادة) ═══

const AthleteFormModal: React.FC<{
  open: boolean;
  mode: 'add' | 'edit';
  row?: AthleteRow;
  clubId: string;
  onClose: () => void;
  onSaved: () => void;
  flash: (kind: 'ok' | 'err', text: string) => void;
}> = ({ open, mode, row, clubId, onClose, onSaved, flash }) => {
  const { t } = useI18n();
  const [form, setForm] = useState<AthleteInput>({
    first_name: '', last_name: '', gender: 'M', birth_date: '',
    license_no: '', wilaya: '', medical_cert_expiry: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFormErr(null);
    setFile(null);
    setForm(row
      ? {
          first_name: row.first_name, last_name: row.last_name, gender: row.gender,
          birth_date: row.birth_date, license_no: row.license_no ?? '', wilaya: row.wilaya ?? '',
          medical_cert_expiry: row.medical_cert_expiry ?? '',
        }
      : { first_name: '', last_name: '', gender: 'M', birth_date: '', license_no: '', wilaya: '', medical_cert_expiry: '' });
  }, [open, row]);

  const save = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const v = validateAthleteInput(form, today);
    if (!v.ok) { setFormErr(t((v.error ?? 'form_required_missing') as DictKey)); return; }
    setBusy(true);
    setFormErr(null);
    try {
      if (mode === 'add') {
        const res = await createAthlete(clubId, form);
        if (!res.ok) { setFormErr(opError(t, res.error)); return; }
        if (file && res.data) {
          const up = await uploadMedicalCert(clubId, res.data.id, file);
          if (!up.ok) { flash('err', opError(t, up.error)); }
        }
      } else if (row) {
        const res = await updateAthlete(row.id, form);
        if (!res.ok) { setFormErr(opError(t, res.error)); return; }
        if (file) {
          const up = await uploadMedicalCert(clubId, row.id, file);
          if (!up.ok) { flash('err', opError(t, up.error)); }
        }
      }
      flash('ok', '✓');
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const pickFile = (f: File | null) => {
    if (!f) { setFile(null); return; }
    const bad = validateCertFile({ type: f.type, size: f.size });
    if (bad) { flash('err', t(bad as DictKey)); setFile(null); if (fileRef.current) fileRef.current.value = ''; return; }
    setFile(f);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'add' ? `➕ ${t('athlete_add')}` : `✎ ${t('athlete_edit')}`}
      size="md"
    >
      <form
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        onSubmit={(e) => { e.preventDefault(); if (!busy) void save(); }}
      >
        <Input label={t('athlete_first_name')} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} disabled={busy} />
        <Input label={t('athlete_last_name')} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} disabled={busy} />
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">{t('athlete_gender')}</label>
          <select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value as 'M' | 'F' })}
            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-slate-100 px-3 py-2.5"
            disabled={busy}
          >
            <option value="M">{t('athlete_gender_m')}</option>
            <option value="F">{t('athlete_gender_f')}</option>
          </select>
        </div>
        <Input label={t('athlete_birth_date')} type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} disabled={busy} />
        <Input label={t('athlete_license')} value={form.license_no ?? ''} onChange={(e) => setForm({ ...form, license_no: e.target.value })} dir="ltr" disabled={busy} hint={t('athlete_license_hint')} />
        <Input label={t('athlete_wilaya')} value={form.wilaya ?? ''} onChange={(e) => setForm({ ...form, wilaya: e.target.value })} disabled={busy} />
        <Input label={`${t('athlete_cert_expiry')} (${t('comp_from')})`} type="date" value={form.medical_cert_expiry ?? ''} onChange={(e) => setForm({ ...form, medical_cert_expiry: e.target.value })} disabled={busy} />

        {/* الشهادة الطبية */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-slate-300 mb-1.5">🩺 {t('athlete_cert_upload')}</label>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-slate-400 file:me-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200 file:cursor-pointer"
            disabled={busy}
          />
          <p className="text-[11px] text-slate-500 mt-1">
            {t('athlete_cert_hint')} {row?.medical_cert_path ? `· ${t('athlete_cert_ok')}` : ''}
          </p>
        </div>

        {formErr && <p role="alert" className="sm:col-span-2 text-xs font-bold text-red-400">{formErr}</p>}
        <div className="sm:col-span-2 flex gap-2">
          <Button type="submit" variant="success" block loading={busy}>{t('common_save')}</Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>{t('common_cancel')}</Button>
        </div>
      </form>
    </Modal>
  );
};

// ═══ تبويب التظاهرات المفتوحة ═══

const OpenCompetitionsTab: React.FC<TabProps> = ({ club, writable, flash }) => {
  const { t } = useI18n();
  const [comps, setComps] = useState<OpenCompetition[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [openComp, setOpenComp] = useState<OpenCompetition | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    const res = await listOpenCompetitions();
    if (res.ok) setComps(res.data ?? []);
    else { setComps([]); setLoadErr(res.error); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      {loadErr && (
        <Card className="border-red-500/40"><CardBody>
          <p className="text-sm font-bold text-red-300">{opError(t, loadErr)}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => void load()}>🔄 {t('site_retry')}</Button>
        </CardBody></Card>
      )}

      {comps && comps.length === 0 && !loadErr && (
        <Card><CardBody className="text-center py-10">
          <div className="text-3xl mb-2" aria-hidden>🏁</div>
          <p className="font-bold text-slate-300">{t('comp_open_empty')}</p>
        </CardBody></Card>
      )}

      {comps && comps.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {comps.map((c) => {
            const dl = c.registration_deadline ? new Date(c.registration_deadline) : null;
            const passed = dl ? dl.getTime() < Date.now() : false;
            return (
              <Card key={c.id} className="h-full">
                <CardBody className="space-y-2">
                  <h4 className="font-black text-sm leading-snug">{c.title_ar}</h4>
                  <p className="text-[11px] text-slate-500 font-mono" dir="ltr">
                    {formatDmy(c.start_date)} → {formatDmy(c.end_date)}{c.venue ? ` · ${c.venue}` : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.registration_deadline && (
                      <Badge tone={passed ? 'danger' : 'warning'}>
                        ⏳ {t('comp_deadline')}: {formatDmy(c.registration_deadline)}
                      </Badge>
                    )}
                    {!writable && <Badge tone="neutral">{t('coach_readonly_note')}</Badge>}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    block
                    disabled={!writable || passed}
                    onClick={() => setOpenComp(c)}
                  >
                    📋 {passed ? t('comp_closed') : t('reg_submit_open')}
                  </Button>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <SubmitModal
        comp={openComp}
        club={club}
        onClose={() => setOpenComp(null)}
        onDone={() => { setOpenComp(null); }}
        flash={flash}
      />
    </div>
  );
};

// ═══ نافذة التقديم (مسابقة → عدائون → تقديم) ═══

const SubmitModal: React.FC<{
  comp: OpenCompetition | null;
  club: CoachClubContext;
  onClose: () => void;
  onDone: () => void;
  flash: (kind: 'ok' | 'err', text: string) => void;
}> = ({ comp, club, onClose, onDone, flash }) => {
  const { t } = useI18n();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState('');
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!comp) return;
    setEventId(''); setPicked(new Set()); setErr(null);
    void (async () => {
      const [evRes, atRes] = await Promise.all([listEvents(comp.id), listMyAthletes(club.clubId)]);
      setEvents(evRes.ok ? evRes.data ?? [] : []);
      setAthletes(atRes.ok ? atRes.data ?? [] : []);
      if (evRes.ok && evRes.data && evRes.data.length > 0) setEventId(evRes.data[0].id);
    })();
  }, [comp, club.clubId]);

  if (!comp) return null;

  const deadlinePassed = comp.registration_deadline
    ? new Date(comp.registration_deadline).getTime() < Date.now()
    : false;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const res = await submitRegistrations({
      competitionId: comp.id,
      eventId,
      clubId: club.clubId,
      athleteIds: [...picked],
      deadlinePassed,
    });
    setBusy(false);
    if (!res.ok) { setErr(opError(t, res.error)); return; }
    flash('ok', `${t('reg_submit_ok')} (${res.data?.inserted ?? 0})`);
    onDone();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`📋 ${comp.title_ar}`}
      subtitle={`${t('reg_pick_event')} — ${t('reg_pick_athletes_note')}`}
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">{t('reg_event')}</label>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-slate-100 px-3 py-2.5"
          >
            {events.length === 0 && <option value="">{t('reg_no_events')}</option>}
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.discipline} · {ev.gender === 'M' ? t('athlete_gender_m') : t('athlete_gender_f')} · {ev.category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-300">{t('tab_athletes')}</label>
            <span className="text-[11px] text-slate-500">{picked.size}/{athletes.length}</span>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-xl border border-slate-800 p-2">
            {athletes.length === 0 && <p className="text-xs text-slate-500 p-2">{t('athlete_empty')}</p>}
            {athletes.map((a) => {
              const on = picked.has(a.id);
              const hasCert = !!a.medical_cert_path;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    const next = new Set(picked);
                    if (on) next.delete(a.id); else next.add(a.id);
                    setPicked(next);
                  }}
                  className={
                    'w-full text-start px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ' +
                    (on ? 'border-[var(--pf-primary,#f59e0b)]/60 bg-[var(--pf-primary,#f59e0b)]/10' : 'border-slate-800 hover:border-slate-600')
                  }
                >
                  <span className="font-bold">{athleteDisplayName(a)}</span>
                  {!hasCert && <span className="ms-2 text-[10px] text-amber-400">🩺 {t('athlete_cert_missing')}</span>}
                </button>
              );
            })}
          </div>
          {picked.size > club.quotaPerEvent && (
            <p className="text-[11px] font-bold text-amber-400 mt-1.5">
              ⚠️ {t('quota_warning').replace('{quota}', String(club.quotaPerEvent))}
            </p>
          )}
        </div>

        {err && <p role="alert" className="text-xs font-bold text-red-400">{err}</p>}
        <div className="flex gap-2">
          <Button variant="primary" block loading={busy} disabled={!eventId || picked.size === 0} onClick={() => void submit()}>
            📤 {t('reg_submit_open')} ({picked.size})
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common_cancel')}</Button>
        </div>
      </div>
    </Modal>
  );
};

// ═══ تبويب تسجيلاتي ═══

const MyRegistrationsTab: React.FC<{ clubId: string; flash: TabProps['flash'] }> = ({ clubId, flash }) => {
  const { t } = useI18n();
  const [regs, setRegs] = useState<MyRegistrationRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    const res = await listMyRegistrations(clubId);
    if (res.ok) setRegs(res.data ?? []);
    else { setRegs([]); setLoadErr(res.error); }
  }, [clubId]);

  useEffect(() => { setRegs(null); void load(); }, [load]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    void (async () => {
      const res = await fn();
      if (!res.ok) flash('err', opError(t, res.error ?? ''));
      else { flash('ok', '✓'); void load(); }
    })();
  };

  return (
    <div className="space-y-4">
      {loadErr && (
        <Card className="border-red-500/40"><CardBody>
          <p className="text-sm font-bold text-red-300">{opError(t, loadErr)}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => void load()}>🔄 {t('site_retry')}</Button>
        </CardBody></Card>
      )}

      {regs && regs.length === 0 && !loadErr && (
        <Card><CardBody className="text-center py-10">
          <div className="text-3xl mb-2" aria-hidden>📋</div>
          <p className="font-bold text-slate-300">{t('reg_mine_empty')}</p>
        </CardBody></Card>
      )}

      {regs && regs.length > 0 && (
        <div className="space-y-2">
          {regs.map((r) => {
            const athlete = r.athletes ? athleteDisplayName(r.athletes) : '—';
            const ev = r.events ? `${r.events.discipline} · ${r.events.gender === 'M' ? '♂' : '♀'} · ${r.events.category}` : '—';
            return (
              <Card key={r.id}>
                <CardBody className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-36">
                    <p className="font-black text-sm">{athlete}</p>
                    <p className="text-[10px] text-slate-500 truncate max-w-[40vw]">{r.competitions?.title_ar ?? ''}</p>
                  </div>
                  <p className="text-xs text-slate-400">{t('reg_event')}: <span className="font-bold text-slate-300">{ev}</span></p>
                  <Badge tone={REG_STATUS_TONE[r.status]}>{t(REG_STATUS_KEY[r.status])}</Badge>
                  {r.bib_number != null && <Badge tone="neutral">#{r.bib_number}</Badge>}
                  {r.review_note && <p className="w-full text-[11px] text-slate-500">📝 {r.review_note}</p>}
                  <span className="flex-1" />
                  {r.status === 'submitted' && (
                    <Button variant="ghost" size="xs" onClick={() => act(() => withdrawRegistration(r.id))}>
                      ↩ {t('reg_withdraw')}
                    </Button>
                  )}
                  {r.status === 'needs_edit' && (
                    <Button variant="accent" size="xs" onClick={() => act(() => resubmitRegistration(r.id))}>
                      📤 {t('reg_resubmit')}
                    </Button>
                  )}
                  {r.status === 'draft' && (
                    <Button variant="accent" size="xs" onClick={() => act(() => resubmitRegistration(r.id))}>
                      📤 {t('reg_resubmit')}
                    </Button>
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
