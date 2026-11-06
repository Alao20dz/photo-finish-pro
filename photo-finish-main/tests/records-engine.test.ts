/**
 * اختبارات محرك الأرقام القياسية (Records Engine)
 * تطبيق قواعد TR31: توقيت آلي، حد الرياح +2.0 حتى 200م، تديث الدفتر بالجولة.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateRecord,
  applyResultsToBook,
  formatOfficialTime,
  windRuleApplies,
  WIND_LIMIT_MS,
  type RecordAttempt,
  type RecordBook,
} from '../src/services/recordsEngine';

const baseAttempt = (over: Partial<RecordAttempt> = {}): RecordAttempt => ({
  athleteId: 'ath-1',
  athleteName: 'يوسف العبدلي',
  timeMs: 9987,
  gender: 'M',
  category: 'SENIOR',
  distanceM: 100,
  discipline: 'track',
  windMs: +1.2,
  fullyAutomaticTiming: true,
  ...over,
});

describe('Records Engine — eligibility rules (TR31)', () => {
  const emptyBook: RecordBook = {};

  it('awards a first-ever national and competition record with legal wind + FAT', () => {
    const res = evaluateRecord(baseAttempt(), {
      ...emptyBook,
      nationalRecordMs: null,
      competitionRecordMs: null,
      personalBestMs: null,
    });
    expect(res.eligible).toBe(true);
    expect(res.ineligibilityReasons).toHaveLength(0);
    expect(res.broken.map(b => b.level).sort()).toEqual(['competition', 'national', 'personal']);
    expect(res.broken.find(b => b.level === 'national')?.previousMs).toBeNull();
  });

  it('rejects records achieved with hand timing (no FAT)', () => {
    const res = evaluateRecord(baseAttempt({ fullyAutomaticTiming: false }), { nationalRecordMs: 10500 });
    expect(res.eligible).toBe(false);
    expect(res.ineligibilityReasons[0]).toContain('NOT_FAT');
    expect(res.broken).toHaveLength(0);
  });

  it('rejects sprint records with wind above +2.0 m/s', () => {
    const res = evaluateRecord(baseAttempt({ windMs: +2.3 }), { nationalRecordMs: 10500 });
    expect(res.eligible).toBe(false);
    expect(res.ineligibilityReasons[0]).toContain('WIND_EXCEEDED');

    // الحد تماماً +2.0 قانوني
    const legal = evaluateRecord(baseAttempt({ windMs: 2.0 }), { nationalRecordMs: 10500 });
    expect(legal.eligible).toBe(true);
    expect(legal.broken.some(b => b.level === 'national')).toBe(true);
  });

  it('requires wind measurement for short sprints but not for 5000m/road/cross', () => {
    // 100م بلا قياس رياح = غير مؤهل
    const sprint = evaluateRecord(baseAttempt({ windMs: null }), {});
    expect(sprint.eligible).toBe(false);
    expect(sprint.ineligibilityReasons[0]).toContain('NO_WIND');

    // 5000م مضمار بلا رياح = مؤهل (لا يخضع للقاعدة)
    const long = evaluateRecord(baseAttempt({ distanceM: 5000, windMs: null }), {});
    expect(long.eligible).toBe(true);

    // الطريق والعدو الريفي بلا رياح = مؤهلان
    const road = evaluateRecord(baseAttempt({ distanceM: 10000, discipline: 'road', windMs: null }), {});
    const xc = evaluateRecord(baseAttempt({ distanceM: 8000, discipline: 'cross_country', windMs: +9 }), {});
    expect(road.eligible).toBe(true);
    expect(xc.eligible).toBe(true);
  });

  it('applies wind rule only up to 200m on track', () => {
    expect(windRuleApplies(100, 'track')).toBe(true);
    expect(windRuleApplies(200, 'track')).toBe(true);
    expect(windRuleApplies(201, 'track')).toBe(false);
    expect(windRuleApplies(400, 'track')).toBe(false);
    expect(windRuleApplies(100, 'road')).toBe(false);
    expect(WIND_LIMIT_MS).toBe(2.0);
  });

  it('breaks existing records only with a strictly faster time and reports improvement', () => {
    const res = evaluateRecord(baseAttempt({ timeMs: 9940 }), {
      competitionRecordMs: 9980,
      nationalRecordMs: 9960,
      personalBestMs: 9940,
    });
    expect(res.eligible).toBe(true);
    const levels = res.broken.map(b => b.level);
    expect(levels).toContain('competition');
    expect(levels).toContain('national');
    expect(levels).not.toContain('personal'); // لم يحسّن رقمه الشخصي (تعادل)

    const nat = res.broken.find(b => b.level === 'national')!;
    expect(nat.previousMs).toBe(9960);
    expect(nat.improvementMs).toBe(20);
  });

  it('rejects invalid times', () => {
    const res = evaluateRecord(baseAttempt({ timeMs: 0 }), {});
    expect(res.eligible).toBe(false);
    expect(res.ineligibilityReasons.some(r => r.includes('INVALID_TIME'))).toBe(true);
  });
});

describe('Records Engine — round book update', () => {
  it('keeps the fastest time of the same round as the standing record', () => {
    const book: RecordBook = { competitionRecordMs: 10100, nationalRecordMs: 10050 };
    const attA = baseAttempt({ athleteId: 'a', athleteName: 'أ', timeMs: 10020 });
    const attB = baseAttempt({ athleteId: 'b', athleteName: 'ب', timeMs: 10010 });
    const r1 = evaluateRecord(attA, book);
    const r2 = evaluateRecord(attB, book);

    const next = applyResultsToBook(
      [ { attempt: attA, evaluation: r1 },
        { attempt: attB, evaluation: r2 } ],
      book
    );

    // الأسرع (10010) هو صاحب الرقم النهائي وليس أول من سجل
    expect(next.competitionRecordMs).toBe(10010);
    expect(next.competitionRecordHolder).toBe('ب');
    expect(next.nationalRecordMs).toBe(10010);
  });

  it('never lets an ineligible result (illegal wind) update the book', () => {
    const book: RecordBook = { competitionRecordMs: 10500 };
    const res = evaluateRecord(baseAttempt({ timeMs: 9000, windMs: +5.5 }), book);
    expect(res.eligible).toBe(false);
    const next = applyResultsToBook([{ attempt: baseAttempt({ windMs: +5.5 }), evaluation: res }], book);
    expect(next.competitionRecordMs).toBe(10500);
  });

  it('does not mutate the input book (pure function)', () => {
    const book: RecordBook = { competitionRecordMs: 10500 };
    const res = evaluateRecord(baseAttempt({ timeMs: 10000 }), book);
    applyResultsToBook([{ attempt: baseAttempt({ timeMs: 10000 }), evaluation: res }], book);
    expect(book.competitionRecordMs).toBe(10500);
  });
});

describe('Records Engine — official time formatting', () => {
  it('formats 100m times as SS.mmm', () => {
    expect(formatOfficialTime(9987)).toBe('9.987');
  });

  it('formats 1500m times as M:SS.mmm', () => {
    expect(formatOfficialTime(212340)).toBe('3:32.340');
  });

  it('formats marathon times as H:MM:SS.mmm', () => {
    expect(formatOfficialTime(7412530)).toBe('2:03:32.530');
  });

  it('renders invalid times as em-dash', () => {
    expect(formatOfficialTime(0)).toBe('—');
    expect(formatOfficialTime(NaN)).toBe('—');
  });
});
