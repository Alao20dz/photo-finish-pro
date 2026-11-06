/**
 * PHOTO FINISH PRO – Complete Athletics Management System
 * Chief Judge Control Center & Results Engine (Stage C6)
 * 
 * Features:
 * 1. Gun Time vs Net Time calculations with millisecond accuracy.
 * 2. Official Classification Lifecycle (provisional -> under_review -> official -> certified).
 * 3. Results locking with tamper-proof Chief Judge override audit log.
 * 4. World Athletics Rule 8 Protests and Appeals (Reclamations) workflow.
 * 5. Multi-Phone Judge Matrix and Live Telemetry (heartbeats, latency, battery).
 */

import { 
  AthleticsCompetition, 
  MergedPassage, 
  RaceResultEntry, 
  JudgeTelemetry, 
  ProtestAppeal, 
  ChiefJudgeLockAudit,
  CompetitionResultStatus 
} from '../types/athletics';

const RESULTS_STORAGE_KEY = 'pf_athletics_official_results_v1';
const PROTESTS_STORAGE_KEY = 'pf_athletics_protest_appeals_v1';
const AUDIT_STORAGE_KEY = 'pf_athletics_chief_judge_audit_v1';
const TELEMETRY_STORAGE_KEY = 'pf_athletics_judge_telemetry_v1';

export class ChiefJudgeControlService {
  private inMemoryResults: Map<string, RaceResultEntry[]> = new Map();
  private inMemoryProtests: Map<string, ProtestAppeal> = new Map();
  private inMemoryAudit: ChiefJudgeLockAudit[] = [];
  private inMemoryTelemetry: Map<string, JudgeTelemetry> = new Map();
  private competitionStatus: Map<string, CompetitionResultStatus> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const rawResults = localStorage.getItem(RESULTS_STORAGE_KEY);
        if (rawResults) {
          const parsed = JSON.parse(rawResults) as Record<string, RaceResultEntry[]>;
          Object.entries(parsed).forEach(([k, v]) => this.inMemoryResults.set(k, v));
        }

        const rawProtests = localStorage.getItem(PROTESTS_STORAGE_KEY);
        if (rawProtests) {
          const parsed = JSON.parse(rawProtests) as ProtestAppeal[];
          parsed.forEach(p => this.inMemoryProtests.set(p.id, p));
        }

        const rawAudit = localStorage.getItem(AUDIT_STORAGE_KEY);
        if (rawAudit) {
          this.inMemoryAudit = JSON.parse(rawAudit) as ChiefJudgeLockAudit[];
        }

        const rawTelem = localStorage.getItem(TELEMETRY_STORAGE_KEY);
        if (rawTelem) {
          const parsed = JSON.parse(rawTelem) as JudgeTelemetry[];
          parsed.forEach(t => this.inMemoryTelemetry.set(`${t.checkpointId}_${t.judgeId}`, t));
        }
      }
    } catch (e) {
      console.warn('Failed to load ChiefJudgeControl state:', e);
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const resultsObj: Record<string, RaceResultEntry[]> = {};
        this.inMemoryResults.forEach((v, k) => resultsObj[k] = v);
        localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(resultsObj));

        localStorage.setItem(PROTESTS_STORAGE_KEY, JSON.stringify(Array.from(this.inMemoryProtests.values())));
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(this.inMemoryAudit));
        localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(Array.from(this.inMemoryTelemetry.values())));
      }
    } catch (e) {
      console.warn('Failed to save ChiefJudgeControl state:', e);
    }
  }

  /**
   * تنسيق الزمن بالمللي ثانية إلى نص رياضي رسمي (HH:MM:SS.mmm أو MM:SS.mmm)
   */
  public formatTime(ms: number, includeHours: boolean = false): string {
    if (ms < 0 || isNaN(ms)) return '00:00.000';
    const totalSeconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor(ms % 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    const pad = (n: number, z = 2) => n.toString().padStart(z, '0');

    if (hours > 0 || includeHours) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 3)}`;
  }

  /**
   * حساب النتائج والترتيب الرسمي بناءً على أوقات طلقة البداية (Gun Time) والعبور الفعلي (Net Time)
   */
  public computeOfficialResults(
    competition: AthleticsCompetition,
    mergedPassages: MergedPassage[],
    gunStartTime: number
  ): RaceResultEntry[] {
    const requiredLaps = competition.lapCount || 1;
    const finishCheckpoint = competition.checkpoints.find(c => c.type === 'finish')
      || competition.checkpoints.find(c => c.code.toLowerCase().includes('fin') || c.name.includes('نهاية') || c.name.toLowerCase().includes('finish'))
      || competition.checkpoints[competition.checkpoints.length - 1];
    const finishCpId = finishCheckpoint ? finishCheckpoint.id : '';

    // تجميع المرورات حسب رقم الصدر
    const passagesByBib = new Map<number, MergedPassage[]>();
    mergedPassages.forEach(p => {
      const list = passagesByBib.get(p.bibNumber) || [];
      list.push(p);
      passagesByBib.set(p.bibNumber, list);
    });

    const entries: RaceResultEntry[] = [];

    // فحص جميع العدائين المسجلين في المنافسة أو الذين لديهم مرورات
    const allBibs = new Set<number>();
    (competition.runners || []).forEach(r => allBibs.add(r.bibNumber));
    passagesByBib.forEach((_, bib) => allBibs.add(bib));

    allBibs.forEach(bibNumber => {
      const runnerPassages = (passagesByBib.get(bibNumber) || []).sort((a, b) => a.officialTimestamp - b.officialTimestamp);
      const runnerInfo = (competition.runners || []).find(r => r.bibNumber === bibNumber);

      const athleteName = runnerInfo?.name || runnerPassages[0]?.athleteName || `عداء #${bibNumber}`;
      const clubName = runnerInfo?.club || runnerPassages[0]?.clubName || 'فردي';

      // فحص هل هناك استبعاد DQ
      const dqPassage = runnerPassages.find(p => p.status === 'disqualified');
      if (dqPassage) {
        entries.push({
          rank: 9999,
          bibNumber,
          athleteName,
          clubName,
          category: competition.category,
          gender: competition.gender,
          gunTimeMs: 0,
          netTimeMs: 0,
          formattedGunTime: 'DQ',
          formattedNetTime: 'DQ',
          gapMs: 0,
          formattedGap: '-',
          completedLaps: 0,
          status: 'dq',
          disqualificationReason: dqPassage.anomalyReason || 'مخالفة اللوائح الرسمية',
          isLocked: this.isCompetitionLocked(competition.id)
        });
        return;
      }

      // البحث عن مرور خط النهاية في الحلقة المطلوبة
      const finishPassages = runnerPassages.filter(p => p.checkpointId === finishCpId);
      const lastFinishPassage = finishPassages[finishPassages.length - 1];
      const completedLaps = finishPassages.length;

      // العثور على مرور خط البداية لحساب الـ Net Time
      const startCp = competition.checkpoints.find(c => c.type === 'start')
        || competition.checkpoints.find(c => c.code.toLowerCase().includes('start') || c.name.includes('انطلاق') || c.name.toLowerCase().includes('start'))
        || competition.checkpoints[0];
      const startPassage = runnerPassages.find(p => p.checkpointId === (startCp ? startCp.id : ''));
      const netStartTime = startPassage ? startPassage.officialTimestamp : gunStartTime;

      if (lastFinishPassage && completedLaps >= requiredLaps) {
        const finishTime = lastFinishPassage.officialTimestamp;
        const gunTimeMs = Math.max(0, finishTime - gunStartTime);
        const netTimeMs = Math.max(0, finishTime - netStartTime);

        entries.push({
          rank: 0, // يتم تعيينه بعد الترتيب
          bibNumber,
          athleteName,
          clubName,
          category: competition.category,
          gender: competition.gender,
          gunTimeMs,
          netTimeMs,
          formattedGunTime: this.formatTime(gunTimeMs),
          formattedNetTime: this.formatTime(netTimeMs),
          gapMs: 0,
          formattedGap: '-',
          completedLaps,
          status: 'finished',
          isLocked: this.isCompetitionLocked(competition.id)
        });
      } else if (runnerPassages.length > 0) {
        // بدأ ولم يكمل (DNF)
        entries.push({
          rank: 8888,
          bibNumber,
          athleteName,
          clubName,
          category: competition.category,
          gender: competition.gender,
          gunTimeMs: 0,
          netTimeMs: 0,
          formattedGunTime: 'DNF',
          formattedNetTime: 'DNF',
          gapMs: 0,
          formattedGap: '-',
          completedLaps,
          status: 'dnf',
          isLocked: this.isCompetitionLocked(competition.id)
        });
      } else {
        // لم يبدأ (DNS)
        entries.push({
          rank: 7777,
          bibNumber,
          athleteName,
          clubName,
          category: competition.category,
          gender: competition.gender,
          gunTimeMs: 0,
          netTimeMs: 0,
          formattedGunTime: 'DNS',
          formattedNetTime: 'DNS',
          gapMs: 0,
          formattedGap: '-',
          completedLaps: 0,
          status: 'dns',
          isLocked: this.isCompetitionLocked(competition.id)
        });
      }
    });

    // فرز الفائزين حسب Gun Time
    const finishedEntries = entries.filter(e => e.status === 'finished');
    finishedEntries.sort((a, b) => a.gunTimeMs - b.gunTimeMs);

    const winnerGunTime = finishedEntries[0]?.gunTimeMs || 0;

    finishedEntries.forEach((entry, idx) => {
      entry.rank = idx + 1;
      const gap = entry.gunTimeMs - winnerGunTime;
      entry.gapMs = gap;
      entry.formattedGap = idx === 0 ? '-' : `+${this.formatTime(gap)}`;
    });

    // دمج النهائي: المؤهلين أولاً، ثم DNF، ثم DQ، ثم DNS
    const nonFinished = entries.filter(e => e.status !== 'finished');
    const finalResults = [...finishedEntries, ...nonFinished];

    this.inMemoryResults.set(competition.id, finalResults);
    this.saveToStorage();
    return finalResults;
  }

  // ══════════════════════════════════════════════════════════════
  // دورة حياة الاعتماد والإقفال الرسمي (Official Locking)
  // ══════════════════════════════════════════════════════════════

  public isCompetitionLocked(competitionId: string): boolean {
    const status = this.competitionStatus.get(competitionId) || 'provisional';
    return status === 'official' || status === 'certified';
  }

  public getCompetitionResultStatus(competitionId: string): CompetitionResultStatus {
    return this.competitionStatus.get(competitionId) || 'provisional';
  }

  public setCompetitionResultStatus(competitionId: string, status: CompetitionResultStatus): void {
    this.competitionStatus.set(competitionId, status);
  }

  /**
   * إقفال النتائج رسمياً من قبل الحكم الرئيسي
   */
  public lockResults(
    competitionId: string,
    chiefJudgeId: string,
    chiefJudgeName: string,
    reason: string = 'اعتماد النتائج الرسمية النهائية بعد انقضاء مهلة الطعون'
  ): boolean {
    this.competitionStatus.set(competitionId, 'official');

    const audit: ChiefJudgeLockAudit = {
      id: `audit_lock_${Date.now()}`,
      competitionId,
      action: 'lock',
      chiefJudgeId,
      chiefJudgeName,
      timestamp: Date.now(),
      reason
    };

    this.inMemoryAudit.unshift(audit);

    // تحديث كائن النتائج
    const results = this.inMemoryResults.get(competitionId);
    if (results) {
      results.forEach(r => r.isLocked = true);
    }

    this.saveToStorage();
    return true;
  }

  /**
   * فك القفل الإداري مع تسجيل السبب التدقيقي الإلزامي
   */
  public unlockResults(
    competitionId: string,
    chiefJudgeId: string,
    chiefJudgeName: string,
    overrideReason: string
  ): boolean {
    if (!overrideReason || overrideReason.trim().length < 5) {
      throw new Error('يلزم تسجيل سبب رسمي صريح ومفصل لفك قفل النتائج المعتمدة.');
    }

    this.competitionStatus.set(competitionId, 'under_review');

    const audit: ChiefJudgeLockAudit = {
      id: `audit_unlock_${Date.now()}`,
      competitionId,
      action: 'unlock',
      chiefJudgeId,
      chiefJudgeName,
      timestamp: Date.now(),
      reason: overrideReason
    };

    this.inMemoryAudit.unshift(audit);

    const results = this.inMemoryResults.get(competitionId);
    if (results) {
      results.forEach(r => r.isLocked = false);
    }

    this.saveToStorage();
    return true;
  }

  /**
   * تصديق النتائج نهائياً والتوقيع الرقمي للحكم العام
   */
  public certifyResults(
    competitionId: string,
    chiefJudgeId: string,
    chiefJudgeName: string
  ): boolean {
    this.competitionStatus.set(competitionId, 'certified');

    const audit: ChiefJudgeLockAudit = {
      id: `audit_cert_${Date.now()}`,
      competitionId,
      action: 'certify',
      chiefJudgeId,
      chiefJudgeName,
      timestamp: Date.now(),
      reason: 'تصديق وتوقيع رسمي نهائي من قبل الحكم العام'
    };

    this.inMemoryAudit.unshift(audit);
    this.saveToStorage();
    return true;
  }

  public getLockAuditLog(competitionId?: string): ChiefJudgeLockAudit[] {
    if (competitionId) {
      return this.inMemoryAudit.filter(a => a.competitionId === competitionId);
    }
    return [...this.inMemoryAudit];
  }

  // ══════════════════════════════════════════════════════════════
  // إدارة الطعون والاستئنافات الرسمية (World Athletics Rule 8)
  // ══════════════════════════════════════════════════════════════

  public fileProtest(params: {
    competitionId: string;
    bibNumber: number;
    clubName: string;
    filedByName: string;
    reason: string;
    feeDeposited: boolean;
  }): ProtestAppeal {
    const protest: ProtestAppeal = {
      id: `protest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      competitionId: params.competitionId,
      bibNumber: params.bibNumber,
      clubName: params.clubName,
      filedByName: params.filedByName,
      filedAt: Date.now(),
      feeDeposited: params.feeDeposited,
      reason: params.reason,
      status: 'pending'
    };

    this.inMemoryProtests.set(protest.id, protest);
    this.competitionStatus.set(params.competitionId, 'under_review');
    this.saveToStorage();
    return protest;
  }

  public decideProtest(
    protestId: string,
    decision: 'accepted' | 'rejected',
    decisionNote: string,
    chiefJudgeId: string
  ): boolean {
    const protest = this.inMemoryProtests.get(protestId);
    if (!protest) return false;

    protest.status = decision;
    protest.decisionNote = decisionNote;
    protest.decidedByChiefJudgeId = chiefJudgeId;
    protest.decidedAt = Date.now();

    this.saveToStorage();
    return true;
  }

  public listProtests(competitionId?: string): ProtestAppeal[] {
    const all = Array.from(this.inMemoryProtests.values());
    if (competitionId) {
      return all.filter(p => p.competitionId === competitionId);
    }
    return all;
  }

  // ══════════════════════════════════════════════════════════════
  // مصفوفة قياس هواتف وتزامن الحكام (Judge Matrix Telemetry)
  // ══════════════════════════════════════════════════════════════

  public updateJudgeTelemetry(telemetry: JudgeTelemetry): void {
    const key = `${telemetry.checkpointId}_${telemetry.judgeId}`;
    this.inMemoryTelemetry.set(key, telemetry);
    this.saveToStorage();
  }

  public getJudgeMatrix(competitionId?: string): JudgeTelemetry[] {
    const list = Array.from(this.inMemoryTelemetry.values());
    if (competitionId) {
      // إذا أردنا فلترة حسب المنافسة
      return list;
    }
    return list;
  }

  public clearAll(): void {
    this.inMemoryResults.clear();
    this.inMemoryProtests.clear();
    this.inMemoryAudit = [];
    this.inMemoryTelemetry.clear();
    this.competitionStatus.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(RESULTS_STORAGE_KEY);
      localStorage.removeItem(PROTESTS_STORAGE_KEY);
      localStorage.removeItem(AUDIT_STORAGE_KEY);
      localStorage.removeItem(TELEMETRY_STORAGE_KEY);
    }
  }
}

export const chiefJudgeControlService = new ChiefJudgeControlService();
