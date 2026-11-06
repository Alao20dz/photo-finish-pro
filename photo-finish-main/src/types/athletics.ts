/**
 * PHOTO FINISH PRO – Complete Athletics Management System
 * تعريفات ونماذج البيانات لمنظومة المنافسات ونقاط المراقبة والحكام
 * 
 * المبادئ الحاكمة:
 * 1. الحفاظ على التوافق التام مع types/race.ts دون كسر.
 * 2. دعم كافة أنواع ألعاب القوى (العدو الريفي، سباقات الطريق، المضمار، والميدان).
 * 3. أحداث المرور غير قابلة للحذف وتتضمن مسار تدقيق رسمي (Audit Trail).
 */

export type AthleticsCompetitionType = 
  | 'cross_country'   // العدو الريفي (حلقات ومسارات طبيعية)
  | 'road_race'       // سباقات الطريق (10km، نصف ماراثون، ماراثون)
  | 'track_race'      // سباقات المضمار (السرعة، الحواجز، المسافات المتوسطة والطويلة)
  | 'race_walking'    // المشي الرياضي
  | 'field_event'     // مسابقات الميدان (الوثب والرمي)
  | 'combined_event'; // السباعي والعشاري

export type AgeCategory = 
  | 'U14'     // براعم
  | 'U16'     // أصاغر
  | 'U18'     // أشبال
  | 'U20'     // أواسط
  | 'SENIOR'  // أكابر
  | 'MASTER'  // قدماء
  | 'OPEN';   // مفتوح

export type GenderCategory = 'M' | 'F' | 'MIXED';

export type CheckpointType = 
  | 'start'          // خط الانطلاق
  | 'intermediate'   // نقطة مراقبة بينية عادية
  | 'turnaround'     // نقطة التفاف (U-Turn)
  | 'split'          // نقطة قياس زمن جزئي (Split Timing)
  | 'finish';        // خط النهاية

export interface Checkpoint {
  id: string;               // معرف فريد للنقطة (مثل cp_01_a9f)
  code: string;             // رمز النقطة المختصر (START, CP01, CP02, FINISH)
  name: string;             // الاسم التوضيحي (مثلاً: نقطة جسر الوادي، منعرج الصنوبر)
  distanceKm: number;       // المسافة بالكيلومتر من خط البداية (مثلاً 2.5 كم)
  type: CheckpointType;
  requiredLaps: number[];   // أرقام الحلقات التي يجب تسجيل المرور فيها (مثلاً [1, 2, 3, 4])
  order: number;            // ترتيب النقطة التسلسلي في المسار (0, 1, 2...)
  latitude?: number;        // الإحداثيات الجغرافية (اختياري للخرائط)
  longitude?: number;
  assignedJudgeIds: string[]; // معرفات الحكام المعينين في هذه النقطة
  expectedPassageCount?: number;
}

export interface AthleticsCompetition {
  id: string;               // UUID فريد
  name: string;             // اسم المنافسة (مثلاً: البطولة الجهوية للعدو الريفي - أكابر رجال)
  type: AthleticsCompetitionType;
  venue: string;            // مكان السباق (الملعب / المنتزه / الغابة)
  date: string;             // تاريخ المنافسة
  distanceKm: number;       // المسافة الإجمالية بالكيلومتر
  lapCount: number;         // عدد الحلقات (مثلاً 4 حلقات في سباق 8 كم)
  category: AgeCategory;
  gender: GenderCategory;
  checkpoints: Checkpoint[]; // قائمة نقاط المراقبة المرتبة
  scheduledStartTime?: string; // وقت الانطلاق المجدول (مثلاً "09:30")
  actualStartTime?: number;    // توقيت البداية الفعلي بالمللي ثانية (Date.now())
  status: 'draft' | 'ready' | 'in_progress' | 'completed' | 'official';
  runners?: { id: string; bibNumber: number; name: string; club?: string; startTime?: number }[];
  chiefJudgeId?: string;
  chiefJudgeName?: string;
  isOfficial?: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type JudgeRole = 
  | 'chief_judge'        // الحكم العام / الحكم الرئيسي (اعتماد النتائج ومراجعة التقارير)
  | 'checkpoint_judge'   // حكم نقطة مراقبة (تسجيل المرور)
  | 'course_marshal'     // مراقب مسار (رصد المخالفات)
  | 'finish_judge'       // حكم خط النهاية
  | 'results_secretary'; // مسؤول أمانة النتائج والإحصاء

export interface AthleticsJudge {
  id: string;                  // UUID فريد للحكم
  name: string;                // اسم الحكم الكامل
  phone?: string;              // رقم الهاتف
  pinCode: string;             // رمز PIN سريع للدخول (4 أرقام)
  role: JudgeRole;
  assignedCheckpointId?: string; // النقطة المخصصة حالياً
  assignedCompetitionId?: string;// المنافسة المخصصة
  deviceId?: string;           // معرف الجهاز المتصل
  isOnline?: boolean;
  lastSeen?: number;
  latencyMs?: number;
}

export type PassageSource = 
  | 'quick_button'   // ضغط سريع على لوحة الأرقام (Rapid Pad)
  | 'qr_scan'        // مسح باركود الصدرية بالكاميرا
  | 'nfc'            // بطاقة NFC
  | 'manual_entry';  // إدخال يدوي تدقيقي

export interface PassageEvent {
  id: string;               // UUID فريد عالمياً لمنع التكرار (Idempotency)
  competitionId: string;
  checkpointId: string;
  checkpointCode: string;   // للتسهيل والعرض السريع (CP01, FINISH...)
  lapNumber: number;        // رقم الحلقة الحالية للعداء (1, 2...)
  bibNumber: number;        // رقم الصدرية (Dossard)
  athleteName?: string;     // اسم العداء إن وجد
  club?: string;            // نادي العداء
  timestamp: number;        // توقيت التسجيل الحقيقي (Date.now())
  perfNow?: number;         // توقيت دقيق أحادي الاتجاه (performance.now())
  elapsedTimeMs?: number;   // الزمن المنقضي منذ انطلاق السباق
  recordedByJudgeId: string;// معرف الحكم الذي سجل الحدث
  judgeId?: string;         // معرّف الحكم المساعد
  runnerId?: string;        // معرّف العداء
  judgeName?: string;
  clubName?: string;        // اسم النادي
  deviceId: string;         // معرف الجهاز
  source: PassageSource;
  syncStatus: 'pending' | 'synced' | 'conflict';
  syncedAt?: number;
  isFlagged?: boolean;      // هل هناك تنبيه أو اشتباه (مثلاً تخطي نقطة سابقة)
  flagReason?: string;
  isDeleted?: boolean;      // هل تم إهمال أو حذف السجل
}

export interface PassageCorrection {
  id: string;               // UUID
  passageEventId: string;   // معرف الحدث الأصلي
  originalBibNumber: number;
  correctedBibNumber: number;
  reason: string;           // سبب التصحيح (خطأ إبصار، تصحيح من الحكم المساعد...)
  requestedByJudgeId: string;
  requestedByName: string;
  requestedAt: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewedByJudgeId?: string;
  reviewedByName?: string;
  reviewedAt?: number;
  reviewNote?: string;
}

export interface CourseViolation {
  id: string;
  competitionId: string;
  bibNumber: number;
  checkpointId?: string;
  reportedByJudgeId: string;
  judgeName: string;
  violationType: 'course_cutting' | 'unsporting' | 'illegal_assistance' | 'missed_checkpoint';
  description: string;
  reportedAt: number;
  status: 'pending' | 'confirmed' | 'dismissed';
  penaltyApplied?: 'warning' | 'time_penalty' | 'disqualification';
  penaltySeconds?: number;
  decidedByJudgeId?: string;
  decidedAt?: number;
}

export interface RunnerLiveRanking {
  bibNumber: number;
  athleteName: string;
  club?: string;
  category?: AgeCategory;
  lapsCompleted: number;
  lastCheckpointCode: string;
  lastCheckpointDistanceKm: number;
  lastPassageTime: number;
  totalElapsedTimeMs: number;
  rank: number;
  gapToLeaderMs: number;
  status: 'active' | 'finished' | 'dnf' | 'dq';
  hasAnomaly: boolean;
  anomalyReason?: string;
  passages: PassageEvent[];
}

// ═══════════════════════════════════════════════════
// منظومة السجلات الرياضية والأرقام القياسية (PB / SB)
// ═══════════════════════════════════════════════════

export interface PersonalRecord {
  eventCode: string;           // كود الاختصاص (100m, 800m, cross_country, long_jump...)
  eventName: string;           // اسم الاختصاص (100 متر، 800 متر...)
  recordValue: string;         // النتيجة النصية (مثلاً 10.12s أو 1:44.25 أو 8.25m)
  numericValueMsOrCm: number;  // القيمة الرقمية للمقارنة والفرز
  date: string;                // تاريخ تحقيق الرقم YYYY-MM-DD
  venue?: string;              // مكان البطولة / الملعب
  wind?: string;               // سرعة الرياح
}

// ═══════════════════════════════════════════════════
// الملف الرياضي الموحد للعداء (Unified Athlete Profile)
// ═══════════════════════════════════════════════════

export interface Athlete {
  id: string;                  // معرف فريد UUID
  bibNumber?: number;          // رقم الصدرية الافتراضي (Dossard)
  licenseNumber: string;       // رقم رخصة الاتحاد الوطني (e.g. DZ-2026-10492)
  firstName: string;           // الاسم
  lastName: string;            // اللقب
  arabicName?: string;         // الاسم واللقب بالعربية
  birthDate: string;           // تاريخ الميلاد YYYY-MM-DD
  gender: 'M' | 'F';           // الجنس
  nationality: string;         // الدولة / الجنسية
  clubId?: string;             // معرف النادي المنتمي إليه
  clubName?: string;           // اسم النادي
  wilaya?: string;             // الولاية أو الرابطة الجهوية
  primaryDiscipline: string;   // الاختصاص الأساسي (sprints, middle_distance, long_distance, jumps, throws)
  eligibleEvents: string[];    // قائمة المسابقات المصرح له بالمشاركة فيها
  personalBests: PersonalRecord[];  // الأرقام القياسية الشخصية (Personal Bests)
  seasonBests: PersonalRecord[];    // أفضل أرقام الموسم الحالي (Season Bests)
  medicalClearance: boolean;   // شهادة الكفاءة الطبية سارية
  medicalClearanceExpiry?: string;  // تاريخ نهاية صلاحية الفحص الطبي
  status: 'active' | 'suspended' | 'retired';
  photoUrl?: string;           // صورة العداء
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// ═══════════════════════════════════════════════════
// بطاقة النادي الرياضي (Athletics Club)
// ═══════════════════════════════════════════════════

export interface Club {
  id: string;                  // معرف فريد UUID
  code: string;                // رمز النادي (MCA, GSP, CRB, ASSN...)
  name: string;                // اسم النادي الرسمي (مثلاً: نادي مولودية الجزائر لألعاب القوى)
  shortName?: string;          // الاسم المختصر
  wilaya: string;              // الولاية / المنطقة
  city?: string;
  foundedYear?: number;        // سنة التأسيس
  presidentName?: string;      // رئيس النادي
  headCoachName?: string;      // المدرب الرئيسي
  phone?: string;
  email?: string;
  logoUrl?: string;
  colors: string[];            // ألوان النادي الرسمية (HEX codes)
  activeAthletesCount?: number;
  medalsTally: {
    gold: number;
    silver: number;
    bronze: number;
    total: number;
  };
  createdAt: number;
  updatedAt: number;
}

// ═══════════════════════════════════════════════════
// لقطة الفئات العمرية الثابتة (Category Snapshot)
// تجميد القواعد وأعمار المتسابقين لضمان عدم تأثر السجلات التاريخية
// ═══════════════════════════════════════════════════

export interface CategoryRule {
  category: AgeCategory;
  nameAr: string;
  minAge: number;
  maxAge: number;
  birthYearRange: { from: number; to: number };
}

export interface CategorySnapshot {
  competitionId: string;
  referenceYear: number;
  frozenAt: number;
  rules: CategoryRule[];
  athleteSnapshots: {
    athleteId: string;
    birthDate: string;
    calculatedCategory: AgeCategory;
    ageAtCompetition: number;
  }[];
}

// ═══════════════════════════════════════════════════
// نموذج كشف تكرار تسجيل العدائين (Deduplication Match)
// ═══════════════════════════════════════════════════

export interface AthleteDuplicateMatch {
  existingAthlete: Athlete;
  matchType: 'exact_license' | 'name_and_birthyear' | 'fuzzy_name' | 'same_bib_in_club';
  similarityScore: number;     // من 0.0 إلى 1.0 (1.0 = تطابق تام)
  conflictDetails: string;     // تفاصيل الاشتباه
  recommendedAction: 'block' | 'warn' | 'merge_suggestion';
}

// ═══════════════════════════════════════════════════
// المرحلة C2: بوابة المدربين ومسار الموافقات الإداري
// ═══════════════════════════════════════════════════

export interface Coach {
  id: string;                  // UUID فريد
  clubId: string;              // معرف النادي المنتمي إليه حصراً (عزل كامل)
  clubName: string;            // اسم النادي
  name: string;                // اسم المدرب الكامل
  pinCode: string;             // رمز المرور السريع للدخول الميداني (4 إلى 6 أرقام)
  phone?: string;              // رقم الهاتف
  email?: string;              // البريد الإلكتروني
  licenseNumber: string;       // رقم رخصة التدريب الاتحادية
  role: 'head_coach' | 'assistant_coach' | 'club_admin';
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export type RegistrationStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface CompetitionRegistration {
  id: string;                  // معرف فريد للطلب UUID
  competitionId: string;       // معرف المنافسة
  competitionName: string;     // اسم المنافسة
  clubId: string;              // معرف النادي
  clubName: string;            // اسم النادي
  coachId: string;             // معرف المدرب مقدم الطلب
  coachName: string;           // اسم المدرب
  athleteId: string;           // معرف العداء
  athleteName: string;         // اسم العداء
  licenseNumber: string;       // رقم رخصة العداء
  birthDate: string;           // تاريخ الميلاد
  calculatedCategory: AgeCategory; // الفئة المحسوبة
  targetEvents: string[];      // السباقات المرشح لها (e.g. ['100m', '200m'] أو ['cross_country'])
  medicalClearanceValid: boolean; // هل شهادة الكفاءة الطبية سارية
  status: RegistrationStatus;  // حالة الطلب
  bibAssigned?: number;        // رقم الصدرية المخصص عند الاعتماد
  rejectionReason?: string;    // سبب الرفض إن وجد
  submittedAt?: number;        // وقت تقديم الطلب
  reviewedAt?: number;         // وقت المراجعة والاعتماد
  reviewedByJudgeId?: string;  // معرف الحكم / المدير الفني المعتمد
  reviewedByName?: string;     // اسم المدير الفني
  notes?: string;              // ملاحظات
  createdAt: number;
  updatedAt: number;
}

export interface RegistrationAuditEntry {
  id: string;
  registrationId: string;
  action: 'submit' | 'approve' | 'reject' | 'bib_assign' | 'edit';
  performedById: string;
  performedByName: string;
  role: string;
  timestamp: number;
  details: string;
}

// ═══════════════════════════════════════════════════
// المرحلة C3: المسابقات والاختصاصات والمسابقات الميدانية (Field Events)
// ═══════════════════════════════════════════════════

export type FieldEventType = 
  | 'long_jump'       // الوثب الطويل
  | 'triple_jump'     // الوثب الثلاثي
  | 'high_jump'       // الوثب العالي
  | 'pole_vault'      // القفز بالزانة
  | 'shot_put'        // رمي الجلة
  | 'discus_throw'    // رمي القرص
  | 'javelin_throw'   // رمي الرمح
  | 'hammer_throw';   // رمي المطرقة

export type FieldAttemptResult = 'valid' | 'foul' | 'pass' | 'no_mark';

export interface FieldAttempt {
  attemptNumber: number;          // رقم المحاولة (1 إلى 6)
  resultType: FieldAttemptResult; // صالح (valid)، خطأ (X - foul)، تنازل (P - pass)، بدون رقم (-)
  measurementMeters: number;      // القياس بالأمتار (مثلاً 8.25 أو 18.42 أو 0 للخطأ)
  wind?: number;                  // سرعة الرياح بالـ m/s (للوثب الطويل والثلاثي)
  timestamp: number;              // توقيت المحاولة
  judgeId?: string;               // معرف الحكم الراصد
}

export interface VerticalHeightTrial {
  heightMeters: number;           // الارتفاع (مثلاً 2.15م أو 5.60م)
  trials: ('O' | 'X' | '-' | 'r')[]; // O=نجاح، X=فشل، -=تنازل، r=انسحاب
  cleared: boolean;               // هل تم اجتياز هذا الارتفاع
  attemptsCount: number;          // عدد المحاولات المستهلكة في هذا الارتفاع
}

export interface FieldAthleteScore {
  athleteId: string;
  athleteName: string;
  bibNumber: number;
  clubName: string;
  order: number;                  // ترتيب القفز أو الرمي في الفوج (Flight Order)
  attempts: FieldAttempt[];       // مسابقات المسافة (الوثب الأفقي والرمي: حتى 6 محاولات)
  verticalTrials?: VerticalHeightTrial[]; // مسابقات الارتفاع (الوثب العالي والزانة)
  bestValidMeasurement: number;   // أفضل رقم معتمد
  secondBestMeasurement: number;  // ثاني أفضل رقم (لكسر التعادل في الرمي والوثب الأفقي)
  rank: number;                   // الترتيب الحالي
  status: 'active' | 'qualified' | 'eliminated' | 'dns' | 'nm';
}

export interface FieldEventCompetition {
  id: string;                     // UUID فريد
  competitionId: string;          // المسابقة الأم
  name: string;                   // اسم الاختصاص (مثلاً: نهائي الوثب الطويل - أكابر رجال)
  discipline: FieldEventType;     // نوع المسابقة
  gender: GenderCategory;
  category: AgeCategory;
  venue: string;                  // الملعب / القطاع الميداني
  date: string;
  scheduledTime?: string;
  totalAttemptsAllowed: 3 | 6;    // 3 محاولات تصفيات أو 6 محاولات نهائي
  athletes: FieldAthleteScore[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'official';
  chiefJudgeId?: string;
  chiefJudgeName?: string;
  officialNotes?: string;
  createdAt: number;
  updatedAt: number;
}

// ══════════════════════════════════════════════════════════════
// نماذج مصمم المسارات والخرائط المحلية وحزم الباركود المؤمنة (Stage C4)
// ══════════════════════════════════════════════════════════════

export type CourseWaypointType = 
  | 'start'          // خط الانطلاق
  | 'finish'         // خط النهاية
  | 'checkpoint'     // نقطة مراقبة وتوقيت
  | 'turn'           // منعطف حاد
  | 'aid_station'    // نقطة إمداد وإسعاف
  | 'hazard'         // منطقة وعرة / خطر
  | 'track_point';   // نقطة مسار عامة

export interface CourseWaypoint {
  id: string;
  index: number;
  lat: number;
  lng: number;
  elevation?: number;
  name?: string;
  type: CourseWaypointType;
  distanceFromStartMeters: number;
  checkpointId?: string;
}

export interface ElevationPoint {
  distanceMeters: number;
  elevationMeters: number;
}

export interface Course {
  id: string;
  competitionId: string;
  name: string;
  discipline: AthleticsCompetitionType;
  totalDistanceMeters: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  lapCount: number;
  waypoints: CourseWaypoint[];
  elevationProfile: ElevationPoint[];
  checkpoints: Checkpoint[];
  geoJsonData?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OfflineMapPack {
  id: string;
  courseId: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zoomLevels: number[];
  tileCount: number;
  dataSize: number;
  status: 'ready' | 'downloading' | 'failed';
  createdAt: number;
}

export interface SecuredQrPack {
  id: string;
  competitionId: string;
  checkpointId: string;
  checkpointCode: string;
  checkpointName: string;
  token: string;
  encryptedPayload: string;
  issuedAt: number;
  expiresAt: number;
  signature: string;
}

// ══════════════════════════════════════════════════════════════
// نماذج دمج تحكيم متعدد الهواتف وكشف شذوذ السباق (Stage C5)
// ══════════════════════════════════════════════════════════════

export type RaceAnomalyType = 
  | 'skipped_checkpoint'   // تخطي نقطة مراقبة إجبارية
  | 'speed_anomaly'        // سرعة قياسية غير بشرية (اشتباه قطع مسار أو وسيلة نقل)
  | 'reverse_traversal'    // سير عكس اتجاه المسار
  | 'rapid_duplicate'      // نقر مكرر سريع بالخطأ
  | 'unregistered_bib';    // رقم صدر غير مسجل

export type RaceAnomalySeverity = 'warning' | 'error' | 'critical';

export interface MergedPassage {
  id: string;
  competitionId: string;
  bibNumber: number;
  athleteName?: string;
  clubName?: string;
  checkpointId: string;
  checkpointCode: string;
  lapNumber: number;
  officialTimestamp: number;
  originalTimestamps: { judgeId: string; timestamp: number }[];
  corroboratingJudges: string[];
  confidenceScore: number; // نسبة موثوقية من 0.0 إلى 1.0
  status: 'valid' | 'suspicious' | 'disqualified' | 'overridden';
  anomalyReason?: string;
  manualOverrideNote?: string;
}

export interface RaceAnomaly {
  id: string;
  competitionId: string;
  type: RaceAnomalyType;
  bibNumber: number;
  checkpointId: string;
  checkpointCode: string;
  lapNumber: number;
  timestamp: number;
  severity: RaceAnomalySeverity;
  details: string;
  calculatedSpeedKmh?: number;
  expectedCheckpointCode?: string;
  resolved: boolean;
  resolutionNote?: string;
  createdAt: number;
}

export interface MergeEngineConfig {
  mergeWindowMs: number;       // نافذة دمج تسجيلات الحكام للنفس المرور (افتراضياً 3000ms)
  maxHumanSpeedKmh: number;    // أقصى سرعة بشرية مقبولة بالسباق (افتراضياً 28 كم/سا)
  debounceTapWindowMs: number; // نافذة إهمال النقرات المزدوجة العرضية (افتراضياً 1500ms)
  minTimeBetweenLapsMs: number;// أقل وقت ممكن لاجتياز حلقة كاملة (افتراضياً 90000ms)
}

// ══════════════════════════════════════════════════════════════
// نماذج محرك النتائج الرسمية وغرفة الحكم الرئيسي والطعون (Stage C6)
// ══════════════════════════════════════════════════════════════

export type CompetitionResultStatus = 
  | 'provisional'    // مؤقت (قيد المراجعة الميدانية)
  | 'under_review'   // معلق لوجود طعن أو شبهة
  | 'official'       // معتمد ورسمي (مغلق)
  | 'certified';     // مصدق نهائياً وموقع من الحكم العام

export interface RaceResultEntry {
  rank: number;
  bibNumber: number;
  athleteName: string;
  clubName: string;
  category: AgeCategory;
  gender: GenderCategory;
  gunTimeMs: number;           // زمن طلقة البداية (Gun Time)
  netTimeMs: number;           // زمن العبور الفعلي (Net / Chip Time)
  formattedGunTime: string;    // HH:MM:SS.mmm
  formattedNetTime: string;
  gapMs: number;               // الفارق الزمني عن المتصدر
  formattedGap: string;        // +00:14.2
  completedLaps: number;
  status: 'finished' | 'dnf' | 'dns' | 'dq';
  disqualificationReason?: string;
  isLocked: boolean;
}

export interface JudgeTelemetry {
  judgeId: string;
  judgeName: string;
  role: string;
  checkpointId: string;
  checkpointCode: string;
  deviceId: string;
  batteryPercent?: number;
  isOnline: boolean;
  lastHeartbeat: number;
  latencyMs: number;
  passagesRecordedCount: number;
}

export interface ProtestAppeal {
  id: string;
  competitionId: string;
  bibNumber: number;
  clubName: string;
  filedByName: string;
  filedAt: number;
  feeDeposited: boolean;       // دفع رسوم الطعن الرسمية (World Athletics Rule 8)
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  decisionNote?: string;
  decidedByChiefJudgeId?: string;
  decidedAt?: number;
}

export interface ChiefJudgeLockAudit {
  id: string;
  competitionId: string;
  action: 'lock' | 'unlock' | 'override' | 'certify';
  chiefJudgeId: string;
  chiefJudgeName: string;
  timestamp: number;
  reason: string;
}

// ══════════════════════════════════════════════════════════════
// نماذج ترتيب الأندية وحساب نقاط الفرق والتصدير (Stage C7)
// ══════════════════════════════════════════════════════════════

export interface TeamScoringRunner {
  bibNumber: number;
  athleteName: string;
  individualRank: number;
  timeMs: number;
  formattedTime: string;
  isScorer: boolean; // هل يدخل ضمن أفضل N عدائين مسجلين للنقاط
}

export interface ClubTeamScore {
  rank: number;
  clubId?: string;
  clubName: string;
  clubCode?: string;
  totalPoints: number;        // مجموع رتب أفضل N عدائين (الأقل نقاطاً يفوز - WA Rule 19)
  scoringCount: number;       // عدد العدائين المحتسبين (مثلاً 3 أو 4)
  runners: TeamScoringRunner[];
  lastScorerRank: number;     // رتبة العداء الأخير المحتسب لكسر التعادل
  status: 'qualified' | 'incomplete';
}

export interface ClubMedalTally {
  rank: number;
  clubName: string;
  gold: number;
  silver: number;
  bronze: number;
  totalMedals: number;
  trophyPoints: number;       // نقاط درع البطولة العام
}

export type ExportFormat = 'pdf' | 'csv' | 'json';

// ══════════════════════════════════════════════════════════════
// نماذج المساعد الذكي للسباقات والتحليل التكتيكي (Stage C8)
// ══════════════════════════════════════════════════════════════

export interface PacingProfile {
  bibNumber: number;
  athleteName: string;
  pacingStyle: 'negative_split' | 'positive_split' | 'even_pace' | 'irregular';
  averagePaceMinKm: string;
  fastestSplitKm: number;
  slowestSplitKm: number;
  paceVariationPercent: number;
  tacticalAdvice: string;
}

export interface LeadChange {
  checkpointCode: string;
  kilometerMark: number;
  newLeaderBib: number;
  newLeaderName: string;
  previousLeaderBib?: number;
  previousLeaderName?: string;
  gapSeconds: number;
}

export interface AiAnomalyCluster {
  clusterType: 'suspected_course_measurement_error' | 'isolated_runner_irregularity' | 'judge_timing_drift';
  affectedCheckpoints: string[];
  affectedBibs: number[];
  confidence: number;
  diagnosis: string;
  recommendation: string;
}

export interface AiRaceReport {
  title: string;
  summary: string;
  winnerHeadline: string;
  teamChampionHeadline?: string;
  pacingInsights: PacingProfile[];
  leadChanges: LeadChange[];
  anomalyClusters: AiAnomalyCluster[];
  triageRecommendations: string[];
  fullNarrativeArabic: string;
  generatedAt: number;
}

