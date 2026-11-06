import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  Play, 
  RefreshCw, 
  Layers, 
  ChevronRight, 
  ShieldCheck, 
  SlidersHorizontal,
  Users,
  Building2,
  Check,
  X
} from 'lucide-react';
import { 
  AthleticsCompetition, 
  PassageEvent, 
  RunnerLiveRanking, 
  PassageCorrection 
} from '../../types/athletics';
import { checkpointStorage } from '../../services/checkpointStorage';
import { passageSyncEngine } from '../../services/passageSyncEngine';
import { CrossCountryResultEngine } from '../../services/crossCountryResultEngine';
import { AthletesDatabaseModal } from '../athletics/AthletesDatabaseModal';
import { ClubsDatabaseModal } from '../athletics/ClubsDatabaseModal';

interface PassageMonitoringDashboardProps {
  competition: AthleticsCompetition;
  onExit: () => void;
  onOpenConfig: () => void;
  onOpenJudges: () => void;
}

export const PassageMonitoringDashboard: React.FC<PassageMonitoringDashboardProps> = ({
  competition,
  onExit,
  onOpenConfig,
  onOpenJudges,
}) => {
  const [_passages, setPassages] = useState<PassageEvent[]>([]);
  const [standings, setStandings] = useState<RunnerLiveRanking[]>([]);
  const [corrections, setCorrections] = useState<PassageCorrection[]>([]);
  const [activeTab, setActiveTab] = useState<'standings' | 'matrix' | 'corrections'>('standings');
  const [filterLap, setFilterLap] = useState<number>(1);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isAthletesModalOpen, setIsAthletesModalOpen] = useState<boolean>(false);
  const [isClubsModalOpen, setIsClubsModalOpen] = useState<boolean>(false);

  const loadAllData = async () => {
    setIsRefreshing(true);
    try {
      const allPassages = await checkpointStorage.getPassagesForCompetition(competition.id);
      setPassages(allPassages);

      const computed = CrossCountryResultEngine.computeStandings(competition, allPassages);
      setStandings(computed);

      const allCorrections = await checkpointStorage.listCorrections();
      setCorrections(allCorrections);
    } catch (e) {
      console.warn('Failed loading passages:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();

    // الاستماع لأي أحداث مرور حية جديدة عبر الشبكة المحلية
    const unsubPassage = passageSyncEngine.onPassage(() => {
      loadAllData();
    });

    const unsubCorrection = passageSyncEngine.onCorrection(() => {
      loadAllData();
    });

    return () => {
      unsubPassage();
      unsubCorrection();
    };
  }, [competition.id]);

  // انطلاق السباق الرسمي
  const handleStartRace = async () => {
    if (competition.actualStartTime) {
      if (!confirm('السباق منطلق بالفعل. هل تريد إعادة ضبط توقيت الانطلاق؟')) return;
    }
    const updated: AthleticsCompetition = {
      ...competition,
      actualStartTime: Date.now(),
      status: 'in_progress',
      updatedAt: Date.now()
    };
    await checkpointStorage.saveCompetition(updated);
    loadAllData();
  };

  // اعتماد أو رفض تصحيح من الحكم العام
  const handleReviewCorrection = async (corr: PassageCorrection, status: 'approved' | 'rejected') => {
    const updatedCorr: PassageCorrection = {
      ...corr,
      status,
      reviewedAt: Date.now(),
      reviewedByName: 'الحكم العام'
    };
    await checkpointStorage.recordCorrection(updatedCorr);
    loadAllData();
  };

  // تصدير النتائج الرسمية إلى ملف CSV
  const handleExportCsv = () => {
    if (standings.length === 0) {
      alert('لا توجد نتائج مسجلة للتصدير بعد.');
      return;
    }

    const headers = ['الترتيب', 'رقم الصدرية', 'اسم العداء', 'النادي', 'الحلقات المكتملة', 'آخر نقطة', 'الزمن الإجمالي', 'الفارق عن المتصدر', 'الحالة', 'ملاحظات التحكيم'];
    const rows = standings.map(r => [
      r.rank,
      r.bibNumber,
      `"${r.athleteName}"`,
      `"${r.club || ''}"`,
      r.lapsCompleted,
      r.lastCheckpointCode,
      `"${CrossCountryResultEngine.formatDuration(r.totalElapsedTimeMs)}"`,
      `"${CrossCountryResultEngine.formatDuration(r.gapToLeaderMs)}"`,
      r.status === 'finished' ? 'مكتمل' : 'في المسار',
      r.hasAnomaly ? `"${r.anomalyReason || ''}"` : 'سليم'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `نتائج_${competition.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pendingCorrectionsCount = corrections.filter(c => c.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* شريط التحكم العلوي للحكم العام */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onExit}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="الرجوع"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-base">{competition.name}</span>
                <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full font-bold">
                  {competition.distanceKm} كم — {competition.lapCount} حلقات
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                <span>المكان: {competition.venue}</span>
                <span>•</span>
                <span>الحالة: {competition.status === 'in_progress' ? 'السباق جارٍ ⏱️' : 'جاهز للبدء'}</span>
              </div>
            </div>
          </div>

          {/* أزرار الإجراءات الرسمية */}
          <div className="flex flex-wrap items-center gap-2">
            {!competition.actualStartTime && (
              <button
                onClick={handleStartRace}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-900/40 transition"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>إعطاء شارة الانطلاق</span>
              </button>
            )}

            <button
              onClick={() => setIsAthletesModalOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-blue-300 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 transition"
              title="سجل العدائين والتحقق من الفئات والتكرار"
            >
              <Users className="w-4 h-4 text-blue-400" />
              <span>سجل العدائين</span>
            </button>

            <button
              onClick={() => setIsClubsModalOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 transition"
              title="دليل الأندية والميداليات"
            >
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>دليل الأندية</span>
            </button>

            <button
              onClick={onOpenJudges}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 transition"
            >
              <Users className="w-4 h-4 text-indigo-400" />
              <span>إدارة الحكام</span>
            </button>

            <button
              onClick={onOpenConfig}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 transition"
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-400" />
              <span>ضبط المسار</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 transition"
            >
              <Download className="w-4 h-4" />
              <span>تصدير CSV</span>
            </button>

            <button
              onClick={loadAllData}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="إعادة احتساب النتائج من الأحداث الأصلية"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* التبويبات الرئيسية: جدول الترتيب / مصفوفة نقاط المرور / تدقيق التصحيحات */}
      <div className="max-w-6xl mx-auto w-full px-4 pt-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('standings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'standings'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>جدول الترتيب المباشر ({standings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>مصفوفة نقاط المرور</span>
          </button>

          <button
            onClick={() => setActiveTab('corrections')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 relative ${
              activeTab === 'corrections'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>طلبات التصحيح وسجل التدقيق</span>
            {pendingCorrectionsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                {pendingCorrectionsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* محتوى الشاشات */}
      <div className="max-w-6xl mx-auto w-full p-4 flex-1">
        {/* 1. جدول الترتيب المباشر */}
        {activeTab === 'standings' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <th className="p-3.5 font-bold">الرتبة</th>
                    <th className="p-3.5 font-bold">الصدرية</th>
                    <th className="p-3.5 font-bold">العداء والنادي</th>
                    <th className="p-3.5 font-bold">الحلقات</th>
                    <th className="p-3.5 font-bold">آخر نقطة عبور</th>
                    <th className="p-3.5 font-bold font-mono">الزمن الإجمالي</th>
                    <th className="p-3.5 font-bold font-mono">الفارق</th>
                    <th className="p-3.5 font-bold">الحالة والمراجعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {standings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                        لم يتم تسجيل أي مرور للعدائين حتى الآن في أي نقطة مراقبة.
                      </td>
                    </tr>
                  ) : (
                    standings.map((runner) => (
                      <tr 
                        key={runner.bibNumber}
                        className={`hover:bg-slate-800/40 transition ${
                          runner.hasAnomaly ? 'bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="p-3.5 font-black text-sm">
                          {runner.rank === 1 ? '🥇 1' : runner.rank === 2 ? '🥈 2' : runner.rank === 3 ? '🥉 3' : runner.rank}
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono font-black text-emerald-400 text-sm bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-lg">
                            #{runner.bibNumber}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-200">{runner.athleteName}</div>
                          <div className="text-[11px] text-slate-400">{runner.club}</div>
                        </td>
                        <td className="p-3.5 font-bold text-slate-300">
                          {runner.lapsCompleted} / {competition.lapCount}
                        </td>
                        <td className="p-3.5">
                          <span className="text-slate-300 font-mono font-bold bg-slate-800 px-2 py-0.5 rounded">
                            {runner.lastCheckpointCode}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-black text-slate-100 text-sm">
                          {CrossCountryResultEngine.formatDuration(runner.totalElapsedTimeMs)}
                        </td>
                        <td className="p-3.5 font-mono text-slate-400">
                          {runner.rank === 1 ? '—' : `+${CrossCountryResultEngine.formatDuration(runner.gapToLeaderMs)}`}
                        </td>
                        <td className="p-3.5">
                          {runner.hasAnomaly ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-950 border border-amber-800 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>{runner.anomalyReason || 'اشتباه في المسار'}</span>
                            </span>
                          ) : runner.status === 'finished' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>أنهى السباق</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                              في المسار
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. مصفوفة نقاط المرور للعدائين (Matrix View) */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            {competition.lapCount > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">عرض الحلقة:</span>
                {Array.from({ length: competition.lapCount }, (_, i) => i + 1).map(lNum => (
                  <button
                    key={lNum}
                    onClick={() => setFilterLap(lNum)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      filterLap === lNum ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    حلقة {lNum}
                  </button>
                ))}
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-x-auto shadow-xl">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-3 text-start">الصدرية</th>
                    {competition.checkpoints.map(cp => (
                      <th key={cp.id} className="p-3 font-mono font-bold text-emerald-400">
                        {cp.code}
                        <div className="text-[10px] text-slate-500 font-normal">{cp.distanceKm} كم</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {standings.map(runner => (
                    <tr key={runner.bibNumber} className="hover:bg-slate-800/40">
                      <td className="p-3 text-start font-mono font-bold text-slate-200">
                        #{runner.bibNumber} {runner.athleteName}
                      </td>
                      {competition.checkpoints.map(cp => {
                        const pass = runner.passages.find(p => p.checkpointId === cp.id && p.lapNumber === filterLap);
                        return (
                          <td key={cp.id} className="p-3 font-mono">
                            {pass ? (
                              <span className="inline-block bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded text-[11px] font-bold">
                                {new Date(pass.timestamp).toLocaleTimeString('ar-EG')}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. سجل التصحيحات والتدقيق (Audit Trail & Corrections) */}
        {activeTab === 'corrections' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-200">طلبات التصحيح وسجل التعديلات الميدانية</h3>
              <span className="text-xs text-slate-400">جميع الأحداث الأصلية محفوظة ولا يتم حذفها أبداً</span>
            </div>

            {corrections.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">لا توجد طلبات تصحيح مسجلة حتى الآن.</p>
            ) : (
              <div className="space-y-2">
                {corrections.map(corr => (
                  <div 
                    key={corr.id}
                    className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300">
                          تصحيح الصدرية: <span className="line-through text-rose-400">#{corr.originalBibNumber}</span> ⬅️ <span className="text-emerald-400 font-bold">#{corr.correctedBibNumber}</span>
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          corr.status === 'approved' 
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : corr.status === 'rejected'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                        }`}>
                          {corr.status === 'approved' ? 'معتمد رسمياً' : corr.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">السبب: {corr.reason}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        طلب بواسطة: {corr.requestedByName} في {new Date(corr.requestedAt).toLocaleTimeString()}
                      </p>
                    </div>

                    {corr.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReviewCorrection(corr, 'approved')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>اعتماد</span>
                        </button>
                        <button
                          onClick={() => handleReviewCorrection(corr, 'rejected')}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>رفض</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* نوافذ منظومة العدائين والأندية */}
      <AthletesDatabaseModal
        isOpen={isAthletesModalOpen}
        onClose={() => setIsAthletesModalOpen(false)}
      />

      <ClubsDatabaseModal
        isOpen={isClubsModalOpen}
        onClose={() => setIsClubsModalOpen(false)}
      />
    </div>
  );
};
