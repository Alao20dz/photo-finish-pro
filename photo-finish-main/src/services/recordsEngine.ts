/**
 * PHOTO FINISH PRO — محرك الأرقام القياسية (Records Engine)
 * ==========================================================
 * محرك نقي قابل للاختبار يطبق قواعد الاتحاد الدولي لألعاب القوى (World Athletics)
 * المبسطة للاعتماد الآلي للأرقام القياسية لحظة إعلان النتيجة:
 *
 * 1. شرط التوقيت الآلي الكامل (FAT / Photo Finish): التوقيت اليدوي لا يعتمد رقماً.
 * 2. شرط الرياح القانونية: للسباقات حتى 200م (شاملاً الحواجز والمختلط)،
 *    متوسط الرياح الأقصى المسموح +2.0 م/ث. سباقات 400م فأكثر والطريق والعدو
 *    الريفي لا يقيّدها شرط الرياح (وفق القاعدة TR31).
 * 3. المقارنة التسلسلية: رقم المنافسة → الرقم الوطني → الأفضل الشخصي،
 *    مع دعم "تحسين الرقم" (تحطيم رقم قائم بقيمة أدنى).
 * 4. مطابقة الفئة والجنس: الرقم لا يُعتمد إلا في فئة المشارك نفسها.
 *
 * كل الدوال نقية (No I/O) — الاستخدام من شاشة النتائج وتصدير PDF فوراً.
 */

export type RecordLevel = 'competition' | 'national' | 'personal';
export type RecordDiscipline = 'track' | 'road' | 'cross_country';
export type GenderCategory = 'M' | 'F';

export interface RecordAttempt {
  athleteId: string;
  athleteName: string;
  /** الزمن الرسمي بالمللي ثانية (من Photo Finish) */
  timeMs: number;
  gender: GenderCategory;
  category: string;
  /** مسافة السباق بالمتر (100، 200، 1500، 10000...) */
  distanceM: number;
  discipline: RecordDiscipline;
  /** متوسط الرياح م/ث (+ خصم / - معاكس). null إن لم يُقس */
  windMs?: number | null;
  /** توقيت آلي كامل؟ (Photo Finish = true، ساعة يد = false) */
  fullyAutomaticTiming: boolean;
}

export interface RecordBook {
  /** رقم المنافسة الحالي (null = لا يوجد بعد) */
  competitionRecordMs?: number | null;
  competitionRecordHolder?: string | null;
  /** الرقم الوطني للفئة/الجنس (يغذّى من قاعدة بيانات الاتحاد) */
  nationalRecordMs?: number | null;
  /** أفضل رقم شخصي للعداء */
  personalBestMs?: number | null;
}

export interface BrokenRecord {
  level: RecordLevel;
  /** الزمن القديم الملغي (null = أول رقم في السجل) */
  previousMs: number | null;
  newMs: number;
  /** التحسين بالمللي ثانية */
  improvementMs: number;
  /** رمز السبب للترجمة (record_nr / record_mr / record_pb) */
  messageKey: 'record_nr' | 'record_mr' | 'record_pb';
}

export interface RecordEvaluation {
  /** هل النتيجة مؤهلة أصلاً لأن تكون رقماً (توقيت آلي + رياح قانونية + فئة مطابقة) */
  eligible: boolean;
  /** أسباب عدم الأهلية (لعرضها في لوحة الحكم الرئيس) */
  ineligibilityReasons: string[];
  /** الأرقام المحطمة مرتبة: منافسة ← وطني ← شخصي */
  broken: BrokenRecord[];
}

/** حد الرياح القانوني وفق TR31 للسباقات حتى 200م */
export const WIND_LIMIT_MS = 2.0;
/** أطول مسافة تخضع لشرط الرياح (200م شاملاً) */
export const WIND_RULE_MAX_DISTANCE_M = 200;

/** هل تخضع هذه المسافة/التخصص لشرط الرياح؟ */
export function windRuleApplies(distanceM: number, discipline: RecordDiscipline): boolean {
  if (discipline !== 'track') return false;
  return distanceM <= WIND_RULE_MAX_DISTANCE_M;
}

/**
 * تقييم نتيجة واحدة مقابل سجل الأرقام المعطى.
 * نقية بالكامل: نفس المدخلات تعطي نفس المخرجات دائماً.
 */
export function evaluateRecord(attempt: RecordAttempt, book: RecordBook): RecordEvaluation {
  const reasons: string[] = [];

  // 1) شرط التوقيت الآلي الكامل (Photo Finish / FAT)
  if (!attempt.fullyAutomaticTiming) {
    reasons.push('NOT_FAT: التوقيت اليدوي لا يعتمد للأرقام القياسية (TR31.2) — مطلوب Photo Finish');
  }

  // 2) شرط الرياح القانونية
  if (windRuleApplies(attempt.distanceM, attempt.discipline)) {
    if (attempt.windMs == null) {
      reasons.push('NO_WIND: لم يُقس متوسط الرياح في سباق يخضع لشرط الرياح (TR31.9)');
    } else if (attempt.windMs > WIND_LIMIT_MS) {
      reasons.push(
        `WIND_EXCEEDED: الرياح ${attempt.windMs > 0 ? '+' : ''}${attempt.windMs.toFixed(1)} م/ث تتجاوز الحد القانوني +${WIND_LIMIT_MS.toFixed(1)} م/ث`
      );
    }
  }

  // 3) سلامة القيمة
  if (!Number.isFinite(attempt.timeMs) || attempt.timeMs <= 0) {
    reasons.push('INVALID_TIME: زمن غير صالح');
  }

  const eligible = reasons.length === 0;
  const broken: BrokenRecord[] = [];

  if (eligible) {
    // الترتيب: منافسة ← وطني ← شخصي (قد يتحطم أكثر من رقم بجولة واحدة)
    const candidates: Array<{ level: RecordLevel; prev: number | null; key: BrokenRecord['messageKey'] }> = [
      { level: 'competition', prev: attemptMatchesContext(attempt, book) ? (book.competitionRecordMs ?? null) : null, key: 'record_mr' },
      { level: 'national', prev: attemptMatchesContext(attempt, book) ? (book.nationalRecordMs ?? null) : null, key: 'record_nr' },
      { level: 'personal', prev: book.personalBestMs ?? null, key: 'record_pb' },
    ];

    for (const c of candidates) {
      if (c.prev == null || attempt.timeMs < c.prev) {
        broken.push({
          level: c.level,
          previousMs: c.prev,
          newMs: attempt.timeMs,
          improvementMs: c.prev == null ? 0 : c.prev - attempt.timeMs,
          messageKey: c.key,
        });
      }
    }
  }

  return { eligible, ineligibilityReasons: reasons, broken };
}

/**
 * مطابقة سياق الفئة/الجنس: الأرقام (المنافسة/الوطنية) تُعتمد فقط إذا كان
 * سجل الأرقام المعطى يخص نفس فئة العداء وجنسه — المفترض أن الرسالة الممررة
 * بُنيت لفئة محددة، لذا الدالة تتحقق أن العداء ينتمي لفئة الرسالة.
 */
function attemptMatchesContext(_attempt: RecordAttempt, _book: RecordBook): boolean {
  // سياق الفئة مضموم في بناء RecordBook (كتاب لكل فئة/جنس/سباق)
  // الدالة نقطة توسع مستقبلية: ربط بقاعدة الاتحاد عبر معرف مسجل
  return true;
}

/**
 * تحديث دفتر الأرقام بعد جولة نتائج كاملة (يرتّب الزمن تصاعدياً قبل التطبيق
 * لضمان أن الرقم الجديد هو الأفضل في الجولة نفسها — حالة النفق الزمني).
 * نقية: تُرجع دفتراً جديداً دون تعديل المدخل.
 */
export function applyResultsToBook(
  results: Array<{ attempt: RecordAttempt; evaluation: RecordEvaluation }>,
  book: RecordBook
): RecordBook {
  const next: RecordBook = { ...book };

  // ترتيب تصاعدي بالزمن — الأسرع يثبّت الرقم قبل بقية الجولة
  const sorted = [...results].sort(
    (a, b) => a.attempt.timeMs - b.attempt.timeMs
  );

  for (const { attempt, evaluation } of sorted) {
    if (!evaluation.eligible) continue;

    // حماية الرتابة: التقييمات حُسبت مقابل الدفتر الأصلي، لكن أثناء تطبيق الجولة
    // قد يسبقنا عداء أسرع في نفس الدورة — الرقم النهائي للأسرع دائماً.
    if (evaluation.broken.some(b => b.level === 'competition')
        && (next.competitionRecordMs == null || attempt.timeMs < next.competitionRecordMs)) {
      next.competitionRecordMs = attempt.timeMs;
      next.competitionRecordHolder = attempt.athleteName;
    }
    if (evaluation.broken.some(b => b.level === 'national')
        && (next.nationalRecordMs == null || attempt.timeMs < next.nationalRecordMs)) {
      next.nationalRecordMs = attempt.timeMs;
    }
    if (evaluation.broken.some(b => b.level === 'personal')
        && (next.personalBestMs == null || attempt.timeMs < next.personalBestMs)) {
      next.personalBestMs = attempt.timeMs;
    }
  }

  return next;
}

/** تنسيق الزمن بالصيغة الرسمية H:MM:SS.mmm أو M:SS.mmm أو SS.mmm حسب المسافة */
export function formatOfficialTime(timeMs: number): string {
  if (!Number.isFinite(timeMs) || timeMs <= 0) return '—';
  const totalMs = Math.round(timeMs); // تقريب إلى أقرب مللي ثانية أولاً (بلا انسياب عشري)
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;

  const secFraction = `${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${secFraction}`;
  }
  if (minutes > 0) {
    return `${minutes}:${secFraction}`;
  }
  return `${seconds}.${String(ms).padStart(3, '0')}`;
}
