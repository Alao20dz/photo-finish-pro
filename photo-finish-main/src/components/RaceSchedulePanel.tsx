import React, { useState } from 'react';
import { 
  X, 
  Flag, 
  Clock, 
  CheckCircle2, 
  Award,
  Play
} from 'lucide-react';
import { Heat, PhoneRole } from '../types/race';

interface RaceSchedulePanelProps {
  heats: Heat[];
  currentHeatIndex: number;
  dispatchedHeatId?: string | null;
  role: PhoneRole;
  onSelectHeat?: (index: number) => void;
  onDispatchHeat?: (heatId: string) => void;
  onClose: () => void;
}

export const RaceSchedulePanel: React.FC<RaceSchedulePanelProps> = ({
  heats,
  currentHeatIndex,
  dispatchedHeatId,
  role,
  onSelectHeat,
  onDispatchHeat,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'dispatched' | 'pending' | 'completed'>('all');

  // تصنيف القوائم:
  // 1. السباق المعني الجاري على خط الانطلاق (Au Départ)
  const currentDispatchedHeat = heats.find(h => h.id === dispatchedHeatId || h.isDispatched) || heats[currentHeatIndex];

  // 2. سباقات أجريت واكتملت
  const completedHeats = heats.filter(h => h.status === 'completed');

  // 3. سباقات قادمة لم تجرَ بعد
  const upcomingHeats = heats.filter(h => h.status !== 'completed' && h.id !== currentDispatchedHeat?.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl animate-scaleUp my-auto text-slate-100 flex flex-col max-h-[90vh]">
        {/* الترويسة */}
        <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-inner">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-white">
                  جدول السباقات وحالة خط الانطلاق (Race Schedule)
                </h3>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                  مزامنة لحظية ⚡
                </span>
              </div>
              <p className="text-xs text-slate-400">
                متابعة السباق الجاري على خط الانطلاق (Au Départ)، السباقات المكتملة، والقادمة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* قسم بارز جداً: السباق المعني المحدد على خط الانطلاق (Au Départ 🏁) */}
        {currentDispatchedHeat && (
          <div className="p-4 bg-gradient-to-r from-amber-950/60 via-orange-950/50 to-slate-900 border-b border-amber-500/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl font-black text-xl shadow-lg shadow-amber-500/30 animate-pulse shrink-0">
                  🏁
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-amber-400 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full animate-bounce">
                      على خط الانطلاق (Au Départ) 🚦
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      محدد بواسطة هاتف البداية
                    </span>
                  </div>
                  <h4 className="text-lg font-black text-white mt-1">
                    {currentDispatchedHeat.name}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-slate-300 mt-1 font-mono">
                    <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-cyan-300 font-bold">
                      {currentDispatchedHeat.distance}
                    </span>
                    <span>{currentDispatchedHeat.runners.length} عداء في الأروقة</span>
                    {currentDispatchedHeat.dispatchedAt && (
                      <span className="text-amber-300 text-[11px]">
                        وقت الإرسال: {new Date(currentDispatchedHeat.dispatchedAt).toLocaleTimeString('ar-DZ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* إذا كان المستخدم على هاتف البداية أو التحكيم ويريد الانتقال أو إعادة الإرسال */}
              {role === 'start' && onDispatchHeat && (
                <button
                  type="button"
                  onClick={() => onDispatchHeat(currentDispatchedHeat.id)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer border border-emerald-400/40 shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>تأكيد الإرسال (Au Départ)</span>
                </button>
              )}
            </div>

            {/* شريط مصغر للعدائين في خط الانطلاق */}
            <div className="mt-3 pt-2.5 border-t border-amber-500/20 flex flex-wrap gap-1.5">
              {currentDispatchedHeat.runners.map(r => (
                <div
                  key={r.id}
                  className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700 px-2 py-1 rounded-xl text-xs"
                >
                  <span
                    className="w-5 h-5 rounded-lg flex items-center justify-center font-bold text-[10px] text-white"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.lane}
                  </span>
                  <span className="font-bold text-white text-[11px]">{r.name}</span>
                  <span className="text-[10px] text-amber-400 font-mono">#{r.bib}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* أزرار التبويبات للتصفية */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              جميع القوائم ({heats.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              القادمة ({upcomingHeats.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              المنتهية ({completedHeats.length})
            </button>
          </div>
        </div>

        {/* محتوى القوائم */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
          {/* قسم السباقات القادمة التي لم تجرَ بعد */}
          {(activeTab === 'all' || activeTab === 'pending') && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                <Clock className="w-3.5 h-3.5" />
                <span>السباقات القادمة (Courses à venir):</span>
              </div>

              {upcomingHeats.length === 0 ? (
                <div className="p-4 bg-slate-950/40 rounded-2xl text-center text-slate-500 text-xs">
                  لا توجد سباقات قادمة متبقية في الجدول.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {upcomingHeats.map(heat => {
                    const originalIndex = heats.findIndex(h => h.id === heat.id);
                    return (
                      <div
                        key={heat.id}
                        className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between gap-2 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs">{heat.name}</span>
                              <span className="text-[10px] bg-slate-800 text-cyan-300 font-mono px-1.5 py-0.2 rounded">
                                {heat.distance}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 mt-1 block">
                              {heat.runners.length} عدائين مسجلين
                            </span>
                          </div>

                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                            بانتظار النداء ⌛
                          </span>
                        </div>

                        {/* زر تعيين هذه القائمة إلى خط الانطلاق */}
                        {onSelectHeat && (
                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectHeat(originalIndex);
                                if (role === 'start' && onDispatchHeat) {
                                  onDispatchHeat(heat.id);
                                }
                                onClose();
                              }}
                              className="w-full py-1.5 px-2.5 rounded-xl bg-slate-850 hover:bg-amber-600/40 text-amber-300 hover:text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer border border-slate-700"
                            >
                              <span>تحديد كسباق تالي إلى خط الانطلاق 🏁</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* قسم السباقات التي أُجريت وانتهت */}
          {(activeTab === 'all' || activeTab === 'completed') && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>السباقات التي أُجريت (Courses terminées):</span>
              </div>

              {completedHeats.length === 0 ? (
                <div className="p-4 bg-slate-950/40 rounded-2xl text-center text-slate-500 text-xs">
                  لم يكتمل أي سباق بعد في هذه الجلسة.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {completedHeats.map(heat => {
                    const winner = [...heat.runners].filter(r => r.finishTime > 0).sort((a, b) => a.finishTime - b.finishTime)[0];
                    const originalIndex = heats.findIndex(h => h.id === heat.id);
                    return (
                      <div
                        key={heat.id}
                        className="bg-slate-950/80 border border-emerald-900/40 rounded-2xl p-3 flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs">{heat.name}</span>
                              <span className="text-[10px] bg-slate-800 text-emerald-400 font-mono px-1.5 py-0.2 rounded">
                                {heat.distance}
                              </span>
                            </div>
                            {winner ? (
                              <div className="text-[11px] text-amber-300 font-bold mt-1 flex items-center gap-1">
                                <Award className="w-3 h-3 text-amber-400" />
                                <span>الفائز: {winner.name} ({((winner.finishTime) / 1000).toFixed(2)}s)</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 mt-1 block">
                                اكتمل السباق
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                            مكتمل ✅
                          </span>
                        </div>

                        {onSelectHeat && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectHeat(originalIndex);
                              onClose();
                            }}
                            className="py-1 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                          >
                            <span>عرض نتائج هذه القائمة 📊</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* تذييل النافذة */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
