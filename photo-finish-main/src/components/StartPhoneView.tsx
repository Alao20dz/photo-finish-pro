import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  RotateCcw, 
  CheckCircle2, 
  Award, 
  Zap, 
  Volume2, 
  Settings2, 
  SlidersHorizontal, 
  BellRing, 
  Globe, 
  Flag, 
  ListOrdered,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { Runner, RaceStatus, RaceSettings, Heat } from '../types/race';
import { athleticsNetwork } from '../services/networkService';

interface StartPhoneViewProps {
  raceStatus: RaceStatus;
  runners: Runner[];
  clockTimeMs: number;
  settings: RaceSettings;
  heats?: Heat[];
  currentHeatIndex?: number;
  onSelectHeat?: (index: number) => void;
  onDispatchHeat?: (heatId: string) => void;
  onCancelDispatchHeat?: (heatId?: string) => void;
  onOpenSchedulePanel?: () => void;
  onCommandOnMarks: () => void;
  onCommandSet: () => void;
  onFireGun: () => void;
  onRecallGun: () => void;
  onSharedResetRace: () => void;
  onViewResults: () => void;
  onOpenSettings?: () => void;
  onOpenInternetBridge?: () => void;
  onStartBellSignal?: () => void;
  onStopBellSignal?: () => void;
  isHoldingBell?: boolean;
  isPeerSirenRinging?: boolean;
}

export const StartPhoneView: React.FC<StartPhoneViewProps> = ({
  raceStatus,
  runners,
  clockTimeMs,
  settings,
  heats = [],
  currentHeatIndex = 0,
  onSelectHeat,
  onDispatchHeat,
  onCancelDispatchHeat,
  onOpenSchedulePanel,
  onCommandOnMarks,
  onCommandSet,
  onFireGun,
  onRecallGun,
  onSharedResetRace,
  onViewResults,
  onOpenSettings,
  onOpenInternetBridge,
  onStartBellSignal,
  onStopBellSignal,
  isHoldingBell,
  isPeerSirenRinging
}) => {
  const [autoDelayRemaining, setAutoDelayRemaining] = useState<number>(0);
  const [isDispatchedLocally, setIsDispatchedLocally] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentHeat = heats[currentHeatIndex];

  // تسلسل إطلاق المسدس التلقائي بعد "استعد"
  const handleSetCommand = () => {
    onCommandSet();

    if (settings.starterMode === 'auto_random') {
      const baseMs = Math.round(settings.autoDelayDuration * 1000);
      const randomHoldMs = Math.floor(baseMs - 300 + Math.random() * 600);
      setAutoDelayRemaining(randomHoldMs);

      const startTime = Date.now();
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, randomHoldMs - elapsed);
        setAutoDelayRemaining(remaining);

        if (remaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          onFireGun();
        }
      }, 40);
    }
  };

  const handleManualFire = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setAutoDelayRemaining(0);
    onFireGun();
  };

  // إرسال أمر Au Départ لجميع الهواتف
  const handleDispatchCurrentHeat = () => {
    if (currentHeat && onDispatchHeat) {
      onDispatchHeat(currentHeat.id);
      setIsDispatchedLocally(true);
      setTimeout(() => setIsDispatchedLocally(false), 5000);
    }
  };

  // إلغاء أمر خط الانطلاق وسحب القائمة في حالة الخطأ
  const handleCancelDispatch = () => {
    if (onCancelDispatchHeat) {
      onCancelDispatchHeat(currentHeat?.id);
      setIsDispatchedLocally(false);
    }
  };

  const isDispatched = currentHeat?.isDispatched || isDispatchedLocally;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor(ms % 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  };

  const finishedCount = runners.filter(r => r.finishTime > 0).length;

  const getGunSoundLabel = () => {
    return 'مسدس الانطلاق الرسمي 💥';
  };

  return (
    <div className="w-full max-w-xl mx-auto p-2 sm:p-4 space-y-3" dir="rtl">
      {/* قسم تحديد القائمة المعنية بالسباق وزر Au Départ البارز */}
      <div className="bg-gradient-to-br from-slate-900 via-amber-950/30 to-slate-900 border-2 border-amber-500/50 rounded-3xl p-3.5 sm:p-4 shadow-xl space-y-3 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-amber-400">تحديد سباق خط الانطلاق:</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                  هاتف 1 هو المسؤول 🎯
                </span>
              </div>
              <h3 className="font-black text-sm sm:text-base text-white truncate max-w-[280px]">
                {currentHeat?.name || settings.heatName || `قائمة ${settings.heatNumber}`}
              </h3>
            </div>
          </div>

          {/* زر فتح جدول جميع السباقات */}
          {onOpenSchedulePanel && (
            <button
              type="button"
              onClick={onOpenSchedulePanel}
              className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ListOrdered className="w-3.5 h-3.5 text-cyan-400" />
              <span>جدول السباقات 📋</span>
            </button>
          )}
        </div>

        {/* شريط اختيار السلسلة من القوائم المتوفرة */}
        {heats.length > 0 && onSelectHeat && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {heats.map((h, idx) => {
              const isSelected = idx === currentHeatIndex;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onSelectHeat(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30 scale-102'
                      : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>{h.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isSelected ? 'bg-black/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {h.distance}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* الزر الرئيسي المطلوب: "إلى خط الانطلاق (Au Départ) 🏁" + زر الإلغاء */}
        <div className="pt-1 space-y-2">
          <button
            type="button"
            onClick={handleDispatchCurrentHeat}
            disabled={isDispatched && raceStatus !== 'waiting'}
            className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-95 cursor-pointer ${
              isDispatched
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white shadow-emerald-600/40 border-2 border-yellow-300 animate-pulse'
                : 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-red-400 text-slate-950 shadow-amber-500/30'
            }`}
          >
            <Flag className="w-5 h-5" />
            <span>
              {isDispatched
                ? '✅ تم الإرسال لجميع الهواتف: العداؤون على خط الانطلاق (Au Départ) 🏁'
                : 'إلى خط الانطلاق (Au Départ) 🏁 • بث القائمة فورياً'}
            </span>
          </button>

          {/* زر إلغاء أمر خط الانطلاق / سحب القائمة (يظهر فقط بعد الإرسال) */}
          {isDispatched && raceStatus === 'waiting' && onCancelDispatchHeat && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCancelDispatch}
                className="py-3 px-3 rounded-2xl bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 hover:from-rose-600 hover:to-red-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-700/30 border border-rose-400/50 cursor-pointer active:scale-95 transition-all"
              >
                <XCircle className="w-5 h-5 text-white" />
                <span>❌ إلغاء أمر الانطلاق / سحب القائمة (Rappel)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleCancelDispatch();
                  // يتم تبديل القائمة عبر شريط القوائم أعلاه بعد الإلغاء
                }}
                className="py-3 px-3 rounded-2xl bg-gradient-to-r from-cyan-700 via-blue-600 to-cyan-700 hover:from-cyan-600 hover:to-blue-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-700/30 border border-cyan-400/50 cursor-pointer active:scale-95 transition-all"
              >
                <RefreshCw className="w-5 h-5 text-white" />
                <span>🔄 تبديل القائمة (Changer la Série)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* شريط جسر الإنترنت وعنوان هاتف البداية للربط عن بُعد */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between text-xs shadow-md">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Globe className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold">عنوان هاتف البداية بالجسر (سجّله بهاتف النهاية):</div>
            <div className="font-mono font-black text-amber-300 tracking-wider text-xs select-all">
              {athleticsNetwork.myAddress}
            </div>
          </div>
        </div>
        {onOpenInternetBridge && (
          <button
            type="button"
            onClick={onOpenInternetBridge}
            className="py-1 px-2.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-200 border border-cyan-500/40 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
          >
            <span>الجسر 🌐</span>
          </button>
        )}
      </div>

      {/* بطاقة الشاشة الرقمية للساعة المباشرة */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-4 text-center shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
          {/* زر المسافة والقائمة المباشر */}
          <button
            onClick={onOpenSettings}
            className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/40 flex items-center gap-1 font-bold transition-all"
            title="انقر لتغيير المسافة أو القائمة"
          >
            <span>سباق {settings.distance}</span>
            <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
              {settings.heatName || `قائمة ${settings.heatNumber}`}
            </span>
            <SlidersHorizontal className="w-3 h-3" />
          </button>

          {/* صوت المسدس المختار */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 text-slate-300 hover:text-amber-400 bg-slate-850 px-2 py-1 rounded-lg border border-slate-700/60 transition-all text-[11px]"
            title="انقر لتعديل نوع الصوت والحدة والحجم"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold text-amber-300">{getGunSoundLabel()}</span>
          </button>

          <span className="text-emerald-400 font-bold">الرياح: {settings.windSpeed}</span>
        </div>

        {/* المؤقت الرقمي الرياضي الضخم (Cyan Stadium Display) */}
        <div className="my-3 py-2 bg-slate-950/80 rounded-2xl border border-cyan-900/40 shadow-inner">
          <div className="font-black font-mono text-cyan-400 drop-shadow-[0_0_25px_rgba(0,229,255,0.4)] tracking-wider text-[clamp(1.85rem,9vw,3rem)] leading-tight">
            {formatTime(clockTimeMs)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">توقيت إلكتروني رسمي بدقة 1/1000 ثانية</div>
        </div>

        {/* شارة حالة السباق */}
        <div className="flex items-center justify-center gap-2">
          {raceStatus === 'waiting' && (
            <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-3.5 py-1 rounded-full font-bold">
              جاهز للبدء على خط الانطلاق
            </span>
          )}
          {raceStatus === 'on_marks' && (
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3.5 py-1 rounded-full font-bold animate-pulse">
              🏃 1. خذ مكانك (On Your Marks)
            </span>
          )}
          {raceStatus === 'set' && (
            <span className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/40 px-3.5 py-1 rounded-full font-bold">
              ⏱️ 2. استعد... (SET)
            </span>
          )}
          {raceStatus === 'racing' && (
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3.5 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              السباق جاري الآن!
            </span>
          )}
          {raceStatus === 'finished' && (
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3.5 py-1 rounded-full font-bold flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              اكتمل السباق الرسمي
            </span>
          )}
        </div>
      </div>

      {/* بطاقة لفت الانتباه وفحص إشارة هاتف النهاية (Signal Check) */}
      {onStartBellSignal && onStopBellSignal && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-2 shadow-xl">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <BellRing className="w-4 h-4 text-amber-400" />
              <span>جرس لفت الانتباه وفحص الإشارة (Signal Check):</span>
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${
              isPeerSirenRinging
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {isPeerSirenRinging ? '🚨 هاتف النهاية يرن الآن!' : 'اضغط مطولاً للرنين'}
            </span>
          </div>

          <button
            type="button"
            onPointerDown={onStartBellSignal}
            onPointerUp={onStopBellSignal}
            onPointerLeave={onStopBellSignal}
            onPointerCancel={onStopBellSignal}
            className={`w-full py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 select-none transition-all cursor-pointer shadow-lg active:scale-95 ${
              isHoldingBell
                ? isPeerSirenRinging
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white shadow-rose-600/40 border-2 border-yellow-300 animate-pulse scale-[1.02]'
                  : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-amber-600/30 border border-amber-400 animate-pulse'
                : 'bg-slate-800/90 hover:bg-slate-800 text-amber-300 border border-amber-500/40 hover:border-amber-400'
            }`}
          >
            <BellRing className={`w-4 h-4 ${isHoldingBell ? 'animate-bounce text-yellow-300' : 'text-amber-400'}`} />
            <span>
              {isHoldingBell
                ? isPeerSirenRinging
                  ? '🚨 هاتف النهاية يرن بصوت الشرطة! (اتركه لإيقاف الرنين)'
                  : '📡 جاري إرسال إشارة الرنين إلى هاتف النهاية...'
                : '🔔 اضغط واستمر بالضغط لتشغيل صفارة الشرطة في هاتف النهاية'}
            </span>
          </button>
        </div>
      )}

      {/* لوحة أوامر حَكَم البداية */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-xl">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <span>أوامر الانطلاق (IAAF Starter Sequence):</span>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] font-bold"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>تعديل الصوت والنمط والمسافة</span>
            </button>
          )}
        </div>

        {raceStatus === 'waiting' && (
          <button
            onClick={onCommandOnMarks}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-lg shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>1. أمر: "خذ مكانك" (On Marks)</span>
          </button>
        )}

        {raceStatus === 'on_marks' && (
          <div className="space-y-2">
            <button
              onClick={handleSetCommand}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black text-lg shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>2. أمر: "استعد" {settings.starterMode === 'auto_random' ? '+ إطلاق تلقائي' : ''}</span>
            </button>
            {settings.starterMode === 'manual' && (
              <button
                onClick={handleManualFire}
                className="w-full py-2.5 rounded-xl bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/40 font-bold text-xs active:scale-95 transition-all cursor-pointer"
              >
                أو إطلاق المسدس فورياً الآن 💥
              </button>
            )}
          </div>
        )}

        {raceStatus === 'set' && (
          <div className="space-y-2">
            <button
              onClick={handleManualFire}
              className="w-full py-5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-400 text-white font-black text-2xl shadow-xl shadow-red-600/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 animate-bounce cursor-pointer"
            >
              <Zap className="w-6 h-6" />
              <span>طلقة البداية 💥 BANG!</span>
            </button>
            {settings.starterMode === 'auto_random' && autoDelayRemaining > 0 && (
              <div className="text-center text-xs text-orange-400 font-mono">
                تأخير عشوائي مانع للتوقع: {(autoDelayRemaining / 1000).toFixed(2)}s
              </div>
            )}
          </div>
        )}

        {raceStatus === 'racing' && (
          <div className="space-y-2">
            <button
              onClick={onRecallGun}
              className="w-full py-3.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600 text-rose-300 font-black text-base shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
              <span>طلقة استرجاع 🛑 (انطلاقة خاطئة False Start)</span>
            </button>
            <p className="text-[11px] text-center text-slate-400">
              تطلق صافرة وطلقة مزدوجة لإلغاء السباق فوراً
            </p>
          </div>
        )}

        {raceStatus === 'finished' && (
          <button
            onClick={onViewResults}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-base shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <Award className="w-5 h-5" />
            <span>عرض منصة التتويج والنتائج الرسمية 🏆</span>
          </button>
        )}

        {/* زر مشترك فوري لإعادة البدء في سباق جديد في الهواتف معاً */}
        <button
          onClick={onSharedResetRace}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-slate-800 via-slate-750 to-slate-800 hover:from-slate-700 text-cyan-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-cyan-500/40 shadow-lg active:scale-95 transition-all cursor-pointer"
          title="يقوم بإعادة تعيين الساعة وحساس الكاميرا في الهواتف معاً في نفس اللحظة"
        >
          <RotateCcw className="w-4 h-4 text-cyan-400" />
          <span>🔄 إعادة ضبط وبدء سباق جديد (مشترك في جميع الهواتف)</span>
        </button>
      </div>

      {/* شاشة وصول العدائين المباشرة مرتبة تلقائياً حسب أسبقية الوصول والتوقيت */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2 shadow-xl">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span>الترتيب التلقائي وأزمنة خط النهاية:</span>
          <span className="text-amber-400 font-mono">
            {finishedCount} / {runners.length} وصلوا خط النهاية
          </span>
        </div>

        <div className="space-y-1.5">
          {[...runners]
            .sort((a, b) => {
              if (a.finishTime > 0 && b.finishTime > 0) return a.finishTime - b.finishTime;
              if (a.finishTime > 0) return -1;
              if (b.finishTime > 0) return 1;
              return a.lane - b.lane;
            })
            .map((runner) => {
              const finished = runner.finishTime > 0;
              const winningRunner = runners.filter(r => r.finishTime > 0).sort((a, b) => a.finishTime - b.finishTime)[0];
              const diffMs = finished && winningRunner ? runner.finishTime - winningRunner.finishTime : 0;
              const medal = runner.rank === 1 ? '🥇 الأول' : runner.rank === 2 ? '🥈 الثاني' : runner.rank === 3 ? '🥉 الثالث' : runner.rank ? `#${runner.rank}` : '--';

              return (
                <div
                  key={runner.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    finished
                      ? runner.rank === 1
                        ? 'bg-amber-500/10 border-amber-500/40 text-white shadow-sm'
                        : 'bg-emerald-950/40 border-emerald-700 text-white'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: runner.color }}
                    >
                      L{runner.lane}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white flex items-center gap-1.5">
                        <span>{runner.name}</span>
                        {finished && runner.rank && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-black ${
                            runner.rank === 1 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-300'
                          }`}>
                            {medal}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        صدر #{runner.bib} • {runner.club || runner.country}
                        {runner.wilaya && ` • ${runner.wilaya}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-left font-mono">
                      {finished ? (
                        <>
                          <div className="text-xs font-black text-amber-400 flex items-center gap-1 justify-end">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            {(runner.finishTime / 1000).toFixed(3)}s
                          </div>
                          <div className="text-[10px] text-slate-500 text-left">
                            {runner.rank === 1 ? 'الفائز' : `+${(diffMs / 1000).toFixed(3)}s`}
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-600">في المضمار...</span>
                      )}
                    </div>

                    {runner.crossingSnapshot && (
                      <img
                        src={runner.crossingSnapshot}
                        alt="Photo finish moment"
                        className="w-9 h-6 object-cover rounded border border-cyan-400/60 shadow-sm"
                        title="صورة لحظة الوصول من كاميرا خط النهاية"
                      />
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
