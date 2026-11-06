import { describe, it, expect } from 'vitest';
import { PhoneRole, RaceStatus, GunSoundType } from '../src/types/race';
import { AthleticsCompetition, PassageEvent, Checkpoint } from '../src/types/athletics';

describe('Legacy Compatibility & Types Integrity', () => {
  it('preserves existing 4 phone roles', () => {
    const roles: PhoneRole[] = ['start', 'finish', 'judge', 'chambre_dappel', null];
    expect(roles).toHaveLength(5);
  });

  it('preserves legacy race statuses', () => {
    const statuses: RaceStatus[] = [
      'idle',
      'waiting',
      'on_marks',
      'set',
      'racing',
      'finished',
      'false_start'
    ];
    expect(statuses).toContain('false_start');
    expect(statuses).toContain('racing');
  });

  it('supports new Athletics models without collision', () => {
    const sampleCheckpoint: Checkpoint = {
      id: 'cp_test_1',
      code: 'CP01',
      name: 'نقطة المراقبة الأولى',
      distanceKm: 2.0,
      type: 'intermediate',
      requiredLaps: [1, 2],
      order: 1,
      assignedJudgeIds: ['judge_1']
    };

    const sampleCompetition: AthleticsCompetition = {
      id: 'comp_123',
      name: 'بطولة العدو الريفي التجريبية',
      type: 'cross_country',
      venue: 'غابة بوشاوي',
      date: '2026-11-04',
      distanceKm: 8,
      lapCount: 4,
      category: 'SENIOR',
      gender: 'M',
      checkpoints: [sampleCheckpoint],
      status: 'ready',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    expect(sampleCompetition.checkpoints[0].code).toBe('CP01');
    expect(sampleCompetition.lapCount).toBe(4);
  });
});
