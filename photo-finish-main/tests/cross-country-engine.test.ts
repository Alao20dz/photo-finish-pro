import { describe, it, expect } from 'vitest';
import { CrossCountryResultEngine } from '../src/services/crossCountryResultEngine';
import { AthleticsCompetition, Checkpoint, PassageEvent } from '../src/types/athletics';

describe('CrossCountryResultEngine', () => {
  const mockCheckpoints: Checkpoint[] = [
    { id: 'cp_start', code: 'START', name: 'البداية', distanceKm: 0, type: 'start', requiredLaps: [1], order: 0, assignedJudgeIds: [] },
    { id: 'cp_01', code: 'CP01', name: 'نقطة 1', distanceKm: 2, type: 'intermediate', requiredLaps: [1], order: 1, assignedJudgeIds: [] },
    { id: 'cp_02', code: 'CP02', name: 'نقطة 2', distanceKm: 4, type: 'intermediate', requiredLaps: [1], order: 2, assignedJudgeIds: [] },
    { id: 'cp_finish', code: 'FINISH', name: 'النهاية', distanceKm: 6, type: 'finish', requiredLaps: [1], order: 3, assignedJudgeIds: [] },
  ];

  const mockCompetition: AthleticsCompetition = {
    id: 'comp_cc_01',
    name: 'سباق العدو الريفي 6 كم',
    type: 'cross_country',
    venue: 'غابة باينام',
    date: '2026-11-04',
    distanceKm: 6,
    lapCount: 1,
    category: 'SENIOR',
    gender: 'M',
    checkpoints: mockCheckpoints,
    actualStartTime: 100000,
    status: 'in_progress',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('correctly ranks finished runners by elapsed time', () => {
    // Runner 10 finished at t=120000 (20s)
    // Runner 12 finished at t=118000 (18s) - Faster!
    const passages: PassageEvent[] = [
      { id: 'p1', competitionId: 'comp_cc_01', checkpointId: 'cp_start', checkpointCode: 'START', lapNumber: 1, bibNumber: 10, timestamp: 100000, recordedByJudgeId: 'j1', deviceId: 'd1', source: 'quick_button', syncStatus: 'synced' },
      { id: 'p2', competitionId: 'comp_cc_01', checkpointId: 'cp_finish', checkpointCode: 'FINISH', lapNumber: 1, bibNumber: 10, timestamp: 120000, recordedByJudgeId: 'j1', deviceId: 'd1', source: 'quick_button', syncStatus: 'synced' },
      { id: 'p3', competitionId: 'comp_cc_01', checkpointId: 'cp_start', checkpointCode: 'START', lapNumber: 1, bibNumber: 12, timestamp: 100000, recordedByJudgeId: 'j1', deviceId: 'd1', source: 'quick_button', syncStatus: 'synced' },
      { id: 'p4', competitionId: 'comp_cc_01', checkpointId: 'cp_finish', checkpointCode: 'FINISH', lapNumber: 1, bibNumber: 12, timestamp: 118000, recordedByJudgeId: 'j1', deviceId: 'd1', source: 'quick_button', syncStatus: 'synced' },
    ];

    const standings = CrossCountryResultEngine.computeStandings(mockCompetition, passages);

    expect(standings).toHaveLength(2);
    expect(standings[0].bibNumber).toBe(12); // Winner
    expect(standings[0].rank).toBe(1);
    expect(standings[0].status).toBe('finished');
    expect(standings[1].bibNumber).toBe(10);
    expect(standings[1].rank).toBe(2);
    expect(standings[1].gapToLeaderMs).toBe(2000); // 2 seconds behind
  });

  it('flags runners who missed an intermediate checkpoint', () => {
    // Runner 5 skipped CP01 and only registered at START and CP02
    const passages: PassageEvent[] = [
      { id: 'p5', competitionId: 'comp_cc_01', checkpointId: 'cp_start', checkpointCode: 'START', lapNumber: 1, bibNumber: 5, timestamp: 100000, recordedByJudgeId: 'j1', deviceId: 'd1', source: 'quick_button', syncStatus: 'synced' },
      { id: 'p6', competitionId: 'comp_cc_01', checkpointId: 'cp_02', checkpointCode: 'CP02', lapNumber: 1, bibNumber: 5, timestamp: 110000, recordedByJudgeId: 'j1', deviceId: 'd1', source: 'quick_button', syncStatus: 'synced' },
    ];

    const standings = CrossCountryResultEngine.computeStandings(mockCompetition, passages);
    expect(standings[0].hasAnomaly).toBe(true);
    expect(standings[0].anomalyReason).toContain('CP01');
  });

  it('formats duration properly', () => {
    expect(CrossCountryResultEngine.formatDuration(65430)).toBe('01:05.43');
    expect(CrossCountryResultEngine.formatDuration(3665430)).toBe('1:01:05.43');
  });
});
