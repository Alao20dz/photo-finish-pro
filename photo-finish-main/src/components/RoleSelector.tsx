import React, { useState } from 'react';
import { 
  Flag, 
  Camera, 
  Shuffle, 
  Award, 
  QrCode, 
  Users, 
  ScanLine, 
  Crown, 
  ArrowLeftRight, 
  CreditCard, 
  Lock, 
  Wifi, 
  Radio, 
  ChevronLeft, 
  Smartphone, 
  MapPin, 
  Route,
  Building2,
  ShieldCheck,
  ShieldAlert,
  Trophy,
  Sparkles
} from 'lucide-react';
import { PhoneRole, LicensePoolInfo } from '../types/race';
import { PhoneQrModal } from './PhoneQrModal';
import { QrScannerModal } from './QrScannerModal';
import { useI18n } from '../i18n';
import type { Lang } from '../i18n/dictionaries';
import { pricingService } from '../services/pricingService';
import { licenseManager } from '../services/licenseManager';
import { AthletesDatabaseModal } from './athletics/AthletesDatabaseModal';
import { ClubsDatabaseModal } from './athletics/ClubsDatabaseModal';
import { CoachPortalModal } from './athletics/CoachPortalModal';
import { RegistrationApprovalModal } from './athletics/RegistrationApprovalModal';
import { FieldEventScorepadModal } from './athletics/FieldEventScorepadModal';
import { CourseDesignerModal } from './athletics/CourseDesignerModal';
import { MultiJudgeMergeModal } from './athletics/MultiJudgeMergeModal';
import { ChiefJudgeDashboardModal } from './athletics/ChiefJudgeDashboardModal';
import { ClubStandingsModal } from './athletics/ClubStandingsModal';
import { AiRaceAssistantModal } from './athletics/AiRaceAssistantModal';

interface RoleSelectorProps {
  roomCode: string;
  onSetRoomCode: (code: string) => void;
  onSelectRole: (role: PhoneRole) => void;
  onOpenSubscriptionModal?: () => void;
  onOpenTransferModal?: () => void;
  sharedPoolLicense?: LicensePoolInfo | null;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  roomCode,
  onSetRoomCode,
  onSelectRole,
  onOpenSubscriptionModal,
  onOpenTransferModal,
  sharedPoolLicense,
}) => {
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);
  const [showAthletesModal, setShowAthletesModal] = useState<boolean>(false);
  const [showClubsModal, setShowClubsModal] = useState<boolean>(false);
  const [showCoachModal, setShowCoachModal] = useState<boolean>(false);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [showFieldEventModal, setShowFieldEventModal] = useState<boolean>(false);
  const [showCourseDesignerModal, setShowCourseDesignerModal] = useState<boolean>(false);
  const [showMultiJudgeModal, setShowMultiJudgeModal] = useState<boolean>(false);
  const [showChiefJudgeModal, setShowChiefJudgeModal] = useState<boolean>(false);
  const [showClubStandingsModal, setShowClubStandingsModal] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);

  const activeLicense = licenseManager.activeLicense;
  const isTrialExpired = pricingService.isTrialExpired();
  // شرط الحظر التام: انتهاء الـ 7 أيام مع عدم وجود ترخيص شخصي أو مشاركة 1*4 نشطة
  const isLocked = isTrialExpired && !activeLicense && !sharedPoolLicense;
  const trialText = pricingService.getRemainingTrialText();
  const { t, lang, setLang, dir } = useI18n();

  const generateNewRoom = () => {
    const num = Math.floor(100 + Math.random() * 900);
    onSetRoomCode(`RACE-${num}`);
  };

  const handleScanSuccess = (data: { roomCode: string; role?: PhoneRole }) => {
    if (data.roomCode) {
      onSetRoomCode(data.roomCode);
    }
    setShowScannerModal(false);
    if (data.role && !isLocked) {
      onSelectRole(data.role);
    }
  };

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-start p-3 sm:p-5 max-w-lg mx-auto w-full space-y-4" dir={dir}>

      {/* ═══ 0. مبدّل اللغة (عربي / Français) ═══ */}
      <div className="w-full flex items-center justify-end">
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-xl p-1 shadow" role="group" aria-label={t('language')}>
          <button
            type="button"
            onClick={() => setLang('ar' as Lang)}
            className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all ${lang === 'ar' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
            aria-pressed={lang === 'ar'}
          >
            {t('lang_ar')}
          </button>
          <button
            type="button"
            onClick={() => setLang('fr' as Lang)}
            className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all ${lang === 'fr' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
            aria-pressed={lang === 'fr'}
          >
            {t('lang_fr')}
          </button>
        </div>
      </div>
      
      {/* ═══ 1. الشريط العلوي للهاتف: حالة الشبكة ومؤشر الـ P2P ═══ */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl px-3.5 py-2 flex items-center justify-between shadow-md text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-300">{t('race_track')}</span>
          </div>
          <span className="bg-slate-950 text-amber-300 font-mono font-black px-2 py-0.5 rounded-lg border border-slate-800 text-[11px]">
            {roomCode}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1 text-cyan-400 font-mono font-bold bg-cyan-950/60 px-2 py-0.5 rounded-lg border border-cyan-800/40">
            <Wifi className="w-3 h-3 text-cyan-400" />
            <span>P2P 4G Mesh</span>
          </span>
          <span className="text-slate-400">1/1000s</span>
        </div>
      </div>

      {/* ═══ 2. بطاقة حالة الاشتراك والـ 1*4 الشبكي (Hero Status) ═══ */}
      <div className={`w-full rounded-3xl p-4 border-2 shadow-xl transition-all relative overflow-hidden ${
        activeLicense
          ? 'bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500/50 shadow-emerald-500/10'
          : sharedPoolLicense
          ? 'bg-gradient-to-br from-cyan-950/80 via-slate-900 to-slate-950 border-cyan-500/50 shadow-cyan-500/10'
          : isLocked
          ? 'bg-gradient-to-br from-red-950/80 via-slate-900 to-slate-950 border-red-500/50 shadow-red-500/10'
          : 'bg-gradient-to-br from-amber-950/80 via-slate-900 to-slate-950 border-amber-500/50 shadow-amber-500/10'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-lg shrink-0 ${
              activeLicense
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950'
                : sharedPoolLicense
                ? 'bg-gradient-to-tr from-cyan-500 to-blue-400 text-slate-950'
                : isLocked
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950'
            }`}>
              {isLocked ? <Lock className="w-6 h-6 text-red-400" /> : <Crown className="w-6 h-6" />}
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-sm text-white">
                  {activeLicense 
                    ? t('license_host') 
                    : sharedPoolLicense 
                    ? t('license_shared') 
                    : isLocked 
                    ? t('license_locked') 
                    : t('license_trial')}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.2 rounded-full border ${
                  activeLicense || sharedPoolLicense
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : isLocked
                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {activeLicense || sharedPoolLicense ? t('lanes_open') : isLocked ? t('locked_out') : t('trial_days')}
                </span>
              </div>

              <p className="text-[11px] text-slate-300 leading-snug">
                {activeLicense
                  ? `${activeLicense.tierName} • ${t('license_valid_until')} ${activeLicense.expiryDate}`
                  : sharedPoolLicense
                  ? `${t('inherited_from')} (${sharedPoolLicense.hostRole}) ${t('same_room_free')}`
                  : isLocked
                  ? t('trial_locked_hint')
                  : `${t('trial_full_features')} • ${trialText}`}
              </p>
            </div>
          </div>

          {onOpenSubscriptionModal && (
            <button
              type="button"
              onClick={onOpenSubscriptionModal}
              className="shrink-0 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{isLocked ? t('btn_activate') : t('btn_packages')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══ 3. حاجز قفل التجربة (Paywall Locked State) ═══ */}
      {isLocked ? (
        <div className="w-full bg-slate-900/90 border-2 border-red-500/40 rounded-3xl p-5 sm:p-6 text-center space-y-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto shadow-inner">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-white">
              {t('paywall_title')}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
              {t('paywall_body')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 max-w-sm mx-auto pt-1">
            <button
              type="button"
              onClick={onOpenSubscriptionModal}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4 fill-slate-950" />
              <span>{t('paywall_opt1')}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowScannerModal(true)}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-cyan-300 font-bold text-xs border border-cyan-500/40 shadow transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <ScanLine className="w-4 h-4 text-cyan-400" />
              <span>{t('paywall_opt2')}</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-400 pt-1">
            {t('paywall_hint')}
          </p>
        </div>
      ) : (
        /* ═══ 4. بطاقات محطات الهاتف الأربعة الرسمية ═══ */
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>{t('choose_station')}</span>
            </h3>
            <span className="text-[10px] text-slate-400">{t('stations_count')}</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {/* 1. هاتف البداية (Starter) */}
            <button
              type="button"
              onClick={() => onSelectRole('start')}
              className="group relative overflow-hidden text-start p-4 rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-950 border border-emerald-500/40 hover:border-emerald-400 transition-all shadow-lg active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <Flag className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        {t('station')} 1
                      </span>
                      <h4 className="font-black text-sm sm:text-base text-white group-hover:text-emerald-300 transition-colors">
                        {t('station_start_title')}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {t('station_start_desc')}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] text-emerald-400 font-mono">
                      <span>{t('station_start_f1')}</span>
                      <span>•</span>
                      <span>{t('station_start_f2')}</span>
                    </div>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-emerald-300 group-hover:border-emerald-400 transition-colors shrink-0 mt-2">
                  <ChevronLeft className="w-5 h-5" />
                </div>
              </div>
            </button>

            {/* 2. كاميرا خط النهاية (Finish Camera) */}
            <button
              type="button"
              onClick={() => onSelectRole('finish')}
              className="group relative overflow-hidden text-start p-4 rounded-3xl bg-gradient-to-br from-slate-900 via-cyan-950/40 to-slate-950 border border-cyan-500/40 hover:border-cyan-400 transition-all shadow-lg active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                        {t('station')} 2
                      </span>
                      <h4 className="font-black text-sm sm:text-base text-white group-hover:text-cyan-300 transition-colors">
                        {t('station_finish_title')}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {t('station_finish_desc')}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] text-cyan-400 font-mono">
                      <span>{t('station_finish_f1')}</span>
                      <span>•</span>
                      <span>{t('station_finish_f2')}</span>
                    </div>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-cyan-300 group-hover:border-cyan-400 transition-colors shrink-0 mt-2">
                  <ChevronLeft className="w-5 h-5" />
                </div>
              </div>
            </button>

            {/* 3. رئيس الحكام والنتائج (Chief Judge) */}
            <button
              type="button"
              onClick={() => onSelectRole('judge')}
              className="group relative overflow-hidden text-start p-4 rounded-3xl bg-gradient-to-br from-slate-900 via-amber-950/40 to-slate-950 border border-amber-500/40 hover:border-amber-400 transition-all shadow-lg active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <Award className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        {t('station')} 3
                      </span>
                      <h4 className="font-black text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors">
                        {t('station_judge_title')}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {t('station_judge_desc')}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] text-amber-400 font-mono">
                      <span>{t('station_judge_f1')}</span>
                      <span>•</span>
                      <span>{t('station_judge_f2')}</span>
                    </div>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-amber-300 group-hover:border-amber-400 transition-colors shrink-0 mt-2">
                  <ChevronLeft className="w-5 h-5" />
                </div>
              </div>
            </button>

            {/* 4. غرفة النداء (Call Room) */}
            <button
              type="button"
              onClick={() => onSelectRole('chambre_dappel')}
              className="group relative overflow-hidden text-start p-4 rounded-3xl bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-950 border border-purple-500/40 hover:border-purple-400 transition-all shadow-lg active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/50 text-purple-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                        {t('station')} 4
                      </span>
                      <h4 className="font-black text-sm sm:text-base text-white group-hover:text-purple-300 transition-colors">
                        {t('station_chambre_title')}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {t('station_chambre_desc')}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] text-purple-400 font-mono">
                      <span>{t('station_chambre_f1')}</span>
                      <span>•</span>
                      <span>{t('station_chambre_f2')}</span>
                    </div>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-purple-300 group-hover:border-purple-400 transition-colors shrink-0 mt-2">
                  <ChevronLeft className="w-5 h-5" />
                </div>
              </div>
            </button>

            {/* 5. حكم نقاط المراقبة الميداني (Checkpoint Judge) */}
            <button
              type="button"
              onClick={() => onSelectRole('checkpoint_judge')}
              className="group relative overflow-hidden text-start p-4 rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-950 border border-emerald-500/40 hover:border-emerald-400 transition-all shadow-lg active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        {t('station')} 5 ({t('station_new')})
                      </span>
                      <h4 className="font-black text-sm sm:text-base text-white group-hover:text-emerald-300 transition-colors">
                        {t('station_checkpoint_title')}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {t('station_checkpoint_desc')}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] text-emerald-400 font-mono">
                      <span>{t('station_checkpoint_f1')}</span>
                      <span>•</span>
                      <span>{t('station_checkpoint_f2')}</span>
                      <span>•</span>
                      <span>{t('station_checkpoint_f3')}</span>
                    </div>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-emerald-300 group-hover:border-emerald-400 transition-colors shrink-0 mt-2">
                  <ChevronLeft className="w-5 h-5" />
                </div>
              </div>
            </button>

            {/* 6. لوحة إدارة ألعاب القوى والترتيب (Athletics Manager) */}
            <button
              type="button"
              onClick={() => onSelectRole('athletics_manager')}
              className="group relative overflow-hidden text-start p-4 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-950 border border-indigo-500/40 hover:border-indigo-400 transition-all shadow-lg active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/50 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <Route className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                        {t('station')} 6 ({t('station_new')})
                      </span>
                      <h4 className="font-black text-sm sm:text-base text-white group-hover:text-indigo-300 transition-colors">
                        {t('station_manager_title')}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {t('station_manager_desc')}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] text-indigo-400 font-mono">
                      <span>{t('station_manager_f1')}</span>
                      <span>•</span>
                      <span>{t('station_manager_f2')}</span>
                    </div>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-indigo-300 group-hover:border-indigo-400 transition-colors shrink-0 mt-2">
                  <ChevronLeft className="w-5 h-5" />
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ═══ 5. مركز الربط ومسح الباركود السريع في المضمار ═══ */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>ربط وتغيير غرفة المضمار (Room Code):</span>
          </label>
          <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            تزامن &lt; 0.5ms
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => onSetRoomCode(e.target.value.toUpperCase())}
            placeholder="مثال: RACE-2026"
            className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-500 text-white font-mono font-bold text-center tracking-widest text-lg rounded-xl py-2 px-3 outline-none uppercase"
          />
          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            title="مسح باركود الهاتف المقابل بالكاميرا"
          >
            <Camera className="w-4 h-4" />
            <span>مسح</span>
          </button>
          <button
            onClick={generateNewRoom}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="توليد كود عشوائي"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>

        {/* أزرار سريعة لمشاركة الباركود وروابط الأدوار */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow"
          >
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span>عرض باركود QR 📲</span>
          </button>

          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow"
          >
            <ScanLine className="w-4 h-4 text-emerald-400" />
            <span>مسح كاميرا الهاتف 📷</span>
          </button>
        </div>
      </div>

      {/* ═══ 6. شريط الإجراءات والخدمات السريعة في الأسفل ═══ */}
      <div className="w-full grid grid-cols-2 gap-2 text-xs pt-1">
        {onOpenSubscriptionModal && (
          <button
            type="button"
            onClick={onOpenSubscriptionModal}
            className="py-3 px-3 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 text-amber-300 font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer"
          >
            <Crown className="w-4 h-4 text-amber-400" />
            <span>الاشتراكات والأسعار 👑</span>
          </button>
        )}

        {onOpenTransferModal && (
          <button
            type="button"
            onClick={onOpenTransferModal}
            className="py-3 px-3 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-purple-500/40 text-purple-300 font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-purple-400" />
            <span>نقل الترخيص الآمن 🔄</span>
          </button>
        )}
      </div>

      {/* ═══ 7. قسم قاعدة بيانات ألعاب القوى وبوابة المدربين والاعتماد ═══ */}
      <div className="w-full grid grid-cols-2 gap-2 text-xs pt-0.5">
        <button
          type="button"
          onClick={() => setShowAthletesModal(true)}
          className="py-2.5 px-3 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-blue-500/30 text-blue-300 font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer active:scale-95"
        >
          <Users className="w-4 h-4 text-blue-400" />
          <span>سجل العدائين 🏃</span>
        </button>

        <button
          type="button"
          onClick={() => setShowClubsModal(true)}
          className="py-2.5 px-3 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-emerald-500/30 text-emerald-300 font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer active:scale-95"
        >
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span>دليل الأندية 🏛️</span>
        </button>

        <button
          type="button"
          onClick={() => setShowCoachModal(true)}
          className="py-2.5 px-3 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer active:scale-95"
        >
          <Users className="w-4 h-4 text-indigo-400" />
          <span>بوابة المدربين 📋</span>
        </button>

        <button
          type="button"
          onClick={() => setShowApprovalModal(true)}
          className="py-2.5 px-3 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-amber-500/30 text-amber-300 font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer active:scale-95"
        >
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>اعتماد المشاركات ⚖️</span>
        </button>

        <button
          type="button"
          onClick={() => setShowFieldEventModal(true)}
          className="py-2.5 px-3 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer active:scale-95"
        >
          <Award className="w-4 h-4 text-amber-400" />
          <span>المسابقات الميدانية 🏆</span>
        </button>

        <button
          type="button"
          onClick={() => setShowCourseDesignerModal(true)}
          className="py-2.5 px-3 rounded-2xl bg-slate-900/80 hover:bg-slate-850 border border-cyan-500/40 text-cyan-300 font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer active:scale-95"
        >
          <Route className="w-4 h-4 text-cyan-400" />
          <span>مصمم المسارات والخرائط 🗺️</span>
        </button>

        <button
          type="button"
          onClick={() => setShowMultiJudgeModal(true)}
          className="col-span-2 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-900/80 to-amber-950/60 hover:from-amber-900/60 hover:to-amber-900/60 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer active:scale-95"
        >
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>مركز دمج تحكيم الهواتف وكشف الشذوذ ⚖️</span>
        </button>

        <button
          type="button"
          onClick={() => setShowChiefJudgeModal(true)}
          className="col-span-2 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-900/90 to-purple-950/70 hover:from-purple-900/70 hover:to-purple-900/70 border border-purple-500/40 text-purple-300 font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer active:scale-95"
        >
          <Award className="w-4 h-4 text-purple-400" />
          <span>غرفة الحكم العام والنتائج الرسمية 📜</span>
        </button>

        <button
          type="button"
          onClick={() => setShowClubStandingsModal(true)}
          className="col-span-2 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-950/70 via-slate-900/90 to-amber-950/70 hover:from-amber-900/70 hover:to-amber-900/70 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer active:scale-95"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>ترتيب الأندية وحصاد الميداليات والتصدير 🏆</span>
        </button>

        <button
          type="button"
          onClick={() => setShowAiModal(true)}
          className="col-span-2 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900/90 to-purple-950/70 hover:from-indigo-900/70 hover:to-purple-900/70 border border-indigo-500/40 text-indigo-300 font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer active:scale-95"
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>المساعد الذكي والتحليل التكتيكي 🤖 AI</span>
        </button>
      </div>

      {/* نافذة عرض باركود الغرفة */}
      {showQrModal && (
        <PhoneQrModal
          roomCode={roomCode}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {/* نافذة مسح باركود الكاميرا */}
      {showScannerModal && (
        <QrScannerModal
          onSuccess={handleScanSuccess}
          onClose={() => setShowScannerModal(false)}
        />
      )}

      {/* نوافذ منظومة العدائين والأندية والمدربين والمسابقات الميدانية والمسارات والشذوذ وغرفة الحكم العام وترتيب الأندية والذكاء الاصطناعي */}
      <AthletesDatabaseModal
        isOpen={showAthletesModal}
        onClose={() => setShowAthletesModal(false)}
      />

      <ClubsDatabaseModal
        isOpen={showClubsModal}
        onClose={() => setShowClubsModal(false)}
      />

      <CoachPortalModal
        isOpen={showCoachModal}
        onClose={() => setShowCoachModal(false)}
      />

      <RegistrationApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
      />

      <FieldEventScorepadModal
        isOpen={showFieldEventModal}
        onClose={() => setShowFieldEventModal(false)}
      />

      <CourseDesignerModal
        isOpen={showCourseDesignerModal}
        onClose={() => setShowCourseDesignerModal(false)}
      />

      <MultiJudgeMergeModal
        isOpen={showMultiJudgeModal}
        onClose={() => setShowMultiJudgeModal(false)}
      />

      <ChiefJudgeDashboardModal
        isOpen={showChiefJudgeModal}
        onClose={() => setShowChiefJudgeModal(false)}
        onOpenStandingsModal={() => setShowClubStandingsModal(true)}
      />

      <ClubStandingsModal
        isOpen={showClubStandingsModal}
        onClose={() => setShowClubStandingsModal(false)}
      />

      <AiRaceAssistantModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
      />
    </div>
  );
};

export default RoleSelector;
