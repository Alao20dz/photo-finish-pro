import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Sparkles, BrainCircuit, TrendingUp, 
  FileText, Copy, Check, Printer, RefreshCw, Award, Activity, 
  Layers, Compass, ShieldAlert, CheckCircle2
} from 'lucide-react';
import { 
  AthleticsCompetition, 
  RaceResultEntry, 
  MergedPassage,
  RaceAnomaly,
  PacingProfile,
  LeadChange,
  AiAnomalyCluster,
  AiRaceReport,
  ClubTeamScore
} from '../../types/athletics';
import { aiRaceAssistantService } from '../../services/aiRaceAssistant';
import { chiefJudgeControlService } from '../../services/chiefJudgeControlService';
import { multiJudgeMergeEngine } from '../../services/multiJudgeMergeEngine';
import { clubRankingService } from '../../services/clubRankingService';
import { checkpointStorage } from '../../services/checkpointStorage';

interface AiRaceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitionId?: string;
}

export const AiRaceAssistantModal: React.FC<AiRaceAssistantModalProps> = ({
  isOpen,
  onClose,
  competitionId,
}) => {
  const [competitions, setCompetitions] = useState<AthleticsCompetition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>(competitionId || '');
  const [results, setResults] = useState<RaceResultEntry[]>([]);
  const [mergedPassages, setMergedPassages] = useState<MergedPassage[]>([]);
  const [anomalies, setAnomalies] = useState<RaceAnomaly[]>([]);
  const [teamScores, setTeamScores] = useState<ClubTeamScore[]>([]);
  const [activeTab, setActiveTab] = useState<'pacing' | 'leads' | 'anomalies' | 'press'>('pacing');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
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
          const { mergedPassages: merged, anomalies: detectedAnomalies } = multiJudgeMergeEngine.processPassages(comp, rawPassages);
          setMergedPassages(merged);
          setAnomalies(detectedAnomalies);

          const gunTime = comp.runners?.[0]?.startTime || (rawPassages[0] ? rawPassages[0].timestamp - 5000 : Date.now() - 600000);
          const computed = chiefJudgeControlService.computeOfficialResults(comp, merged, gunTime);
          setResults(computed);

          const teams = clubRankingService.computeTeamStandings(computed, 3);
          setTeamScores(teams);
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

  // توليد التقرير الذكي
  const aiReport: AiRaceReport | null = useMemo(() => {
    if (!activeCompetition || results.length === 0) return null;
    return aiRaceAssistantService.generateFullRaceReport(
      activeCompetition,
      results,
      teamScores,
      anomalies,
      mergedPassages
    );
  }, [activeCompetition, results, teamScores, anomalies, mergedPassages]);

  // تحليل وتيرة كافة العدائين الذين أنهوا السباق
  const pacingProfiles: PacingProfile[] = useMemo(() => {
    if (!activeCompetition || !mergedPassages.length) return [];
    const finishedRunners = results.filter(r => r.status === 'finished');
    return finishedRunners.map(r => {
      const runnerPassages = mergedPassages.filter(p => p.bibNumber === r.bibNumber);
      return aiRaceAssistantService.analyzeRunnerPacing(
        r.bibNumber,
        r.athleteName,
        runnerPassages,
        activeCompetition.checkpoints
      );
    });
  }, [activeCompetition, mergedPassages, results]);

  // كشف تغيرات الصدارة
  const leadChanges: LeadChange[] = useMemo(() => {
    if (!activeCompetition || !mergedPassages.length) return [];
    return aiRaceAssistantService.detectLeadChanges(activeCompetition, mergedPassages);
  }, [activeCompetition, mergedPassages]);

  // تجميع الشذوذ بالذكاء الاصطناعي
  const anomalyClusters: AiAnomalyCluster[] = useMemo(() => {
    return aiRaceAssistantService.diagnoseAnomalyClusters(anomalies);
  }, [anomalies]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3500);
  };

  const copyPressNarrative = () => {
    if (!aiReport) return;
    navigator.clipboard.writeText(aiReport.fullNarrativeArabic);
    setCopied(true);
    showNotification('تم نسخ التقرير الصحفي إلى الحافظة بنجاح 📋');
    setTimeout(() => setCopied(false), 2500);
  };

  const printReport = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto font-sans">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* شريط الإشعار */}
        {notification && (
          <div className="bg-emerald-500/90 text-white px-4 py-2 text-sm text-center font-medium animate-pulse">
            {notification}
          </div>
        )}

        {/* رأس النافذة */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-l from-slate-900 via-indigo-950/40 to-slate-900 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">المساعد الذكي والتحليل التكتيكي للسباق</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                  <BrainCircuit className="w-3.5 h-3.5" />
                  AI Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                توزيع الجهد التكتيكي، رصد التجاوزات، التمييز الطوبوغرافي للشذوذ والتقرير الصحفي الآلي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* اختيار المنافسة */}
            <select
              value={selectedCompId}
              onChange={(e) => setSelectedCompId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500 transition-colors"
            >
              {competitions.length === 0 ? (
                <option value="">لا توجد مسابقات مسجلة</option>
              ) : (
                competitions.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.distanceKm} كم)
                  </option>
                ))
              )}
            </select>

            <button
              onClick={loadData}
              disabled={isProcessing}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* التبويبات الرئيسية */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-900/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('pacing')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'pacing'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            تحليل وتيرة العدائين (Pacing)
            <span className="px-1.5 py-0.2 rounded-full text-xs bg-slate-800 text-slate-300">
              {pacingProfiles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('leads')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'leads'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            تغيرات الصدارة والتجاوزات
            <span className="px-1.5 py-0.2 rounded-full text-xs bg-slate-800 text-slate-300">
              {leadChanges.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('anomalies')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'anomalies'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            تشخيص الشذوذ الطوبوغرافي (AI Triage)
            {anomalyClusters.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {anomalyClusters.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('press')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'press'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            التقرير الصحفي التنفيذي
            <span className="px-1.5 py-0.2 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              جاهز للنشر
            </span>
          </button>
        </div>

        {/* جسم النافذة ومحتوى التبويبات */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* رسالة حالة فارغة عند عدم وجود مسابقات */}
          {!activeCompetition ? (
            <div className="text-center py-16 bg-slate-800/40 border border-dashed border-slate-700 rounded-xl">
              <BrainCircuit className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-300">لا توجد مسابقة محددة</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                قم باختيار أو تسجيل مسابقة لإجراء التحليل التكتيكي للسرعات والشذوذ.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/40 border border-dashed border-slate-700 rounded-xl">
              <Activity className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-300">لا توجد نتائج مسجلة حتى الآن</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                في انتظار تسجيل مرور العدائين عبر نقاط المراقبة للبدء في توليد التحليلات التكتيكية.
              </p>
            </div>
          ) : (
            <>
              {/* 1. تبويب تحليل وتيرة العدائين */}
              {activeTab === 'pacing' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-400" />
                        استراتيجية توزيع الجهد والسرعات التكتيكية (Pacing Profiles)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        تحليل الفارق بين النصف الأول والنصف الثاني من السباق ورصد استقرار وتيرة كل عداء
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pacingProfiles.map((p) => {
                      const getStyleBadge = (style: PacingProfile['pacingStyle']) => {
                        switch (style) {
                          case 'negative_split':
                            return {
                              label: 'Negative Split (تصاعدي مثالي)',
                              color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                              desc: 'تسريع تدريجي في النصف الثاني'
                            };
                          case 'positive_split':
                            return {
                              label: 'Positive Split (تراجع سرعة)',
                              color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                              desc: 'انطلاقة مفرطة ثم هبوط في الوتيرة'
                            };
                          case 'even_pace':
                            return {
                              label: 'Even Pace (ثبات تكتيكي)',
                              color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
                              desc: 'سرعة متوازنة وتوزيع متقن'
                            };
                          default:
                            return {
                              label: 'Irregular (وتيرة متذبذبة)',
                              color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
                              desc: 'تذبذب مستمر في السرعة'
                            };
                        }
                      };

                      const badge = getStyleBadge(p.pacingStyle);

                      return (
                        <div key={p.bibNumber} className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-500/50 transition-all">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                                    #{p.bibNumber}
                                  </span>
                                  <h4 className="font-bold text-white text-sm">{p.athleteName}</h4>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${badge.color}`}>
                                {badge.label}
                              </span>
                            </div>

                            {/* الإحصائيات الفنية للسرعة */}
                            <div className="grid grid-cols-3 gap-2 my-3 text-center">
                              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-700/50">
                                <span className="text-[10px] text-slate-400 block">معدل السرعة</span>
                                <span className="text-xs font-bold text-indigo-300">{p.averagePaceMinKm}</span>
                              </div>
                              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-700/50">
                                <span className="text-[10px] text-slate-400 block">أسرع كيلومتر</span>
                                <span className="text-xs font-bold text-emerald-400">{p.fastestSplitKm} ث</span>
                              </div>
                              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-700/50">
                                <span className="text-[10px] text-slate-400 block">معامل التباين</span>
                                <span className="text-xs font-bold text-amber-400">{p.paceVariationPercent}%</span>
                              </div>
                            </div>
                          </div>

                          {/* النصيحة والتحليل التكتيكي */}
                          <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-lg p-2.5 text-xs text-indigo-200 mt-2">
                            <span className="font-semibold text-indigo-400 block mb-1">التقييم الذكي:</span>
                            {p.tacticalAdvice}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. تبويب تغيرات الصدارة والتجاوزات */}
              {activeTab === 'leads' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Compass className="w-4 h-4 text-indigo-400" />
                      سجل التجاوزات وتطور صدارة السباق عبر النقاط (Lead Changes)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      تتبع انتقال المركز الأول بين العدائين مع فارق الثواني عند كل نقطة مراقبة
                    </p>
                  </div>

                  {leadChanges.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/40 rounded-xl border border-slate-700/50">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-300">
                        صدارة مطلقة دون أي تجاوز: المتصدر احتفظ بالمركز الأول من الانطلاق حتى النهاية.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leadChanges.map((lc, idx) => (
                        <div 
                          key={idx}
                          className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 hover:border-indigo-500/40 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-black text-indigo-300 text-sm">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">
                                  {lc.previousLeaderBib 
                                    ? `تجاوز للصدارة: ${lc.newLeaderName} يتقدم على ${lc.previousLeaderName}`
                                    : `المتصدر عند النقطة الأولى: ${lc.newLeaderName}`}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                  صدر #{lc.newLeaderBib}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                                <span>نقطة المراقبة: <strong>{lc.checkpointCode}</strong></span>
                                <span>المسافة: <strong>{lc.kilometerMark} كم</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="text-end">
                            <span className="text-[11px] text-slate-400 block">الفارق عن الملاحق المباشر</span>
                            <span className="text-sm font-bold text-emerald-400">
                              +{lc.gapSeconds.toFixed(1)} ثانية
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. تبويب تشخيص الشذوذ الطوبوغرافي */}
              {activeTab === 'anomalies' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      التشخيص الذكي للاختلالات وتجميع الشذوذ (AI Anomaly Clustering)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      فصل الشبهات الفردية المنعزلة عن الأخطاء الطوبوغرافية في قياس المسار ومسافات النقاط
                    </p>
                  </div>

                  {anomalyClusters.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/40 rounded-xl border border-slate-700/50">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-300">
                        لا توجد أي اختلالات أو شذوذ مسجل! السباق مطابق تماماً لمعايير النزاهة الرياضية.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {anomalyClusters.map((cluster, idx) => {
                        const isCourseError = cluster.clusterType === 'suspected_course_measurement_error';
                        const isTimingDrift = cluster.clusterType === 'judge_timing_drift';

                        return (
                          <div 
                            key={idx}
                            className={`p-5 rounded-xl border ${
                              isCourseError 
                                ? 'bg-amber-950/20 border-amber-600/40' 
                                : isTimingDrift 
                                ? 'bg-indigo-950/20 border-indigo-600/40' 
                                : 'bg-rose-950/20 border-rose-600/40'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                                  isCourseError
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : isTimingDrift
                                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                }`}>
                                  {isCourseError 
                                    ? '⚠️ خطأ طوبوغرافي مشتبه في المسافة' 
                                    : isTimingDrift 
                                    ? '📡 اشتباه انقطاع هاتف الحكم' 
                                    : '🚨 شبهة فردية معزولة'}
                                </span>
                                <span className="text-xs text-slate-400">
                                  مستوى الثقة الذكية: <strong>{(cluster.confidence * 100).toFixed(0)}%</strong>
                                </span>
                              </div>

                              <div className="text-xs text-slate-400">
                                النقاط المتأثرة: <strong className="text-white">{cluster.affectedCheckpoints.join(', ')}</strong>
                              </div>
                            </div>

                            <div className="mt-3 text-sm text-slate-200">
                              <span className="font-bold text-white block mb-1">التشخيص الفني:</span>
                              {cluster.diagnosis}
                            </div>

                            <div className="mt-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-emerald-300 flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                              <div>
                                <span className="font-bold block mb-0.5">توصية الحكم العام (Chief Judge Triage):</span>
                                {cluster.recommendation}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 4. تبويب التقرير الصحفي التنفيذي */}
              {activeTab === 'press' && aiReport && (
                <div className="space-y-6">
                  {/* شريط الإجراءات والعناوين */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        التقرير الصحفي والإعلامي التلقائي
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        صياغة صحفية متقنة ومطابقة للوائح النشر والإعلام الرياضي جاهزة للإرسال
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyPressNarrative}
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'تم النسخ!' : 'نسخ التقرير للنشر 📋'}
                      </button>

                      <button
                        onClick={printReport}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-600 transition-all"
                      >
                        <Printer className="w-4 h-4" />
                        طباعة التقرير الفني 🖨️
                      </button>
                    </div>
                  </div>

                  {/* عناوين التتويج البارزة */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">مانشيت البطل الفردي</span>
                        <p className="text-xs font-bold text-slate-100 mt-0.5">{aiReport.winnerHeadline}</p>
                      </div>
                    </div>

                    {aiReport.teamChampionHeadline && (
                      <div className="bg-gradient-to-r from-indigo-500/10 to-transparent border border-indigo-500/30 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">مانشيت بطل الأندية (Rule 19)</span>
                          <p className="text-xs font-bold text-slate-100 mt-0.5">{aiReport.teamChampionHeadline}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* نص التقرير الصحفي الكامل */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-6 font-mono text-sm leading-relaxed whitespace-pre-line text-slate-200 select-all">
                    {aiReport.fullNarrativeArabic}
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* تذييل النافذة */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>نظام الذكاء الاصطناعي التكتيكي يعمل بالكامل دون اتصال بالإنترنت (100% Offline AI)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
