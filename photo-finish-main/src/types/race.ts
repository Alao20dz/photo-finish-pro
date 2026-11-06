import type { 
  PassageEvent, 
  PassageCorrection, 
  AthleticsJudge, 
  AthleticsCompetition, 
  CourseViolation 
} from './athletics';

export type GunSoundType = 'official_starter_gun'; // صوت طلقة مسدس الانطلاق الاحترافي الموحد (Web Audio API)

export type StarterMode = 'auto_random' | 'manual';

/**
 * هندسة وضعية كاميرا خط النهاية (Camera Placement Geometry)
 * تلعب دوراً حاسماً في دقة التوقيت: أي ميلان عن امتداد خط النهاية يولّد خطأ منظور (Parallax)
 * يجعل الأروقة تُسجّل في لحظات مختلفة رغم وصولها معاً على أرض الواقع — ولا يمكن لأي خوارزمية تصحيحه لاحقاً.
 */
export type CameraPlacementMode =
  | 'tele_parallel'   // موازية لخط النهاية من الخلف + تكبير (الوضع الأولمبي المعتمد — الأدق)
  | 'angled_behind'   // خلفية بزاوية خفيفة (حل وسط عند محدودية المساحة)
  | 'side_classic';   // جانبية كلاسيكية من الجانب (الأسلوب التقليدي — خطأ منظور مرتفع)

export interface Runner {
  id: number;
  bib: number;           // رقم الصدرية (Dossard)
  name: string;          // الاسم واللقب
  birthDate?: string;    // تاريخ الميلاد (Date de Naissance)
  country: string;       // الدولة / النادي
  club?: string;         // النادي الرياضي
  wilaya?: string;       // الولاية / الرابطة
  lane: number;          // رقم الرواق في المضمار (1 إلى 8)
  color: string;
  finishTime: number;    // التوقيت بالمللي ثانية (0 إذا لم ينته بعد)
  reactionTime?: number;
  rank?: number;         // الترتيب: 1 للأول، 2 للثاني...
  status: 'OK' | 'DNF' | 'DQ' | 'DNS'; // OK: عادي، DNF: لم يكمل، DQ: إقصاء، DNS: لم يبدأ
  avatar?: string;
  crossingSnapshot?: string; // لقطة الحساس الدقيقة عند قطع خط النهاية من كاميرا هاتف 2
  notes?: string;        // ملاحظات الحكم العام
}

// الأدوار الرسمية للنظام: هاتف البداية، هاتف الكاميرا، هاتف التحكيم، غرفة النداء، حكم نقطة المراقبة، وإدارة ألعاب القوى
export type PhoneRole = 'start' | 'finish' | 'judge' | 'chambre_dappel' | 'checkpoint_judge' | 'athletics_manager' | null;

export type RaceStatus = 
  | 'idle'
  | 'waiting'
  | 'on_marks'
  | 'set'
  | 'racing'
  | 'finished'
  | 'false_start';

export type RaceDistance = string;

// نموذج السلسلة أو القائمة (Heat / Series) في السباق
export interface Heat {
  id: string;
  number: number;        // رقم القائمة / السلسلة (قائمة 1، قائمة 2...)
  name: string;          // اسم القائمة (مثلاً: 800m Série 1، 800m Série 2، النهائي)
  distance: RaceDistance;
  windSpeed: string;
  runners: Runner[];
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: number;
  order?: number;        // ترتيب القائمة في جدول السباقات
  scheduledTime?: string;// التوقيت المجدول للسباق (مثلاً 16:30)
  isDispatched?: boolean;// تم إرسال أمر Au Départ من هاتف البداية
  dispatchedAt?: number; // وقت الإرسال إلى خط الانطلاق
  fullPhotoFinishUrl?: string; // شريط المسح البانورامي المستمر الحقيقي للسباق (Slit-Scan)
}

export interface RaceSettings {
  distance: RaceDistance;
  availableDistances: string[];  // قائمة المسافات المتاحة
  heatNumber: number;            // رقم القائمة الحالية (1، 2، 3...)
  heatName: string;              // اسم القائمة الحالية (تصفية 1، النهائي...)
  laneCount: number;             // عدد الأروقة (2، 4، 6، 8)
  finishLineXPercent: number;    // موقع خط النهاية الرسمي (مثلاً 35%)
  finishLineColor: string;       // لون خط النهاية
  finishLineWidth: number;       // سُمك خط النهاية
  preFinishLineXPercent?: number;  // موقع خط ما قبل النهاية (بدء التصوير التلقائي)
  preFinishLineColor?: string;     // لون خط ما قبل النهاية
  postFinishLineXPercent?: number; // موقع خط ما بعد النهاية (انتهاء التصوير)
  postFinishLineColor?: string;    // لون خط ما بعد النهاية
  motionThreshold: number;       // حساسية حساس خط النهاية
  laserBeamVisible: boolean;     // إظهار شعاع الحساس الضوئي
  gunSoundType: GunSoundType;    // نوع صوت طلقة الانطلاق
  soundVolume: number;           // مستوى الصوت
  soundPitch: number;            // حدة وسرعة الصوت
  stadiumAcoustics: boolean;     // تفعيل صدى وهندسة صوت الملعب
  stadiumReverbLevel: number;    // مستوى صدى مدرجات الملعب
  stadiumAmbience: boolean;      // أجواء وضوضاء مضمار الملعب
  hapticFeedback: boolean;       // اهتزاز الهاتف
  starterMode: StarterMode;      // نمط زر الانطلاق
  autoDelayDuration: number;     // مدة التأخير العشوائي بعد استعد
  slitScanWidth: number;         // عرض شريحة المسح الشريطي
  windSpeed: string;             // سرعة الرياح الرسمية (+1.2 m/s)
  autoStopAfterLastRunner: boolean;
  cameraPlacement?: CameraPlacementMode; // هندسة وضعية كاميرا خط النهاية (اختياري للتوافق مع الإعدادات المحفوظة سابقاً)
}


export interface LaneMotionState {
  lane: number;
  motionScore: number;
  isTriggered: boolean;
  hasFinished: boolean;
  finishTime?: number;
}

// ═══ منظومة التراخيص الشبكية 1*4 ونقل التفعيل المشفر ═══
export type LicenseTierCode = 'CLB8' | 'ENTX';

export interface LicensePoolInfo {
  hostDeviceId: string;
  hostRole: PhoneRole;
  licenseCode: string;
  tier: LicenseTierCode;
  tierName: string;
  expiryDate: string;
  maxSharedSlots: number; // 4 هواتف (1*4)
  activeMembers: { role: PhoneRole; deviceId: string }[];
  isShared: boolean;
  timestamp: number;
}

export interface LicenseTransferTicket {
  ticketId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  tier: LicenseTierCode;
  tierName: string;
  originalCode: string;
  voucherCode: string;
  expiryDate: string;
  remainingDays: number;
  signature: string;
  revocationProof: string;
  timestamp: number;
}

// ═══════════════════════════════════════════════════
// حمولات الرسائل الشبكية الصارمة (Strict Network Message Payloads)
// ═══════════════════════════════════════════════════

export interface StartGunPayload {
  startTime?: number;
  soundVolume?: number;
  soundPitch?: number;
  heatId?: string;
  gunType?: string;
  perfNow?: number;
  soundType?: string;
  [key: string]: any;
}

export interface RecallGunPayload {
  reason?: string;
  heatId?: string;
  [key: string]: any;
}

export interface ClockTickPayload {
  clockTimeMs: number;
  isRunning: boolean;
  [key: string]: any;
}

export interface LaneFinishPayload {
  lane: number;
  timeMs: number;
  rank?: number;
  bib?: number;
  snapshotUrl?: string;
  [key: string]: any;
}

export interface RaceCompletePayload {
  runners?: Runner[];
  fullPhotoFinishUrl?: string;
  heatId?: string;
  completedAt?: number;
  [key: string]: any;
}

export interface SettingsSyncPayload {
  settings?: RaceSettings;
  runners?: Runner[];
  heats?: Heat[];
  heatIndex?: number;
  [key: string]: any;
}

export interface JudgeUpdateRunnerPayload {
  lane: number;
  updates: Partial<Runner>;
  [key: string]: any;
}

export interface HeatChangePayload {
  heatIndex: number;
  heat?: Heat;
  [key: string]: any;
}

export interface HeatDispatchPayload {
  heatId: string;
  heatIndex?: number;
  heat?: Heat;
  [key: string]: any;
}

export interface HeatCancelDispatchPayload {
  heatId?: string;
  [key: string]: any;
}

export interface HeatsSyncPayload {
  heats: Heat[];
  [key: string]: any;
}

export interface HeatsReorderPayload {
  heats: Heat[];
  [key: string]: any;
}

export interface DeleteHeatPayload {
  heatId: string;
  [key: string]: any;
}

export interface SlitScanImagePayload {
  fullPhotoFinishUrl: string;
  [key: string]: any;
}

export interface RequestStateSyncPayload {
  fromRole?: PhoneRole;
  peerId?: string;
  [key: string]: any;
}

export interface ResponseStateSyncPayload {
  settings?: RaceSettings;
  runners?: Runner[];
  raceStatus?: RaceStatus;
  clockTimeMs?: number;
  heats?: Heat[];
  currentHeatIndex?: number;
  fromRole?: PhoneRole;
  [key: string]: any;
}

export interface LicenseTransferAckPayload {
  ticketId: string;
  status: 'accepted' | 'rejected';
  [key: string]: any;
}

export interface AthleticsPassageBatchPayload {
  events: PassageEvent[];
  senderDeviceId?: string;
  judge?: AthleticsJudge | null;
  [key: string]: any;
}

export interface AthleticsCorrectionPayload {
  correction: PassageCorrection;
  [key: string]: any;
}

export interface AthleticsJudgeHeartbeatPayload {
  judge: AthleticsJudge;
  deviceId?: string;
  time?: number;
  timestamp?: number;
  [key: string]: any;
}

export interface AthleticsCompetitionSyncPayload {
  competition: AthleticsCompetition;
  [key: string]: any;
}

export interface AthleticsViolationPayload {
  violation: CourseViolation;
  [key: string]: any;
}

export interface NetworkMessagePayloadMap {
  SYNC_PING: { pingId?: string; clientTime?: number; [key: string]: any } | undefined;
  SYNC_PONG: { originalSenderTime?: any; clientTime?: number; serverTime?: number; [key: string]: any } | undefined;
  ON_MARKS: { heatId?: string; [key: string]: any } | undefined;
  SET: { heatId?: string; [key: string]: any } | undefined;
  START_GUN: StartGunPayload | undefined;
  RECALL_GUN: RecallGunPayload | undefined;
  CLOCK_TICK: ClockTickPayload | undefined;
  LANE_FINISH: LaneFinishPayload;
  RACE_COMPLETE: RaceCompletePayload | undefined;
  SYNC_RESET_ALL: { heatId?: string; [key: string]: any } | undefined;
  SETTINGS_SYNC: SettingsSyncPayload;
  BELL_SIGNAL_START: { sender?: string; [key: string]: any } | undefined;
  BELL_SIGNAL_STOP: { sender?: string; [key: string]: any } | undefined;
  BELL_SIGNAL_ACK: { sender?: string; [key: string]: any } | undefined;
  JUDGE_UPDATE_RUNNER: JudgeUpdateRunnerPayload;
  HEAT_CHANGE: HeatChangePayload;
  HEAT_DISPATCH: HeatDispatchPayload;
  HEAT_CANCEL_DISPATCH: HeatCancelDispatchPayload | undefined;
  HEATS_SYNC: HeatsSyncPayload;
  HEATS_REORDER: HeatsReorderPayload;
  DELETE_HEAT: DeleteHeatPayload;
  SLIT_SCAN_IMAGE: SlitScanImagePayload;
  REQUEST_STATE_SYNC: RequestStateSyncPayload | undefined;
  RESPONSE_STATE_SYNC: ResponseStateSyncPayload;
  LICENSE_SHARE_POOL: LicensePoolInfo;
  LICENSE_REVOKE_AND_TRANSFER: LicenseTransferTicket;
  LICENSE_TRANSFER_ACK: LicenseTransferAckPayload;
  ATHLETICS_PASSAGE_BATCH: AthleticsPassageBatchPayload;
  ATHLETICS_CORRECTION: AthleticsCorrectionPayload;
  ATHLETICS_JUDGE_HEARTBEAT: AthleticsJudgeHeartbeatPayload;
  ATHLETICS_COMPETITION_SYNC: AthleticsCompetitionSyncPayload;
  ATHLETICS_VIOLATION: AthleticsViolationPayload;
}

export type NetworkMessageType = keyof NetworkMessagePayloadMap;

export type TypedNetworkPeerMessage<K extends NetworkMessageType = NetworkMessageType> = K extends any ? {
  type: K;
  timestamp: number;
  senderTime: number;
  perfNow?: number;
  payload?: NetworkMessagePayloadMap[K];
} : never;

/**
 * رسالة الشبكة المشتركة (Strict Discriminated Union)
 * تضمن تعيين وتدقيق نوع الحمولة (Payload) حسب نوع الرسالة (Type)
 */
export type NetworkPeerMessage = TypedNetworkPeerMessage;

