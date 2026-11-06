/**
 * PHOTO FINISH PRO – Complete Athletics Management System
 * Multi-Judge Merge Engine & Off-Track Anomaly Detection (Stage C5)
 * 
 * Features:
 * 1. Multi-phone passage merge and consensus within configurable time windows.
 * 2. Rapid duplicate tap debouncing per judge.
 * 3. Skipped checkpoint detection based on competition checkpoint topography.
 * 4. Physics-based impossible split speed detection (>28 km/h on trail/road).
 * 5. Reverse course traversal detection.
 * 6. Offline synchronization queue with idempotency and replay protection.
 */

import { 
  AthleticsCompetition, 
  PassageEvent, 
  MergedPassage, 
  RaceAnomaly, 
  MergeEngineConfig,
  Checkpoint 
} from '../types/athletics';

const MERGE_STORAGE_KEY = 'pf_athletics_merged_passages_v1';
const ANOMALIES_STORAGE_KEY = 'pf_athletics_race_anomalies_v1';
const OFFLINE_QUEUE_STORAGE_KEY = 'pf_athletics_offline_passages_queue_v1';

export class MultiJudgeMergeEngine {
  private config: MergeEngineConfig = {
    mergeWindowMs: 3000,
    maxHumanSpeedKmh: 28.0,
    debounceTapWindowMs: 1500,
    minTimeBetweenLapsMs: 90000
  };

  private inMemoryMerged: Map<string, MergedPassage> = new Map();
  private inMemoryAnomalies: Map<string, RaceAnomaly> = new Map();
  private offlineQueue: PassageEvent[] = [];

  constructor(customConfig?: Partial<MergeEngineConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
    this.loadFromStorage();
  }

  public setConfig(newConfig: Partial<MergeEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): MergeEngineConfig {
    return { ...this.config };
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const rawMerged = localStorage.getItem(MERGE_STORAGE_KEY);
        if (rawMerged) {
          const list = JSON.parse(rawMerged) as MergedPassage[];
          list.forEach(m => this.inMemoryMerged.set(m.id, m));
        }

        const rawAnomalies = localStorage.getItem(ANOMALIES_STORAGE_KEY);
        if (rawAnomalies) {
          const list = JSON.parse(rawAnomalies) as RaceAnomaly[];
          list.forEach(a => this.inMemoryAnomalies.set(a.id, a));
        }

        const rawQueue = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
        if (rawQueue) {
          this.offlineQueue = JSON.parse(rawQueue) as PassageEvent[];
        }
      }
    } catch (e) {
      console.warn('Failed to load merge state from storage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(MERGE_STORAGE_KEY, JSON.stringify(Array.from(this.inMemoryMerged.values())));
        localStorage.setItem(ANOMALIES_STORAGE_KEY, JSON.stringify(Array.from(this.inMemoryAnomalies.values())));
        localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(this.offlineQueue));
      }
    } catch (e) {
      console.warn('Failed to save merge state to storage:', e);
    }
  }

  /**
   * دمج تسجيلات مرور الحكام واكتشاف شذوذ السباق
   */
  public processPassages(
    competition: AthleticsCompetition, 
    rawPassages: PassageEvent[]
  ): { 
    mergedPassages: MergedPassage[]; 
    anomalies: RaceAnomaly[]; 
  } {
    const activePassages = rawPassages.filter(p => !p.isDeleted);
    // ترتيب زمني تصاعدي
    activePassages.sort((a, b) => a.timestamp - b.timestamp);

    const mergedResults: MergedPassage[] = [];
    const anomalies: RaceAnomaly[] = [];

    // خريطة نقاط المراقبة للوصول السريع
    const checkpointMap = new Map<string, Checkpoint>();
    competition.checkpoints.forEach(cp => checkpointMap.set(cp.id, cp));
    const sortedCheckpoints = [...competition.checkpoints].sort((a, b) => a.order - b.order);

    // تجميع حسب رقم الصدر
    const passagesByBib = new Map<number, PassageEvent[]>();
    activePassages.forEach(p => {
      const list = passagesByBib.get(p.bibNumber) || [];
      list.push(p);
      passagesByBib.set(p.bibNumber, list);
    });

    passagesByBib.forEach((bibPassages, bibNumber) => {
      // 1. فلترة وتجاهل النقرات المزدوجة العرضية (Debouncing)
      const debouncedPassages: PassageEvent[] = [];
      for (let i = 0; i < bibPassages.length; i++) {
        const curr = bibPassages[i];
        const currJudgeId = curr.judgeId || curr.recordedByJudgeId || curr.deviceId;
        if (debouncedPassages.length > 0) {
          const prev = debouncedPassages[debouncedPassages.length - 1];
          const prevJudgeId = prev.judgeId || prev.recordedByJudgeId || prev.deviceId;
          // إذا كان نفس الحكم سجل نفس المتسابق في نفس النقطة خلال نافذة أقل من debounceTapWindowMs
          if (
            prevJudgeId === currJudgeId &&
            prev.checkpointId === curr.checkpointId &&
            curr.timestamp - prev.timestamp < this.config.debounceTapWindowMs
          ) {
            anomalies.push({
              id: `anom_deb_${curr.id}`,
              competitionId: competition.id,
              type: 'rapid_duplicate',
              bibNumber,
              checkpointId: curr.checkpointId,
              checkpointCode: curr.checkpointCode,
              lapNumber: curr.lapNumber,
              timestamp: curr.timestamp,
              severity: 'warning',
              details: `نقر مزدوج مكرر للحكم (${curr.judgeName || currJudgeId}) خلال ${curr.timestamp - prev.timestamp}ms وتم إهماله تلقائياً.`,
              resolved: true,
              resolutionNote: 'تم إهمال النقر المكرر تلقائياً',
              createdAt: Date.now()
            });
            continue; // تجاوز النقر المكرر
          }
        }
        debouncedPassages.push(curr);
      }

      // 2. دمج تسجيلات الحكام المتعددين لنفس نقطة المراقبة والحلقة
      const runnerMergedPassages: MergedPassage[] = [];
      const visitedBatches: Set<number> = new Set();

      for (let i = 0; i < debouncedPassages.length; i++) {
        if (visitedBatches.has(i)) continue;

        const base = debouncedPassages[i];
        const matchingGroup: PassageEvent[] = [base];
        visitedBatches.add(i);

        for (let j = i + 1; j < debouncedPassages.length; j++) {
          if (visitedBatches.has(j)) continue;
          const other = debouncedPassages[j];

          // شرط الدمج: نفس النقطة ونفس الحلقة وبفارق زمني ضمن mergeWindowMs
          if (
            other.checkpointId === base.checkpointId &&
            other.lapNumber === base.lapNumber &&
            Math.abs(other.timestamp - base.timestamp) <= this.config.mergeWindowMs
          ) {
            matchingGroup.push(other);
            visitedBatches.add(j);
          }
        }

        // حساب الزمن الرسمي التوافقي (أبكر توقيت دقيق من الحكام)
        const earliestTime = Math.min(...matchingGroup.map(g => g.timestamp));
        const uniqueJudges = Array.from(new Set(matchingGroup.map(g => g.judgeId || g.recordedByJudgeId || g.deviceId || 'judge')));
        const originalTimestamps = matchingGroup.map(g => ({
          judgeId: g.judgeId || g.recordedByJudgeId || g.deviceId || 'judge',
          timestamp: g.timestamp
        }));

        // حساب معامل الموثوقية التوافقية
        const confidence = Math.min(1.0, 0.75 + (uniqueJudges.length - 1) * 0.15);

        const merged: MergedPassage = {
          id: `merged_${base.checkpointId}_bib${bibNumber}_lap${base.lapNumber}_${earliestTime}`,
          competitionId: competition.id,
          bibNumber,
          athleteName: base.athleteName,
          clubName: base.clubName || base.club,
          checkpointId: base.checkpointId,
          checkpointCode: base.checkpointCode,
          lapNumber: base.lapNumber,
          officialTimestamp: earliestTime,
          originalTimestamps,
          corroboratingJudges: uniqueJudges,
          confidenceScore: confidence,
          status: 'valid'
        };

        runnerMergedPassages.push(merged);
        mergedResults.push(merged);
      }

      // 3. تحليل التسلسل الجغرافي وكشف الشذوذ (Skipped, Speed, Reverse)
      // ترتيب المرورات المدمجة للعداء تصاعدياً
      runnerMergedPassages.sort((a, b) => a.officialTimestamp - b.officialTimestamp);

      for (let k = 0; k < runnerMergedPassages.length; k++) {
        const curr = runnerMergedPassages[k];
        const currCp = checkpointMap.get(curr.checkpointId);

        if (k > 0) {
          const prev = runnerMergedPassages[k - 1];
          const prevCp = checkpointMap.get(prev.checkpointId);

          if (currCp && prevCp) {
            const timeDiffSec = (curr.officialTimestamp - prev.officialTimestamp) / 1000;
            const timeDiffHours = timeDiffSec / 3600;

            // مسافة المقطع بالكيلومتر
            let segmentDistanceKm = 0;
            if (curr.lapNumber === prev.lapNumber) {
              segmentDistanceKm = currCp.distanceKm - prevCp.distanceKm;
            } else if (curr.lapNumber > prev.lapNumber) {
              // حساب المسافة عبر الحلقات
              const lapDistance = competition.distanceKm / (competition.lapCount || 1);
              const lapDiff = curr.lapNumber - prev.lapNumber;
              segmentDistanceKm = (lapDiff * lapDistance) + (currCp.distanceKm - prevCp.distanceKm);
            }

            // أ) كشف السير العكسي (Reverse Traversal) في نفس الحلقة
            if (curr.lapNumber === prev.lapNumber && currCp.order < prevCp.order) {
              anomalies.push({
                id: `anom_rev_${curr.id}`,
                competitionId: competition.id,
                type: 'reverse_traversal',
                bibNumber,
                checkpointId: curr.checkpointId,
                checkpointCode: curr.checkpointCode,
                lapNumber: curr.lapNumber,
                timestamp: curr.officialTimestamp,
                severity: 'critical',
                details: `سير عكسي: العداء رُصد في (${curr.checkpointCode}) بعد مروره بنقطة لاحقة (${prev.checkpointCode}).`,
                resolved: false,
                createdAt: Date.now()
              });
              curr.status = 'suspicious';
              curr.anomalyReason = 'سير عكسي للمسار';
            }

            // ب) كشف تخطي نقاط المراقبة (Skipped Checkpoints)
            if (curr.lapNumber === prev.lapNumber && currCp.order - prevCp.order > 1) {
              // البحث عن النقاط التي تم تخطيها بين prevCp و currCp
              const skipped = sortedCheckpoints.filter(cp => cp.order > prevCp.order && cp.order < currCp.order);
              const skippedCodes = skipped.map(s => s.code).join('، ');

              anomalies.push({
                id: `anom_skip_${curr.id}`,
                competitionId: competition.id,
                type: 'skipped_checkpoint',
                bibNumber,
                checkpointId: curr.checkpointId,
                checkpointCode: curr.checkpointCode,
                lapNumber: curr.lapNumber,
                timestamp: curr.officialTimestamp,
                severity: 'critical',
                details: `تخطي نقاط مراقبة: لم يُرصد العداء في النقاط الإجبارية (${skippedCodes}) بين (${prev.checkpointCode}) و (${curr.checkpointCode}).`,
                expectedCheckpointCode: skippedCodes,
                resolved: false,
                createdAt: Date.now()
              });
              curr.status = 'suspicious';
              curr.anomalyReason = `تخطي نقاط المراقبة (${skippedCodes})`;
            }

            // ج) كشف السرعة غير الطبيعية (Speed Anomaly)
            if (timeDiffHours > 0 && segmentDistanceKm > 0) {
              const speedKmh = segmentDistanceKm / timeDiffHours;
              if (speedKmh > this.config.maxHumanSpeedKmh) {
                anomalies.push({
                  id: `anom_spd_${curr.id}`,
                  competitionId: competition.id,
                  type: 'speed_anomaly',
                  bibNumber,
                  checkpointId: curr.checkpointId,
                  checkpointCode: curr.checkpointCode,
                  lapNumber: curr.lapNumber,
                  timestamp: curr.officialTimestamp,
                  severity: 'critical',
                  calculatedSpeedKmh: Math.round(speedKmh * 10) / 10,
                  details: `سرعة غير بشرية: ${speedKmh.toFixed(1)} كم/سا بين (${prev.checkpointCode}) و (${curr.checkpointCode}) (أقصى سرعة مسموحة: ${this.config.maxHumanSpeedKmh} كم/سا). اشتباه وسيلة نقل أو اختصار طريق.`,
                  resolved: false,
                  createdAt: Date.now()
                });
                curr.status = 'suspicious';
                curr.anomalyReason = `سرعة مستحيلة (${speedKmh.toFixed(1)} كم/سا)`;
              }
            }
          }
        }
      }
    });

    // تحديث التخزين الداخلي
    mergedResults.forEach(m => this.inMemoryMerged.set(m.id, m));
    anomalies.forEach(a => this.inMemoryAnomalies.set(a.id, a));
    this.saveToStorage();

    return {
      mergedPassages: mergedResults,
      anomalies
    };
  }

  /**
   * إدارة الشذوذ: اعتماد، إهمال، أو استبعاد المتسابق من الحكم الرئيسي
   */
  public resolveAnomaly(
    anomalyId: string, 
    action: 'dismiss' | 'disqualify' | 'override',
    resolutionNote: string
  ): boolean {
    const anomaly = this.inMemoryAnomalies.get(anomalyId);
    if (!anomaly) return false;

    anomaly.resolved = true;
    anomaly.resolutionNote = `[${action.toUpperCase()}] ${resolutionNote}`;

    // العثور على المرور المرتبط بالشذوذ
    const merged = Array.from(this.inMemoryMerged.values()).find(
      m => m.bibNumber === anomaly.bibNumber && m.checkpointId === anomaly.checkpointId && m.lapNumber === anomaly.lapNumber
    );

    if (merged) {
      if (action === 'dismiss') {
        merged.status = 'valid';
        merged.anomalyReason = undefined;
      } else if (action === 'disqualify') {
        merged.status = 'disqualified';
        merged.anomalyReason = `استبعاد رسمي (DQ): ${resolutionNote}`;
      } else if (action === 'override') {
        merged.status = 'overridden';
        merged.manualOverrideNote = resolutionNote;
      }
    }

    this.saveToStorage();
    return true;
  }

  // ══════════════════════════════════════════════════════════════
  // طابور المزامنة دون اتصال (Offline Persistence Queue)
  // ══════════════════════════════════════════════════════════════

  public enqueueOfflinePassage(passage: PassageEvent): void {
    // التأكد من عدم التكرار في الطابور (Idempotent enqueue)
    const exists = this.offlineQueue.some(p => p.id === passage.id);
    if (!exists) {
      this.offlineQueue.push(passage);
      this.saveToStorage();
    }
  }

  public getOfflineQueue(): PassageEvent[] {
    return [...this.offlineQueue];
  }

  public clearOfflineQueue(): void {
    this.offlineQueue = [];
    this.saveToStorage();
  }

  public async syncOfflineQueue(
    onSyncBatch: (batch: PassageEvent[]) => Promise<boolean>
  ): Promise<{ syncedCount: number; remainingCount: number }> {
    if (this.offlineQueue.length === 0) {
      return { syncedCount: 0, remainingCount: 0 };
    }

    const batchToSync = [...this.offlineQueue];
    const success = await onSyncBatch(batchToSync);

    if (success) {
      this.offlineQueue = [];
      this.saveToStorage();
      return { syncedCount: batchToSync.length, remainingCount: 0 };
    }

    return { syncedCount: 0, remainingCount: this.offlineQueue.length };
  }

  public getAllMergedPassages(competitionId?: string): MergedPassage[] {
    const list = Array.from(this.inMemoryMerged.values());
    if (competitionId) {
      return list.filter(m => m.competitionId === competitionId);
    }
    return list;
  }

  public getAllAnomalies(competitionId?: string): RaceAnomaly[] {
    const list = Array.from(this.inMemoryAnomalies.values());
    if (competitionId) {
      return list.filter(a => a.competitionId === competitionId);
    }
    return list;
  }

  public clearAll(): void {
    this.inMemoryMerged.clear();
    this.inMemoryAnomalies.clear();
    this.offlineQueue = [];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(MERGE_STORAGE_KEY);
      localStorage.removeItem(ANOMALIES_STORAGE_KEY);
      localStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY);
    }
  }
}

export const multiJudgeMergeEngine = new MultiJudgeMergeEngine();
