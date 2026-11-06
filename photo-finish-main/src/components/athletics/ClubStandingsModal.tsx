import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Award, Medal, Download, Printer, RefreshCw, 
  FileSpreadsheet, FileCode, CheckCircle2, SlidersHorizontal,
  Building2, Users, Trophy
} from 'lucide-react';
import { 
  AthleticsCompetition, 
  RaceResultEntry, 
  ClubTeamScore, 
  ClubMedalTally 
} from '../../types/athletics';
import { clubRankingService } from '../../services/clubRankingService';
import { exportService } from '../../services/exportService';
import { chiefJudgeControlService } from '../../services/chiefJudgeControlService';
import { multiJudgeMergeEngine } from '../../services/multiJudgeMergeEngine';
import { checkpointStorage } from '../../services/checkpointStorage';

interface ClubStandingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitionId?: string;
}

export const ClubStandingsModal: React.FC<ClubStandingsModalProps> = ({
  isOpen,
  onClose,
  competitionId,
}) => {
  const [competitions, setCompetitions] = useState<AthleticsCompetition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>(competitionId || '');
  const [results, setResults] = useState<RaceResultEntry[]>([]);
  const [scoringRunnersCount, setScoringRunnersCount] = useState<number>(3);
  const [activeTab, setActiveTab] = useState<'teams' | 'medals' | 'export'>('teams');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [notification, setNotification] = useState<string>('');

  const activeCompetition = useMemo(() => {
    return competitions.find(c => c.id === selectedCompId) || competitions[0] || null;
  }, [competitions, selectedCompId]);

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
          const gunTime = comp.runners?.[0]?.startTime || (rawPassages[0] ? rawPassages[0].timestamp - 5000 : Date.now() - 600000);
          const computed = chiefJudgeControlService.computeOfficialResults(comp, mergedPassages, gunTime);
          setResults(computed);
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

  // حساب ترتيب الفرق (Rule 19)
  const teamScores: ClubTeamScore[] = useMemo(() => {
    return clubRankingService.computeTeamStandings(results, scoringRunnersCount);
  }, [results, scoringRunnersCount]);

  // حساب جدول الميداليات
  const medalTallies: ClubMedalTally[] = useMemo(() => {
    return clubRankingService.computeMedalTally(results);
  }, [results]);

  // تصدير CSV متوافق مع Excel
  const handleExportCsv = () => {
    if (!activeCompetition) return;
    const csvData = exportService.exportToCsv(activeCompetition, results);
    const filename = `${activeCompetition.name.replace(/\s+/g, '_')}_results.csv`;
    exportService.downloadFile(csvData, filename, 'text/csv;charset=utf-8;');
    showNotification('تم تحميل ملف Excel CSV المتوافق مع اللغة العربية بنجاح 📊');
  };

  // تصدير JSON
  const handleExportJson = () => {
    if (!activeCompetition) return;
    const jsonData = exportService.exportToJson(activeCompetition, results, teamScores);
    const filename = `${activeCompetition.name.replace(/\s+/g, '_')}_data.json`;
    exportService.downloadFile(jsonData, filename, 'application/json');
    showNotification('تم تصدير ملف البيانات القياسي JSON 💾');
  };

  // طباعة / PDF
  const handlePrintPdf = () => {
    if (!activeCompetition) return;
    exportService.printResults(activeCompetition, results, teamScores);
    showNotification('جاري فتح نافذة الطباعة الرسمية للنتائج 🖨️');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* شريط العنوان */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-lg shrink-0">
              <Trophy className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">ترتيب الأندية والفرق وتصدير التقارير</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  WA Rule 19 Engine 🏆
                </span>
              </div>
              <p className="text-xs text-slate-400">
                حساب نقاط الفرق للعدو الريفي، جدول الميداليات والدروع، وتصدير التقارير الرسمية (PDF / Excel / JSON)
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

        {/* شريط اختيار المنافسة والتبويبات */}
        <div className="px-4 py-2.5 bg-slate-950/30 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
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

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('teams')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'teams' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>ترتيب الفرق (Rule 19)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('medals')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'medals' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Medal className="w-3.5 h-3.5" />
              <span>جدول الميداليات والدرع</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'export' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>مركز التصدير الرسمي 🖨️</span>
            </button>

            <button
              type="button"
              onClick={loadData}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="تحديث"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* محتوى التبويبات */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          
          {/* ══════════ تبويب ترتيب الفرق (Rule 19) ══════════ */}
          {activeTab === 'teams' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 border border-slate-800 rounded-2xl p-3 text-xs">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-white flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span>لائحة الاتحاد الدولي لألعاب القوى (World Athletics Rule 19)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    يحسب ترتيب الفريق بجمع رتب أفضل N عدائين منه. الفريق الأقل مجموعاً يفوز. في حالة التعادل، يفوز الفريق الذي أنهى عداؤه الأخير المحتسب في رتبة متقدمة.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-300 font-bold">العداؤون المحتسبون:</span>
                  <select
                    value={scoringRunnersCount}
                    onChange={e => setScoringRunnersCount(parseInt(e.target.value))}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-amber-300 font-mono font-bold"
                  >
                    <option value={3}>أفضل 3 عدائين</option>
                    <option value={4}>أفضل 4 عدائين</option>
                    <option value={5}>أفضل 5 عدائين</option>
                    <option value={6}>أفضل 6 عدائين</option>
                  </select>
                </div>
              </div>

              {teamScores.length > 0 ? (
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-900 text-slate-400 text-[11px] border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">الرتبة</th>
                        <th className="p-2.5">اسم النادي / الفريق</th>
                        <th className="p-2.5">مجموع النقاط</th>
                        <th className="p-2.5">تفصيل العدائين المحتسبين</th>
                        <th className="p-2.5">رتبة العداء الحاسم</th>
                        <th className="p-2.5">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {teamScores.map(t => (
                        <tr key={t.clubName} className="hover:bg-slate-850/50 transition">
                          <td className="p-2.5 font-black text-sm">
                            {t.status === 'qualified' ? (
                              t.rank === 1 ? <span className="text-amber-400">🥇 1</span> :
                              t.rank === 2 ? <span className="text-slate-300">🥈 2</span> :
                              t.rank === 3 ? <span className="text-amber-600">🥉 3</span> :
                              <span className="text-slate-400">#{t.rank}</span>
                            ) : <span className="text-slate-600">-</span>}
                          </td>
                          <td className="p-2.5 font-sans font-bold text-white text-sm">
                            {t.clubName}
                          </td>
                          <td className="p-2.5 text-amber-400 font-black text-sm">
                            {t.status === 'qualified' ? `${t.totalPoints} نقطة` : '-'}
                          </td>
                          <td className="p-2.5 font-sans">
                            <div className="flex flex-wrap gap-1">
                              {t.runners.map((r, idx) => (
                                <span
                                  key={idx}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                    r.isScorer
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                  title={`${r.athleteName} - الترتيب #${r.individualRank}`}
                                >
                                  #{r.bibNumber} (رتبة {r.individualRank})
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-2.5 text-cyan-300">
                            {t.status === 'qualified' ? `رتبة #${t.lastScorerRank}` : '-'}
                          </td>
                          <td className="p-2.5 font-sans">
                            {t.status === 'qualified' ? (
                              <span className="text-emerald-400 text-[11px] font-bold">مكتمل ومؤهل ✓</span>
                            ) : (
                              <span className="text-amber-400 text-[11px] font-bold">غير مكتمل ({t.runners.length}/{scoringRunnersCount})</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 text-xs">
                  لا تتوفر نتائج فرق لهذه المنافسة بعد.
                </div>
              )}
            </div>
          )}

          {/* ══════════ تبويب جدول الميداليات والدروع ══════════ */}
          {activeTab === 'medals' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 text-xs">
                <h3 className="font-bold text-white flex items-center gap-1.5 mb-1">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>جدول حصاد الميداليات ونقاط درع البطولة العام</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  توزيع نقاط الدرع: الذهب (10 نقاط)، الفضة (7 نقاط)، البرونز (5 نقاط)، الرابع (4)، الخامس (3)، السادس (2)، السابع والثامن (نقطة واحدة).
                </p>
              </div>

              {medalTallies.length > 0 ? (
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-900 text-slate-400 text-[11px] border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">الرتبة</th>
                        <th className="p-2.5">اسم النادي</th>
                        <th className="p-2.5 text-center">🥇 ذهب</th>
                        <th className="p-2.5 text-center">🥈 فضة</th>
                        <th className="p-2.5 text-center">🥉 برونز</th>
                        <th className="p-2.5 text-center">إجمالي الميداليات</th>
                        <th className="p-2.5 text-center">نقاط الدرع العام</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {medalTallies.map(m => (
                        <tr key={m.clubName} className="hover:bg-slate-850/50 transition">
                          <td className="p-2.5 font-black text-sm">
                            {m.rank === 1 && <span className="text-amber-400">🥇 1</span>}
                            {m.rank === 2 && <span className="text-slate-300">🥈 2</span>}
                            {m.rank === 3 && <span className="text-amber-600">🥉 3</span>}
                            {m.rank > 3 && <span className="text-slate-400">#{m.rank}</span>}
                          </td>
                          <td className="p-2.5 font-sans font-bold text-white text-sm">
                            {m.clubName}
                          </td>
                          <td className="p-2.5 text-center text-amber-400 font-bold">{m.gold}</td>
                          <td className="p-2.5 text-center text-slate-300 font-bold">{m.silver}</td>
                          <td className="p-2.5 text-center text-amber-600 font-bold">{m.bronze}</td>
                          <td className="p-2.5 text-center text-white font-bold">{m.totalMedals}</td>
                          <td className="p-2.5 text-center text-cyan-400 font-black text-sm">
                            {m.trophyPoints} نقطة
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 text-xs">
                  لا توجد ميداليات معتمدة بعد.
                </div>
              )}
            </div>
          )}

          {/* ══════════ تبويب مركز التصدير الرسمي ══════════ */}
          {activeTab === 'export' && activeCompetition && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-4 hover:border-purple-500/40 transition shadow-lg">
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                    <Printer className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-white text-base">استمارة PDF رسمية للطباعة</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    محضر نتائج جاهز للطباعة المباشرة والتصدير كـ PDF، مصمم وفق معايير الاتحاد الدولي، بخط عربي واضح وتأشيرات التوقيع للحكم العام.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة أو حفظ PDF 🖨️</span>
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition shadow-lg">
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-white text-base">جداول Excel / CSV المعتمدة</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    ملف جدول بيانات CSV مدعوم بترميز UTF-8 مع علامة BOM لضمان فتح النصوص والأسماء العربية في برنامج Microsoft Excel بدون أي تشويه.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تحميل Excel CSV 📊</span>
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-4 hover:border-cyan-500/40 transition shadow-lg">
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                    <FileCode className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-white text-base">ملف بيانات رقمي JSON</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    تصدير رقمي شامل لهياكل البيانات والنتائج وتفاصيل أزمنة المقاطع والحكام، مخصص للربط مع شاشات الملاعب وقواعد بيانات الاتحادات.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportJson}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                >
                  <FileCode className="w-4 h-4" />
                  <span>تصدير JSON القياسي 💾</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* الشريط السفلي */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
          <div className="text-slate-400">
            جميع الخوارزميات وصيغ التصدير تعمل ذاتياً 100% دون اتصال بالإنترنت
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

export default ClubStandingsModal;
