import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Lock, Unlock, Award, CheckCircle2, AlertTriangle, 
  RefreshCw, FileText, Check, Ban, Eye, Search,
  Smartphone, Battery, Wifi, Shield, FileCheck
} from 'lucide-react';
import { 
  AthleticsCompetition, 
  RaceResultEntry, 
  ProtestAppeal, 
  ChiefJudgeLockAudit, 
  JudgeTelemetry,
  CompetitionResultStatus 
} from '../../types/athletics';
import { chiefJudgeControlService } from '../../services/chiefJudgeControlService';
import { multiJudgeMergeEngine } from '../../services/multiJudgeMergeEngine';
import { checkpointStorage } from '../../services/checkpointStorage';

interface ChiefJudgeDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitionId?: string;
  onOpenStandingsModal?: () => void;
}

export const ChiefJudgeDashboardModal: React.FC<ChiefJudgeDashboardModalProps> = ({
  isOpen,
  onClose,
  competitionId,
  onOpenStandingsModal,
}) => {
  const [competitions, setCompetitions] = useState<AthleticsCompetition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>(competitionId || '');
  const [results, setResults] = useState<RaceResultEntry[]>([]);
  const [protests, setProtests] = useState<ProtestAppeal[]>([]);
  const [auditLog, setAuditLog] = useState<ChiefJudgeLockAudit[]>([]);
  const [judgeMatrix, setJudgeMatrix] = useState<JudgeTelemetry[]>([]);
  const [activeTab, setActiveTab] = useState<'results' | 'protests' | 'matrix' | 'audit'>('results');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // حوار فك القفل الإداري
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [unlockReason, setUnlockReason] = useState<string>('');

  // حوار تسجيل طعن جديد
  const [showNewProtestModal, setShowNewProtestModal] = useState<boolean>(false);
  const [protestBib, setProtestBib] = useState<string>('');
  const [protestClub, setProtestClub] = useState<string>('');
  const [protestName, setProtestName] = useState<string>('');
  const [protestReason, setProtestReason] = useState<string>('');
  const [protestFee, setProtestFee] = useState<boolean>(true);

  // حوار البت في طعن
  const [selectedProtest, setSelectedProtest] = useState<ProtestAppeal | null>(null);
  const [decisionNote, setDecisionNote] = useState<string>('');

  const activeCompetition = useMemo(() => {
    return competitions.find(c => c.id === selectedCompId) || competitions[0] || null;
  }, [competitions, selectedCompId]);

  const currentStatus: CompetitionResultStatus = useMemo(() => {
    if (!activeCompetition) return 'provisional';
    return chiefJudgeControlService.getCompetitionResultStatus(activeCompetition.id);
  }, [activeCompetition, results, auditLog]);

  const loadData = async () => {
    setIsProcessing(true);
    try {
      const allComps = await checkpointStorage.listCompetitions();
      setCompetitions(allComps);

      const targetId = selectedCompId || (allComps[0] ? allComps[0].id : '');
      if (targetId) {
        setSelectedCompId(targetId);
        const comp = allComps.find(c => c.id === targetId);
        if (comp) {
          const rawPassages = await checkpointStorage.getPassagesForCompetition(targetId);
          const { mergedPassages } = multiJudgeMergeEngine.processPassages(comp, rawPassages);
          
          // طلقة البداية: تؤخذ من توقيت البداية أو أقدم مرور
          const gunTime = comp.runners?.[0]?.startTime || (rawPassages[0] ? rawPassages[0].timestamp - 5000 : Date.now() - 600000);
          const computedResults = chiefJudgeControlService.computeOfficialResults(comp, mergedPassages, gunTime);
          setResults(computedResults);

          setProtests(chiefJudgeControlService.listProtests(targetId));
          setAuditLog(chiefJudgeControlService.getLockAuditLog(targetId));
          setJudgeMatrix(chiefJudgeControlService.getJudgeMatrix(targetId));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, selectedCompId]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3500);
  };

  // إقفال النتائج رسمياً
  const handleLockResults = () => {
    if (!activeCompetition) return;
    chiefJudgeControlService.lockResults(
      activeCompetition.id,
      'chief_judge_1',
      activeCompetition.chiefJudgeName || 'الحكم العام',
      'اعتماد رسمي بعد مراجعة تقارير الحكام وانقضاء مهلة الطعون'
    );
    loadData();
    showNotification('تم إقفال واعتماد النتائج الرسمية بنجاح 🔒');
  };

  // فك القفل الإداري
  const handleUnlockResults = () => {
    if (!activeCompetition) return;
    if (!unlockReason.trim()) {
      alert('يرجى كتابة سبب فك القفل الإداري.');
      return;
    }

    try {
      chiefJudgeControlService.unlockResults(
        activeCompetition.id,
        'chief_judge_1',
        activeCompetition.chiefJudgeName || 'الحكم العام',
        unlockReason.trim()
      );
      setShowUnlockModal(false);
      setUnlockReason('');
      loadData();
      showNotification('تم فك القفل وتغيير الحالة إلى "قيد المراجعة" 🔓');
    } catch (e: any) {
      alert(e?.message);
    }
  };

  // تصديق وتوقيع نهائي
  const handleCertifyResults = () => {
    if (!activeCompetition) return;
    chiefJudgeControlService.certifyResults(
      activeCompetition.id,
      'chief_judge_1',
      activeCompetition.chiefJudgeName || 'الحكم العام'
    );
    loadData();
    showNotification('تم التصديق والتوقيع الرقمي النهائي على النتائج 📜');
  };

  // تسجيل طعن رسمي جديد
  const handleFileProtest = () => {
    if (!activeCompetition) return;
    const bib = parseInt(protestBib);
    if (isNaN(bib) || !protestReason.trim()) {
      alert('يرجى تحديد رقم الصدر وسبب الطعن.');
      return;
    }

    chiefJudgeControlService.fileProtest({
      competitionId: activeCompetition.id,
      bibNumber: bib,
      clubName: protestClub.trim() || 'نادي غير محدد',
      filedByName: protestName.trim() || 'ممثل النادي',
      reason: protestReason.trim(),
      feeDeposited: protestFee
    });

    setShowNewProtestModal(false);
    setProtestBib('');
    setProtestClub('');
    setProtestName('');
    setProtestReason('');
    loadData();
    showNotification('تم تسجيل الطعن الرسمي وتعليق الاعتماد النهائي!');
  };

  // البت في الطعن
  const handleDecideProtest = (decision: 'accepted' | 'rejected') => {
    if (!selectedProtest) return;
    const note = decisionNote.trim() || (decision === 'accepted' ? 'تم قبول الطعن وتعديل النتيجة' : 'تم رفض الطعن لعدم ثبوت المخالفة');

    chiefJudgeControlService.decideProtest(
      selectedProtest.id,
      decision,
      note,
      'chief_judge_1'
    );

    setSelectedProtest(null);
    setDecisionNote('');
    loadData();
    showNotification(`تم تسجيل قرار لجنة الحكام (${decision === 'accepted' ? 'قبول الطعن' : 'رفض الطعن'}) بنجاح!`);
  };

  // فلترة النتائج
  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const q = searchQuery.toLowerCase();
      const matchBib = r.bibNumber.toString().includes(q);
      const matchName = r.athleteName.toLowerCase().includes(q);
      const matchClub = r.clubName.toLowerCase().includes(q);
      return matchBib || matchName || matchClub;
    });
  }, [results, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* شريط العنوان */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-slate-950 font-black shadow-lg shrink-0">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">غرفة الحكم العام والنتائج الرسمية</h2>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  currentStatus === 'certified'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                    : currentStatus === 'official'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : currentStatus === 'under_review'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                }`}>
                  {currentStatus === 'certified' && 'مصدق وموقع رسمياً 📜'}
                  {currentStatus === 'official' && 'معتمد ومغلق 🔒'}
                  {currentStatus === 'under_review' && 'قيد المراجعة / طعن ⚠️'}
                  {currentStatus === 'provisional' && 'نتائج مؤقتة ⏱️'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                إدارة أوقات الانطلاق (Gun/Net)، الإقفال الرسمي، الطعون والاستئنافات، ومصفوفة تزامن الحكام
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* إشعار النجاح */}
        {notification && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* شريط الإجراءات والتحكم الإداري */}
        <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-bold">المسابقة:</span>
            <select
              value={selectedCompId}
              onChange={e => setSelectedCompId(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-200 font-bold max-w-xs"
            >
              {competitions.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* أزرار الإقفال وفك القفل والتصديق */}
          <div className="flex items-center gap-2">
            {currentStatus !== 'official' && currentStatus !== 'certified' ? (
              <button
                type="button"
                onClick={handleLockResults}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 cursor-pointer transition shadow"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>إقفال واعتماد رسمي 🔒</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowUnlockModal(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 cursor-pointer transition shadow"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>فك القفل الإداري 🔓</span>
              </button>
            )}

            {currentStatus === 'official' && (
              <button
                type="button"
                onClick={handleCertifyResults}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5 cursor-pointer transition shadow"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>تصديق نهائي 📜</span>
              </button>
            )}

            {onOpenStandingsModal && (
              <button
                type="button"
                onClick={onOpenStandingsModal}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>ترتيب الأندية 🏆</span>
              </button>
            )}
          </div>
        </div>

        {/* التبويبات الفرعية */}
        <div className="px-4 py-2 bg-slate-950/20 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('results')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'results' ? 'bg-purple-600 text-white shadow' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>النتائج الرسمية ({results.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('protests')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'protests' ? 'bg-purple-600 text-white shadow' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>الطعون والاستئنافات ({protests.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'matrix' ? 'bg-purple-600 text-white shadow' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>مصفوفة الحكام والهواتف</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'audit' ? 'bg-purple-600 text-white shadow' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>سجل التدقيق ({auditLog.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="تحديث"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>

        {/* محتوى التبويبات */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          
          {/* ══════════ تبويب النتائج الرسمية ══════════ */}
          {activeTab === 'results' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="بحث برقم الصدر أو اسم العداء أو النادي..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-100"
                  />
                </div>

                <div className="text-xs text-slate-400">
                  المشاركون: <strong className="text-cyan-400">{filteredResults.length}</strong>
                </div>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-900 text-slate-400 text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">الرتبة</th>
                      <th className="p-2.5">الصدر والاسم</th>
                      <th className="p-2.5">النادي</th>
                      <th className="p-2.5">زمن البندقية (Gun Time)</th>
                      <th className="p-2.5">الزمن الصافي (Net Time)</th>
                      <th className="p-2.5">الفارق (Gap)</th>
                      <th className="p-2.5">الحلقات</th>
                      <th className="p-2.5">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredResults.map(r => (
                      <tr key={r.bibNumber} className="hover:bg-slate-850/50 transition">
                        <td className="p-2.5 font-black text-sm">
                          {r.rank === 1 && <span className="text-amber-400">🥇 1</span>}
                          {r.rank === 2 && <span className="text-slate-300">🥈 2</span>}
                          {r.rank === 3 && <span className="text-amber-600">🥉 3</span>}
                          {r.rank > 3 && r.rank < 1000 && <span className="text-slate-400">#{r.rank}</span>}
                          {r.rank >= 1000 && <span className="text-slate-600">-</span>}
                        </td>
                        <td className="p-2.5 font-sans font-bold text-white flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-mono font-black text-purple-300">
                            {r.bibNumber}
                          </span>
                          <span>{r.athleteName}</span>
                        </td>
                        <td className="p-2.5 text-slate-300 font-sans">{r.clubName}</td>
                        <td className="p-2.5 text-cyan-300 font-bold">{r.formattedGunTime}</td>
                        <td className="p-2.5 text-emerald-300">{r.formattedNetTime}</td>
                        <td className="p-2.5 text-slate-400">{r.formattedGap}</td>
                        <td className="p-2.5 text-slate-300">{r.completedLaps}</td>
                        <td className="p-2.5 font-sans">
                          {r.status === 'finished' && <span className="text-emerald-400 font-bold text-[11px]">أنهى السباق ✓</span>}
                          {r.status === 'dnf' && <span className="text-amber-400 font-bold text-[11px]">انسحاب (DNF)</span>}
                          {r.status === 'dns' && <span className="text-slate-500 font-bold text-[11px]">غياب (DNS)</span>}
                          {r.status === 'dq' && (
                            <span className="text-red-400 font-bold text-[11px]" title={r.disqualificationReason}>
                              استبعاد (DQ) ✕
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════ تبويب الطعون والاستئنافات ══════════ */}
          {activeTab === 'protests' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  لوائح World Athletics (المادة 8): يجب تسجيل الطعن خلال 30 دقيقة من إعلان النتائج المؤقتة مع دفع الرسوم المقررة.
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewProtestModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>تسجيل طعن رسمي جديد 📝</span>
                </button>
              </div>

              {protests.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {protests.map(p => (
                    <div
                      key={p.id}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                            p.status === 'accepted'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : p.status === 'rejected'
                              ? 'bg-red-500/20 text-red-300 border-red-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}>
                            {p.status === 'accepted' && 'مقبول ✓'}
                            {p.status === 'rejected' && 'مرفوض ✕'}
                            {p.status === 'pending' && 'قيد دراسة لجنة التحكيم ⏳'}
                          </span>

                          <span className="font-bold text-white text-xs">
                            طعن مقدم من ({p.clubName} - {p.filedByName})
                          </span>

                          <span className="text-xs text-purple-300 font-mono">
                            بخصوص صدر #{p.bibNumber}
                          </span>

                          {p.feeDeposited && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                              الرسوم مدفوعة
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed font-sans">
                          {p.reason}
                        </p>

                        {p.decisionNote && (
                          <div className="text-[11px] text-slate-400 bg-slate-900 rounded-lg p-2 border border-slate-800 mt-1">
                            <strong>قرار الحكم العام:</strong> {p.decisionNote}
                          </div>
                        )}
                      </div>

                      {p.status === 'pending' && (
                        <div className="shrink-0 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedProtest(p)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-purple-400" />
                            <span>البت في الطعن</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-14 text-slate-500 text-xs">
                  لا توجد أي طعون أو اعتراضات رسمية مسجلة لهذه المنافسة.
                </div>
              )}
            </div>
          )}

          {/* ══════════ تبويب مصفوفة الحكام والهواتف ══════════ */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                <h3 className="font-bold text-sm text-white mb-1">مصفوفة هواتف الحكام المتصلة بالشبكة المحلية P2P</h3>
                <p className="text-xs text-slate-400">
                  مراقبة لحظية لحالة بطاريات هواتف الحكام في النقاط الميدانية، زمن الاستجابة (Latency)، وإجمالي التسجيلات
                </p>
              </div>

              {judgeMatrix.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {judgeMatrix.map(t => (
                    <div key={`${t.checkpointId}_${t.judgeId}`} className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between text-xs shadow-md">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{t.judgeName}</span>
                          <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                            {t.checkpointCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">الجهاز: {t.deviceId} • الدور: {t.role}</div>
                      </div>

                      <div className="flex items-center gap-3 text-start">
                        <div>
                          <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                            <Battery className="w-3.5 h-3.5" />
                            <span>{t.batteryPercent || 92}%</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Wifi className="w-3 h-3 text-cyan-400" />
                            <span>{t.latencyMs}ms</span>
                          </div>
                        </div>

                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-14 text-slate-500 text-xs">
                  لا توجد هواتف حكام متصلة حالياً بالبث الشبكي المحلي.
                </div>
              )}
            </div>
          )}

          {/* ══════════ تبويب سجل التدقيق الإداري ══════════ */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              {auditLog.length > 0 ? (
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-900 text-slate-400 text-[11px] border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">الإجراء</th>
                        <th className="p-2.5">الحكم العام</th>
                        <th className="p-2.5">التوقيت</th>
                        <th className="p-2.5">السبب / الحيثيات الرسمية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {auditLog.map(a => (
                        <tr key={a.id} className="hover:bg-slate-850/50 transition">
                          <td className="p-2.5 font-bold font-sans">
                            {a.action === 'lock' && <span className="text-emerald-400">🔒 إقفال رسمي</span>}
                            {a.action === 'unlock' && <span className="text-amber-400">🔓 فك قفل إداري</span>}
                            {a.action === 'certify' && <span className="text-purple-400">📜 تصديق نهائي</span>}
                          </td>
                          <td className="p-2.5 text-white font-sans">{a.chiefJudgeName}</td>
                          <td className="p-2.5 text-slate-300">
                            {new Date(a.timestamp).toLocaleString('ar-DZ')}
                          </td>
                          <td className="p-2.5 text-slate-300 font-sans text-xs">{a.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-14 text-slate-500 text-xs">
                  سجل التدقيق فارغ. لم يتم اتخاذ أي إجراءات إقفال بعد.
                </div>
              )}
            </div>
          )}

        </div>

        {/* حوار فك القفل الإداري */}
        {showUnlockModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-amber-300 flex items-center gap-2">
                  <Unlock className="w-4 h-4 text-amber-400" />
                  <span>فك القفل الإداري للنتائج المعتمدة</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                وفقاً للوائح التحكيم، يتطلب فك القفل تسجيل سبب رسمي صريح ومفصل (مثل: قبول طعن، تصحيح رقم صدر، أو خطأ إجرائي)، ويتم توثيقه في سجل التدقيق غير القابل للتعديل.
              </p>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">السبب الإداري لفك القفل (إلزامي):</label>
                <textarea
                  value={unlockReason}
                  onChange={e => setUnlockReason(e.target.value)}
                  placeholder="اكتب حيثيات فك القفل الإداري..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 h-24 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleUnlockResults}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition shadow"
                >
                  تأكيد فك القفل
                </button>
              </div>
            </div>
          </div>
        )}

        {/* حوار تسجيل طعن رسمي جديد */}
        {showNewProtestModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-purple-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-purple-400" />
                  <span>تسجيل طعن رسمي (World Athletics Rule 8)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewProtestModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">رقم الصدر المعني</label>
                  <input
                    type="number"
                    value={protestBib}
                    onChange={e => setProtestBib(e.target.value)}
                    placeholder="مثلاً 104"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">النادي مقدم الطعن</label>
                  <input
                    type="text"
                    value={protestClub}
                    onChange={e => setProtestClub(e.target.value)}
                    placeholder="اسم النادي"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] text-slate-400 block mb-1">اسم ممثل النادي / المدرب</label>
                  <input
                    type="text"
                    value={protestName}
                    onChange={e => setProtestName(e.target.value)}
                    placeholder="اسم المدرب أو رئيس الوفد"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] text-slate-400 block mb-1">حيثيات وسبب الطعن</label>
                  <textarea
                    value={protestReason}
                    onChange={e => setProtestReason(e.target.value)}
                    placeholder="شرح المخالفة الملاحظة..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 h-20 resize-none"
                  />
                </div>

                <div className="col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="feeDeposit"
                    checked={protestFee}
                    onChange={e => setProtestFee(e.target.checked)}
                    className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="feeDeposit" className="text-xs text-slate-300 cursor-pointer">
                    تم إيداع رسوم الطعن الرسمية لدى الأمانة
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowNewProtestModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleFileProtest}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow"
                >
                  تسجيل الطعن
                </button>
              </div>
            </div>
          </div>
        )}

        {/* حوار البت في الطعن من قبل الحكم العام */}
        {selectedProtest && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-white">قرار لجنة التحكيم العليا</h3>
                <button
                  type="button"
                  onClick={() => setSelectedProtest(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                <div className="text-white font-bold">طعن بخصوص صدر #{selectedProtest.bibNumber}</div>
                <div className="text-slate-300">{selectedProtest.reason}</div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">تعليل القرار الرسمي للجنة التحكيم:</label>
                <textarea
                  value={decisionNote}
                  onChange={e => setDecisionNote(e.target.value)}
                  placeholder="اكتب حيثيات القرار..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleDecideProtest('accepted')}
                  className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1 transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>قبول الطعن وتعديل النتيجة</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDecideProtest('rejected')}
                  className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center justify-center gap-1 transition"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>رفض الطعن</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* الشريط السفلي */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
          <div className="text-slate-400">
            نظام الاعتماد الرسمي والطعون متطابق مع لوائح الاتحاد الدولي لألعاب القوى (World Athletics Rule 8)
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};

export default ChiefJudgeDashboardModal;
