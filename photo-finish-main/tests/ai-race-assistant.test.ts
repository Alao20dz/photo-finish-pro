import { describe, it, expect } from 'vitest';
import { aiRaceAssistantService } from '../src/services/aiRaceAssistant';
import { 
  AthleticsCompetition, 
  MergedPassage, 
  RaceResultEntry, 
  ClubTeamScore, 
  RaceAnomaly, 
  Checkpoint 
} from '../src/types/athletics';

describe('AiRaceAssistantService (Stage C8)', () => {
  const checkpoints: Checkpoint[] = [
    { id: 'cp-start', competitionId: 'comp-1', name: 'Start', code: 'START', order: 0, distanceKm: 0 },
    { id: 'cp-1', competitionId: 'comp-1', name: 'CP 1 (2.5km)', code: 'CP1', order: 1, distanceKm: 2.5 },
    { id: 'cp-2', competitionId: 'comp-1', name: 'CP 2 (5.0km)', code: 'CP2', order: 2, distanceKm: 5.0 },
    { id: 'cp-3', competitionId: 'comp-1', name: 'CP 3 (7.5km)', code: 'CP3', order: 3, distanceKm: 7.5 },
    { id: 'cp-fin', competitionId: 'comp-1', name: 'Finish (10km)', code: 'FINISH', order: 4, distanceKm: 10.0 },
  ];

  const baseCompetition: AthleticsCompetition = {
    id: 'comp-1',
    name: 'بطولة الجمهورية للعدو الريفي 10 كم',
    type: 'cross_country',
    venue: 'الجزائر العاصمة',
    date: '2026-12-15',
    distanceKm: 10,
    lapCount: 1,
    category: 'SENIOR',
    gender: 'M',
    status: 'completed',
    checkpoints,
    createdAt: Date.now() - 100000,
    updatedAt: Date.now(),
  };

  describe('analyzeRunnerPacing', () => {
    it('detects Negative Split when the second half is significantly faster', () => {
      // 10km split:
      // 0-2.5km: 9 minutes (540s) -> pace = 216s/km (3:36/km)
      // 2.5-5.0km: 9 minutes (540s) -> pace = 216s/km (3:36/km)
      // 5.0-7.5km: 8 minutes (480s) -> pace = 192s/km (3:12/km)
      // 7.5-10km: 7.8 minutes (468s) -> pace = 187.2s/km (3:07/km)
      const baseTime = 1700000000000;
      const passages: MergedPassage[] = [
        { id: 'p0', competitionId: 'comp-1', bibNumber: 101, athleteName: 'سليم بن عيسى', checkpointId: 'cp-start', officialTimestamp: baseTime, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'p1', competitionId: 'comp-1', bibNumber: 101, athleteName: 'سليم بن عيسى', checkpointId: 'cp-1', officialTimestamp: baseTime + 540000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'p2', competitionId: 'comp-1', bibNumber: 101, athleteName: 'سليم بن عيسى', checkpointId: 'cp-2', officialTimestamp: baseTime + 1080000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'p3', competitionId: 'comp-1', bibNumber: 101, athleteName: 'سليم بن عيسى', checkpointId: 'cp-3', officialTimestamp: baseTime + 1560000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'p4', competitionId: 'comp-1', bibNumber: 101, athleteName: 'سليم بن عيسى', checkpointId: 'cp-fin', officialTimestamp: baseTime + 2028000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
      ];

      const profile = aiRaceAssistantService.analyzeRunnerPacing(101, 'سليم بن عيسى', passages, checkpoints);

      expect(profile.bibNumber).toBe(101);
      expect(profile.pacingStyle).toBe('negative_split');
      expect(profile.tacticalAdvice).toContain('Negative Split');
      expect(profile.fastestSplitKm).toBeLessThan(profile.slowestSplitKm);
    });

    it('detects Positive Split when runner burns out and slows down in the second half', () => {
      // 0-2.5km: 7.5 mins (450s)
      // 2.5-5.0km: 7.8 mins (468s)
      // 5.0-7.5km: 10 mins (600s)
      // 7.5-10km: 11 mins (660s)
      const baseTime = 1700000000000;
      const passages: MergedPassage[] = [
        { id: 'p0', competitionId: 'comp-1', bibNumber: 102, athleteName: 'فؤاد خلوفي', checkpointId: 'cp-start', officialTimestamp: baseTime, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'p1', competitionId: 'comp-1', bibNumber: 102, athleteName: 'فؤاد خلوفي', checkpointId: 'cp-1', officialTimestamp: baseTime + 450000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'p2', competitionId: 'comp-1', bibNumber: 102, athleteName: 'فؤاد خلوفي', checkpointId: 'cp-2', officialTimestamp: baseTime + 918000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'p3', competitionId: 'comp-1', bibNumber: 102, athleteName: 'فؤاد خلوفي', checkpointId: 'cp-3', officialTimestamp: baseTime + 1518000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'p4', competitionId: 'comp-1', bibNumber: 102, athleteName: 'فؤاد خلوفي', checkpointId: 'cp-fin', officialTimestamp: baseTime + 2178000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
      ];

      const profile = aiRaceAssistantService.analyzeRunnerPacing(102, 'فؤاد خلوفي', passages, checkpoints);

      expect(profile.bibNumber).toBe(102);
      expect(profile.pacingStyle).toBe('positive_split');
      expect(profile.tacticalAdvice).toContain('Positive Split');
      expect(profile.tacticalAdvice).toContain('اللاكتات');
    });

    it('detects Even Pace when variation is minimal across the entire course', () => {
      // 0-2.5km: 8.5 mins (510s)
      // 2.5-5.0km: 8.5 mins (510s)
      // 5.0-7.5km: 8.5 mins (510s)
      // 7.5-10km: 8.5 mins (510s)
      const baseTime = 1700000000000;
      const passages: MergedPassage[] = [
        { id: 'p0', competitionId: 'comp-1', bibNumber: 103, athleteName: 'ياسين حتحات', checkpointId: 'cp-start', officialTimestamp: baseTime, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'p1', competitionId: 'comp-1', bibNumber: 103, athleteName: 'ياسين حتحات', checkpointId: 'cp-1', officialTimestamp: baseTime + 510000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'p2', competitionId: 'comp-1', bibNumber: 103, athleteName: 'ياسين حتحات', checkpointId: 'cp-2', officialTimestamp: baseTime + 1020000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'p3', competitionId: 'comp-1', bibNumber: 103, athleteName: 'ياسين حتحات', checkpointId: 'cp-3', officialTimestamp: baseTime + 1530000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'p4', competitionId: 'comp-1', bibNumber: 103, athleteName: 'ياسين حتحات', checkpointId: 'cp-fin', officialTimestamp: baseTime + 2040000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
      ];

      const profile = aiRaceAssistantService.analyzeRunnerPacing(103, 'ياسين حتحات', passages, checkpoints);

      expect(profile.bibNumber).toBe(103);
      expect(profile.pacingStyle).toBe('even_pace');
      expect(profile.paceVariationPercent).toBeLessThanOrEqual(5.0);
      expect(profile.tacticalAdvice).toContain('Even Pace');
    });
  });

  describe('detectLeadChanges', () => {
    it('tracks changes in leader and computes gap seconds across checkpoints', () => {
      const baseTime = 1700000000000;
      // At START: Runner 101 leads
      // At CP1: Runner 102 surges ahead of 101 by 4 seconds
      // At CP2: Runner 101 reclaims lead by 6 seconds
      const passages: MergedPassage[] = [
        // Start
        { id: 's1', competitionId: 'comp-1', bibNumber: 101, athleteName: 'سليم', checkpointId: 'cp-start', officialTimestamp: baseTime, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 's2', competitionId: 'comp-1', bibNumber: 102, athleteName: 'فؤاد', checkpointId: 'cp-start', officialTimestamp: baseTime + 2000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        // CP1
        { id: 'c1_2', competitionId: 'comp-1', bibNumber: 102, athleteName: 'فؤاد', checkpointId: 'cp-1', officialTimestamp: baseTime + 500000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'c1_1', competitionId: 'comp-1', bibNumber: 101, athleteName: 'سليم', checkpointId: 'cp-1', officialTimestamp: baseTime + 504000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        // CP2
        { id: 'c2_1', competitionId: 'comp-1', bibNumber: 101, athleteName: 'سليم', checkpointId: 'cp-2', officialTimestamp: baseTime + 1000000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
        { id: 'c2_2', competitionId: 'comp-1', bibNumber: 102, athleteName: 'فؤاد', checkpointId: 'cp-2', officialTimestamp: baseTime + 1006000, sourceJudgeIds: ['j1'], consensusLevel: 'unanimous', status: 'valid' },
      ];

      const leadChanges = aiRaceAssistantService.detectLeadChanges(baseCompetition, passages);

      expect(leadChanges.length).toBeGreaterThanOrEqual(3);
      // First is initial leader
      expect(leadChanges[0].newLeaderBib).toBe(101);
      // Second is overtake by 102
      expect(leadChanges[1].checkpointCode).toBe('CP1');
      expect(leadChanges[1].newLeaderBib).toBe(102);
      expect(leadChanges[1].previousLeaderBib).toBe(101);
      expect(leadChanges[1].gapSeconds).toBe(4);
      // Third is overtake back by 101
      expect(leadChanges[2].checkpointCode).toBe('CP2');
      expect(leadChanges[2].newLeaderBib).toBe(101);
      expect(leadChanges[2].previousLeaderBib).toBe(102);
      expect(leadChanges[2].gapSeconds).toBe(6);
    });
  });

  describe('diagnoseAnomalyClusters', () => {
    it('diagnoses multiple speed anomalies at the same checkpoint as a course measurement error', () => {
      const anomalies: RaceAnomaly[] = [
        { bibNumber: 11, checkpointCode: 'CP-3', type: 'speed_anomaly', details: 'Speed 32 km/h', timestamp: 1000, severity: 'warning' },
        { bibNumber: 12, checkpointCode: 'CP-3', type: 'speed_anomaly', details: 'Speed 34 km/h', timestamp: 1002, severity: 'warning' },
        { bibNumber: 13, checkpointCode: 'CP-3', type: 'speed_anomaly', details: 'Speed 33 km/h', timestamp: 1005, severity: 'warning' },
      ];

      const clusters = aiRaceAssistantService.diagnoseAnomalyClusters(anomalies);

      expect(clusters.length).toBe(1);
      expect(clusters[0].clusterType).toBe('suspected_course_measurement_error');
      expect(clusters[0].affectedCheckpoints).toEqual(['CP-3']);
      expect(clusters[0].affectedBibs).toEqual([11, 12, 13]);
      expect(clusters[0].confidence).toBeGreaterThan(0.9);
      expect(clusters[0].recommendation).toContain('مراجعة قياس المسافة الفعلي');
    });

    it('diagnoses multiple skipped checkpoints as judge phone outage or drift', () => {
      const anomalies: RaceAnomaly[] = [
        { bibNumber: 21, checkpointCode: 'CP-2', type: 'skipped_checkpoint', details: 'Not seen', timestamp: 1000, severity: 'high' },
        { bibNumber: 22, checkpointCode: 'CP-2', type: 'skipped_checkpoint', details: 'Not seen', timestamp: 1001, severity: 'high' },
        { bibNumber: 23, checkpointCode: 'CP-2', type: 'skipped_checkpoint', details: 'Not seen', timestamp: 1004, severity: 'high' },
      ];

      const clusters = aiRaceAssistantService.diagnoseAnomalyClusters(anomalies);

      expect(clusters.length).toBe(1);
      expect(clusters[0].clusterType).toBe('judge_timing_drift');
      expect(clusters[0].affectedCheckpoints).toEqual(['CP-2']);
      expect(clusters[0].recommendation).toContain('استيراد طابور عدم الاتصال');
    });

    it('treats single runner anomaly as isolated runner irregularity', () => {
      const anomalies: RaceAnomaly[] = [
        { bibNumber: 99, checkpointCode: 'CP-4', type: 'reverse_order', details: 'Reverse sequence', timestamp: 1000, severity: 'high' }
      ];

      const clusters = aiRaceAssistantService.diagnoseAnomalyClusters(anomalies);

      expect(clusters.length).toBe(1);
      expect(clusters[0].clusterType).toBe('isolated_runner_irregularity');
      expect(clusters[0].affectedBibs).toEqual([99]);
      expect(clusters[0].diagnosis).toContain('#99');
    });
  });

  describe('generateFullRaceReport', () => {
    it('synthesizes complete Arabic sports journalism race report', () => {
      const results: RaceResultEntry[] = [
        { rank: 1, bibNumber: 101, athleteName: 'سليم بن عيسى', clubName: 'مولودية الجزائر', gunTimeMs: 1845000, netTimeMs: 1844000, formattedGunTime: '30:45.00', formattedNetTime: '30:44.00', formattedGap: '+00:00.00', status: 'finished', isCertified: true },
        { rank: 2, bibNumber: 102, athleteName: 'فؤاد خلوفي', clubName: 'وفاق سطيف', gunTimeMs: 1858000, netTimeMs: 1856000, formattedGunTime: '30:58.00', formattedNetTime: '30:56.00', formattedGap: '+00:13.00', status: 'finished', isCertified: true },
        { rank: 3, bibNumber: 103, athleteName: 'ياسين حتحات', clubName: 'شباب بلوزداد', gunTimeMs: 1872000, netTimeMs: 1871000, formattedGunTime: '31:12.00', formattedNetTime: '31:11.00', formattedGap: '+00:27.00', status: 'finished', isCertified: true },
      ];

      const teamScores: ClubTeamScore[] = [
        {
          rank: 1,
          clubName: 'مولودية الجزائر',
          totalPoints: 12,
          scoringCount: 3,
          runners: [
            { bibNumber: 101, athleteName: 'سليم بن عيسى', individualRank: 1, timeMs: 1845000, formattedTime: '30:45.00', isScorer: true },
            { bibNumber: 104, athleteName: 'عادل حماني', individualRank: 4, timeMs: 1880000, formattedTime: '31:20.00', isScorer: true },
            { bibNumber: 107, athleteName: 'سمير قادري', individualRank: 7, timeMs: 1910000, formattedTime: '31:50.00', isScorer: true },
          ],
          lastScorerRank: 7,
          status: 'qualified',
        }
      ];

      const report = aiRaceAssistantService.generateFullRaceReport(
        baseCompetition,
        results,
        teamScores,
        [],
        []
      );

      expect(report.winnerHeadline).toContain('سليم بن عيسى');
      expect(report.winnerHeadline).toContain('مولودية الجزائر');
      expect(report.winnerHeadline).toContain('30:45.00');
      expect(report.teamChampionHeadline).toContain('مولودية الجزائر');
      expect(report.teamChampionHeadline).toContain('12 نقطة');
      expect(report.fullNarrativeArabic).toContain('التقرير الفني والتحليلي لسباق: بطولة الجمهورية للعدو الريفي 10 كم');
      expect(report.fullNarrativeArabic).toContain('World Athletics Rule 19');
      expect(report.fullNarrativeArabic).toContain('سليم بن عيسى');
      expect(report.triageRecommendations.length).toBeGreaterThan(0);
    });
  });
});
