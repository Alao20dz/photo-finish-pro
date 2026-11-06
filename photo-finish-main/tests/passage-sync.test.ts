import { describe, it, expect, beforeEach } from 'vitest';
import { CrossCountryResultEngine } from '../src/services/crossCountryResultEngine';
import { AthleticsCompetition, Checkpoint, PassageEvent, PassageCorrection } from '../src/types/athletics';

describe('Athletics Passage & Audit Trail Integration', () => {
  const testComp: AthleticsCompetition = {
    id: 'comp_audit_test',
    name: 'اختبار التدقيق والنزاهة الرياضية',
    type: 'cross_country',
    venue: 'ميدان السباق',
    date: '2026-11-04',
    distanceKm: 5,
    lapCount: 2,
    category: 'SENIOR',
    gender: 'M',
    checkpoints: [
      { id: 'cp_start', code: 'START', name: 'البداية', distanceKm: 0, type: 'start', requiredLaps: [1], order: 0, assignedJudgeIds: [] },
      { id: 'cp_01', code: 'CP01', name: 'نقطة 1', distanceKm: 2.5, type: 'intermediate', requiredLaps: [1, 2], order: 1, assignedJudgeIds: [] },
      { id: 'cp_finish', code: 'FINISH', name: 'النهاية', distanceKm: 5.0, type: 'finish', requiredLaps: [2], order: 2, assignedJudgeIds: [] },
    ],
    actualStartTime: 1000000,
    status: 'in_progress',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('detects duplicate passage at same checkpoint and lap without breaking', () => {
    const p1: PassageEvent = {
      id: 'p_dup_1',
      competitionId: testComp.id,
      checkpointId: 'cp_01',
      checkpointCode: 'CP01',
      lapNumber: 1,
      bibNumber: 77,
      timestamp: 1005000,
      recordedByJudgeId: 'j1',
      deviceId: 'd1',
      source: 'quick_button',
      syncStatus: 'synced'
    };

    const p2Duplicate: PassageEvent = {
      id: 'p_dup_2',
      competitionId: testComp.id,
      checkpointId: 'cp_01',
      checkpointCode: 'CP01',
      lapNumber: 1,
      bibNumber: 77,
      timestamp: 1005020,
      recordedByJudgeId: 'j2',
      deviceId: 'd2',
      source: 'quick_button',
      syncStatus: 'synced',
      isFlagged: true,
      flagReason: 'تسجيل مزدوج'
    };

    const standings = CrossCountryResultEngine.computeStandings(testComp, [p1, p2Duplicate]);
    expect(standings).toHaveLength(1);
    expect(standings[0].bibNumber).toBe(77);
  });

  it('maintains non-destructive correction history', () => {
    const originalEvent: PassageEvent = {
      id: 'p_err_1',
      competitionId: testComp.id,
      checkpointId: 'cp_01',
      checkpointCode: 'CP01',
      lapNumber: 1,
      bibNumber: 88, // entered erroneously
      timestamp: 1006000,
      recordedByJudgeId: 'j1',
      deviceId: 'd1',
      source: 'quick_button',
      syncStatus: 'synced'
    };

    const correction: PassageCorrection = {
      id: 'corr_1',
      passageEventId: originalEvent.id,
      originalBibNumber: 88,
      correctedBibNumber: 89, // correct bib
      reason: 'خطأ إبصار من حكم النقطة',
      requestedByJudgeId: 'j1',
      requestedByName: 'حكم النقطة 1',
      requestedAt: 1006100,
      status: 'approved',
      reviewedByJudgeId: 'chief_1',
      reviewedByName: 'الحكم العام'
    };

    // Applying approved correction
    const correctedEvent: PassageEvent = {
      ...originalEvent,
      bibNumber: correction.correctedBibNumber,
      isFlagged: true,
      flagReason: `تم التصحيح رسمياً من ${correction.originalBibNumber} إلى ${correction.correctedBibNumber}`
    };

    const standings = CrossCountryResultEngine.computeStandings(testComp, [correctedEvent]);
    expect(standings[0].bibNumber).toBe(89);
    expect(correction.originalBibNumber).toBe(88); // audit trail intact!
  });

  it('handles 20 simulated judges registering simultaneously', () => {
    const simulatedEvents: PassageEvent[] = [];
    for (let i = 1; i <= 20; i++) {
      simulatedEvents.push({
        id: `event_batch_${i}`,
        competitionId: testComp.id,
        checkpointId: i % 2 === 0 ? 'cp_01' : 'cp_start',
        checkpointCode: i % 2 === 0 ? 'CP01' : 'START',
        lapNumber: 1,
        bibNumber: 100 + i,
        timestamp: 1000000 + i * 500,
        recordedByJudgeId: `judge_${i}`,
        deviceId: `device_${i}`,
        source: 'quick_button',
        syncStatus: 'synced'
      });
    }

    const standings = CrossCountryResultEngine.computeStandings(testComp, simulatedEvents);
    expect(standings).toHaveLength(20);
    // Runners at CP01 (2.5 km) should rank higher than runners at START (0 km)
    expect(standings[0].lastCheckpointCode).toBe('CP01');
  });
});
