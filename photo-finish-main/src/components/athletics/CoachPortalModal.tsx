import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Key, LogOut, CheckCircle2, Clock, XCircle, 
  Send, AlertTriangle, ShieldCheck, X
} from 'lucide-react';
import { useAthleteStore } from '../../stores/athleteStore';
import { Coach, CompetitionRegistration, AthleticsCompetition } from '../../types/athletics';
import { coachWorkflowService, INITIAL_COACHES } from '../../services/coachWorkflowService';
import { checkpointStorage } from '../../services/checkpointStorage';

interface CoachPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CoachPortalModal: React.FC<CoachPortalModalProps> = ({ isOpen, onClose }) => {
  const { athletes } = useAthleteStore();

  const [activeCoach, setActiveCoach] = useState<Coach | null>(null);
  const [pinCode, setPinCode] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // بيانات المسابقات والطلبات
  const [competitions, setCompetitions] = useState<AthleticsCompetition[]>([]);
  const [registrations, setRegistrations] = useState<CompetitionRegistration[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // نموذج تقديم عداء جديد
  const [isNewRegOpen, setIsNewRegOpen] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['cross_country']);
  const [regNotes, setRegNotes] = useState<string>('');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCompetitions();
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeCoach) {
      loadRegistrations();
    }
  }, [activeCoach]);

  const loadCompetitions = async () => {
    try {
      const comps = await checkpointStorage.listCompetitions();
      if (comps.length > 0) {
        setCompetitions(comps);
        setSelectedCompId(comps[0].id);
      } else {
        // منافسة افتراضية إذا لم تكن هناك مسابقة جارية
        const defaultComp: AthleticsCompetition = {
          id: 'comp_algiers_cross_2026',
          name: 'بطولة الجزائر العاصمة للعدو الريفي 2026',
          type: 'cross_country',
          venue: 'غابة باينام',
          date: '2026-03-20',
          distanceKm: 8,
          lapCount: 4,
          category: 'SENIOR',
          gender: 'M',
          checkpoints: [],
          status: 'ready',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setCompetitions([defaultComp]);
        setSelectedCompId(defaultComp.id);
      }
    } catch (e) {
      console.warn('Could not load competitions:', e);
    }
  };

  const loadRegistrations = async () => {
    if (!activeCoach) return;
    const list = await coachWorkflowService.getRegistrations({ clubId: activeCoach.clubId });
    setRegistrations(list);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);

    try {
      const coach = await coachWorkflowService.authenticateCoach(pinCode);
      if (!coach) {
        setAuthError('رمز PIN غير صحيح أو الحساب غير نشط. جرّب: 1921 (مولودية الجزائر) أو 2008 (المجمع البترولي) أو 1962 (شباب بلوزداد).');
        setIsSubmittingAuth(false);
        return;
      }

      setActiveCoach(coach);
      setPinCode('');
    } catch {
      setAuthError('حدث خطأ أثناء فحص رمز المرور.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleQuickCoachSelect = (coach: Coach) => {
    setPinCode(coach.pinCode);
  };

  const handleLogout = () => {
    setActiveCoach(null);
    setRegistrations([]);
    setIsNewRegOpen(false);
  };

  // عدائين النادي الخاص بهذا المدرب فقط (Club Isolation)
  const clubAthletes = useMemo(() => {
    if (!activeCoach) return [];
    return athletes.filter((a) => a.clubId === activeCoach.clubId);
  }, [athletes, activeCoach]);

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      return true;
    });
  }, [registrations, statusFilter]);

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);
    setSubmissionSuccess(null);

    if (!activeCoach) return;
    const athlete = clubAthletes.find((a) => a.id === selectedAthleteId);
    if (!athlete) {
      setSubmissionError('يرجى اختيار عداء من قائمة النادي.');
      return;
    }

    const competition = competitions.find((c) => c.id === selectedCompId) || competitions[0];
    if (!competition) {
      setSubmissionError('يرجى اختيار المنافسة المستهدفة.');
      return;
    }

    const res = await coachWorkflowService.submitAthleteRegistration(
      athlete,
      competition,
      activeCoach,
      selectedEvents,
      regNotes
    );

    if (!res.success) {
      setSubmissionError(res.error || 'فشلت عملية رفع طلب التسجيل.');
      return;
    }

    setSubmissionSuccess(`تم تقديم طلب تسجيل العداء (${athlete.firstName} ${athlete.lastName}) بنجاح! هو الآن قيد مراجعة المدير الفني.`);
    setSelectedAthleteId('');
    setRegNotes('');
    setIsNewRegOpen(false);
    loadRegistrations();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-4 text-white overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 bg-slate-800/80 border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">بوابة مدربي الأندية والجمعيات</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  COACH PORTAL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">تسجيل العدائين، اختيار الاختصاصات، ومتابعة اعتمادات المدير الفني</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeCoach && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 rounded-xl text-xs font-semibold transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* جسم النافذة: تسجيل الدخول أو لوحة المدرب */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {!activeCoach ? (
            /* ═══ شاشة الدخول السريع برمز PIN ═══ */
            <div className="max-w-md mx-auto py-8">
              <div className="p-6 bg-slate-800/60 border border-slate-700/80 rounded-2xl shadow-xl text-center space-y-5">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-inner">
                  <Key className="w-7 h-7" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">تسجيل دخول المدرب الميداني</h3>
                  <p className="text-xs text-slate-400 mt-1">أدخل رمز PIN السريع المخصص لناديك للدخول الآمن</p>
                </div>

                {authError && (
                  <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs text-right flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <input
                      type="password"
                      maxLength={6}
                      autoFocus
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      placeholder="رمز PIN (مثلاً 1921)"
                      className="w-full text-center text-2xl font-mono tracking-widest py-3 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingAuth || !pinCode.trim()}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-blue-950/50"
                  >
                    {isSubmittingAuth ? 'جارٍ التحقق...' : 'دخول البوابة 🔐'}
                  </button>
                </form>

                {/* روابط سريعة للمدربين التجريبيين */}
                <div className="pt-4 border-t border-slate-700/60 text-right">
                  <span className="text-[11px] font-bold text-slate-400 block mb-2">أكواد تجريبية للمدربين المعتمدين:</span>
                  <div className="space-y-1.5">
                    {INITIAL_COACHES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleQuickCoachSelect(c)}
                        className="w-full p-2 bg-slate-900/60 hover:bg-slate-750 border border-slate-800 rounded-xl text-xs flex items-center justify-between text-slate-300 transition"
                      >
                        <div>
                          <span className="font-bold text-white">{c.name}</span>
                          <span className="text-[10px] text-slate-400 mr-2">({c.clubName})</span>
                        </div>
                        <span className="font-mono text-[11px] text-amber-400 font-bold bg-slate-800 px-2 py-0.5 rounded">
                          PIN: {c.pinCode}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ═══ لوحة تحكم المدرب المعتمد ═══ */
            <div className="space-y-6">
              {/* شريط معلومات المدرب والنادي */}
              <div className="p-4 bg-slate-800/60 border border-slate-700/80 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-base">
                    {activeCoach.clubName.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-white text-base">{activeCoach.name}</h3>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                        مدرب معتمد
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{activeCoach.clubName}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-400">رخصة: {activeCoach.licenseNumber}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setIsNewRegOpen(true);
                      setSubmissionError(null);
                      setSubmissionSuccess(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition shadow-lg shadow-emerald-950/40 active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                    <span>تسجيل عداء في منافسة جديدة</span>
                  </button>
                </div>
              </div>

              {/* ملخص إحصائي سريع للطلبات */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
                  <div className="text-slate-400 text-[11px]">عداؤو النادي</div>
                  <div className="text-lg font-bold text-white mt-1">{clubAthletes.length} عداء</div>
                </div>
                <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
                  <div className="text-slate-400 text-[11px]">الطلبات المرفوعة</div>
                  <div className="text-lg font-bold text-blue-300 mt-1">{registrations.length}</div>
                </div>
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl">
                  <div className="text-emerald-400 text-[11px]">المعتمدة رسمياً</div>
                  <div className="text-lg font-bold text-emerald-300 mt-1">
                    {registrations.filter((r) => r.status === 'approved').length}
                  </div>
                </div>
                <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl">
                  <div className="text-amber-400 text-[11px]">قيد المراجعة</div>
                  <div className="text-lg font-bold text-amber-300 mt-1">
                    {registrations.filter((r) => r.status === 'submitted').length}
                  </div>
                </div>
              </div>

              {/* جدول متابعة الطلبات المسجلة */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm">سجل طلبات المشاركة والاعتمادات الرسمية</h4>
                  <div className="flex items-center gap-2">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300"
                    >
                      <option value="ALL">جميع الحالات</option>
                      <option value="submitted">قيد المراجعة</option>
                      <option value="approved">معتمد</option>
                      <option value="rejected">مرفوض</option>
                    </select>
                  </div>
                </div>

                {filteredRegistrations.length === 0 ? (
                  <div className="p-12 text-center bg-slate-850/50 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                    <Clock className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-medium text-slate-300">لا توجد طلبات مشاركة مسجلة حتى الآن.</p>
                    <p className="text-[11px] text-slate-500 mt-1">انقر على "تسجيل عداء في منافسة جديدة" لبدء تسجيل عدائي ناديك.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                        <tr>
                          <th className="py-2.5 px-3">العداء</th>
                          <th className="py-2.5 px-3">المنافسة</th>
                          <th className="py-2.5 px-3">الفئة</th>
                          <th className="py-2.5 px-3">الاختصاصات</th>
                          <th className="py-2.5 px-3">الصدرية</th>
                          <th className="py-2.5 px-3 text-center">الحالة</th>
                          <th className="py-2.5 px-3">ملاحظات التحكيم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium">
                        {filteredRegistrations.map((reg) => (
                          <tr key={reg.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-white">{reg.athleteName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{reg.licenseNumber}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-slate-300">{reg.competitionName}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-blue-300">{reg.calculatedCategory}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-purple-300 font-mono">
                                {reg.targetEvents.join(', ')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {reg.bibAssigned ? (
                                <span className="font-mono font-bold text-amber-300 text-xs px-2 py-0.5 bg-amber-950/40 border border-amber-500/40 rounded">
                                  #{reg.bibAssigned}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {reg.status === 'approved' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>معتمد</span>
                                </span>
                              ) : reg.status === 'submitted' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>قيد المراجعة</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                  <XCircle className="w-3 h-3 text-rose-400" />
                                  <span>مرفوض</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {reg.rejectionReason ? (
                                <span className="text-rose-300 text-[11px]">{reg.rejectionReason}</span>
                              ) : reg.status === 'approved' ? (
                                <span className="text-slate-400 text-[10px]">اعتمدها: {reg.reviewedByName}</span>
                              ) : (
                                <span className="text-slate-500 text-[10px]">في انتظار فحص الملف</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <div>
            نظام الاعتماد الإلكتروني الموحد • الاتحاد الجزائري لألعاب القوى (FAA Workflow)
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* نافذة تسجيل عداء جديد في مسابقة */}
      {/* ═══════════════════════════════════════════════════ */}
      {isNewRegOpen && activeCoach && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 text-right max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 font-bold text-base text-white">
                <Send className="w-5 h-5 text-emerald-400" />
                <span>تقديم طلب مشاركة عداء في البطولة</span>
              </div>
              <button onClick={() => setIsNewRegOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {submissionError && (
              <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{submissionError}</span>
              </div>
            )}

            {submissionSuccess && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{submissionSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRegistration} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">المنافسة المستهدفة *</label>
                <select
                  value={selectedCompId}
                  onChange={(e) => setSelectedCompId(e.target.value)}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                >
                  {competitions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.venue})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">اختيار العداء من قائمة نادي ({activeCoach.clubName}) *</label>
                {clubAthletes.length === 0 ? (
                  <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl text-amber-300 text-xs">
                    لا يوجد عدائين مسجلين تحت لواء هذا النادي حالياً. يرجى إضافة عدائين في سجل العدائين أولاً.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedAthleteId}
                    onChange={(e) => setSelectedAthleteId(e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-semibold"
                  >
                    <option value="">-- اختر عداء من القائمة --</option>
                    {clubAthletes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.firstName} {a.lastName} (رخصة: {a.licenseNumber} • {a.medicalClearance ? 'طبي سارٍ' : 'غير سارٍ'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* معاينة فحص الكفاءة الطبية للعداء المختار */}
              {selectedAthleteId && (() => {
                const ath = clubAthletes.find((a) => a.id === selectedAthleteId);
                if (!ath) return null;
                return (
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    ath.medicalClearance 
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300' 
                      : 'bg-red-950/30 border-red-500/30 text-red-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      <span>الكفاءة الطبية: {ath.medicalClearance ? 'شهادة سارية' : 'غير سارية أو منتهية'}</span>
                    </div>
                    <span className="font-mono text-[10px]">{ath.medicalClearanceExpiry || '—'}</span>
                  </div>
                );
              })()}

              <div>
                <label className="block text-slate-400 mb-1">الاختصاصات المطلوبة للمشاركة</label>
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl">
                  {['cross_country', '100m', '200m', '400m', '800m', '1500m', '5000m', '10000m'].map((ev) => (
                    <label key={ev} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(ev)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEvents([...selectedEvents, ev]);
                          } else {
                            setSelectedEvents(selectedEvents.filter((item) => item !== ev));
                          }
                        }}
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                      />
                      <span>{ev === 'cross_country' ? 'العدو الريفي (Cross)' : ev}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">ملاحظات إضافية للمدير الفني</label>
                <textarea
                  rows={2}
                  value={regNotes}
                  onChange={(e) => setRegNotes(e.target.value)}
                  placeholder="ملاحظات حول الجاهزية أو الإقامة أو ترقية الفئة..."
                  className="w-full p-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewRegOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!selectedAthleteId || clubAthletes.length === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold transition shadow-lg shadow-emerald-950/40"
                >
                  إرسال الطلب للمدير الفني
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
