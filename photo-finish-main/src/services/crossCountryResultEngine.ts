/**
 * محرك نتائج سباقات العدو الريفي والطريق ونقاط المراقبة
 * (Cross-Country & Road Race Scoring Engine)
 * 
 * المزايا:
 * 1. حساب الترتيب المباشر وفق التقدم في المسار والزمن المنقضي.
 * 2. كشف النقاط الناقصة والتسجيلات المشبوهة (Missed Checkpoint Detection).
 * 3. القدرة الكاملة على إعادة احتساب نتائج السباق بالكامل من أحداث المرور الخام (Determinism).
 * 4. دعم الحلقات المتعددة (Multi-Lap) ونقاط الالتفاف.
 */

import { 
  AthleticsCompetition, 
  PassageEvent, 
  RunnerLiveRanking
} from '../types/athletics';

export class CrossCountryResultEngine {
  /**
   * إعادة احتساب جدول الترتيب والنتائج بالكامل من قائمة أحداث المرور الخام
   * @param competition المنافسة المحددة بنقاط مراقبتها وعدد حلقاتها
   * @param passages جميع أحداث المرور المسجلة
   * @param runnerMetadata أسماء وأندية العدائين (اختياري للربط)
   */
  public static computeStandings(
    competition: AthleticsCompetition,
    passages: PassageEvent[],
    runnerMetadata?: Map<number, { name: string; club?: string }>
  ): RunnerLiveRanking[] {
    const sortedCheckpoints = [...competition.checkpoints].sort((a, b) => a.order - b.order);
    const finishCheckpoint = sortedCheckpoints.find(cp => cp.type === 'finish') || sortedCheckpoints[sortedCheckpoints.length - 1];
    const totalRequiredLaps = competition.lapCount || 1;

    // تجميع أحداث المرور لكل عداء حسب رقم الصدرية
    const bibPassagesMap = new Map<number, PassageEvent[]>();
    for (const p of passages) {
      if (p.competitionId !== competition.id) continue;
      const list = bibPassagesMap.get(p.bibNumber) || [];
      list.push(p);
      bibPassagesMap.set(p.bibNumber, list);
    }

    const rankings: RunnerLiveRanking[] = [];

    bibPassagesMap.forEach((runnerEvents, bib) => {
      // ترتيب أحداث هذا العداء زمنياً
      runnerEvents.sort((a, b) => a.timestamp - b.timestamp);

      const meta = runnerMetadata?.get(bib);
      const athleteName = meta?.name || runnerEvents[0].athleteName || `العداء #${bib}`;
      const club = meta?.club || runnerEvents[0].club || '—';

      // فحص الحلقات ونقاط المراقبة
      let lastCheckpointCode = 'START';
      let lastDistanceKm = 0;
      let lastPassageTime = competition.actualStartTime || runnerEvents[0].timestamp;
      let hasAnomaly = false;
      let anomalyReason: string | undefined = undefined;

      // تتبع النقاط المسجلة في كل حلقة
      const lapsMap = new Map<number, Set<string>>();
      for (const ev of runnerEvents) {
        const lapSet = lapsMap.get(ev.lapNumber) || new Set<string>();
        lapSet.add(ev.checkpointId);
        lapsMap.set(ev.lapNumber, lapSet);

        const cp = sortedCheckpoints.find(c => c.id === ev.checkpointId);
        if (cp) {
          lastCheckpointCode = cp.code;
          lastDistanceKm = (ev.lapNumber - 1) * competition.distanceKm / totalRequiredLaps + cp.distanceKm;
          lastPassageTime = ev.timestamp;
        }
      }

      // فحص تخطي النقاط الإلزامية في كل حلقة
      lapsMap.forEach((recordedCpIds, lapNum) => {
        const requiredCpsInLap = sortedCheckpoints.filter(cp => 
          !cp.requiredLaps || cp.requiredLaps.length === 0 || cp.requiredLaps.includes(lapNum)
        );

        for (const reqCp of requiredCpsInLap) {
          if (!recordedCpIds.has(reqCp.id)) {
            // تخطي نقطة معينة
            hasAnomaly = true;
            anomalyReason = `تخطي نقطة (${reqCp.code}) في الحلقة ${lapNum}`;
            break;
          }
        }
      });

      // احتساب الحلقات المكتملة
      let completedLapsCount = 0;
      if (finishCheckpoint) {
        completedLapsCount = runnerEvents.filter(ev => ev.checkpointId === finishCheckpoint.id).length;
      }

      const isFinished = completedLapsCount >= totalRequiredLaps;
      const totalElapsedTimeMs = competition.actualStartTime 
        ? Math.max(0, lastPassageTime - competition.actualStartTime)
        : (runnerEvents[runnerEvents.length - 1].timestamp - runnerEvents[0].timestamp);

      rankings.push({
        bibNumber: bib,
        athleteName,
        club,
        category: competition.category,
        lapsCompleted: completedLapsCount,
        lastCheckpointCode,
        lastCheckpointDistanceKm: lastDistanceKm,
        lastPassageTime,
        totalElapsedTimeMs,
        rank: 0, // سيتم حسابه بالترتيب
        gapToLeaderMs: 0,
        status: isFinished ? 'finished' : 'active',
        hasAnomaly,
        anomalyReason,
        passages: runnerEvents
      });
    });

    // ═══════════════════════════════════════════════════
    // خوارزمية الترتيب الرسمية (Ranking Criteria)
    // ═══════════════════════════════════════════════════
    // 1. الواصلون خط النهاية أولاً (الأقل زمناً أولاً)
    // 2. يليهم المتسابقون النشطون (الأكثر حلقات، ثم الأبعد مسافة، ثم الأسبق وصولاً)
    rankings.sort((a, b) => {
      if (a.status === 'finished' && b.status !== 'finished') return -1;
      if (a.status !== 'finished' && b.status === 'finished') return 1;

      if (a.status === 'finished' && b.status === 'finished') {
        return a.totalElapsedTimeMs - b.totalElapsedTimeMs;
      }

      // المتسابقون الذين لا يزالون في المسار:
      if (b.lapsCompleted !== a.lapsCompleted) {
        return b.lapsCompleted - a.lapsCompleted;
      }
      if (b.lastCheckpointDistanceKm !== a.lastCheckpointDistanceKm) {
        return b.lastCheckpointDistanceKm - a.lastCheckpointDistanceKm;
      }
      return a.lastPassageTime - b.lastPassageTime;
    });

    // احتساب الرتبة والفارق الزمني مع المتصدر
    const leaderTime = rankings.length > 0 ? rankings[0].totalElapsedTimeMs : 0;
    rankings.forEach((r, index) => {
      r.rank = index + 1;
      r.gapToLeaderMs = index === 0 ? 0 : Math.max(0, r.totalElapsedTimeMs - leaderTime);
    });

    return rankings;
  }

  /** تنسيق الزمن بصيغة ملائمة (دقيقة:ثانية.أجزاء) */
  public static formatDuration(ms: number): string {
    if (!ms || ms <= 0) return '00:00.00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centis = Math.floor((ms % 1000) / 10);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remMinutes = minutes % 60;
      return `${hours}:${String(remMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
  }
}
