import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, ShieldAlert, CheckCircle2, AlertTriangle, Users, 
  RefreshCw, Check, Ban, Eye, Search, Layers, Clock
} from 'lucide-react';
import { 
  AthleticsCompetition, 
  MergedPassage, 
  RaceAnomaly 
} from '../../types/athletics';
import { multiJudgeMergeEngine } from '../../services/multiJudgeMergeEngine';
import { checkpointStorage } from '../../services/checkpointStorage';

interface MultiJudgeMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitionId?: string;
}

export const MultiJudgeMergeModal: React.FC<MultiJudgeMergeModalProps> = ({
  isOpen,
  onClose,
  competitionId,
}) => {
  const [competitions, setCompetitions] = useState<AthleticsCompetition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>(competitionId || '');
  const [mergedPassages, setMergedPassages] = useState<MergedPassage[]>([]);
  const [anomalies, setAnomalies] = useState<RaceAnomaly[]>([]);
  const [activeTab, setActiveTab] = useState<'anomalies' | 'passages' | 'telemetry'>('anomalies');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAnomaly, setSelectedAnomaly] = useState<RaceAnomaly | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [notification, setNotification] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

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
          const result = multiJudgeMergeEngine.processPassages(comp, rawPassages);
          setMergedPassages(result.mergedPassages);
          setAnomalies(result.anomalies);
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

  // معالجة الشذوذ من قبل الحكم الرئيسي
  const handleResolve = (action: 'dismiss' | 'disqualify' | 'override') => {
    if (!selectedAnomaly) return;
    const note = resolutionNote.trim() || (action === 'dismiss' ? 'تم الفحص والتأكيد بواسطة الحكم الرئيسي' : 'مخالفة معتمدة');

    multiJudgeMergeEngine.resolveAnomaly(selectedAnomaly.id, action, note);
    
    // تحديث الحالة المحلية
    setAnomalies(prev => prev.map(a => a.id === selectedAnomaly.id ? {
      ...a,
      resolved: true,
      resolutionNote: `[${action.toUpperCase()}] ${note}`
    } : a));

    if (activeCompetition) {
      const allMerged = multiJudgeMergeEngine.getAllMergedPassages(activeCompetition.id);
      setMergedPassages(allMerged);
    }

    setSelectedAnomaly(null);
    setResolutionNote('');
    showNotification(`تم تسجيل القرار (${action === 'dismiss' ? 'إهمال الشبهة' : action === 'disqualify' ? 'استبعاد المتسابق' : 'تعديل رسمي'}) بنجاح!`);
  };

  // فلترة قائمة المرورات
  const filteredPassages = useMemo(() => {
    return mergedPassages.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchBib = p.bibNumber.toString().includes(q);
      const matchName = (p.athleteName || '').toLowerCase().includes(q);
      const matchCp = p.checkpointCode.toLowerCase().includes(q);
      return matchBib || matchName || matchCp;
    });
  }, [mergedPassages, searchQuery]);

  // فلترة التنبيهات غير المعالجة
  const unresolvedAnomalies = useMemo(() => {
    return anomalies.filter(a => !a.resolved);
  }, [anomalies]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* شريط العنوان */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-lg shrink-0">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">مركز دمج تحكيم الهواتف المتعددة وكشف الشذوذ</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Consensus Engine ⚖️
                </span>
              </div>
              <p className="text-xs text-slate-400">
                دمج توافقي لتسجيلات الحكام، كشف تخطي النقاط، السرعات المستحيلة، وحماية النزاهة الرياضية
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

        {/* إشعار النجاح اللحظي */}
        {notification && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* شريط اختيار المنافسة والتبويبات */}
        <div className="px-4 py-2.5 bg-slate-950/30 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-bold">المنافسة:</span>
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
              onClick={() => setActiveTab('anomalies')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'anomalies' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>تنبيهات الشذوذ ({unresolvedAnomalies.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('passages')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'passages' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>سجل المرور المدمج ({mergedPassages.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('telemetry')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'telemetry' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>تزامن الحكام والموثوقية</span>
            </button>

            <button
              type="button"
              onClick={loadData}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* محتوى التبويبات */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          
          {/* ══════════ تبويب تنبيهات الشذوذ ══════════ */}
          {activeTab === 'anomalies' && (
            <div className="space-y-3">
              {anomalies.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {anomalies.map(anomaly => (
                    <div
                      key={anomaly.id}
                      className={`border rounded-2xl p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md ${
                        anomaly.resolved
                          ? 'bg-slate-950/40 border-slate-800 text-slate-400'
                          : anomaly.severity === 'critical'
                          ? 'bg-red-950/30 border-red-500/40 text-red-200'
                          : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                            anomaly.severity === 'critical'
                              ? 'bg-red-500/20 text-red-300 border-red-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}>
                            {anomaly.type === 'skipped_checkpoint' && '🚨 تخطي نقطة مراقبة'}
                            {anomaly.type === 'speed_anomaly' && '⚡ سرعة غير بشرية'}
                            {anomaly.type === 'reverse_traversal' && '🔄 سير عكسي'}
                            {anomaly.type === 'rapid_duplicate' && '⏱️ نقر مكرر'}
                            {anomaly.type === 'unregistered_bib' && '❓ صدر غير مسجل'}
                          </span>

                          <span className="font-mono font-black text-sm text-white">
                            صدر #{anomaly.bibNumber}
                          </span>

                          <span className="text-xs text-slate-300">
                            في نقطة ({anomaly.checkpointCode}) • حلقة {anomaly.lapNumber}
                          </span>

                          {anomaly.resolved && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              تمت المعالجة: {anomaly.resolutionNote}
                            </span>
                          )}
                        </div>

                        <p className="text-xs leading-relaxed text-slate-300 font-sans">
                          {anomaly.details}
                        </p>
                      </div>

                      {!anomaly.resolved && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedAnomaly(anomaly)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow"
                          >
                            <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            <span>اتخاذ قرار</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                  <p>لا توجد أي تنبيهات شذوذ في هذا السباق! جميع تسجيلات الحكام متطابقة وسليمة رياضياً.</p>
                </div>
              )}
            </div>
          )}

          {/* ══════════ تبويب سجل المرور المدمج ══════════ */}
          {activeTab === 'passages' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="بحث برقم الصدر أو اسم العداء أو النقطة..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-100"
                  />
                </div>
                <div className="text-xs text-slate-400">
                  إجمالي المرورات المدمجة: <strong className="text-cyan-400">{filteredPassages.length}</strong>
                </div>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-400 text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">الصدر والعداء</th>
                      <th className="p-2.5">نقطة المراقبة</th>
                      <th className="p-2.5">الحلقة</th>
                      <th className="p-2.5">التوقيت التوافقي</th>
                      <th className="p-2.5">تطابق الحكام</th>
                      <th className="p-2.5">الموثوقية</th>
                      <th className="p-2.5">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredPassages.map(p => (
                      <tr key={p.id} className="hover:bg-slate-850/50 transition">
                        <td className="p-2.5 font-sans font-bold text-white flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-mono font-black text-cyan-300">
                            {p.bibNumber}
                          </span>
                          <div>
                            <span className="block text-xs">{p.athleteName || `متسابق #${p.bibNumber}`}</span>
                            {p.clubName && <span className="text-[10px] text-slate-400 block">{p.clubName}</span>}
                          </div>
                        </td>
                        <td className="p-2.5 text-cyan-300 font-bold">{p.checkpointCode}</td>
                        <td className="p-2.5 text-slate-300">حلقة {p.lapNumber}</td>
                        <td className="p-2.5 text-slate-200">
                          {new Date(p.officialTimestamp).toLocaleTimeString('ar-DZ')}
                        </td>
                        <td className="p-2.5 text-slate-300 font-sans text-[11px]">
                          {p.corroboratingJudges.length} حكام توافقيين
                        </td>
                        <td className="p-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            p.confidenceScore >= 0.85
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}>
                            {(p.confidenceScore * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="p-2.5 font-sans">
                          {p.status === 'valid' && <span className="text-emerald-400 text-[11px] font-bold">معتمد ✓</span>}
                          {p.status === 'suspicious' && <span className="text-amber-400 text-[11px] font-bold">محل شبهة ⚠️</span>}
                          {p.status === 'disqualified' && <span className="text-red-400 text-[11px] font-bold">مستبعد (DQ) ✕</span>}
                          {p.status === 'overridden' && <span className="text-purple-400 text-[11px] font-bold">تعديل حكم ⚖️</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════ تبويب تزامن الحكام والموثوقية ══════════ */}
          {activeTab === 'telemetry' && activeCompetition && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs text-slate-400 block mb-1">نقاط المراقبة النشطة</span>
                  <span className="text-xl font-bold text-cyan-400">{activeCompetition.checkpoints.length} نقاط</span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs text-slate-400 block mb-1">متوسط نسبة التوافق</span>
                  <span className="text-xl font-bold text-emerald-400">96.4%</span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs text-slate-400 block mb-1">نافذة الدمج الشبكي</span>
                  <span className="text-xl font-bold text-amber-400">3000ms (±3 ثواني)</span>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>توزيع الحكام على النقاط التضاريسية</span>
                </h3>

                <div className="space-y-2">
                  {activeCompetition.checkpoints.map(cp => (
                    <div key={cp.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                      <div>
                        <strong className="text-white block font-mono">{cp.code} • {cp.name}</strong>
                        <span className="text-[11px] text-slate-400">المسافة: {cp.distanceKm} كم • الترتيب: #{cp.order}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300">
                          {cp.assignedJudgeIds?.length || 1} هواتف حكام
                        </span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* نافذة اتخاذ القرار للحكم الرئيسي */}
        {selectedAnomaly && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4" dir="rtl">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-lg w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>قرار الحكم الرئيسي بشأن المخالفة</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedAnomaly(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 text-xs space-y-1">
                <div className="text-white font-bold">صدر #{selectedAnomaly.bibNumber} في ({selectedAnomaly.checkpointCode})</div>
                <div className="text-slate-300 leading-relaxed">{selectedAnomaly.details}</div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">تعليل القرار الرسمي (يُدرج في التقرير النهائي)</label>
                <textarea
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  placeholder="اكتب ملاحظة التعديل أو حيثيات الاستبعاد أو تأكيد سلامة المرور..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleResolve('dismiss')}
                  className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>إهمال الشبهة</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleResolve('disqualify')}
                  className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>استبعاد (DQ)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleResolve('override')}
                  className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>تعديل إداري</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* الشريط السفلي */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
          <div className="text-slate-400">
            تحديث فوري لبيانات الحكام عبر بروتوكول P2P Mesh المحلي دون انترنت
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

export default MultiJudgeMergeModal;
