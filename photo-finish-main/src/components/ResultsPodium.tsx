import React from 'react';
import { Award, RotateCcw, Download, Eye, Sparkles } from 'lucide-react';
import { Runner, RaceSettings } from '../types/race';

interface ResultsPodiumProps {
  runners: Runner[];
  settings: RaceSettings;
  onSharedResetRace: () => void;
  onViewPhotoFinish: () => void;
}

export const ResultsPodium: React.FC<ResultsPodiumProps> = ({
  runners,
  settings,
  onSharedResetRace,
  onViewPhotoFinish
}) => {
  // ترتيب العدائين تلقائياً حسب الوصول بالمللي ثانية (من الأول إلى الأخير)
  const sorted = [...runners]
    .filter(r => r.finishTime > 0)
    .sort((a, b) => a.finishTime - b.finishTime);

  const winningTime = sorted.length > 0 ? sorted[0].finishTime : 0;

  const exportCSV = () => {
    const headers = ['الترتيب', 'الرواق', 'رقم الصدر', 'اسم العداء', 'الدولة/الفريق', 'التوقيت الرسمي (ثانية)', 'الفارق عن الأول'];
    const rows = sorted.map((r, idx) => [
      idx + 1,
      `رواق ${r.lane}`,
      r.bib,
      r.name,
      r.country,
      (r.finishTime / 1000).toFixed(3),
      idx === 0 ? 'الفائز 🥇' : `+${((r.finishTime - winningTime) / 1000).toFixed(3)}s`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `results-${settings.distance}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-md mx-auto p-3 space-y-3.5" dir="rtl">
      {/* منصة التتويج الأولمبية (Podium) */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden text-center">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>النتائج الرسمية لسباق {settings.distance}</span>
        </div>

        {/* المنصة الثلاثية للمراكز الأولى */}
        {sorted.length >= 2 && (
          <div className="flex items-end justify-center gap-2.5 my-3 pt-3">
            {/* المركز الثاني (فضة) */}
            <div className="flex-1 flex flex-col items-center">
              <span className="text-2xl mb-1">🥈</span>
              <div className="text-[11px] font-bold text-slate-200 truncate w-20">{sorted[1]?.name}</div>
              <div className="text-[10px] text-cyan-400 font-mono">رواق L{sorted[1]?.lane}</div>
              <div className="text-[11px] font-mono text-amber-300 font-bold mt-0.5">
                {sorted[1] ? `${(sorted[1].finishTime / 1000).toFixed(3)}s` : '--'}
              </div>
              <div className="w-full h-14 bg-gradient-to-t from-slate-800 to-slate-700/80 rounded-t-xl mt-2 flex items-center justify-center font-black text-slate-400 text-lg border-t-2 border-slate-400">
                2
              </div>
            </div>

            {/* المركز الأول (ذهب) */}
            <div className="flex-1 flex flex-col items-center">
              <span className="text-3xl mb-1 animate-bounce">🥇</span>
              <div className="text-xs font-black text-amber-300 truncate w-24">{sorted[0]?.name}</div>
              <div className="text-[11px] text-yellow-400 font-mono font-bold">رواق L{sorted[0]?.lane}</div>
              <div className="text-xs font-mono font-black text-white bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40 mt-0.5 shadow-sm">
                {sorted[0] ? `${(sorted[0].finishTime / 1000).toFixed(3)}s` : '--'}
              </div>
              <div className="w-full h-20 bg-gradient-to-t from-amber-600/80 to-yellow-500 rounded-t-xl mt-2 flex items-center justify-center font-black text-slate-950 text-2xl border-t-2 border-yellow-300 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                1
              </div>
            </div>

            {/* المركز الثالث (برونز) */}
            <div className="flex-1 flex flex-col items-center">
              <span className="text-2xl mb-1">🥉</span>
              <div className="text-[11px] font-bold text-slate-200 truncate w-20">{sorted[2]?.name || '--'}</div>
              <div className="text-[10px] text-cyan-400 font-mono">{sorted[2] ? `رواق L${sorted[2].lane}` : ''}</div>
              <div className="text-[11px] font-mono text-amber-300 font-bold mt-0.5">
                {sorted[2] ? `${(sorted[2].finishTime / 1000).toFixed(3)}s` : '--'}
              </div>
              <div className="w-full h-10 bg-gradient-to-t from-amber-900/60 to-amber-800/80 rounded-t-xl mt-2 flex items-center justify-center font-black text-amber-600 text-base border-t-2 border-amber-600">
                3
              </div>
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-400 font-mono mt-1">
          سرعة الرياح: {settings.windSpeed} • تم التحكيم عبر الحساس الضوئي
        </div>
      </div>

      {/* أزرار العمليات السريعة */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onViewPhotoFinish}
          className="p-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/20"
        >
          <Eye className="w-4 h-4" />
          <span>فحص Photo Finish 🔍</span>
        </button>

        <button
          onClick={exportCSV}
          className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>تصدير النتائج (CSV)</span>
        </button>
      </div>

      {/* جدول النتائج التفصيلي مرتباً حسب الأروقة والوصول */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" />
            جدول الترتيب الرسمي حسب الأروقة
          </span>
          <span className="text-slate-400 font-mono">{sorted.length} عدائين معتمدين</span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {sorted.map((runner, idx) => {
            const deltaMs = runner.finishTime - winningTime;
            return (
              <div
                key={runner.id}
                className="p-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 text-center font-black text-sm">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: runner.color }}
                      >
                        رواق L{runner.lane}
                      </span>
                      <span className="font-bold text-xs text-white">{runner.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">#{runner.bib}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{runner.country}</div>
                  </div>
                </div>

                <div className="text-left font-mono">
                  <div className="text-xs font-black text-amber-400">
                    {(runner.finishTime / 1000).toFixed(3)}s
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {idx === 0 ? 'البطل' : `+${(deltaMs / 1000).toFixed(3)}s`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* زر مشترك لإعادة البدء في سباق آخر على الهاتفين معاً */}
      <button
        onClick={onSharedResetRace}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 hover:from-slate-700 hover:to-slate-600 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-600 shadow-xl transition-all"
        title="يقوم بإعادة تعيين الساعة وحساس الكاميرا في كلا الهاتفين معاً في نفس اللحظة"
      >
        <RotateCcw className="w-4 h-4 text-cyan-400" />
        <span>🔄 بدء سباق جديد (إعادة تعيين مشتركة في كلا الهاتفين)</span>
      </button>
    </div>
  );
};
