import React from 'react';
import { Volume2, VolumeX, Wifi, WifiOff, Settings, RotateCcw, BellRing, Globe, Home, ArrowRight, ListOrdered, Crown, ArrowLeftRight, Archive } from 'lucide-react';
import { PhoneRole, LicensePoolInfo } from '../types/race';

interface HeaderProps {
  role: PhoneRole;
  roomCode: string;
  isConnected: boolean;
  latencyMs: number;
  isMuted: boolean;
  heatNumber?: number;
  heatName?: string;
  sharedPoolLicense?: LicensePoolInfo | null;
  onToggleMute: () => void;
  onChangeRole: () => void;
  onOpenSettings?: () => void;
  onOpenInternetBridge?: () => void;
  onOpenSchedulePanel?: () => void;
  onOpenSubscriptionModal?: () => void;
  onOpenTransferModal?: () => void;
  onOpenArchive?: () => void;
  onSharedResetRace?: () => void;
  onStartBellSignal?: () => void;
  onStopBellSignal?: () => void;
  isHoldingBell?: boolean;
  isPeerSirenRinging?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  role,
  roomCode,
  isConnected,
  latencyMs,
  isMuted,
  heatNumber,
  heatName,
  sharedPoolLicense,
  onToggleMute,
  onChangeRole,
  onOpenSettings,
  onOpenInternetBridge,
  onOpenSchedulePanel,
  onOpenSubscriptionModal,
  onOpenTransferModal,
  onOpenArchive,
  onSharedResetRace,
  onStartBellSignal,
  onStopBellSignal,
  isHoldingBell,
  isPeerSirenRinging
}) => {
  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white px-2.5 sm:px-4 py-2 sticky top-0 z-50 shadow-lg" dir="rtl">
      <div className="max-w-6xl mx-auto flex flex-col gap-1.5">
        {/* الصف العلوي: اللوجو + الدور + زر العودة للرئيسية المباشر (لفّي ليناسب كل الشاشات) */}
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          {/* اللوجو والعنوان */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 flex items-center justify-center font-black text-slate-950 text-xs shadow-md shadow-amber-500/25">
              PF
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-xs sm:text-sm tracking-wide bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent truncate">
                  PHOTO FINISH PRO
                </h1>
                <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 shrink-0 hidden xs:inline">
                  IAAF
                </span>
              </div>
              {role && (
                <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 flex items-center gap-1.5 truncate">
                  <span>غرفة:</span>
                  <span className="text-amber-400 font-mono tracking-wider">{roomCode}</span>
                  {heatNumber && (
                    <span className="bg-slate-800 text-cyan-300 font-mono text-[9px] px-1.5 py-0.2 rounded border border-slate-700 truncate max-w-[110px] sm:max-w-none">
                      {heatName || `قائمة ${heatNumber}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* الجزء الأيسر: شارة الدور الحالية + زر العودة للرئيسية البارز جداً */}
          <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-0">
            {/* شارة الاشتراك الشبكي المشترك 1*4 إذا كان فعالاً */}
            {sharedPoolLicense && (
              <span 
                className="hidden md:flex items-center gap-1 text-[10px] bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 font-bold px-2.5 py-1 rounded-full border border-amber-500/40 animate-pulse shadow-sm"
                title={`اشتراك 1*4 مشترك من ${sharedPoolLicense.hostRole === 'start' ? 'هاتف البداية' : sharedPoolLicense.hostRole === 'finish' ? 'هاتف النهاية' : 'الهاتف الرئيسي'} (${sharedPoolLicense.tierName})`}
              >
                <Crown className="w-3 h-3 text-amber-400" />
                <span>1×4 مشترك ({sharedPoolLicense.tier === 'ENTX' ? '10 أروقة' : '8 أروقة'}) 🏆</span>
              </span>
            )}

            {/* زر نافذة خطط الاشتراك والأسعار والتفعيل */}
            {onOpenSubscriptionModal && (
              <button
                type="button"
                onClick={onOpenSubscriptionModal}
                className={`items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 font-bold text-[11px] sm:text-xs shadow-sm border border-amber-500/40 transition-all active:scale-95 cursor-pointer shrink-0 ${!role ? 'hidden sm:flex' : 'flex'}`}
                title="عرض أنواع الاشتراكات، الأسعار، كيفية الاشتراك، وتفعيل كود الترخيص"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="sm:hidden">الاشتراك 👑</span>
                <span className="hidden sm:inline">الاشتراك والأسعار 👑</span>
              </button>
            )}

            {/* زر نقل الترخيص المشفر */}
            {onOpenTransferModal && (
              <button
                type="button"
                onClick={onOpenTransferModal}
                className={`items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-slate-850 hover:bg-purple-900/60 text-purple-300 border border-purple-500/40 text-[10px] sm:text-xs font-bold transition-all cursor-pointer shadow-sm ${!role ? 'hidden sm:flex' : 'flex'}`}
                title="تحويل الترخيص المتبقي إلى هاتف آخر أو استقبال كود نقل"
              >
                <ArrowLeftRight className="w-3 h-3 text-purple-400" />
                <span className="hidden sm:inline">نقل الترخيص</span>
              </button>
            )}

            {/* شارة الدور الحالي */}
            {role && (
              <span className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded-xl border shrink-0 ${
                role === 'start' 
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' 
                  : role === 'finish'
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                  : role === 'judge'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                  : 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40'
              }`}>
                {role === 'start' ? '🚦 هاتف البداية' : role === 'finish' ? '📸 كاميرا النهاية' : role === 'judge' ? '⚖️ الحكم العام' : '📋 غرفة النداء'}
              </span>
            )}

            {/* زر جدول السباقات المباشر */}
            {role && onOpenSchedulePanel && (
              <button
                type="button"
                onClick={onOpenSchedulePanel}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-850 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition-all cursor-pointer"
                title="جدول السباقات (الجارية Au Départ، القادمة، والمنتهية)"
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">السباقات</span>
              </button>
            )}

            {/* زر أرشيف السباقات الدائم */}
            {role && onOpenArchive && (
              <button
                type="button"
                onClick={onOpenArchive}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-850 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition-all cursor-pointer"
                title="أرشيف السباقات المحفوظة دائماً على هذا الجهاز (يعمل بدون إنترنت)"
              >
                <Archive className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">الأرشيف</span>
              </button>
            )}

            {/* 1. زر العودة للواجهة الرئيسية (اختر دور الهاتف) - واضح وكبير وبارز */}
            {role && (
              <button
                type="button"
                onClick={onChangeRole}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-750 hover:from-amber-600 hover:to-orange-600 text-amber-300 hover:text-white font-bold text-[11px] sm:text-xs border border-amber-500/40 hover:border-amber-400 shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
                title="العودة إلى شاشة اختيار دور الهاتف في السباق"
              >
                <Home className="w-3.5 h-3.5" />
                <span>الرئيسية</span>
                <ArrowRight className="w-3 h-3 opacity-60 hidden sm:inline" />
              </button>
            )}
          </div>
        </div>

        {/* الصف الثاني: شريط أدوات السباق السريعة (متجاوب ومرن لجميع الهواتف) */}
        {role && (
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
            {/* أزرار العمليات المشتركة */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* زر سباق جديد فوري */}
              {onSharedResetRace && (
                <button
                  type="button"
                  onClick={onSharedResetRace}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-[10px] sm:text-xs shadow-sm active:scale-95 transition-all border border-cyan-400/40 shrink-0 cursor-pointer"
                  title="تصفير العداد وبدء سباق جديد فوراً في جميع الهواتف"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>سباق جديد 🔄</span>
                </button>
              )}

              {/* زر جرس لفت الانتباه */}
              {onStartBellSignal && onStopBellSignal && (
                <button
                  type="button"
                  onPointerDown={onStartBellSignal}
                  onPointerUp={onStopBellSignal}
                  onPointerLeave={onStopBellSignal}
                  onPointerCancel={onStopBellSignal}
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl font-bold text-[10px] sm:text-xs select-none transition-all cursor-pointer shrink-0 ${
                    isHoldingBell
                      ? isPeerSirenRinging
                        ? 'bg-red-600 text-white animate-pulse shadow-md border border-yellow-300'
                        : 'bg-amber-600 text-white animate-pulse border border-amber-300'
                      : 'bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/30'
                  }`}
                  title="اضغط واستمر لتشغيل صفارة الشرطة في الهاتف الآخر للفت الانتباه"
                >
                  <BellRing className={`w-3 h-3 ${isHoldingBell ? 'animate-bounce text-yellow-300' : 'text-amber-400'}`} />
                  <span>{isHoldingBell ? '🚨 صفارة!' : 'جرس 🔔'}</span>
                </button>
              )}

              {/* زر جسر الإنترنت */}
              {onOpenInternetBridge && (
                <button
                  type="button"
                  onClick={onOpenInternetBridge}
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl font-bold text-[10px] sm:text-xs select-none transition-all cursor-pointer shrink-0 ${
                    isConnected
                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
                      : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 animate-pulse'
                  }`}
                  title="جسر الإنترنت للمسافات البعيدة والمزامنة السحابية"
                >
                  <Globe className="w-3 h-3 text-cyan-400" />
                  <span>جسر النت 🌐</span>
                </button>
              )}
            </div>

            {/* أدوات الحالة والصوت والإعدادات */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* مؤشر الاتصال والـ Ping */}
              <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
                isConnected 
                  ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-400' 
                  : 'bg-amber-950/70 border-amber-700/60 text-amber-400'
              }`}>
                {isConnected ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5 animate-pulse" />}
                <span className="font-mono">{isConnected ? `${latencyMs}ms` : 'ربط...'}</span>
              </div>

              {/* كتم / تشغيل الصوت */}
              <button
                type="button"
                onClick={onToggleMute}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
                title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              {/* الإعدادات */}
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
                  title="إعدادات السباق والأروقة"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
