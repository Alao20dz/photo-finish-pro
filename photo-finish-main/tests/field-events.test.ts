import { describe, it, expect, beforeEach } from 'vitest';
import { FieldEventService, fieldEventService } from '../src/services/fieldEventService';
import { FieldAthleteScore, FieldAttempt, VerticalHeightTrial } from '../src/types/athletics';

describe('Stage C3: Field Events Scoring & World Athletics Tie-Breaking', () => {
  beforeEach(async () => {
    await fieldEventService.clearAll();
  });

  describe('Rule 25: Horizontal Jumps and Throws (Countback Rule)', () => {
    it('ranks athletes by best valid measurement', () => {
      const athletes: FieldAthleteScore[] = [
        {
          athleteId: 'ath_1',
          athleteName: 'العداء 1',
          bibNumber: 101,
          clubName: 'MCA',
          order: 1,
          attempts: [
            { attemptNumber: 1, resultType: 'valid', measurementMeters: 7.80, timestamp: 1 },
            { attemptNumber: 2, resultType: 'valid', measurementMeters: 8.10, timestamp: 2 },
          ],
          bestValidMeasurement: 0,
          secondBestMeasurement: 0,
          rank: 1,
          status: 'active',
        },
        {
          athleteId: 'ath_2',
          athleteName: 'العداء 2',
          bibNumber: 102,
          clubName: 'GSP',
          order: 2,
          attempts: [
            { attemptNumber: 1, resultType: 'valid', measurementMeters: 8.20, timestamp: 1 },
            { attemptNumber: 2, resultType: 'foul', measurementMeters: 0, timestamp: 2 },
          ],
          bestValidMeasurement: 0,
          secondBestMeasurement: 0,
          rank: 2,
          status: 'active',
        },
      ];

      const ranked = FieldEventService.rankDistanceFieldAthletes(athletes);
      expect(ranked[0].athleteId).toBe('ath_2'); // 8.20m > 8.10m
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].athleteId).toBe('ath_1');
      expect(ranked[1].rank).toBe(2);
    });

    it('breaks ties using second-best valid measurement (Countback tie-breaker)', () => {
      const athletes: FieldAthleteScore[] = [
        {
          athleteId: 'ath_A',
          athleteName: 'هشام بوحنون',
          bibNumber: 412,
          clubName: 'MCA',
          order: 1,
          attempts: [
            { attemptNumber: 1, resultType: 'valid', measurementMeters: 8.25, timestamp: 1 },
            { attemptNumber: 2, resultType: 'valid', measurementMeters: 8.14, timestamp: 2 }, // 2nd best: 8.14m
            { attemptNumber: 3, resultType: 'valid', measurementMeters: 7.90, timestamp: 3 },
          ],
          bestValidMeasurement: 0,
          secondBestMeasurement: 0,
          rank: 1,
          status: 'active',
        },
        {
          athleteId: 'ath_B',
          athleteName: 'ياسين زواوي',
          bibNumber: 415,
          clubName: 'GSP',
          order: 2,
          attempts: [
            { attemptNumber: 1, resultType: 'valid', measurementMeters: 8.25, timestamp: 1 },
            { attemptNumber: 2, resultType: 'valid', measurementMeters: 8.10, timestamp: 2 }, // 2nd best: 8.10m
            { attemptNumber: 3, resultType: 'valid', measurementMeters: 8.05, timestamp: 3 },
          ],
          bestValidMeasurement: 0,
          secondBestMeasurement: 0,
          rank: 2,
          status: 'active',
        },
      ];

      const ranked = FieldEventService.rankDistanceFieldAthletes(athletes);
      // Both have identical best 8.25m, but ath_A has superior 2nd best (8.14m vs 8.10m)
      expect(ranked[0].athleteId).toBe('ath_A');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].athleteId).toBe('ath_B');
      expect(ranked[1].rank).toBe(2);
    });

    it('applies 3rd attempt countback when 1st and 2nd best marks are equal', () => {
      const athletes: FieldAthleteScore[] = [
        {
          athleteId: 'ath_X',
          athleteName: 'رياض بلحاج',
          bibNumber: 11,
          clubName: 'CRB',
          order: 1,
          attempts: [
            { attemptNumber: 1, resultType: 'valid', measurementMeters: 19.50, timestamp: 1 },
            { attemptNumber: 2, resultType: 'valid', measurementMeters: 19.20, timestamp: 2 },
            { attemptNumber: 3, resultType: 'valid', measurementMeters: 18.90, timestamp: 3 }, // 3rd best: 18.90m
          ],
          bestValidMeasurement: 0,
          secondBestMeasurement: 0,
          rank: 1,
          status: 'active',
        },
        {
          athleteId: 'ath_Y',
          athleteName: 'كمال سويسي',
          bibNumber: 12,
          clubName: 'ASSN',
          order: 2,
          attempts: [
            { attemptNumber: 1, resultType: 'valid', measurementMeters: 19.50, timestamp: 1 },
            { attemptNumber: 2, resultType: 'valid', measurementMeters: 19.20, timestamp: 2 },
            { attemptNumber: 3, resultType: 'valid', measurementMeters: 18.70, timestamp: 3 }, // 3rd best: 18.70m
          ],
          bestValidMeasurement: 0,
          secondBestMeasurement: 0,
          rank: 2,
          status: 'active',
        },
      ];

      const ranked = FieldEventService.rankDistanceFieldAthletes(athletes);
      expect(ranked[0].athleteId).toBe('ath_X');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].athleteId).toBe('ath_Y');
      expect(ranked[1].rank).toBe(2);
    });

    it('marks athlete with only foul attempts as No Mark (NM)', () => {
      const athlete: FieldAthleteScore = {
        athleteId: 'ath_foul',
        athleteName: 'متسابق أخطأ في كل محاولاته',
        bibNumber: 99,
        clubName: 'MCA',
        order: 1,
        attempts: [
          { attemptNumber: 1, resultType: 'foul', measurementMeters: 0, timestamp: 1 },
          { attemptNumber: 2, resultType: 'foul', measurementMeters: 0, timestamp: 2 },
          { attemptNumber: 3, resultType: 'foul', measurementMeters: 0, timestamp: 3 },
        ],
        bestValidMeasurement: 0,
        secondBestMeasurement: 0,
        rank: 1,
        status: 'active',
      };

      const ranked = FieldEventService.rankDistanceFieldAthletes([athlete]);
      expect(ranked[0].status).toBe('nm');
      expect(ranked[0].bestValidMeasurement).toBe(0);
    });
  });

  describe('Rule 26: Vertical Jumps (High Jump & Pole Vault Tie-Breaking)', () => {
    it('breaks ties using fewest attempts at the height last cleared', () => {
      const athletes: FieldAthleteScore[] = [
        {
          athleteId: 'ath_hj_1',
          athleteName: 'الواثب 1',
          bibNumber: 301,
          clubName: 'MCA',
          order: 1,
          attempts: [],
          verticalTrials: [
            { heightMeters: 2.10, trials: ['O'], cleared: true, attemptsCount: 1 },
            { heightMeters: 2.15, trials: ['O'], cleared: true, attemptsCount: 1 }, // Cleared 2.15 on 1st attempt
            { heightMeters: 2.18, trials: ['X', 'X', 'X'], cleared: false, attemptsCount: 3 },
          ],
          bestValidMeasurement: 0,
          secondBestMeasurement: 0,
          rank: 1,
          status: 'active',
        },
        {
          athleteId: 'ath_hj_2',
          athleteName: 'الواثب 2',
          bibNumber: 302,
          clubName: 'GSP',
          order: 2,
          attempts: [],
          verticalTrials: [
            { heightMeters: 2.10, trials: ['O'], cleared: true, attemptsCount: 1 },
            { heightMeters: 2.15, trials: ['X', 'X', 'O'], cleared: true, attemptsCount: 3 }, // Cleared 2.15 on 3rd attempt
            { heightMeters: 2.18, trials: ['X', 'X', 'X'], cleared: false, attemptsCount: 3 },
          ],
          bestValidMeasurement: 0,
          secondBestMeasurement: 0,
          rank: 2,
          status: 'active',
        },
      ];

      const ranked = FieldEventService.rankVerticalFieldAthletes(athletes);
      expect(ranked[0].athleteId).toBe('ath_hj_1'); // 1 attempt at 2.15 vs 3 attempts
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].athleteId).toBe('ath_hj_2');
      expect(ranked[1].rank).toBe(2);
    });

    it('breaks ties using fewest total failures throughout competition when attempts at deciding height are equal', () => {
      const athletes: FieldAthleteScore[] = [
        {
          athleteId: 'ath_hj_clean',
          athleteName: 'الواثب النظيف',
          bibNumber: 310,
          clubName: 'MCA',
          order: 1,
          attempts: [],
          verticalTrials: [
            { heightMeters: 2.05, trials: ['O'], cleared: true, attemptsCount: 1 },
            { heightMeters: 2.10, trials: ['O'], cleared: true, attemptsCount: 1 },
            { heightMeters: 2.15, trials: ['X', 'O'], cleared: true, attemptsCount: 2 }, // 1 total failure up to 2.15
            { heightMeters: 2.18, trials: ['X', 'X', 'X'], cleared: false, attemptsCount: 3 },
          ],
          bestValidMeasurement: 0,
          secondBestMeasurement: 0,
          rank: 1,
          status: 'active',
        },
        {
          athleteId: 'ath_hj_dirty',
          athleteName: 'الواثب مع أخطاء سابقة',
          bibNumber: 311,
          clubName: 'GSP',
          order: 2,
          attempts: [],
          verticalTrials: [
            { heightMeters: 2.05, trials: ['X', 'O'], cleared: true, attemptsCount: 2 },
            { heightMeters: 2.10, trials: ['X', 'O'], cleared: true, attemptsCount: 2 },
            { heightMeters: 2.15, trials: ['X', 'O'], cleared: true, attemptsCount: 2 }, // 3 total failures up to 2.15
            { heightMeters: 2.18, trials: ['X', 'X', 'X'], cleared: false, attemptsCount: 3 },
          ],
          bestValidMeasurement: 0,
          secondBestMeasurement: 0,
          rank: 2,
          status: 'active',
        },
      ];

      const ranked = FieldEventService.rankVerticalFieldAthletes(athletes);
      // Both cleared 2.15 on 2nd attempt, but ath_hj_clean has only 1 total failure vs 3
      expect(ranked[0].athleteId).toBe('ath_hj_clean');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].athleteId).toBe('ath_hj_dirty');
      expect(ranked[1].rank).toBe(2);
    });
  });

  describe('Field Event Service CRUD & Attempt Entry', () => {
    it('records attempts and updates competition ranking dynamically', async () => {
      const comp = await fieldEventService.getCompetitionById('field_sp_final_2026');
      expect(comp).toBeDefined();

      const newAttempt: FieldAttempt = {
        attemptNumber: 1,
        resultType: 'valid',
        measurementMeters: 18.75,
        timestamp: Date.now(),
      };

      const updated = await fieldEventService.recordDistanceAttempt(
        'field_sp_final_2026',
        'ath_sp_01',
        newAttempt
      );

      expect(updated).toBeDefined();
      const ath = updated?.athletes.find((a) => a.athleteId === 'ath_sp_01');
      expect(ath?.bestValidMeasurement).toBe(18.75);
      expect(ath?.rank).toBe(1);
    });
  });
});
