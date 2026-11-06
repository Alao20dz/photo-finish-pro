import { describe, it, expect, beforeEach } from 'vitest';
import { coachWorkflowService, INITIAL_COACHES } from '../src/services/coachWorkflowService';
import { Athlete, AthleticsCompetition, Coach } from '../src/types/athletics';

describe('Stage C2: Coach Portal & Workflow Approvals', () => {
  const mcaCoach: Coach = INITIAL_COACHES[0]; // MCA Coach Ammar Bouras (clubId: 'club_mca', pin: '1921')

  const testCompetition: AthleticsCompetition = {
    id: 'comp_test_cross_2026',
    name: 'البطولة الوطنية للعدو الريفي 2026',
    type: 'cross_country',
    venue: 'غابة باينام',
    date: '2026-03-20',
    distanceKm: 10,
    lapCount: 5,
    category: 'SENIOR',
    gender: 'M',
    checkpoints: [],
    status: 'ready',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mcaAthlete: Athlete = {
    id: 'ath_mca_test_01',
    bibNumber: 201,
    licenseNumber: 'DZ-2026-2001',
    firstName: 'عبد الرحيم',
    lastName: 'بوزيان',
    birthDate: '2002-05-14',
    gender: 'M',
    nationality: 'الجزائر',
    clubId: 'club_mca',
    clubName: 'مولودية الجزائر',
    primaryDiscipline: 'middle_distance',
    eligibleEvents: ['1500m', 'cross_country'],
    personalBests: [],
    seasonBests: [],
    medicalClearance: true,
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const rivalClubAthlete: Athlete = {
    id: 'ath_rival_test_02',
    bibNumber: 301,
    licenseNumber: 'DZ-2026-3001',
    firstName: 'محمد',
    lastName: 'السطايفي',
    birthDate: '2001-08-20',
    gender: 'M',
    nationality: 'الجزائر',
    clubId: 'club_gsp', // Different club!
    clubName: 'المجمع البترولي',
    primaryDiscipline: 'long_distance',
    eligibleEvents: ['cross_country'],
    personalBests: [],
    seasonBests: [],
    medicalClearance: true,
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(async () => {
    await coachWorkflowService.clearAll();
  });

  it('authenticates coach via PIN code and enforces club isolation', async () => {
    // Correct PIN
    const coach = await coachWorkflowService.authenticateCoach('1921');
    expect(coach).toBeDefined();
    expect(coach?.name).toBe('الكابتن عمار بوراس');
    expect(coach?.clubId).toBe('club_mca');

    // Wrong PIN
    const wrong = await coachWorkflowService.authenticateCoach('0000');
    expect(wrong).toBeNull();

    // Matching clubId
    const matching = await coachWorkflowService.authenticateCoach('1921', 'club_mca');
    expect(matching).toBeDefined();

    // Mismatched clubId
    const mismatched = await coachWorkflowService.authenticateCoach('1921', 'club_gsp');
    expect(mismatched).toBeNull();
  });

  it('submits athlete registration successfully within the coach club', async () => {
    const res = await coachWorkflowService.submitAthleteRegistration(
      mcaAthlete,
      testCompetition,
      mcaCoach,
      ['cross_country']
    );

    expect(res.success).toBe(true);
    expect(res.registration).toBeDefined();
    expect(res.registration?.status).toBe('submitted');
    expect(res.registration?.clubId).toBe('club_mca');
    expect(res.registration?.calculatedCategory).toBe('SENIOR');
    expect(res.registration?.athleteName).toBe('عبد الرحيم بوزيان');
  });

  it('strictly blocks coach from registering athletes belonging to competitor clubs', async () => {
    const res = await coachWorkflowService.submitAthleteRegistration(
      rivalClubAthlete, // Belongs to club_gsp, while coach is club_mca
      testCompetition,
      mcaCoach,
      ['cross_country']
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('غير مسموح');
  });

  it('prevents duplicate registration of the same athlete in the same competition', async () => {
    // First registration succeeds
    const first = await coachWorkflowService.submitAthleteRegistration(
      mcaAthlete,
      testCompetition,
      mcaCoach,
      ['cross_country']
    );
    expect(first.success).toBe(true);

    // Second registration must fail
    const second = await coachWorkflowService.submitAthleteRegistration(
      mcaAthlete,
      testCompetition,
      mcaCoach,
      ['cross_country']
    );
    expect(second.success).toBe(false);
    expect(second.error).toContain('مسجل مسبقاً');
  });

  it('supports Technical Director approval and rejection workflows with audit logging', async () => {
    const submission = await coachWorkflowService.submitAthleteRegistration(
      mcaAthlete,
      testCompetition,
      mcaCoach,
      ['cross_country']
    );
    const regId = submission.registration!.id;

    // Technical Director approves registration and assigns bib
    const approved = await coachWorkflowService.reviewRegistration(regId, 'approved', {
      bibAssigned: 105,
      reviewerId: 'dir_tech_01',
      reviewerName: 'المدير الفني للرابطة',
    });

    expect(approved).toBeDefined();
    expect(approved?.status).toBe('approved');
    expect(approved?.bibAssigned).toBe(105);
    expect(approved?.reviewedByName).toBe('المدير الفني للرابطة');

    // Verify audit log has recorded the approval
    const audits = await coachWorkflowService.getAuditHistory(regId);
    expect(audits.length).toBeGreaterThanOrEqual(2); // submit + approve
    expect(audits[0].action).toBe('approve');
  });

  it('supports rejection with detailed reason', async () => {
    const submission = await coachWorkflowService.submitAthleteRegistration(
      mcaAthlete,
      testCompetition,
      mcaCoach,
      ['cross_country']
    );
    const regId = submission.registration!.id;

    const rejected = await coachWorkflowService.reviewRegistration(regId, 'rejected', {
      rejectionReason: 'شهادة الكفاءة الطبية منتهية الصلاحية',
      reviewerId: 'dir_tech_01',
      reviewerName: 'المدير الفني للرابطة',
    });

    expect(rejected?.status).toBe('rejected');
    expect(rejected?.rejectionReason).toBe('شهادة الكفاءة الطبية منتهية الصلاحية');

    const audits = await coachWorkflowService.getAuditHistory(regId);
    expect(audits[0].action).toBe('reject');
    expect(audits[0].details).toContain('شهادة الكفاءة الطبية');
  });

  it('supports bulk approval for multiple registrations', async () => {
    const reg1 = await coachWorkflowService.submitAthleteRegistration(
      mcaAthlete,
      testCompetition,
      mcaCoach,
      ['cross_country']
    );

    const mcaAthlete2: Athlete = {
      ...mcaAthlete,
      id: 'ath_mca_test_02',
      licenseNumber: 'DZ-2026-2002',
      firstName: 'هشام',
      lastName: 'خنوسي',
    };

    const reg2 = await coachWorkflowService.submitAthleteRegistration(
      mcaAthlete2,
      testCompetition,
      mcaCoach,
      ['cross_country']
    );

    const count = await coachWorkflowService.bulkApprove([reg1.registration!.id, reg2.registration!.id], {
      id: 'dir_01',
      name: 'رئيس لجنة المسابقات',
    });

    expect(count).toBe(2);

    const fetched1 = await coachWorkflowService.getRegistrationById(reg1.registration!.id);
    const fetched2 = await coachWorkflowService.getRegistrationById(reg2.registration!.id);
    expect(fetched1?.status).toBe('approved');
    expect(fetched2?.status).toBe('approved');
  });
});
