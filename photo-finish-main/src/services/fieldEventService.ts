import { 
  FieldEventCompetition, 
  FieldAthleteScore, 
  FieldAttempt, 
  VerticalHeightTrial,
  FieldEventType
} from '../types/athletics';

const DB_NAME = 'athletics_competition_db_v1';
const STORE_FIELD_EVENTS = 'field_event_competitions';

export const INITIAL_FIELD_COMPETITIONS: FieldEventCompetition[] = [
  {
    id: 'field_lj_final_2026',
    competitionId: 'comp_algiers_2026',
    name: 'نهائي الوثب الطويل - أكابر رجال',
    discipline: 'long_jump',
    gender: 'M',
    category: 'SENIOR',
    venue: 'المركب الأولمبي محمد بوضياف - 5 جويلية',
    date: '2026-06-15',
    scheduledTime: '17:30',
    totalAttemptsAllowed: 6,
    status: 'in_progress',
    athletes: [
      {
        athleteId: 'ath_lj_01',
        athleteName: 'هشام بوحنون',
        bibNumber: 412,
        clubName: 'مولودية الجزائر',
        order: 1,
        attempts: [
          { attemptNumber: 1, resultType: 'valid', measurementMeters: 7.92, wind: 1.1, timestamp: Date.now() - 300000 },
          { attemptNumber: 2, resultType: 'foul', measurementMeters: 0, timestamp: Date.now() - 240000 },
          { attemptNumber: 3, resultType: 'valid', measurementMeters: 8.14, wind: 0.8, timestamp: Date.now() - 180000 },
          { attemptNumber: 4, resultType: 'valid', measurementMeters: 8.05, wind: 1.4, timestamp: Date.now() - 120000 },
          { attemptNumber: 5, resultType: 'pass', measurementMeters: 0, timestamp: Date.now() - 60000 },
          { attemptNumber: 6, resultType: 'valid', measurementMeters: 8.25, wind: 1.2, timestamp: Date.now() },
        ],
        bestValidMeasurement: 8.25,
        secondBestMeasurement: 8.14,
        rank: 1,
        status: 'active',
      },
      {
        athleteId: 'ath_lj_02',
        athleteName: 'ياسين زواوي',
        bibNumber: 415,
        clubName: 'المجمع البترولي',
        order: 2,
        attempts: [
          { attemptNumber: 1, resultType: 'valid', measurementMeters: 8.02, wind: 0.5, timestamp: Date.now() - 300000 },
          { attemptNumber: 2, resultType: 'valid', measurementMeters: 8.25, wind: 1.0, timestamp: Date.now() - 240000 },
          { attemptNumber: 3, resultType: 'foul', measurementMeters: 0, timestamp: Date.now() - 180000 },
          { attemptNumber: 4, resultType: 'valid', measurementMeters: 8.10, wind: 0.9, timestamp: Date.now() - 120000 },
          { attemptNumber: 5, resultType: 'valid', measurementMeters: 8.08, wind: 1.2, timestamp: Date.now() - 60000 },
          { attemptNumber: 6, resultType: 'foul', measurementMeters: 0, timestamp: Date.now() },
        ],
        bestValidMeasurement: 8.25,
        secondBestMeasurement: 8.10,
        rank: 2,
        status: 'active',
      },
      {
        athleteId: 'ath_lj_03',
        athleteName: 'رمزي بلحاج',
        bibNumber: 420,
        clubName: 'شباب بلوزداد',
        order: 3,
        attempts: [
          { attemptNumber: 1, resultType: 'valid', measurementMeters: 7.75, wind: 0.2, timestamp: Date.now() - 300000 },
          { attemptNumber: 2, resultType: 'valid', measurementMeters: 7.85, wind: 0.6, timestamp: Date.now() - 240000 },
          { attemptNumber: 3, resultType: 'valid', measurementMeters: 7.90, wind: 1.1, timestamp: Date.now() - 180000 },
          { attemptNumber: 4, resultType: 'foul', measurementMeters: 0, timestamp: Date.now() - 120000 },
          { attemptNumber: 5, resultType: 'valid', measurementMeters: 7.82, wind: 0.4, timestamp: Date.now() - 60000 },
          { attemptNumber: 6, resultType: 'valid', measurementMeters: 7.88, wind: 0.7, timestamp: Date.now() },
        ],
        bestValidMeasurement: 7.90,
        secondBestMeasurement: 7.88,
        rank: 3,
        status: 'active',
      },
    ],
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
  },
  {
    id: 'field_sp_final_2026',
    competitionId: 'comp_algiers_2026',
    name: 'نهائي رمي الجلة (Shot Put) - أكابر رجال',
    discipline: 'shot_put',
    gender: 'M',
    category: 'SENIOR',
    venue: 'المركب الأولمبي محمد بوضياف - 5 جويلية',
    date: '2026-06-16',
    scheduledTime: '16:00',
    totalAttemptsAllowed: 6,
    status: 'scheduled',
    athletes: [
      {
        athleteId: 'ath_sp_01',
        athleteName: 'حمزة عثماني',
        bibNumber: 501,
        clubName: 'الأمن الوطني',
        order: 1,
        attempts: [],
        bestValidMeasurement: 0,
        secondBestMeasurement: 0,
        rank: 1,
        status: 'active',
      },
      {
        athleteId: 'ath_sp_02',
        athleteName: 'بلال مهدية',
        bibNumber: 504,
        clubName: 'أمل قسنطينة',
        order: 2,
        attempts: [],
        bestValidMeasurement: 0,
        secondBestMeasurement: 0,
        rank: 2,
        status: 'active',
      },
    ],
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
  },
];

export class FieldEventService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryCompetitions: Map<string, FieldEventCompetition> = new Map();

  constructor() {
    INITIAL_FIELD_COMPETITIONS.forEach((c) => this.memoryCompetitions.set(c.id, { ...c }));
  }

  private async getDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return null;
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 4);

        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_FIELD_EVENTS)) {
            const store = db.createObjectStore(STORE_FIELD_EVENTS, { keyPath: 'id' });
            store.createIndex('competitionId', 'competitionId', { unique: false });
            store.createIndex('discipline', 'discipline', { unique: false });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    return this.dbPromise;
  }

  // ═══════════════════════════════════════════════════
  // محرك كسر التعادل والترتيب لمسابقات المسافة (Rule 25 Countback)
  // ═══════════════════════════════════════════════════

  /**
   * حساب وترتيب نتائج مسابقة الوثب الأفقي أو الرمي وفق قواعد الاتحاد الدولي
   * 1. المقارنة بأفضل قياس صحيح.
   * 2. في حالة التعادل: المقارنة بثاني أفضل قياس، ثم الثالث، وهكذا (Countback).
   * 3. إذا تساوت جميع المحاولات الصالحة بالكامل، يُمنح المتسابقون نفس الترتيب.
   */
  public static rankDistanceFieldAthletes(athletes: FieldAthleteScore[]): FieldAthleteScore[] {
    const scored = athletes.map((ath) => {
      // استخراج القياسات الصالحة فقط وتنازلياً
      const validMarks = ath.attempts
        .filter((a) => a.resultType === 'valid' && a.measurementMeters > 0)
        .map((a) => a.measurementMeters)
        .sort((a, b) => b - a);

      const best = validMarks.length > 0 ? validMarks[0] : 0;
      const secondBest = validMarks.length > 1 ? validMarks[1] : 0;

      // تحديد الحالة: بدون رقم (NM) إذا كانت كل المحاولات خطأ أو تنازل
      let status = ath.status;
      if (ath.attempts.length > 0 && validMarks.length === 0) {
        status = 'nm';
      }

      return {
        ...ath,
        bestValidMeasurement: best,
        secondBestMeasurement: secondBest,
        status,
        _validMarks: validMarks,
      };
    });

    // الترتيب: الأفضل أولاً مع تطبيق Countback الدقيق
    scored.sort((a, b) => {
      // 1. أفضل قياس
      if (b.bestValidMeasurement !== a.bestValidMeasurement) {
        return b.bestValidMeasurement - a.bestValidMeasurement;
      }

      // 2. تطبيق قاعدة Countback عبر كافة المحاولات التالية
      const lenA = a._validMarks.length;
      const lenB = b._validMarks.length;
      const maxChecks = Math.max(lenA, lenB);

      for (let i = 1; i < maxChecks; i += 1) {
        const valA = i < lenA ? a._validMarks[i] : -1;
        const valB = i < lenB ? b._validMarks[i] : -1;
        if (valB !== valA) {
          return valB - valA;
        }
      }

      // 3. في حالة التطابق التام، يبقى ترتيب الفوج
      return a.order - b.order;
    });

    // تعيين الرتبة (Rank) مع التعامل مع التعادل التام
    let currentRank = 1;
    return scored.map((ath, idx) => {
      if (idx > 0) {
        const prev = scored[idx - 1];
        const isExactTie = 
          prev.bestValidMeasurement === ath.bestValidMeasurement &&
          prev.secondBestMeasurement === ath.secondBestMeasurement &&
          JSON.stringify(prev._validMarks) === JSON.stringify(ath._validMarks);

        if (!isExactTie) {
          currentRank = idx + 1;
        }
      }

      const { _validMarks, ...rest } = ath;
      return {
        ...rest,
        rank: ath.bestValidMeasurement > 0 ? currentRank : scored.length,
      };
    });
  }

  // ═══════════════════════════════════════════════════
  // محرك مسابقات الارتفاع: الوثب العالي والزانة (Rule 26)
  // ═══════════════════════════════════════════════════

  /**
   * حساب وترتيب مسابقة الوثب العالي أو القفز بالزانة:
   * 1. أعلى ارتفاع تم اجتيازه بنجاح (O).
   * 2. كسر التعادل 1: أقل عدد محاولات مستهلكة في الارتفاع الأخير المجتاز.
   * 3. كسر التعادل 2: أقل مجموع أخطاء (X) طوال المسابقة حتى الارتفاع الأخير المجتاز.
   */
  public static rankVerticalFieldAthletes(athletes: FieldAthleteScore[]): FieldAthleteScore[] {
    const scored = athletes.map((ath) => {
      const trials = ath.verticalTrials || [];
      const clearedHeights = trials.filter((t) => t.cleared);

      // أعلى ارتفاع تم اجتيازه
      const highestCleared = clearedHeights.length > 0 
        ? Math.max(...clearedHeights.map((t) => t.heightMeters)) 
        : 0;

      // عدد المحاولات في الارتفاع الأخير المجتاز
      const lastClearedTrial = trials.find((t) => t.heightMeters === highestCleared && t.cleared);
      const attemptsAtLastHeight = lastClearedTrial ? lastClearedTrial.attemptsCount : 99;

      // إجمالي الأخطاء حتى الارتفاع الأخير المجتاز (شاملاً إياه)
      let totalFailuresUpToLast = 0;
      trials.forEach((t) => {
        if (t.heightMeters <= highestCleared) {
          totalFailuresUpToLast += t.trials.filter((r) => r === 'X').length;
        }
      });

      return {
        ...ath,
        bestValidMeasurement: highestCleared,
        rank: 1,
        _attemptsAtLastHeight: attemptsAtLastHeight,
        _totalFailures: totalFailuresUpToLast,
      };
    });

    scored.sort((a, b) => {
      // 1. أعلى ارتفاع
      if (b.bestValidMeasurement !== a.bestValidMeasurement) {
        return b.bestValidMeasurement - a.bestValidMeasurement;
      }

      // 2. كسر التعادل 1: أقل محاولات في الارتفاع الأخير
      if (a._attemptsAtLastHeight !== b._attemptsAtLastHeight) {
        return a._attemptsAtLastHeight - b._attemptsAtLastHeight;
      }

      // 3. كسر التعادل 2: أقل مجموع أخطاء
      if (a._totalFailures !== b._totalFailures) {
        return a._totalFailures - b._totalFailures;
      }

      return a.order - b.order;
    });

    let currentRank = 1;
    return scored.map((ath, idx) => {
      if (idx > 0) {
        const prev = scored[idx - 1];
        const isTie = 
          prev.bestValidMeasurement === ath.bestValidMeasurement &&
          prev._attemptsAtLastHeight === ath._attemptsAtLastHeight &&
          prev._totalFailures === ath._totalFailures;

        if (!isTie) {
          currentRank = idx + 1;
        }
      }

      const { _attemptsAtLastHeight, _totalFailures, ...rest } = ath;
      return {
        ...rest,
        rank: ath.bestValidMeasurement > 0 ? currentRank : scored.length,
      };
    });
  }

  // ═══════════════════════════════════════════════════
  // إدارة المسابقات الميدانية وتسجيل المحاولات
  // ═══════════════════════════════════════════════════

  public async getCompetitionById(id: string): Promise<FieldEventCompetition | null> {
    const db = await this.getDb();
    if (db) {
      return new Promise<FieldEventCompetition | null>((resolve, reject) => {
        const tx = db.transaction(STORE_FIELD_EVENTS, 'readonly');
        const req = tx.objectStore(STORE_FIELD_EVENTS).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }
    return this.memoryCompetitions.get(id) || null;
  }

  public async listCompetitions(discipline?: FieldEventType): Promise<FieldEventCompetition[]> {
    const db = await this.getDb();
    let list: FieldEventCompetition[] = [];

    if (db) {
      list = await new Promise<FieldEventCompetition[]>((resolve, reject) => {
        const tx = db.transaction(STORE_FIELD_EVENTS, 'readonly');
        const req = tx.objectStore(STORE_FIELD_EVENTS).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } else {
      list = Array.from(this.memoryCompetitions.values());
    }

    if (!list.length) {
      list = Array.from(this.memoryCompetitions.values());
    }

    if (discipline) {
      return list.filter((c) => c.discipline === discipline);
    }
    return list;
  }

  public async recordDistanceAttempt(
    competitionId: string,
    athleteId: string,
    attempt: FieldAttempt
  ): Promise<FieldEventCompetition | null> {
    const comp = await this.getCompetitionById(competitionId);
    if (!comp) return null;

    const updatedAthletes = comp.athletes.map((ath) => {
      if (ath.athleteId !== athleteId) return ath;

      // استبدال أو إضافة المحاولة
      const existingAttempts = ath.attempts.filter((a) => a.attemptNumber !== attempt.attemptNumber);
      const attempts = [...existingAttempts, attempt].sort((a, b) => a.attemptNumber - b.attemptNumber);

      return {
        ...ath,
        attempts,
      };
    });

    // إعادة احتساب الترتيب وكسر التعادل تلقائياً
    const rankedAthletes = FieldEventService.rankDistanceFieldAthletes(updatedAthletes);

    const updatedComp: FieldEventCompetition = {
      ...comp,
      athletes: rankedAthletes,
      updatedAt: Date.now(),
    };

    await this.persistCompetition(updatedComp);
    return updatedComp;
  }

  public async recordVerticalTrial(
    competitionId: string,
    athleteId: string,
    heightTrial: VerticalHeightTrial
  ): Promise<FieldEventCompetition | null> {
    const comp = await this.getCompetitionById(competitionId);
    if (!comp) return null;

    const updatedAthletes = comp.athletes.map((ath) => {
      if (ath.athleteId !== athleteId) return ath;

      const trials = (ath.verticalTrials || []).filter((t) => t.heightMeters !== heightTrial.heightMeters);
      trials.push(heightTrial);
      trials.sort((a, b) => a.heightMeters - b.heightMeters);

      return {
        ...ath,
        verticalTrials: trials,
      };
    });

    const rankedAthletes = FieldEventService.rankVerticalFieldAthletes(updatedAthletes);

    const updatedComp: FieldEventCompetition = {
      ...comp,
      athletes: rankedAthletes,
      updatedAt: Date.now(),
    };

    await this.persistCompetition(updatedComp);
    return updatedComp;
  }

  public async persistCompetition(comp: FieldEventCompetition): Promise<void> {
    this.memoryCompetitions.set(comp.id, comp);
    const db = await this.getDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_FIELD_EVENTS, 'readwrite');
        const req = tx.objectStore(STORE_FIELD_EVENTS).put(comp);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  }

  public async clearAll(): Promise<void> {
    this.memoryCompetitions.clear();
    INITIAL_FIELD_COMPETITIONS.forEach((c) => this.memoryCompetitions.set(c.id, { ...c }));

    const db = await this.getDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_FIELD_EVENTS, 'readwrite');
        tx.objectStore(STORE_FIELD_EVENTS).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      INITIAL_FIELD_COMPETITIONS.forEach((c) => this.persistCompetition(c));
    }
  }
}

export const fieldEventService = new FieldEventService();
