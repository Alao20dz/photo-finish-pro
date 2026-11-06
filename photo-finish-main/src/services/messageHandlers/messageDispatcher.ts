import { NetworkPeerMessage, RaceSettings, Runner, Heat, PhoneRole, LicensePoolInfo } from '../../types/race';
import { handleTimingMessage } from './timingHandler';
import { handleRaceFinishMessage } from './raceFinishHandler';
import { handleHeatsMessage } from './heatsHandler';
import { handleSettingsSyncMessage } from './settingsSyncHandler';
import { handleLicensingMessage } from './licensingHandler';
import { handleBellSignalMessage } from './bellSignalHandler';
import { passageSyncEngine } from '../passageSyncEngine';

export interface DispatcherContext {
  role: PhoneRole;
  clockOffsetMs: number;
  getSettings: () => RaceSettings;
  getRunners: () => Runner[];
  getHeats: () => Heat[];
  getCurrentHeatIndex: () => number;
  getRaceStatus: () => any;
  getClockTimeMs: () => number;

  setRaceStatus: (status: any) => void;
  startLocalClock: (startTime: number) => void;
  stopLocalClock: () => void;
  handleLocalReset: () => void;

  setRunners: (runners: Runner[] | ((prev: Runner[]) => Runner[])) => void;
  setSettings: (settings: RaceSettings | ((prev: RaceSettings) => RaceSettings)) => void;
  setHeats: (heats: Heat[] | ((prev: Heat[]) => Heat[])) => void;
  setCurrentHeatIndex: (idx: number) => void;
  setDispatchedHeatId: (id: string | null) => void;
  setShowPodium: (show: boolean) => void;
  setSharedPoolLicense: (pool: LicensePoolInfo | null) => void;

  setIsHoldingBellButton?: (holding: boolean) => void;
  setIsPeerSirenRinging?: (ringing: boolean) => void;
  setIsReceivingBellAlert?: (receiving: boolean) => void;

  saveRaceToArchive?: (race: { runners: Runner[]; fullPhotoFinishUrl?: string }) => void;
}

/**
 * الموزع المركزي للرسائل الشبكية (Central Network Message Dispatcher)
 * يوجه كل رسالة لمعالجها التخصصي بنمط نظيف وقابل للاختبار
 */
export function dispatchNetworkMessage(msg: NetworkPeerMessage, ctx: DispatcherContext): boolean {
  if (!msg || !msg.type) return false;

  // 1. رسائل التوقيت ومسدس الانطلاق
  if (handleTimingMessage(msg, {
    setRaceStatus: ctx.setRaceStatus,
    startLocalClock: ctx.startLocalClock,
    stopLocalClock: ctx.stopLocalClock,
    handleLocalReset: ctx.handleLocalReset,
    clockOffsetMs: ctx.clockOffsetMs,
    getSettings: ctx.getSettings,
  })) {
    return true;
  }

  // 2. رسائل نهاية السباق والوصول
  if (handleRaceFinishMessage(msg, {
    setRaceStatus: ctx.setRaceStatus,
    stopLocalClock: ctx.stopLocalClock,
    setRunners: ctx.setRunners,
    setHeats: ctx.setHeats,
    setShowPodium: ctx.setShowPodium,
    saveRaceToArchive: ctx.saveRaceToArchive,
    getCurrentHeatIndex: ctx.getCurrentHeatIndex,
    getRunners: ctx.getRunners,
    getSettings: ctx.getSettings,
  })) {
    return true;
  }

  // 3. رسائل إدارة القوائم والسلاسل (Heats)
  if (handleHeatsMessage(msg, {
    setCurrentHeatIndex: ctx.setCurrentHeatIndex,
    setRunners: ctx.setRunners,
    setSettings: ctx.setSettings,
    setHeats: ctx.setHeats,
    setDispatchedHeatId: ctx.setDispatchedHeatId,
    setRaceStatus: ctx.setRaceStatus,
    handleLocalReset: ctx.handleLocalReset,
  })) {
    return true;
  }

  // 4. رسائل المزامنة الشاملة والإعدادات
  if (handleSettingsSyncMessage(msg, {
    setSettings: ctx.setSettings,
    setRunners: ctx.setRunners,
    setHeats: ctx.setHeats,
    setRaceStatus: ctx.setRaceStatus,
    setClockTimeMs: () => {},
    setCurrentHeatIndex: ctx.setCurrentHeatIndex,
    getCurrentHeatIndex: ctx.getCurrentHeatIndex,
    getSettings: ctx.getSettings,
    getRunners: ctx.getRunners,
    getHeats: ctx.getHeats,
    getRaceStatus: ctx.getRaceStatus,
    getClockTimeMs: ctx.getClockTimeMs,
    role: ctx.role,
  })) {
    return true;
  }

  // 5. رسائل تقاسم ونقل التراخيص المشفرة
  if (handleLicensingMessage(msg, {
    setSharedPoolLicense: ctx.setSharedPoolLicense,
    setSettings: ctx.setSettings,
    getSettings: ctx.getSettings,
  })) {
    return true;
  }

  // 6. رسائل جرس لفت الانتباه والصفارة
  if (handleBellSignalMessage(msg, {
    setIsReceivingBellAlert: ctx.setIsReceivingBellAlert || (() => {}),
    setIsPeerSirenRinging: ctx.setIsPeerSirenRinging || (() => {}),
    getSettings: ctx.getSettings,
  })) {
    return true;
  }

  // 7. رسائل شبكة ونقاط مراقبة ألعاب القوى
  if (
    msg.type === 'ATHLETICS_PASSAGE_BATCH' ||
    msg.type === 'ATHLETICS_CORRECTION' ||
    msg.type === 'ATHLETICS_JUDGE_HEARTBEAT' ||
    msg.type === 'ATHLETICS_COMPETITION_SYNC' ||
    msg.type === 'ATHLETICS_VIOLATION'
  ) {
    passageSyncEngine.handleIncomingMessage(msg);
    return true;
  }

  return false;
}
