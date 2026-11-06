import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryEngine } from '../src/services/categoryEngine';
import { AthleteDeduplicationService } from '../src/services/athleteDeduplicationService';
import { athleteClubStorage } from '../src/services/athleteClubStorage';
import { useAthleteStore } from '../src/stores/athleteStore';
import { Athlete, Club } from '../src/types/athletics';

describe('Stage C1: Category Engine (World Athletics age rules)', () => {
  const refYear = 2026;

  it('calculates age categories correctly according to reference year', () => {
    // Under 14 -> U14 (born 2013 -> age 13)
    expect(CategoryEngine.calculateCategory('2013-05-10', refYear).category).toBe('U14');

    // 14 or 15 -> U16 (born 2011 -> age 15)
    expect(CategoryEngine.calculateCategory('2011-12-31', refYear).category).toBe('U16');
    expect(CategoryEngine.calculateCategory('2012-01-01', refYear).category).toBe('U16');

    // 16 or 17 -> U18 (born 2009 -> age 17)
    expect(CategoryEngine.calculateCategory('2009-08-20', refYear).category).toBe('U18');
    expect(CategoryEngine.calculateCategory('2010-02-15', refYear).category).toBe('U18');

    // 18 or 19 -> U20 (born 2007 -> age 19)
    expect(CategoryEngine.calculateCategory('2007-04-01', refYear).category).toBe('U20');
    expect(CategoryEngine.calculateCategory('2008-11-25', refYear).category).toBe('U20');

    // 20 to 34 -> SENIOR (born 2000 -> age 26)
    expect(CategoryEngine.calculateCategory('2000-01-01', refYear).category).toBe('SENIOR');
    expect(CategoryEngine.calculateCategory('1992-06-15', refYear).category).toBe('SENIOR');

    // 35+ -> MASTER (born 1985 -> age 41)
    expect(CategoryEngine.calculateCategory('1985-03-22', refYear).category).toBe('MASTER');
  });

  it('handles invalid or empty birthdates safely by falling back to OPEN', () => {
    expect(CategoryEngine.calculateCategory('', refYear).category).toBe('OPEN');
    expect(CategoryEngine.calculateCategory('invalid-date', refYear).category).toBe('OPEN');
    expect(CategoryEngine.calculateCategory('1850-01-01', refYear).category).toBe('OPEN');
  });

  it('validates athlete eligibility and handles Surclassement', () => {
    const u18Athlete: Athlete = {
      id: 'ath_test_u18',
      licenseNumber: 'DZ-2026-99001',
      firstName: 'علي',
      lastName: 'مفتاح',
      birthDate: '2009-06-15', // Age 17 in 2026 -> U18
      gender: 'M',
      nationality: 'الجزائر',
      primaryDiscipline: 'sprints',
      eligibleEvents: ['100m'],
      personalBests: [],
      seasonBests: [],
      medicalClearance: true,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Eligible for U18
    const checkSame = CategoryEngine.validateAthleteCategory(u18Athlete, 'U18', refYear);
    expect(checkSame.eligible).toBe(true);

    // Ineligible for U16 (too old)
    const checkYounger = CategoryEngine.validateAthleteCategory(u18Athlete, 'U16', refYear);
    expect(checkYounger.eligible).toBe(false);

    // Ineligible for Senior without surclassement flag
    const checkSeniorNoSurclassement = CategoryEngine.validateAthleteCategory(u18Athlete, 'SENIOR', refYear, false);
    expect(checkSeniorNoSurclassement.eligible).toBe(false);

    // Eligible for Senior with surclassement flag
    const checkSeniorWithSurclassement = CategoryEngine.validateAthleteCategory(u18Athlete, 'SENIOR', refYear, true);
    expect(checkSeniorWithSurclassement.eligible).toBe(true);
    expect(checkSeniorWithSurclassement.reason).toContain('Surclassement');
  });

  it('creates an immutable category snapshot for a competition', () => {
    const athletes: Athlete[] = [
      {
        id: 'ath_1',
        licenseNumber: 'DZ-1',
        firstName: 'أحمد',
        lastName: 'قاسم',
        birthDate: '2005-02-10', // Age 21 -> SENIOR
        gender: 'M',
        nationality: 'الجزائر',
        primaryDiscipline: 'sprints',
        eligibleEvents: ['100m'],
        personalBests: [],
        seasonBests: [],
        medicalClearance: true,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'ath_2',
        licenseNumber: 'DZ-2',
        firstName: 'ياسمين',
        lastName: 'بن سالم',
        birthDate: '2010-09-01', // Age 16 -> U18
        gender: 'F',
        nationality: 'الجزائر',
        primaryDiscipline: 'middle_distance',
        eligibleEvents: ['800m'],
        personalBests: [],
        seasonBests: [],
        medicalClearance: true,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const snapshot = CategoryEngine.createCategorySnapshot('comp_regional_2026', athletes, refYear);

    expect(snapshot.competitionId).toBe('comp_regional_2026');
    expect(snapshot.referenceYear).toBe(2026);
    expect(snapshot.frozenAt).toBeGreaterThan(0);
    expect(snapshot.athleteSnapshots.length).toBe(2);
    expect(snapshot.athleteSnapshots[0].calculatedCategory).toBe('SENIOR');
    expect(snapshot.athleteSnapshots[0].ageAtCompetition).toBe(21);
    expect(snapshot.athleteSnapshots[1].calculatedCategory).toBe('U18');
    expect(snapshot.athleteSnapshots[1].ageAtCompetition).toBe(16);
  });
});

describe('Stage C1: Athlete Deduplication Service', () => {
  it('normalizes Arabic characters (diacritics, alef, ya, ta marbuta)', () => {
    const rawArabic = 'أَحْمَدُ إِبْرَاهِيمْ مَكِّيَّة';
    const normalized = AthleteDeduplicationService.normalizeArabic(rawArabic);
    expect(normalized).toBe('احمد ابراهيم مكيه');
  });

  it('normalizes Latin characters by removing diacritics and accents', () => {
    const rawLatin = 'Élodie François-Müller';
    const normalized = AthleteDeduplicationService.normalizeLatin(rawLatin);
    expect(normalized).toBe('elodie francois muller');
  });

  it('computes Levenshtein similarity accurately', () => {
    expect(AthleteDeduplicationService.calculateSimilarity('Youssef', 'Youssef')).toBe(1.0);
    expect(AthleteDeduplicationService.calculateSimilarity('Youssef', 'Yousef')).toBeGreaterThan(0.85);
    expect(AthleteDeduplicationService.calculateSimilarity('Ahmed', 'Zinedine')).toBeLessThan(0.3);
  });

  it('detects exact license collision and blocks duplicate registration', () => {
    const existingAthletes: Athlete[] = [
      {
        id: 'ath_01',
        licenseNumber: 'DZ-2026-10492',
        firstName: 'يوسف',
        lastName: 'العبدلي',
        birthDate: '2001-04-12',
        gender: 'M',
        nationality: 'الجزائر',
        clubName: 'مولودية الجزائر',
        primaryDiscipline: 'sprints',
        eligibleEvents: ['100m'],
        personalBests: [],
        seasonBests: [],
        medicalClearance: true,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const duplicateCandidate: Partial<Athlete> = {
      licenseNumber: 'dz-2026-10492', // same license case-insensitive
      firstName: 'يوسف',
      lastName: 'عبدلي',
      birthDate: '2001-04-12',
    };

    const matches = AthleteDeduplicationService.findDuplicates(duplicateCandidate, existingAthletes);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].matchType).toBe('exact_license');
    expect(matches[0].recommendedAction).toBe('block');
  });

  it('detects matching name and birth year as blocking duplicate', () => {
    const existingAthletes: Athlete[] = [
      {
        id: 'ath_02',
        licenseNumber: 'DZ-2026-10518',
        firstName: 'سفيان',
        lastName: 'البقالي',
        birthDate: '1996-01-07',
        gender: 'M',
        nationality: 'الجزائر',
        primaryDiscipline: 'long_distance',
        eligibleEvents: ['5000m'],
        personalBests: [],
        seasonBests: [],
        medicalClearance: true,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const candidate: Partial<Athlete> = {
      licenseNumber: 'DZ-NEW-99999', // different license
      firstName: 'سفيان',
      lastName: 'البقالي', // same name
      birthDate: '1996-05-20', // same year 1996
    };

    const matches = AthleteDeduplicationService.findDuplicates(candidate, existingAthletes);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].matchType).toBe('name_and_birthyear');
    expect(matches[0].recommendedAction).toBe('block');
  });

  it('exempts athlete when checking candidate with same athlete id (update flow)', () => {
    const existingAthletes: Athlete[] = [
      {
        id: 'ath_existing_id',
        licenseNumber: 'DZ-2026-55555',
        firstName: 'طارق',
        lastName: 'حاج',
        birthDate: '1998-03-10',
        gender: 'M',
        nationality: 'الجزائر',
        primaryDiscipline: 'sprints',
        eligibleEvents: ['200m'],
        personalBests: [],
        seasonBests: [],
        medicalClearance: true,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const updatingCandidate: Partial<Athlete> = {
      id: 'ath_existing_id', // same ID being edited
      licenseNumber: 'DZ-2026-55555',
      firstName: 'طارق',
      lastName: 'حاج',
      birthDate: '1998-03-10',
    };

    const matches = AthleteDeduplicationService.findDuplicates(updatingCandidate, existingAthletes);
    expect(matches.length).toBe(0);
  });
});

describe('Stage C1: Athlete & Club Storage and Zustand Store', () => {
  beforeEach(async () => {
    await athleteClubStorage.clearAll();
  });

  it('provides initial seed data when storage is empty', async () => {
    const clubs = await athleteClubStorage.getAllClubs();
    expect(clubs.length).toBeGreaterThanOrEqual(4);
    expect(clubs.some((c) => c.code === 'MCA')).toBe(true);

    const athletes = await athleteClubStorage.getAllAthletes();
    expect(athletes.length).toBeGreaterThanOrEqual(2);
    expect(athletes.some((a) => a.licenseNumber === 'DZ-2026-10492')).toBe(true);
  });

  it('performs CRUD on athletes correctly', async () => {
    const newAthlete: Athlete = {
      id: 'ath_crud_test',
      bibNumber: 777,
      licenseNumber: 'DZ-2026-77777',
      firstName: 'كريم',
      lastName: 'زياني',
      birthDate: '2003-08-14',
      gender: 'M',
      nationality: 'الجزائر',
      clubId: 'club_mca',
      clubName: 'مولودية الجزائر',
      primaryDiscipline: 'sprints',
      eligibleEvents: ['400m'],
      personalBests: [
        { eventCode: '400m', eventName: '400 متر', recordValue: '46.12s', numericValueMsOrCm: 46120, date: '2025-05-10' }
      ],
      seasonBests: [],
      medicalClearance: true,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await athleteClubStorage.saveAthlete(newAthlete);
    const fetched = await athleteClubStorage.getAthleteById('ath_crud_test');
    expect(fetched).toBeDefined();
    expect(fetched?.firstName).toBe('كريم');
    expect(fetched?.personalBests.length).toBe(1);

    await athleteClubStorage.deleteAthlete('ath_crud_test');
    const afterDelete = await athleteClubStorage.getAthleteById('ath_crud_test');
    expect(afterDelete).toBeNull();
  });

  it('performs CRUD on clubs correctly', async () => {
    const newClub: Club = {
      id: 'club_test_setif',
      code: 'ESS',
      name: 'وفاق سطيف لألعاب القوى',
      shortName: 'وفاق سطيف',
      wilaya: 'سطيف',
      colors: ['#000000', '#FFFFFF'],
      medalsTally: { gold: 5, silver: 3, bronze: 2, total: 10 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await athleteClubStorage.saveClub(newClub);
    const fetched = await athleteClubStorage.getClubById('club_test_setif');
    expect(fetched).toBeDefined();
    expect(fetched?.code).toBe('ESS');

    await athleteClubStorage.deleteClub('club_test_setif');
    const afterDelete = await athleteClubStorage.getClubById('club_test_setif');
    expect(afterDelete).toBeNull();
  });

  it('integrates seamlessly with useAthleteStore', async () => {
    const store = useAthleteStore.getState();
    await store.loadAthletesAndClubs();

    expect(useAthleteStore.getState().athletes.length).toBeGreaterThan(0);
    expect(useAthleteStore.getState().clubs.length).toBeGreaterThan(0);

    // Test deduplication check via store
    const matches = store.checkDeduplication({
      licenseNumber: 'DZ-2026-10492', // collides with seed athlete Youssef
      firstName: 'يوسف',
      lastName: 'العبدلي',
      birthDate: '2001-04-12',
    });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].matchType).toBe('exact_license');
  });
});
