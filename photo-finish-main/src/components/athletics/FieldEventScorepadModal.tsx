import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, X, Check, Wind, Lock
} from 'lucide-react';
import { 
  FieldEventCompetition, 
  FieldAthleteScore, 
  FieldAttempt, 
  FieldAttemptResult
} from '../../types/athletics';
import { fieldEventService } from '../../services/fieldEventService';

interface FieldEventScorepadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FieldEventScorepadModal: React.FC<FieldEventScorepadModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [competitions, setCompetitions] = useState<FieldEventCompetition[]>([]);
  const [activeCompId, setActiveCompId] = useState<string>('');
  
  // نموذج إدخال محاولة
  const [editingAttempt, setEditingAttempt] = useState<{
    athlete: FieldAthleteScore;
    attemptNumber: number;
    existingAttempt?: FieldAttempt;
  } | null>(null);

  const [attemptResultType, setAttemptResultType] = useState<FieldAttemptResult>('valid');
  const [measurementStr, setMeasurementStr] = useState<string>('');
  const [windStr, setWindStr] = useState<string>('0.0');

  useEffect(() => {
    if (isOpen) {
      loadCompetitions();
    }
  }, [isOpen]);

  const loadCompetitions = async () => {
    const list = await fieldEventService.listCompetitions();
    setCompetitions(list);
    if (list.length > 0 && !activeCompId) {
      setActiveCompId(list[0].id);
    }
  };

  const activeComp = useMemo(() => {
    return competitions.find((c) => c.id === activeCompId) || competitions[0] || null;
  }, [competitions, activeCompId]);

  const isHorizontalJump = useMemo(() => {
    if (!activeComp) return false;
    return activeComp.discipline === 'long_jump' || activeComp.discipline === 'triple_jump';
  }, [activeComp]);

  const handleOpenAttemptModal = (athlete: FieldAthleteScore, attemptNumber: number) => {
    if (activeComp?.status === 'official') {
      alert('المسابقة معتمدة ومقفلة رسمياً. لا يمكن تعديل المحاولات إلا بإعادة الفتح.');
      return;
    }

    const existing = athlete.attempts.find((a) => a.attemptNumber === attemptNumber);
    setEditingAttempt({ athlete, attemptNumber, existingAttempt: existing });
    setAttemptResultType(existing ? existing.resultType : 'valid');
    setMeasurementStr(existing && existing.measurementMeters > 0 ? String(existing.measurementMeters) : '');
    setWindStr(existing?.wind !== undefined ? String(existing.wind) : '0.0');
  };

  const handleSaveAttempt = async () => {
    if (!activeComp || !editingAttempt) return;

    let measurement = 0;
    if (attemptResultType === 'valid') {
      measurement = parseFloat(measurementStr);
      if (isNaN(measurement) || measurement <= 0) {
        alert('يرجى إدخال قياس صحيح بالأمتار (مثلاً: 8.25 أو 19.40).');
        return;
      }
    }

    const wind = isHorizontalJump ? parseFloat(windStr) || 0 : undefined;

    const attempt: FieldAttempt = {
      attemptNumber: editingAttempt.attemptNumber,
      resultType: attemptResultType,
      measurementMeters: measurement,
      wind,
      timestamp: Date.now(),
      judgeId: 'field_judge_01',
    };

    const updated = await fieldEventService.recordDistanceAttempt(
      activeComp.id,
      editingAttempt.athlete.athleteId,
      attempt
    );

    if (updated) {
      setCompetitions((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    }

    setEditingAttempt(null);
  };

  const handleLockCompetition = async () => {
    if (!activeComp) return;
    if (window.confirm(`هل أنت متأكد من قفل واعتماد نتائج (${activeComp.name}) نهائياً؟`)) {
      const updated: FieldEventCompetition = {
        ...activeComp,
        status: 'official',
        chiefJudgeName: 'الحكم العام لمسابقات الميدان',
        updatedAt: Date.now(),
      };
      await fieldEventService.persistCompetition(updated);
      setCompetitions((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-4 text-white overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 bg-slate-800/80 border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {activeComp ? activeComp.name : 'جدول تحكيم المسابقات الميدانية'}
                </h2>
                {activeComp && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    activeComp.status === 'official'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}>
                    {activeComp.status === 'official' ? 'رسمي معتمد 🔒' : 'المنافسة جارية ⏱️'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                مسابقات الوثب والرمي (Rule 25 & 26) • كسر التعادل الآلي (Countback Rule) • 6 محاولات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeComp && activeComp.status !== 'official' && (
              <button
                onClick={handleLockCompetition}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition shadow-lg shadow-emerald-950/40 active:scale-95"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>اعتماد وقفل النتائج</span>
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

        {/* Toolbar: الاختصاصات الميدانية والمنصة السريعة */}
        <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">المسابقة الميدانية:</span>
            <select
              value={activeCompId}
              onChange={(e) => setActiveCompId(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-amber-500"
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.venue})</option>
              ))}
            </select>
          </div>

          {/* منصة التتويج السريعة للمتصدرين */}
          {activeComp && activeComp.athletes.length > 0 && (
            <div className="flex items-center gap-4 bg-slate-850/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              {activeComp.athletes.slice(0, 3).map((ath, idx) => (
                <div key={ath.athleteId} className="flex items-center gap-1.5">
                  <span className="text-sm">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-white text-[11px] block">{ath.athleteName}</span>
                    <span className="font-mono font-bold text-amber-300 text-[10px]">
                      {ath.bestValidMeasurement > 0 ? `${ath.bestValidMeasurement.toFixed(2)}m` : 'NM'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* جدول المحاولات الميداني الرسمي */}
        <div className="flex-1 overflow-y-auto p-4">
          {!activeComp ? (
            <div className="text-center py-16 text-slate-400">لا توجد مسابقات ميدانية مجدولة.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-800/90 text-slate-300 font-semibold border-b border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3 text-center">الرتبة</th>
                    <th className="py-2.5 px-3 text-center">الترتيب</th>
                    <th className="py-2.5 px-3 text-center">الصدرية</th>
                    <th className="py-2.5 px-3">الاسم واللقب</th>
                    <th className="py-2.5 px-3">النادي</th>
                    {Array.from({ length: activeComp.totalAttemptsAllowed }, (_, i) => (
                      <th key={i + 1} className="py-2.5 px-2 text-center border-r border-slate-700/60 font-mono">
                        المحاولة {i + 1}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-center bg-amber-950/20 text-amber-300 font-bold border-r border-slate-700">
                      الأفضل (Best)
                    </th>
                    <th className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                      الثاني (2nd)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {activeComp.athletes.map((ath) => (
                    <tr key={ath.athleteId} className="hover:bg-slate-800/40 transition">
                      {/* الرتبة */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${
                          ath.rank === 1 
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' 
                            : ath.rank === 2 
                            ? 'bg-slate-400/20 text-slate-200 border border-slate-400/50' 
                            : ath.rank === 3 
                            ? 'bg-amber-800/20 text-amber-600 border border-amber-700/50' 
                            : 'text-slate-400'
                        }`}>
                          {ath.bestValidMeasurement > 0 ? ath.rank : '—'}
                        </span>
                      </td>

                      {/* ترتيب الفوج */}
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {ath.order}
                      </td>

                      {/* الصدرية */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300">
                          #{ath.bibNumber}
                        </span>
                      </td>

                      {/* اسم العداء */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-white text-sm">{ath.athleteName}</div>
                      </td>

                      {/* النادي */}
                      <td className="py-2.5 px-3 text-slate-300">
                        {ath.clubName}
                      </td>

                      {/* خلايا المحاولات 1 إلى 6 */}
                      {Array.from({ length: activeComp.totalAttemptsAllowed }, (_, i) => {
                        const attemptNum = i + 1;
                        const att = ath.attempts.find((a) => a.attemptNumber === attemptNum);
                        const isBest = att && att.resultType === 'valid' && att.measurementMeters === ath.bestValidMeasurement;

                        return (
                          <td 
                            key={attemptNum} 
                            onClick={() => handleOpenAttemptModal(ath, attemptNum)}
                            className={`py-2 px-1 text-center border-r border-slate-800/80 cursor-pointer transition hover:bg-slate-700/60 ${
                              isBest ? 'bg-amber-500/10' : ''
                            }`}
                            title="انقر لتسجيل أو تعديل المحاولة"
                          >
                            {att ? (
                              att.resultType === 'valid' ? (
                                <div className="flex flex-col items-center">
                                  <span className={`font-mono font-bold text-xs ${isBest ? 'text-amber-400 font-black' : 'text-emerald-300'}`}>
                                    {att.measurementMeters.toFixed(2)}
                                  </span>
                                  {att.wind !== undefined && (
                                    <span className="text-[9px] text-slate-400 font-mono">
                                      {att.wind > 0 ? `+${att.wind}` : att.wind}
                                    </span>
                                  )}
                                </div>
                              ) : att.resultType === 'foul' ? (
                                <span className="font-mono font-extrabold text-rose-400 text-sm">X</span>
                              ) : att.resultType === 'pass' ? (
                                <span className="font-mono font-bold text-slate-400 text-xs">P</span>
                              ) : (
                                <span className="font-mono text-slate-500">-</span>
                              )
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* أفضل نتيجة Best */}
                      <td className="py-2.5 px-3 text-center bg-amber-950/20 border-r border-slate-700">
                        <span className="font-mono font-black text-amber-300 text-sm">
                          {ath.bestValidMeasurement > 0 ? `${ath.bestValidMeasurement.toFixed(2)}m` : 'NM'}
                        </span>
                      </td>

                      {/* ثاني أفضل نتيجة (Countback) */}
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-xs">
                        {ath.secondBestMeasurement > 0 ? `${ath.secondBestMeasurement.toFixed(2)}m` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <div>
            قواعد التحكيم المعتمدة للاتحاد الدولي (World Athletics Technical Rules TR25) • كسر التعادل الآلي
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
      {/* نافذة تسجيل المحاولة السريعة (Attempt Input Dialog) */}
      {/* ═══════════════════════════════════════════════════ */}
      {editingAttempt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-6 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-white text-base">
                  تسجيل المحاولة رقم ({editingAttempt.attemptNumber})
                </h3>
                <p className="text-xs text-slate-400">العداء: {editingAttempt.athlete.athleteName} (#{editingAttempt.athlete.bibNumber})</p>
              </div>
              <button onClick={() => setEditingAttempt(null)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* خيارات نوع النتيجة */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAttemptResultType('valid')}
                  className={`p-2.5 rounded-xl font-bold transition flex flex-col items-center gap-1 ${
                    attemptResultType === 'valid'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>صالح (Valid)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAttemptResultType('foul');
                    setMeasurementStr('0');
                  }}
                  className={`p-2.5 rounded-xl font-bold transition flex flex-col items-center gap-1 ${
                    attemptResultType === 'foul'
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <X className="w-4 h-4" />
                  <span>خطأ (Foul - X)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAttemptResultType('pass');
                    setMeasurementStr('0');
                  }}
                  className={`p-2.5 rounded-xl font-bold transition flex flex-col items-center gap-1 ${
                    attemptResultType === 'pass'
                      ? 'bg-slate-700 text-white shadow'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <span>P</span>
                  <span>تنازل (Pass)</span>
                </button>
              </div>

              {/* إدخال المسافة بالأمتار */}
              {attemptResultType === 'valid' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1">القياس بالأمتار (مثلاً: 8.24 أو 19.35) *</label>
                    <input
                      type="number"
                      step="0.01"
                      autoFocus
                      value={measurementStr}
                      onChange={(e) => setMeasurementStr(e.target.value)}
                      placeholder="8.24"
                      className="w-full text-center text-3xl font-mono font-bold py-3 bg-slate-950 border border-slate-700 rounded-xl text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {isHorizontalJump && (
                    <div>
                      <label className="block text-slate-400 mb-1 flex items-center gap-1">
                        <Wind className="w-3.5 h-3.5 text-blue-400" />
                        <span>سرعة الرياح (m/s)</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={windStr}
                        onChange={(e) => setWindStr(e.target.value)}
                        placeholder="+1.2"
                        className="w-full text-center font-mono py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAttempt(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveAttempt}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-950/40"
                >
                  حفظ المحاولة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
