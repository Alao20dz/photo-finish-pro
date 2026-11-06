import { describe, it, expect, beforeEach } from 'vitest';
import { MultiJudgeMergeEngine } from '../src/services/multiJudgeMergeEngine';
import { AthleticsCompetition, PassageEvent } from '../src/types/athletics';

describe('Stage C5: Multi-Judge Merge Engine & Off-Track Race Management', () => {
  let engine: MultiJudgeMergeEngine;

  const mockCompetition: AthleticsCompetition = {
    id: 'comp_cross_algiers_2026',
    name: 'بطولة الجزائر للعدو الريفي 2026',
    type: 'cross_country',
    venue: 'غابة باينام - الجزائر العاصمة',
    date: '2026-11-15',
    distanceKm: 8.0,
    lapCount: 4,
    category: 'SENIOR',
    gender: 'M',
    status: 'in_progress',
    isOfficial: false,
    checkpoints: [
      {
        id: 'cp_00_start',
        code: 'START',
        name: 'خط الانطلاق',
        distanceKm: 0.0,
        type: 'start',
        requiredLaps: [1],
        order: 0,
        assignedJudgeIds: ['judge_start_1']
      },
      {
        id: 'cp_01_bridge',
        code: 'CP01',
        name: 'نقطة جسر الوادي',
        distanceKm: 0.5,
        type: 'intermediate',
        requiredLaps: [1, 2, 3, 4],
        order: 1,
        assignedJudgeIds: ['judge_bridge_1', 'judge_bridge_2']
      },
      {
        id: 'cp_02_hill',
        code: 'CP02',
        name: 'قمة الهضبة',
        distanceKm: 1.2,
        type: 'intermediate',
        requiredLaps: [1, 2, 3, 4],
        order: 2,
        assignedJudgeIds: ['judge_hill_1']
      },
      {
        id: 'cp_03_forest',
        code: 'CP03',
        name: 'منعرج الغابة',
        distanceKm: 1.8,
        type: 'intermediate',
        requiredLaps: [1, 2, 3, 4],
        order: 3,
        assignedJudgeIds: ['judge_forest_1']
      },
      {
        id: 'cp_04_finish',
        code: 'FINISH',
        name: 'بوابة الوصول والحلقة',
        distanceKm: 2.0,
        type: 'finish',
        requiredLaps: [1, 2, 3, 4],
        order: 4,
        assignedJudgeIds: ['judge_finish_1']
      }
    ],
    runners: [],
    chiefJudgeId: 'chief_judge_01',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  beforeEach(() => {
    engine = new MultiJudgeMergeEngine();
    engine.clearAll();
  });

  describe('Multi-Judge Consensus & Merge', () => {
    it('merges multiple judge recordings for the same bib within the merge window', () => {
      const baseTime = 1700000000000;

      // Judge A records Bib 104 at CP01 at t
      // Judge B records Bib 104 at CP01 at t + 800ms (within 3000ms window)
      const rawPassages: PassageEvent[] = [
        {
          id: 'p1',
          competitionId: mockCompetition.id,
          checkpointId: 'cp_01_bridge',
          checkpointCode: 'CP01',
          runnerId: 'r104',
          bibNumber: 104,
          athleteName: 'توفيق مخلوفي',
          clubName: 'مولودية الجزائر',
          timestamp: baseTime + 800,
          lapNumber: 1,
          judgeId: 'judge_bridge_2',
          judgeName: 'الحكم المساعد ب'
        },
        {
          id: 'p2',
          competitionId: mockCompetition.id,
          checkpointId: 'cp_01_bridge',
          checkpointCode: 'CP01',
          runnerId: 'r104',
          bibNumber: 104,
          athleteName: 'توفيق مخلوفي',
          clubName: 'مولودية الجزائر',
          timestamp: baseTime,
          lapNumber: 1,
          judgeId: 'judge_bridge_1',
          judgeName: 'الحكم المساعد أ'
        }
      ];

      const { mergedPassages, anomalies } = engine.processPassages(mockCompetition, rawPassages);

      expect(mergedPassages.length).toBe(1);
      expect(mergedPassages[0].bibNumber).toBe(104);
      expect(mergedPassages[0].checkpointCode).toBe('CP01');
      expect(mergedPassages[0].officialTimestamp).toBe(baseTime); // أخذ أبكر توقيت
      expect(mergedPassages[0].corroboratingJudges.length).toBe(2);
      expect(mergedPassages[0].corroboratingJudges).toContain('judge_bridge_1');
      expect(mergedPassages[0].corroboratingJudges).toContain('judge_bridge_2');
      expect(mergedPassages[0].confidenceScore).toBeGreaterThanOrEqual(0.85);
      expect(anomalies.length).toBe(0);
    });

    it('debounces rapid duplicate taps from the same judge', () => {
      const baseTime = 1700000000000;

      // Same judge accidentally taps Bib 205 twice within 400ms
      const rawPassages: PassageEvent[] = [
        {
          id: 'p1',
          competitionId: mockCompetition.id,
          checkpointId: 'cp_01_bridge',
          checkpointCode: 'CP01',
          runnerId: 'r205',
          bibNumber: 205,
          timestamp: baseTime,
          lapNumber: 1,
          judgeId: 'judge_bridge_1'
        },
        {
          id: 'p2',
          competitionId: mockCompetition.id,
          checkpointId: 'cp_01_bridge',
          checkpointCode: 'CP01',
          runnerId: 'r205',
          bibNumber: 205,
          timestamp: baseTime + 400, // < 1500ms
          lapNumber: 1,
          judgeId: 'judge_bridge_1'
        }
      ];

      const { mergedPassages, anomalies } = engine.processPassages(mockCompetition, rawPassages);

      expect(mergedPassages.length).toBe(1);
      expect(anomalies.length).toBe(1);
      expect(anomalies[0].type).toBe('rapid_duplicate');
      expect(anomalies[0].resolved).toBe(true);
    });
  });

  describe('Anomaly Detection: Skipped Checkpoint, Speed & Reverse', () => {
    it('detects a skipped checkpoint along the course', () => {
      const baseTime = 1700000000000;

      // Runner recorded at START (order 0), then directly at CP02 (order 2), skipping CP01 (order 1)
      const rawPassages: PassageEvent[] = [
        {
          id: 'p0',
          competitionId: mockCompetition.id,
          checkpointId: 'cp_00_start',
          checkpointCode: 'START',
          runnerId: 'r55',
          bibNumber: 55,
          timestamp: baseTime,
          lapNumber: 1,
          judgeId: 'judge_start_1'
        },
        {
          id: 'p2',
          competitionId: mockCompetition.id,
          checkpointId: 'cp_02_hill',
          checkpointCode: 'CP02',
          runnerId: 'r55',
          bibNumber: 55,
          timestamp: baseTime + 250000, // 4 mins later
          lapNumber: 1,
          judgeId: 'judge_hill_1'
        }
      ];

      const { mergedPassages, anomalies } = engine.processPassages(mockCompetition, rawPassages);

      expect(mergedPassages.length).toBe(2);
      const skipAnom = anomalies.find(a => a.type === 'skipped_checkpoint');
      expect(skipAnom).toBeDefined();
      expect(skipAnom?.bibNumber).toBe(55);
      expect(skipAnom?.expectedCheckpointCode).toContain('CP01');
      expect(skipAnom?.severity).toBe('critical');

      // The CP02 passage status is marked suspicious
      const cp2Passage = mergedPassages.find(m => m.checkpointCode === 'CP02');
      expect(cp2Passage?.status).toBe('suspicious');
    });

    it('detects impossible split speed exceeding human capability (>28 km/h)', () => {
      const baseTime = 1700000000000;

      // Runner covers CP01 (0.5km) to CP02 (1.2km) = 0.7km in only 20 seconds
      // Speed = 0.7km / (20/3600)h = 126 km/h!
      const rawPassages: PassageEvent[] = [
        {
          id: 'p1',
          competitionId: mockCompetition.id,
          checkpointId: 'cp_01_bridge',
          checkpointCode: 'CP01',
          runnerId: 'r77',
          bibNumber: 77,
          timestamp: baseTime,
          lapNumber: 1,
          judgeId: 'judge_bridge_1'
        },
        {
          id: 'p2',
          competitionId: mockCompetition.id,
          checkpointId: 'cp_02_hill',
          checkpointCode: 'CP02',
          runnerId: 'r77',
          bibNumber: 77,
          timestamp: baseTime + 20000, // 20 seconds!
          lapNumber: 1,
          judgeId: 'judge_hill_1'
        }
      ];

      const { mergedPassages, anomalies } = engine.processPassages(mockCompetition, rawPassages);

      const speedAnom = anomalies.find(a => a.type === 'speed_anomaly');
      expect(speedAnom).toBeDefined();
      expect(speedAnom?.bibNumber).toBe(77);
      expect(speedAnom?.calculatedSpeedKmh).toBeGreaterThan(100);
      expect(speedAnom?.severity).toBe('critical');

      const suspiciousPassage = mergedPassages.find(m => m.checkpointCode === 'CP02');
      expect(suspiciousPassage?.status).toBe('suspicious');
    });

    it('detects reverse traversal on a one-way loop', () => {
      const baseTime = 1700000000000;

      // Runner recorded at CP02 (order 2), then later at CP01 (order 1) in the same lap
      const rawPassages: PassageEvent[] = [
        {
          id: 'p2',
          competitionId: mockCompetition.id,
          checkpointId: 'cp_02_hill',
          checkpointCode: 'CP02',
          runnerId: 'r88',
          bibNumber: 88,
          timestamp: baseTime,
          lapNumber: 1,
          judgeId: 'judge_hill_1'
        },
        {
          id: 'p1',
          competitionId: mockCompetition.id,
          checkpointId: 'cp_01_bridge',
          checkpointCode: 'CP01',
          runnerId: 'r88',
          bibNumber: 88,
          timestamp: baseTime + 60000, // 1 minute later
          lapNumber: 1,
          judgeId: 'judge_bridge_1'
        }
      ];

      const { anomalies } = engine.processPassages(mockCompetition, rawPassages);

      const revAnom = anomalies.find(a => a.type === 'reverse_traversal');
      expect(revAnom).toBeDefined();
      expect(revAnom?.bibNumber).toBe(88);
    });
  });

  describe('Chief Judge Overrides & Anomaly Resolution', () => {
    it('allows chief judge to resolve anomaly by dismiss or disqualification', () => {
      const baseTime = 1700000000000;
      const rawPassages: PassageEvent[] = [
        {
          id: 'p1',
          competitionId: mockCompetition.id,
          checkpointId: 'cp_01_bridge',
          checkpointCode: 'CP01',
          runnerId: 'r99',
          bibNumber: 99,
          timestamp: baseTime,
          lapNumber: 1,
          judgeId: 'judge_bridge_1'
        },
        {
          id: 'p2',
          competitionId: mockCompetition.id,
          checkpointId: 'cp_02_hill',
          checkpointCode: 'CP02',
          runnerId: 'r99',
          bibNumber: 99,
          timestamp: baseTime + 10000, // fast
          lapNumber: 1,
          judgeId: 'judge_hill_1'
        }
      ];

      const { anomalies } = engine.processPassages(mockCompetition, rawPassages);
      expect(anomalies.length).toBeGreaterThan(0);

      const anomId = anomalies[0].id;
      // Chief judge resolves by disqualifying
      const resolved = engine.resolveAnomaly(anomId, 'disqualify', 'قطع الطريق واختصار المسار عمداً');
      expect(resolved).toBe(true);

      const allMerged = engine.getAllMergedPassages(mockCompetition.id);
      const dqPassage = allMerged.find(m => m.bibNumber === 99 && m.checkpointCode === 'CP02');
      expect(dqPassage?.status).toBe('disqualified');
      expect(dqPassage?.anomalyReason).toContain('استبعاد رسمي');
    });
  });

  describe('Offline Sync Queue with Idempotency', () => {
    it('enqueues passages offline, avoids duplicates, and syncs idempotently', async () => {
      const p1: PassageEvent = {
        id: 'offline_p1',
        competitionId: mockCompetition.id,
        checkpointId: 'cp_01_bridge',
        checkpointCode: 'CP01',
        runnerId: 'r12',
        bibNumber: 12,
        timestamp: Date.now(),
        lapNumber: 1,
        judgeId: 'judge_offline'
      };

      engine.enqueueOfflinePassage(p1);
      engine.enqueueOfflinePassage(p1); // Duplicate tap in offline queue

      expect(engine.getOfflineQueue().length).toBe(1);

      // Reconnection: Sync with chief judge server
      const syncResult = await engine.syncOfflineQueue(async (batch) => {
        expect(batch.length).toBe(1);
        expect(batch[0].id).toBe('offline_p1');
        return true; // Sync success
      });

      expect(syncResult.syncedCount).toBe(1);
      expect(syncResult.remainingCount).toBe(0);
      expect(engine.getOfflineQueue().length).toBe(0);
    });
  });
});
