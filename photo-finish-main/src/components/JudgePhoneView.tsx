import React, { useState, useRef } from 'react';
import { 
  Award, 
  Clock, 
  CheckCircle2, 
  Edit3, 
  Plus, 
  Printer, 
  Download, 
  Eye, 
  Sliders, 
  RotateCcw, 
  UserCheck, 
  FileText, 
  Layers,
  ZoomIn,
  Copy,
  Check,
  Globe,
  Share2,
  FileDown,
  Sparkles,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Flag
} from 'lucide-react';
import { Runner, RaceStatus, RaceSettings, Heat } from '../types/race';
import { CertificateExporter } from '../utils/certificateExporter';
import { slitScanEngine } from '../services/slitScanEngine';

interface JudgePhoneViewProps {
  raceStatus: RaceStatus;
  runners: Runner[];
  clockTimeMs: number;
  settings: RaceSettings;
  heats: Heat[];
  currentHeatIndex: number;
  fullPhotoFinishUrl?: string;
  onSelectHeat: (index: number) => void;
  onAddNewHeat: () => void;
  onDeleteHeat?: (heatId: string) => void;
  onReorderHeats?: (newHeats: Heat[]) => void;
  onUpdateRunner: (lane: number, updates: Partial<Runner>) => void;
  onUpdateRunnersList: (newRunners: Runner[]) => void;
  onFinishRace?: (panoramaUrl?: string) => void;
  onSharedResetRace: () => void;
  onViewPhotoFinish: () => void;
  onOpenSettings?: () => void;
  onOpenInternetBridge?: () => void;
}

export const JudgePhoneView: React.FC<JudgePhoneViewProps> = ({
  raceStatus,
  runners,
  clockTimeMs,
  settings,
  heats,
  currentHeatIndex,
  fullPhotoFinishUrl,
  onSelectHeat,
  onAddNewHeat,
  onDeleteHeat,
  onReorderHeats,
  onUpdateRunner,
  onUpdateRunnersList,
  onFinishRace,
  onSharedResetRace,
  onViewPhotoFinish,
  onOpenSettings,
  onOpenInternetBridge,
}) => {
  const [activeTab, setActiveTab] = useState<'scoreboard' | 'certificate' | 'runners'>('scoreboard');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [editingRunner, setEditingRunner] = useState<Runner | null>(null);
  const [editTimeSeconds, setEditTimeSeconds] = useState<string>('');
  const [editRank, setEditRank] = useState<number>(1);
  const [editStatus, setEditStatus] = useState<'OK' | 'DNF' | 'DQ' | 'DNS'>('OK');
  const [editNotes, setEditNotes] = useState<string>('');
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New runner inputs for registration
  const [newRunnerName, setNewRunnerName] = useState<string>('');
  const [newRunnerBib, setNewRunnerBib] = useState<string>('');
  const [newRunnerClub, setNewRunnerClub] = useState<string>('');
  const [newRunnerLane, setNewRunnerLane] = useState<number>(1);

  const printRef = useRef<HTMLDivElement>(null);

  const handleMoveHeatUp = (index: number) => {
    if (index <= 0 || !onReorderHeats) return;
    const newHeats = [...heats];
    [newHeats[index - 1], newHeats[index]] = [newHeats[index], newHeats[index - 1]];
    onReorderHeats(newHeats);
    onSelectHeat(index - 1);
  };

  const handleMoveHeatDown = (index: number) => {
    if (index >= heats.length - 1 || !onReorderHeats) return;
    const newHeats = [...heats];
    [newHeats[index], newHeats[index + 1]] = [newHeats[index + 1], newHeats[index]];
    onReorderHeats(newHeats);
    onSelectHeat(index + 1);
  };

  const handleAutoSortHeats = () => {
    if (!onReorderHeats) return;
    const sorted = [...heats].sort((a, b) => {
      if (a.distance !== b.distance) return a.distance.localeCompare(b.distance);
      return a.number - b.number;
    });
    onReorderHeats(sorted);
    onSelectHeat(0);
  };

  // Sorting finished runners by time
  const finishedRunners = [...runners]
    .filter(r => r.finishTime > 0)
    .sort((a, b) => a.finishTime - b.finishTime);

  const winningTime = finishedRunners.length > 0 ? finishedRunners[0].finishTime : 0;

  const formatClock = (ms: number) => {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    const msec = Math.floor(ms % 1000);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(msec).padStart(3, '0')}`;
  };

  const handleOpenEditModal = (runner: Runner) => {
    setEditingRunner(runner);
    setEditTimeSeconds(runner.finishTime > 0 ? (runner.finishTime / 1000).toFixed(3) : '');
    setEditRank(runner.rank || 1);
    setEditStatus(runner.status || 'OK');
    setEditNotes(runner.notes || '');
  };

  const handleSaveRunnerEdit = () => {
    if (!editingRunner) return;
    const parsedSeconds = parseFloat(editTimeSeconds);
    const newFinishTimeMs = !isNaN(parsedSeconds) && parsedSeconds > 0 
      ? Math.round(parsedSeconds * 1000) 
      : editingRunner.finishTime;

    onUpdateRunner(editingRunner.lane, {
      finishTime: newFinishTimeMs,
      rank: editRank,
      status: editStatus,
      notes: editNotes
    });
    setEditingRunner(null);
  };

  const handleFineTuneTime = (runner: Runner, deltaMs: number) => {
    if (runner.finishTime <= 0) return;
    const newTime = Math.max(0, runner.finishTime + deltaMs);
    onUpdateRunner(runner.lane, { finishTime: newTime });
  };

  const handleAddRunner = () => {
    if (!newRunnerName.trim()) return;
    const lane = Number(newRunnerLane);
    const bib = Number(newRunnerBib) || (100 + lane);
    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EAB308'];

    const newRunner: Runner = {
      id: Date.now(),
      bib,
      name: newRunnerName.trim(),
      country: newRunnerClub.trim() || 'نادي محلي',
      lane,
      color: colors[(lane - 1) % colors.length],
      finishTime: 0,
      status: 'OK'
    };

    // Replace runner in that lane or append
    const exists = runners.find(r => r.lane === lane);
    let updated: Runner[];
    if (exists) {
      updated = runners.map(r => r.lane === lane ? newRunner : r);
    } else {
      updated = [...runners, newRunner];
    }
    onUpdateRunnersList(updated);

    setNewRunnerName('');
    setNewRunnerBib('');
    setNewRunnerClub('');
    setNewRunnerLane(Math.min(settings.laneCount, lane + 1));
  };

  const handleDeleteRunner = (lane: number) => {
    const updated = runners.filter(r => r.lane !== lane);
    onUpdateRunnersList(updated);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const lines = [
      `🏁 نتائج سباق ${settings.distance} - ${settings.heatName || `قائمة ${settings.heatNumber}`}`,
      `💨 سرعة الرياح: ${settings.windSpeed}`,
      `---------------------------------`
    ];

    finishedRunners.forEach((r, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
      const timeStr = `${(r.finishTime / 1000).toFixed(3)}s`;
      const diff = idx === 0 ? 'الفائز' : `+${((r.finishTime - winningTime) / 1000).toFixed(3)}s`;
      lines.push(`${medal} رواق ${r.lane}: ${r.name} (#${r.bib}) - ${timeStr} (${diff})`);
    });

    lines.push(`\nتم التحكيم إلكترونياً بواسطة نظام Photo Finish Pro ⏱️`);

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    });
  };

  const handleExportCSV = () => {
    const headers = ['الترتيب', 'رقم الرواق', 'رقم الصدرية', 'اسم العداء', 'النادي/الدولة', 'التوقيت الرسمي (ثانية)', 'الفارق عن الأول', 'الحالة', 'ملاحظات'];
    const rows = finishedRunners.map((r, idx) => [
      r.rank || (idx + 1),
      `L${r.lane}`,
      r.bib,
      r.name,
      r.country,
      (r.finishTime / 1000).toFixed(3),
      idx === 0 ? '0.000' : `+${((r.finishTime - winningTime) / 1000).toFixed(3)}`,
      r.status,
      r.notes || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `official-results-${settings.distance}-heat-${settings.heatNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeHeat = heats[currentHeatIndex];
  const currentSlitPanorama = fullPhotoFinishUrl || activeHeat?.fullPhotoFinishUrl || slitScanEngine.exportCroppedPhotoFinishDataUrl(settings.laneCount, runners);

  const handleDownloadPng = async () => {
    setIsExportingPng(true);
    setExportToast('جاري رسم وتجهيز استمارة التحكيم بدقة 300DPI...');
    try {
      const canvas = await CertificateExporter.generateProtocolCanvas({
        runners,
        settings,
        heatName: activeHeat?.name || `قائمة ${settings.heatNumber}`,
        distance: settings.distance,
        windSpeed: settings.windSpeed,
        fullPhotoFinishUrl: currentSlitPanorama || undefined
      });

      const filename = `Official-Protocol-${settings.distance}-Heat-${settings.heatNumber}.png`;
      const ok = await CertificateExporter.downloadAsPng(canvas, filename);
      if (ok) {
        setExportToast('تم تنزيل شهادة النتائج كملف PNG بنجاح! 💾');
      } else {
        setExportToast('جاري محاولة التنزيل عبر قائمة المشاركة...');
        await CertificateExporter.shareViaMobile(canvas, filename);
      }
    } catch (e) {
      console.error('Export PNG failed:', e);
      setExportToast('حدث خطأ أثناء تصدير الصورة.');
    } finally {
      setIsExportingPng(false);
      setTimeout(() => setExportToast(null), 4000);
    }
  };

  const handleShareViaMobile = async () => {
    setIsExportingPng(true);
    setExportToast('جاري تجهيز الصورة للمشاركة عبر الهاتف...');
    try {
      const canvas = await CertificateExporter.generateProtocolCanvas({
        runners,
        settings,
        heatName: activeHeat?.name || `قائمة ${settings.heatNumber}`,
        distance: settings.distance,
        windSpeed: settings.windSpeed,
        fullPhotoFinishUrl: currentSlitPanorama || undefined
      });

      const filename = `Official-Protocol-${settings.distance}-Heat-${settings.heatNumber}.png`;
      await CertificateExporter.shareViaMobile(canvas, filename);
      setExportToast('تمت مشاركة الوثيقة بنجاح! 📲');
    } catch (e) {
      setExportToast('تم إلغاء المشاركة.');
    } finally {
      setIsExportingPng(false);
      setTimeout(() => setExportToast(null), 3500);
    }
  };

  const handleCopyImageToClipboard = async () => {
    setIsExportingPng(true);
    setExportToast('جاري نسخ صورة الاستمارة إلى الحافظة...');
    try {
      const canvas = await CertificateExporter.generateProtocolCanvas({
        runners,
        settings,
        heatName: activeHeat?.name || `قائمة ${settings.heatNumber}`,
        distance: settings.distance,
        windSpeed: settings.windSpeed,
        fullPhotoFinishUrl: currentSlitPanorama || undefined
      });

      const ok = await CertificateExporter.copyToClipboard(canvas);
      if (ok) {
        setExportToast('تم نسخ صورة الاستمارة بالكامل! يمكنك لصقها الآن في واتساب أو أي برنامج 📋');
      } else {
        setExportToast('المتصفح لا يدعم نسخ الصور المباشر، جاري التنزيل كملف PNG...');
        await CertificateExporter.downloadAsPng(canvas, `Official-Protocol-${settings.distance}.png`);
      }
    } catch (e) {
      setExportToast('تعذر نسخ الصورة للحافظة.');
    } finally {
      setIsExportingPng(false);
      setTimeout(() => setExportToast(null), 3500);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-2 sm:p-5 space-y-3 sm:space-y-4 text-slate-100" dir="rtl">
      {/* رأس شاشة الحكم العام: السلاسل / القوائم والمؤقت الرقمي */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/50 rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 sm:mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black shadow-inner shrink-0 text-base sm:text-lg">
              ⚖️
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-base sm:text-xl font-black text-white">
                  شاشة الحكم العام وإحصاء النتائج
                </h2>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold border border-indigo-500/30 shrink-0">
                  هاتف 3 • CHIEF JUDGE
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                مراجعة وتعديل الأزمنة وترتيب العدائين واعتماد وإصدار وثائق التحكيم الرسمية
              </p>
            </div>
          </div>

          {/* حالة السباق وسرعة الرياح والمسافة والاتصال */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 font-mono text-[11px] sm:text-xs">
            {onOpenInternetBridge && (
              <button
                type="button"
                onClick={onOpenInternetBridge}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/50 hover:to-blue-600/50 text-cyan-300 border border-cyan-500/40 font-bold transition-all shadow-md cursor-pointer animate-pulse"
                title="فتح جسر الربط ومتابعة حالة الهواتف الثلاثة والروابط"
              >
                <Globe className="w-3 h-3 text-cyan-400" />
                <span>جسر الهواتف 🌐</span>
              </button>
            )}
            <span className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-xl text-amber-300 font-bold">
              سباق {settings.distance}
            </span>
            <span className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-xl text-emerald-400 font-bold">
              الرياح: {settings.windSpeed}
            </span>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                title="إعدادات السباق"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* شريط اختيار وإدارة القوائم / السلاسل (Heats / Series) */}
        <div className="bg-slate-950/70 rounded-2xl p-2 sm:p-2.5 border border-slate-800/80 mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 shrink-0 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>القوائم:</span>
            </span>
            {heats.map((heat, idx) => (
              <div
                key={heat.id || idx}
                className={`flex items-center gap-0.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                  currentHeatIndex === idx
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 border-amber-400 shadow-md font-black'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectHeat(idx)}
                  className="cursor-pointer flex items-center gap-1.5"
                >
                  <span>{heat.name || `قائمة ${heat.number}`}</span>
                  {heat.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                </button>

                {/* أزرار الترتيب والحذف لكل قائمة */}
                <div className="flex items-center gap-0.5 mr-1 border-r border-slate-700/50 pr-1">
                  {onReorderHeats && (
                    <>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveHeatUp(idx)}
                        className="p-0.5 rounded hover:bg-black/20 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                        title="تحريك القائمة للأعلى"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === heats.length - 1}
                        onClick={() => handleMoveHeatDown(idx)}
                        className="p-0.5 rounded hover:bg-black/20 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                        title="تحريك القائمة للأسفل"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  {heats.length > 1 && onDeleteHeat && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(heat.id)}
                      className="p-0.5 rounded hover:bg-rose-900/40 text-rose-400 hover:text-rose-200 cursor-pointer"
                      title="حذف هذه القائمة"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {onReorderHeats && heats.length > 1 && (
              <button
                type="button"
                onClick={handleAutoSortHeats}
                className="px-2 py-1 rounded-xl bg-slate-850 hover:bg-slate-750 text-slate-300 border border-slate-700 text-[10px] font-bold shrink-0 cursor-pointer"
                title="ترتيب تلقائي للقوائم"
              >
                ترتيب تلقائي ⚡
              </button>
            )}

            <button
              onClick={onAddNewHeat}
              className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0"
              title="إضافة تصفية أو قائمة جديدة لنفس السباق"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>قائمة جديدة</span>
            </button>
          </div>

          <div className="text-[10px] sm:text-[11px] font-mono text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-800/40 shrink-0 self-start sm:self-auto">
            {activeHeat?.name || `قائمة ${settings.heatNumber}`} • {runners.length} أروقة
          </div>
        </div>

        {/* نافذة تأكيد حذف قائمة في شاشة التحكيم */}
        {deleteConfirmId && onDeleteHeat && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-rose-500/50 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-base text-white">تأكيد حذف قائمة السباق</h4>
                <p className="text-xs text-slate-300 mt-1">
                  هل أنت متأكد من حذف هذه القائمة؟ سيتم مسح بياناتها نهائياً.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onDeleteHeat(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }}
                  className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
                >
                  نعم، احذف القائمة
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* مؤشر الساعة والتوقيت المباشر وشارة الحالة */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 items-center">
          <div className="bg-slate-950/90 rounded-2xl p-2.5 sm:p-3 border border-cyan-900/40 shadow-inner flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 animate-pulse" />
              <div className="text-xs text-slate-400 font-bold">ساعة السباق المباشرة:</div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-cyan-300 drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              {formatClock(clockTimeMs)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-950/90 rounded-2xl p-2.5 sm:p-3 border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold">حالة السباق:</span>
              {raceStatus === 'waiting' && (
                <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-bold">
                  جاهز للبدء
                </span>
              )}
              {raceStatus === 'on_marks' && (
                <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full font-bold animate-pulse">
                  🏃 خذ مكانك
                </span>
              )}
              {raceStatus === 'set' && (
                <span className="text-xs bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full font-bold">
                  ⏱️ استعد...
                </span>
              )}
              {raceStatus === 'racing' && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  السباق جاري!
                </span>
              )}
              {raceStatus === 'finished' && (
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full font-bold flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  اكتمل السباق
                </span>
              )}
              {raceStatus === 'false_start' && (
                <span className="text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40 px-3 py-1 rounded-full font-bold">
                  انطلاقة خاطئة
                </span>
              )}
            </div>

            <button
              onClick={onSharedResetRace}
              className="p-2.5 sm:p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 transition-all cursor-pointer shadow-md"
              title="تصفير العداد وبدء سباق جديد في الهواتف الثلاثة معاً"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* زر إنهاء السباق واعتماد النتائج من هاتف الحكم (Clôturer l'Arrivée & Valider) */}
        {onFinishRace && (raceStatus === 'racing' || (raceStatus === 'finished' && finishedRunners.length > 0)) && (
          <button
            type="button"
            onClick={() => {
              const panorama = currentSlitPanorama || undefined;
              onFinishRace(panorama);
            }}
            className={`w-full py-4 px-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all shadow-2xl active:scale-95 cursor-pointer ${
              raceStatus === 'racing'
                ? 'bg-gradient-to-r from-red-600 via-amber-500 to-yellow-500 hover:from-red-500 hover:to-yellow-400 text-slate-950 border-2 border-yellow-300 animate-pulse shadow-amber-500/40'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white border-2 border-emerald-300 shadow-emerald-500/30'
            }`}
          >
            <Flag className="w-6 h-6" />
            <span>
              {raceStatus === 'racing'
                ? '🏁 خط النهاية: إنهاء السباق ومعاينة النتائج (Clôturer l\'Arrivée & Valider)'
                : '✅ اعتماد نتائج القائمة ومعاينة Photo Finish'}
            </span>
          </button>
        )}
      </div>

      {/* شريط التبويبات الرئيسي (Tabs) متجاوب مع تمرير سلس للهواتف */}
      <div className="flex border-b border-slate-800 gap-1 sm:gap-2 overflow-x-auto no-scrollbar pb-0.5">
        <button
          onClick={() => setActiveTab('scoreboard')}
          className={`py-2 px-3 sm:py-2.5 sm:px-4 font-bold text-xs sm:text-sm rounded-t-2xl transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer border-t border-x shrink-0 whitespace-nowrap ${
            activeTab === 'scoreboard'
              ? 'bg-slate-900 border-slate-700 text-amber-400 shadow'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Award className="w-4 h-4 shrink-0" />
          <span>جدول الترتيب والنتائج</span>
          {finishedRunners.length > 0 && (
            <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
              {finishedRunners.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('certificate')}
          className={`py-2 px-3 sm:py-2.5 sm:px-4 font-bold text-xs sm:text-sm rounded-t-2xl transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer border-t border-x shrink-0 whitespace-nowrap ${
            activeTab === 'certificate'
              ? 'bg-slate-900 border-slate-700 text-amber-400 shadow'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>استمارة التحكيم (IAAF)</span>
        </button>

        <button
          onClick={() => setActiveTab('runners')}
          className={`py-2 px-3 sm:py-2.5 sm:px-4 font-bold text-xs sm:text-sm rounded-t-2xl transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer border-t border-x shrink-0 whitespace-nowrap ${
            activeTab === 'runners'
              ? 'bg-slate-900 border-slate-700 text-amber-400 shadow'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <UserCheck className="w-4 h-4 shrink-0" />
          <span>تسجيل وتوزيع العدائين</span>
        </button>
      </div>

      {/* التبويب 1: جدول النتائج والترتيب المباشر والتدقيق */}
      {activeTab === 'scoreboard' && (
        <div className="space-y-3">
          {/* أزرار العمليات السريعة */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                onClick={onViewPhotoFinish}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
              >
                <Eye className="w-4 h-4" />
                <span>فحص شريط Photo Finish المكبر 🔍</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>تصدير CSV</span>
              </button>
              <button
                onClick={handleCopySummary}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
              >
                {copiedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                <span>{copiedSuccess ? 'تم النسخ!' : 'نسخ ملخص النتيجة'}</span>
              </button>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              الوصول: <strong className="text-amber-400">{finishedRunners.length}</strong> من <strong className="text-white">{runners.length}</strong>
            </div>
          </div>

          {/* شريط المسح البانورامي المستمر الحقيقي (Continuous Slit-Scan Panorama Ribbon) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold shrink-0">
                  🎞️
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="font-black text-xs sm:text-sm text-white">
                      شريط المسح البانورامي المستمر (Slit-Scan)
                    </h3>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                      IAAF 164.2 FAT
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400">
                    تزامن شرائحي مستمر: المحور الأفقي = الزمن • خط الصدرية (Torso) = الحسم
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={onViewPhotoFinish}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>فحص وتكبير Photo Finish 🔍</span>
                </button>
                {currentSlitPanorama && (
                  <button
                    type="button"
                    onClick={handleDownloadPng}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-cyan-200 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>تصدير الاستمارة والبانوراما PNG</span>
                  </button>
                )}
              </div>
            </div>

            {/* عرض الشريط البانورامي */}
            <div className="relative rounded-2xl bg-black border border-slate-700/80 overflow-hidden shadow-inner group">
              {currentSlitPanorama ? (
                <div className="overflow-x-auto p-1 scrollbar-thin scrollbar-thumb-slate-700">
                  <div className="min-w-[650px] relative">
                    <img
                      src={currentSlitPanorama}
                      alt="Slit Scan Panorama Ribbon"
                      onClick={onViewPhotoFinish}
                      className="w-full h-44 object-contain rounded-xl cursor-zoom-in transition-transform hover:opacity-95"
                    />
                  </div>
                </div>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-slate-500 text-xs font-mono gap-1">
                  <span>بانتظار تسجيل شرائح عبور خط النهاية بالمللي ثانية...</span>
                  <span className="text-[10px] text-slate-600">سيظهر شريط المسح المستمر فور عبور أول عداء أو إنهاء السباق</span>
                </div>
              )}

              {/* وسوم العدائين وأوقاتهم تحت شريط المسح */}
              {finishedRunners.length > 0 && (
                <div className="bg-slate-950/90 border-t border-slate-800 px-3 py-2 flex items-center gap-2 overflow-x-auto">
                  <span className="text-[11px] font-bold text-slate-400 shrink-0">أزمنة الوصول (Torso):</span>
                  {finishedRunners.map((runner) => (
                    <div
                      key={runner.id}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono flex items-center gap-1.5 shrink-0"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: runner.color }}
                      />
                      <span className="font-bold text-white">L{runner.lane} {runner.name}</span>
                      <span className="text-amber-400 font-bold">{(runner.finishTime / 1000).toFixed(3)}s</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* جدول النتائج التفصيلي */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="sm:hidden px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[10px] text-amber-400/90 flex items-center justify-between font-mono">
              <span>← اسحب أفقياً لمشاهدة باقي الأعمدة والصور →</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-bold">{runners.length} أروقة</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold">
                  <tr>
                    <th className="p-2.5 text-center">الترتيب</th>
                    <th className="p-2.5 text-center">الرواق</th>
                    <th className="p-2.5 text-center">الصدرية</th>
                    <th className="p-2.5">الاسم واللقب</th>
                    <th className="p-2.5">الميلاد</th>
                    <th className="p-2.5">النادي</th>
                    <th className="p-2.5">الولاية</th>
                    <th className="p-2.5 text-center">التوقيت الرسمي</th>
                    <th className="p-2.5 text-center">الفارق</th>
                    <th className="p-2.5 text-center">صورة النهاية</th>
                    <th className="p-2.5 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {runners.map((runner) => {
                    const finished = runner.finishTime > 0;
                    const diffMs = finished ? runner.finishTime - winningTime : 0;
                    const medal = runner.rank === 1 ? '🥇 الأول' : runner.rank === 2 ? '🥈 الثاني' : runner.rank === 3 ? '🥉 الثالث' : runner.rank ? `#${runner.rank}` : '--';

                    return (
                      <tr 
                        key={runner.id} 
                        className={`transition-colors ${
                          finished 
                            ? runner.rank === 1 ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-slate-850/50' 
                            : 'opacity-60 hover:opacity-100 hover:bg-slate-850/30'
                        }`}
                      >
                        {/* الترتيب */}
                        <td className="p-2.5 text-center">
                          <span className={`inline-block font-mono font-black text-xs px-2 py-0.5 rounded-lg ${
                            runner.rank === 1
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                              : runner.rank === 2
                              ? 'bg-slate-400/20 text-slate-200 border border-slate-400/40'
                              : runner.rank === 3
                              ? 'bg-amber-700/20 text-amber-500 border border-amber-700/40'
                              : 'text-slate-400'
                          }`}>
                            {medal}
                          </span>
                        </td>

                        {/* الرواق */}
                        <td className="p-2.5 text-center">
                          <span
                            className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg text-white inline-block shadow-sm"
                            style={{ backgroundColor: runner.color }}
                          >
                            L{runner.lane}
                          </span>
                        </td>

                        {/* رقم الصدرية */}
                        <td className="p-2.5 text-center font-mono font-bold text-amber-300">
                          #{runner.bib}
                        </td>

                        {/* الاسم واللقب */}
                        <td className="p-2.5 font-bold text-white">
                          <div className="flex flex-col">
                            <span>{runner.name}</span>
                            {runner.notes && (
                              <span className="text-[10px] text-amber-400 font-mono">
                                ملاحظة: {runner.notes}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* تاريخ الميلاد */}
                        <td className="p-2.5 font-mono text-[11px] text-slate-400">
                          {runner.birthDate || '—'}
                        </td>

                        {/* النادي الرياضي */}
                        <td className="p-2.5 text-[11px] text-slate-300">
                          {runner.club || runner.country || '—'}
                        </td>

                        {/* الولاية */}
                        <td className="p-2.5 text-[11px] text-slate-400">
                          {runner.wilaya || '—'}
                        </td>

                        {/* التوقيت الرسمي */}
                        <td className="p-2.5 text-center font-mono">
                          {finished ? (
                            <div className="text-sm font-black text-amber-400">
                              {(runner.finishTime / 1000).toFixed(3)}s
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">في المضمار...</span>
                          )}
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            runner.status === 'OK' ? 'text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {runner.status}
                          </span>
                        </td>

                        {/* الفارق عن الأول */}
                        <td className="p-3 text-center font-mono text-xs text-slate-400">
                          {finished ? (
                            runner.rank === 1 ? (
                              <span className="text-emerald-400 font-bold">الفائز 🥇</span>
                            ) : (
                              `+${(diffMs / 1000).toFixed(3)}s`
                            )
                          ) : '--'}
                        </td>

                        {/* صورة لحظة ملامسة خط النهاية من هاتف 2 */}
                        <td className="p-3 text-center">
                          {runner.crossingSnapshot ? (
                            <div className="relative group inline-block">
                              <img
                                src={runner.crossingSnapshot}
                                alt={`وصول رواق ${runner.lane}`}
                                onClick={() => setSelectedPhoto(runner.crossingSnapshot!)}
                                className="w-16 h-10 object-cover rounded-lg border border-cyan-500/50 shadow-md cursor-pointer group-hover:scale-105 transition-transform"
                              />
                              <div 
                                onClick={() => setSelectedPhoto(runner.crossingSnapshot!)}
                                className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                              >
                                <ZoomIn className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono">
                              {finished ? 'جاري استقبال الصورة' : 'بانتظار الوصول'}
                            </span>
                          )}
                        </td>

                        {/* إجراءات الحكم العام والتدقيق */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {finished && (
                              <>
                                <button
                                  onClick={() => handleFineTuneTime(runner, -5)}
                                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] border border-slate-700 cursor-pointer"
                                  title="طرح 5 مللي ثانية (-0.005s)"
                                >
                                  -5ms
                                </button>
                                <button
                                  onClick={() => handleFineTuneTime(runner, +5)}
                                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] border border-slate-700 cursor-pointer"
                                  title="إضافة 5 مللي ثانية (+0.005s)"
                                >
                                  +5ms
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleOpenEditModal(runner)}
                              className="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 cursor-pointer transition-all"
                              title="تعديل يدوي للتوقيت، الترتيب أو الحالة"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* التبويب 2: استمارة التحكيم الرسمية المعتمدة (IAAF Official Protocol) */}
      {activeTab === 'certificate' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-lg">
            <div>
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <span>وثيقة التحكيم الرسمية المعتمدة (IAAF Official Protocol)</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                  Rule 164.2 FAT
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                تصدير فوري ومباشر كصورة PNG عالية الدقة (300 DPI) بدون ضغط مطوّل، أو مشاركة مباشرة للهاتف أو طباعة.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* 1. تنزيل مباشر PNG */}
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={isExportingPng}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                title="تنزيل مباشر كملف صورة PNG عالية الجودة 300DPI بدون ضغط مطول"
              >
                {isExportingPng ? <Sparkles className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                <span>تنزيل مباشر PNG 💾</span>
              </button>

              {/* 2. مشاركة للموبايل */}
              <button
                type="button"
                onClick={handleShareViaMobile}
                disabled={isExportingPng}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/20 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                title="مشاركة الصورة مباشرة إلى واتساب أو حفظها في معرض الصور (Web Share)"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة للموبايل 📲</span>
              </button>

              {/* 3. نسخ كصورة للحافظة */}
              <button
                type="button"
                onClick={handleCopyImageToClipboard}
                disabled={isExportingPng}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                title="نسخ الصورة بالكامل للحافظة ولصقها مباشرة في البرامج"
              >
                <Copy className="w-4 h-4 text-cyan-400" />
                <span>نسخ كصورة 📋</span>
              </button>

              {/* 4. طباعة / حفظ كـ PDF */}
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer transition-all active:scale-95"
                title="فتح نافذة الطباعة الرسمية للورق A4 أو PDF"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة / PDF 🖨️</span>
              </button>
            </div>
          </div>

          {/* تنبيه حالة التصدير (Toast Alert) */}
          {exportToast && (
            <div className="p-3 bg-amber-500/20 border border-amber-500/50 rounded-2xl text-amber-200 text-xs font-bold flex items-center gap-2 shadow-lg animate-pulse">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{exportToast}</span>
            </div>
          )}

          {/* الاستمارة الرسمية A4 قابلة للطباعة */}
          <div 
            ref={printRef}
            className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-200"
            id="official-finish-protocol"
          >
            {/* ترويسة الوثيقة الرسمية */}
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-black tracking-tight text-slate-950">
                    استمارة النتائج الرسمية لسباقات ألعاب القوى
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-bold">
                  اتحاد ألعاب القوى • نظام التوقيت والتحكيم الإلكتروني المصور (Photo Finish Pro)
                </div>
              </div>

              <div className="text-left font-mono text-xs space-y-0.5 text-slate-700">
                <div><strong>IAAF Rule:</strong> 164.2 (Photo Finish)</div>
                <div><strong>التاريخ:</strong> {new Date().toLocaleDateString('ar-DZ')}</div>
                <div><strong>التوقيت:</strong> {new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>

            {/* تفاصيل السباق والسلسلة */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-100 p-3 rounded-2xl text-xs font-mono">
              <div>
                <span className="text-slate-500 block">المسافة:</span>
                <strong className="text-slate-900 text-sm">{settings.distance}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">السلسلة / القائمة:</span>
                <strong className="text-slate-900 text-sm">{settings.heatName || `قائمة ${settings.heatNumber}`}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">سرعة الرياح:</span>
                <strong className="text-slate-900 text-sm">{settings.windSpeed}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">نوع التوقيت:</span>
                <strong className="text-emerald-700 text-sm">إلكتروني آلي كامل (FAT)</strong>
              </div>
            </div>

            {/* شريط المسح البانورامي المستمر المعتمد رسمياً */}
            {currentSlitPanorama && (
              <div className="space-y-2 border-2 border-slate-800 rounded-2xl p-3 bg-slate-50">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                    <span>🎞️ شريط المسح البانورامي المستمر المعتمد (IAAF Continuous Slit-Scan Strip):</span>
                  </h4>
                  <span className="text-[10px] font-mono text-slate-600 font-bold bg-slate-200 px-2 py-0.5 rounded">
                    تزامن زمني مستمر (FAT Time-Space Axis)
                  </span>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-300 shadow-sm bg-black">
                  <img 
                    src={currentSlitPanorama} 
                    alt="Official Continuous Slit-Scan Photo Finish Strip" 
                    className="w-full h-auto object-contain max-h-48 cursor-pointer"
                    onClick={() => setSelectedPhoto(currentSlitPanorama)}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>World Athletics Rule 164.2: توقيت خط الجذع (Torso Line Time)</span>
                  <span>دقة التوقيت: 0.001 ثانية (1ms)</span>
                </div>
              </div>
            )}

            {/* معرض صور وصول العدائين لخط النهاية المعتمدة */}
            {finishedRunners.some(r => r.crossingSnapshot) && (
              <div className="space-y-2">
                <h4 className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                  <span>📸 توثيق كاميرا خط النهاية (Photo Finish Proof):</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {finishedRunners.filter(r => r.crossingSnapshot).map((r, idx) => (
                    <div key={r.id} className="border border-slate-300 rounded-xl overflow-hidden shadow-sm bg-slate-50">
                      <img 
                        src={r.crossingSnapshot} 
                        alt={r.name}
                        className="w-full h-28 object-cover" 
                      />
                      <div className="p-1.5 text-center bg-slate-100 font-mono text-[10px]">
                        <strong className="text-slate-900 block truncate">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`} رواق L{r.lane}: {r.name}
                        </strong>
                        <span className="text-emerald-700 font-bold">
                          {(r.finishTime / 1000).toFixed(3)}s
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* جدول الترتيب والنتائج الرسمي */}
            <div>
              <table className="w-full text-right text-xs border border-slate-300 rounded-xl overflow-hidden">
                <thead className="bg-slate-900 text-white font-bold">
                  <tr>
                    <th className="p-2 text-center">الترتيب</th>
                    <th className="p-2 text-center">الرواق</th>
                    <th className="p-2 text-center">الصدرية</th>
                    <th className="p-2">اسم المتسابق</th>
                    <th className="p-2">الميلاد</th>
                    <th className="p-2">النادي</th>
                    <th className="p-2">الولاية</th>
                    <th className="p-2 text-center">التوقيت الرسمي</th>
                    <th className="p-2 text-center">الفارق</th>
                    <th className="p-2 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {finishedRunners.map((r, idx) => (
                    <tr key={r.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-2 text-center font-bold font-mono">
                        {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                      </td>
                      <td className="p-2 text-center font-bold font-mono">L{r.lane}</td>
                      <td className="p-2 text-center font-mono font-bold">#{r.bib}</td>
                      <td className="p-2 font-bold">{r.name}</td>
                      <td className="p-2 font-mono text-[11px] text-slate-600">{r.birthDate || '—'}</td>
                      <td className="p-2 text-slate-700">{r.club || r.country || '—'}</td>
                      <td className="p-2 text-slate-600">{r.wilaya || '—'}</td>
                      <td className="p-2 text-center font-black font-mono text-slate-950">
                        {(r.finishTime / 1000).toFixed(3)}s
                      </td>
                      <td className="p-2 text-center font-mono text-slate-600">
                        {idx === 0 ? 'الفائز' : `+${((r.finishTime - winningTime) / 1000).toFixed(3)}s`}
                      </td>
                      <td className="p-2 text-center font-bold text-emerald-700">
                        {r.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* خانات توقيع الحكام والاعتماد */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-xs">
              <div className="space-y-6">
                <div>
                  <span className="font-bold text-slate-800 block">رئيس حكام التوقيت والمصورة (Chief Photo Finish Judge):</span>
                  <div className="h-10 border-b border-dashed border-slate-400 mt-2"></div>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <span className="font-bold text-slate-800 block">مدير المنافسة والحكم العام (Competition Director):</span>
                  <div className="h-10 border-b border-dashed border-slate-400 mt-2"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* التبويب 3: تسجيل وتوزيع العدائين والأروقة */}
      {activeTab === 'runners' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-base text-white">
                تسجيل العدائين في القائمة الحالية ({settings.heatName || `قائمة ${settings.heatNumber}`})
              </h3>
              <p className="text-xs text-slate-400">
                أدخل أسماء وأرقام صدريات وأروقة العدائين (1 إلى 8). يتم تحديث ومزامنة القائمة فورياً في الهاتف 1 والهاتف 2.
              </p>
            </div>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold flex items-center gap-1"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>إعدادات عدد الأروقة</span>
              </button>
            )}
          </div>

          {/* استمارة إضافة عداء سريع */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-amber-400 block">
              + إضافة عداء جديد إلى رواق محدد:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">اسم العداء الكامل:</label>
                <input
                  type="text"
                  placeholder="مثال: يوسف العبدلي"
                  value={newRunnerName}
                  onChange={(e) => setNewRunnerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">رقم الصدرية (Bib #):</label>
                <input
                  type="number"
                  placeholder="مثال: 105"
                  value={newRunnerBib}
                  onChange={(e) => setNewRunnerBib(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">النادي أو الدولة:</label>
                <input
                  type="text"
                  placeholder="مثال: الجزائر 🇩🇿"
                  value={newRunnerClub}
                  onChange={(e) => setNewRunnerClub(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">رقم الرواق (Lane):</label>
                <select
                  value={newRunnerLane}
                  onChange={(e) => setNewRunnerLane(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-mono"
                >
                  {Array.from({ length: settings.laneCount }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>رواق L{i + 1}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleAddRunner}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تأكيد تسجيل العداء ومزامنته مع الهاتفين</span>
            </button>
          </div>

          {/* قائمة الأروقة الحالية مع خيارات الحذف والتعديل */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {runners.map((runner) => (
              <div
                key={runner.id}
                className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-8 h-8 rounded-xl font-mono font-bold text-xs flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: runner.color }}
                  >
                    L{runner.lane}
                  </span>
                  <div>
                    <div className="font-bold text-xs text-white">{runner.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      صدر #{runner.bib} • {runner.country}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditModal(runner)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="تعديل"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRunner(runner.lane)}
                    className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800"
                    title="حذف العداء من الرواق"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* نافذة تعديل نتيجة عداء يدوياً بواسطة الحكم العام */}
      {editingRunner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>تعديل نتيجة الرواق L{editingRunner.lane}: {editingRunner.name}</span>
              </h3>
              <button
                onClick={() => setEditingRunner(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">التوقيت بالثواني (مثال: 10.245):</label>
                <input
                  type="text"
                  value={editTimeSeconds}
                  onChange={(e) => setEditTimeSeconds(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-amber-400 font-mono font-bold text-base outline-none focus:border-amber-400 text-center"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">الترتيب الرسمي:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editRank}
                    onChange={(e) => setEditRank(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white font-mono font-bold outline-none text-center"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">حالة المتسابق:</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white font-bold outline-none"
                  >
                    <option value="OK">OK (صالح)</option>
                    <option value="DNF">DNF (لم يكمل)</option>
                    <option value="DQ">DQ (مقصى)</option>
                    <option value="DNS">DNS (لم يبدأ)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">ملاحظات الحكم:</label>
                <input
                  type="text"
                  placeholder="مثال: فحص صورة خط النهاية مكبرة"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveRunnerEdit}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs shadow-md cursor-pointer"
              >
                اعتماد التعديل ومزامنته فوراً
              </button>
              <button
                onClick={() => setEditingRunner(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تكبير لقطة وصول العداء الصادرة من كاميرا هاتف 2 */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3">
          <div className="max-w-2xl w-full bg-slate-950 border border-slate-800 rounded-3xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <ZoomIn className="w-4 h-4" />
                <span>صورة خط النهاية عالية الدقة من كاميرا الهاتف الثاني:</span>
              </span>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold"
              >
                إغلاق ✕
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-800 bg-black flex items-center justify-center max-h-[75vh]">
              <img
                src={selectedPhoto}
                alt="Photo finish moment"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
