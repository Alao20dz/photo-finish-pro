import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Trash2, Download, X, Trophy, Wind, Ruler, Clock, Image as ImageIcon } from 'lucide-react';
import { athleticsArchive, formatRaceTime, ArchivedRace } from '../services/archiveService';

interface ArchiveModalProps {
  onClose: () => void;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  OK: { label: 'مؤكد', className: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40' },
  DNF: { label: 'لم يكمل', className: 'bg-amber-950/70 text-amber-300 border-amber-500/40' },
  DQ: { label: 'إقصاء', className: 'bg-red-950/70 text-red-300 border-red-500/40' },
  DNS: { label: 'لم يبدأ', className: 'bg-slate-800/70 text-slate-400 border-slate-600/40' },
};

/**
 * نافذة أرشيف السباقات الدائم — استعراض النتائج الرسمية المحفوظة محلياً
 * على الجهاز (IndexedDB) مع شريط الـ Photo Finish وتصديرها JSON.
 */
export const ArchiveModal: React.FC<ArchiveModalProps> = ({ onClose }) => {
  const [races, setRaces] = useState<ArchivedRace[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await athleticsArchive.listRaces();
      setRaces(list);
      if (list.length > 0) setExpandedId((prev) => prev ?? list[0].id);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (id: string) => {
    await athleticsArchive.deleteRace(id);
    setRaces((prev) => prev.filter((r) => r.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleClearAll = async () => {
    if (!window.confirm('هل أنت متأكد من مسح الأرشيف بالكامل؟ لا يمكن الرجوع.')) return;
    await athleticsArchive.clearAll();
    setRaces([]);
    setExpandedId(null);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* رأس النافذة */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0">
              <Archive className="w-5 h-5 text-slate-950" />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-sm sm:text-base bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                أرشيف السباقات الرسمي
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
                النتائج المحفوظة دائماً على هذا الجهاز — {races.length > 0 ? `${races.length} سباق` : 'لا نتائج بعد'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {races.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/40 text-[10px] sm:text-xs font-bold transition-all cursor-pointer"
                title="مسح الأرشيف بالكامل"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">مسح الكل</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="إغلاق الأرشيف"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* قائمة السباقات */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="text-center py-10 text-slate-400 text-sm font-bold animate-pulse">
              جاري فتح الأرشيف...
            </div>
          )}

          {!loading && races.length === 0 && (
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-800/80 flex items-center justify-center mb-4">
                <Archive className="w-8 h-8 text-slate-600" />
              </div>
              <p className="font-black text-slate-300 text-sm mb-1.5">الأرشيف فارغ حتى الآن</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                كل سباق تُعتمد نتيجته (زر إنهاء السباق) يُحفظ هنا تلقائياً مع
                <br />
                النتائج الرسمية وشريط الـ Photo Finish — حتى بدون إنترنت.
              </p>
            </div>
          )}

          {races.map((race) => {
            const expanded = expandedId === race.id;
            const finished = race.runners.filter((r) => r.finishTime > 0).sort((a, b) => a.finishTime - b.finishTime);
            const winner = finished[0];
            const medal = ['🥇', '🥈', '🥉'];
            return (
              <div
                key={race.id}
                className={`rounded-2xl border transition-all ${
                  expanded ? 'border-amber-500/50 bg-slate-850/90' : 'border-slate-800 bg-slate-850/50 hover:border-slate-700'
                }`}
              >
                {/* ملخص السباق */}
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : race.id)}
                  className="w-full flex items-center justify-between gap-3 p-3.5 text-start cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="font-black text-xs sm:text-sm text-slate-100 truncate">
                      {race.heatName}
                      <span className="ms-2 text-[10px] font-mono bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded border border-slate-700">
                        {race.roomCode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px] text-slate-400 font-medium mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />{race.distance}</span>
                      <span className="flex items-center gap-1"><Wind className="w-3 h-3" />{race.windSpeed}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                        {new Date(race.completedAt).toLocaleString('ar', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {winner && (
                        <span className="flex items-center gap-1 text-amber-300 font-bold">
                          <Trophy className="w-3 h-3" />
                          {winner.name} — {formatRaceTime(winner.finishTime)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-500 text-lg shrink-0">{expanded ? '▾' : '▸'}</span>
                </button>

                {/* تفاصيل السباق الموسّع */}
                {expanded && (
                  <div className="px-3.5 pb-3.5 space-y-3">
                    {/* شريط Photo Finish */}
                    {race.fullPhotoFinishUrl && (
                      <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950/60">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 text-[10px] font-bold text-cyan-300 border-b border-slate-700">
                          <ImageIcon className="w-3 h-3" />
                          شريط المسح الشريطي الرسمي (Photo Finish)
                        </div>
                        <img src={race.fullPhotoFinishUrl} alt={`شريط Photo Finish — ${race.heatName}`} className="w-full h-28 object-cover object-left" />
                      </div>
                    )}

                    {/* جدول النتائج */}
                    <div className="rounded-xl border border-slate-800 overflow-hidden">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-slate-800/70 text-slate-400">
                            <th className="px-2 py-1.5 text-start font-bold">الترتيب</th>
                            <th className="px-2 py-1.5 text-start font-bold">العداء</th>
                            <th className="px-2 py-1.5 text-center font-bold">الرواق</th>
                            <th className="px-2 py-1.5 text-center font-bold">الزمن</th>
                            <th className="px-2 py-1.5 text-center font-bold">الحالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {race.runners
                            .slice()
                            .sort((a, b) => (a.finishTime || 9e9) - (b.finishTime || 9e9))
                            .map((r) => {
                              const badge = STATUS_BADGE[r.status] || STATUS_BADGE.OK;
                              return (
                                <tr key={`${race.id}-${r.lane}`} className="border-t border-slate-800/70 text-slate-200">
                                  <td className="px-2 py-1.5 font-black">
                                    {r.rank ? (medal[r.rank - 1] || `${r.rank}.`) : '—'}
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <span className="font-bold">{r.name}</span>
                                    <span className="text-slate-500 ms-1.5">({r.bib})</span>
                                    <span className="text-slate-500 block text-[9px]">{r.country}</span>
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-mono">{r.lane}</td>
                                  <td className="px-2 py-1.5 text-center font-mono font-bold text-amber-300">
                                    {r.finishTime > 0 ? formatRaceTime(r.finishTime) : '—'}
                                  </td>
                                  <td className="px-2 py-1.5 text-center">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${badge.className}`}>
                                      {badge.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    {/* أزرار التصدير والحذف */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => athleticsArchive.exportRaceJson(race)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
                        title="تصدير النتيجة الرسمية بصيغة JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                        تصدير JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(race.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-900/70 text-slate-300 hover:text-red-300 text-[11px] font-bold transition-all active:scale-95 cursor-pointer border border-slate-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
