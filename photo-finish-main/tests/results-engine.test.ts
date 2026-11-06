import { describe, it, expect, beforeEach } from 'vitest';
import { ChiefJudgeControlService } from '../src/services/chiefJudgeControlService';
import { AthleticsCompetition, MergedPassage } from '../src/types/athletics';

describe('Stage C6: Results Engine & Chief Judge Control Center', () => {
  let service: ChiefJudgeControlService;

  const mockCompetition: AthleticsCompetition = {
    id: 'comp_cross_algiers_2026',
    name: 'بطولة الجزائر للعدو الريفي 2026',
    type: 'cross_country',
    venue: 'غابة باينام',
    date: '2026-11-15',
    distanceKm: 8.0,
    lapCount: 2,
    category: 'SENIOR',
    gender: 'M',
    status: 'in_progress',
    isOfficial: false,
    checkpoints: [
      {
        id: 'cp_start',
        code: 'START',
        name: 'خط الانطلاق',
        distanceKm: 0.0,
        type: 'start',
        requiredLaps: [1],
        order: 0,
        assignedJudgeIds: []
      },
      {
        id: 'cp_finish',
        code: 'FINISH',
        name: 'خط الوصول والحلقة',
        distanceKm: 4.0,
        type: 'finish',
        requiredLaps: [1, 2],
        order: 1,
        assignedJudgeIds: []
      }
    ],
    runners: [
      { id: 'r1', bibNumber: 101, name: 'توفيق مخلوفي', club: 'مولودية الجزائر' },
      { id: 'r2', bibNumber: 102, name: 'نور الدين مرسلي', club: 'شباب بلوزداد' },
      { id: 'r3', bibNumber: 103, name: 'عيسى عيسات', club: 'أولمبي الشلف' },
      { id: 'r4', bibNumber: 104, name: 'سليم دربال', club: 'وفاق سطيف' },
      { id: 'r5', bibNumber: 105, name: 'عبد الله بلقاسم', club: 'شبيبة القبائل' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  beforeEach(() => {
    service = new ChiefJudgeControlService();
    service.clearAll();
  });

  describe('Time Formatting', () => {
    it('formats milliseconds into standard athletics time strings', () => {
      expect(service.formatTime(125430)).toBe('02:05.430');
      expect(service.formatTime(3665120, true)).toBe('01:01:05.120');
      expect(service.formatTime(0)).toBe('00:00.000');
    });
  });

  describe('Official Results Computation', () => {
    it('computes Gun Time, Net Time, ranks and gaps for finished runners', () => {
      const gunStart = 1700000000000;

      // Merged passages:
      // Runner 101 finishes 2 laps at gunStart + 600,000ms (10:00.000)
      // Runner 102 finishes 2 laps at gunStart + 615,500ms (10:15.500)
      // Runner 103 finishes only 1 lap (DNF)
      // Runner 104 is DQ
      // Runner 105 has no passages (DNS)
      const passages: MergedPassage[] = [
        // 101 (Winner)
        {
          id: 'm1',
          competitionId: mockCompetition.id,
          bibNumber: 101,
          athleteName: 'توفيق مخلوفي',
          clubName: 'مولودية الجزائر',
          checkpointId: 'cp_finish',
          checkpointCode: 'FINISH',
          lapNumber: 1,
          officialTimestamp: gunStart + 295000,
          originalTimestamps: [],
          corroboratingJudges: ['j1'],
          confidenceScore: 1.0,
          status: 'valid'
        },
        {
          id: 'm2',
          competitionId: mockCompetition.id,
          bibNumber: 101,
          athleteName: 'توفيق مخلوفي',
          clubName: 'مولودية الجزائر',
          checkpointId: 'cp_finish',
          checkpointCode: 'FINISH',
          lapNumber: 2,
          officialTimestamp: gunStart + 600000,
          originalTimestamps: [],
          corroboratingJudges: ['j1'],
          confidenceScore: 1.0,
          status: 'valid'
        },
        // 102 (2nd place)
        {
          id: 'm3',
          competitionId: mockCompetition.id,
          bibNumber: 102,
          athleteName: 'نور الدين مرسلي',
          clubName: 'شباب بلوزداد',
          checkpointId: 'cp_finish',
          checkpointCode: 'FINISH',
          lapNumber: 1,
          officialTimestamp: gunStart + 305000,
          originalTimestamps: [],
          corroboratingJudges: ['j1'],
          confidenceScore: 1.0,
          status: 'valid'
        },
        {
          id: 'm4',
          competitionId: mockCompetition.id,
          bibNumber: 102,
          athleteName: 'نور الدين مرسلي',
          clubName: 'شباب بلوزداد',
          checkpointId: 'cp_finish',
          checkpointCode: 'FINISH',
          lapNumber: 2,
          officialTimestamp: gunStart + 615500,
          originalTimestamps: [],
          corroboratingJudges: ['j1'],
          confidenceScore: 1.0,
          status: 'valid'
        },
        // 103 (Only 1 lap = DNF)
        {
          id: 'm5',
          competitionId: mockCompetition.id,
          bibNumber: 103,
          athleteName: 'عيسى عيسات',
          clubName: 'أولمبي الشلف',
          checkpointId: 'cp_finish',
          checkpointCode: 'FINISH',
          lapNumber: 1,
          officialTimestamp: gunStart + 310000,
          originalTimestamps: [],
          corroboratingJudges: ['j1'],
          confidenceScore: 1.0,
          status: 'valid'
        },
        // 104 (DQ)
        {
          id: 'm6',
          competitionId: mockCompetition.id,
          bibNumber: 104,
          athleteName: 'سليم دربال',
          clubName: 'وفاق سطيف',
          checkpointId: 'cp_finish',
          checkpointCode: 'FINISH',
          lapNumber: 1,
          officialTimestamp: gunStart + 300000,
          originalTimestamps: [],
          corroboratingJudges: ['j1'],
          confidenceScore: 1.0,
          status: 'disqualified',
          anomalyReason: 'استبعاد: اختصار مسار السباق'
        }
      ];

      const results = service.computeOfficialResults(mockCompetition, passages, gunStart);

      expect(results.length).toBe(5);

      // Rank 1
      expect(results[0].rank).toBe(1);
      expect(results[0].bibNumber).toBe(101);
      expect(results[0].gunTimeMs).toBe(600000);
      expect(results[0].formattedGunTime).toBe('10:00.000');
      expect(results[0].formattedGap).toBe('-');

      // Rank 2
      expect(results[1].rank).toBe(2);
      expect(results[1].bibNumber).toBe(102);
      expect(results[1].gunTimeMs).toBe(615500);
      expect(results[1].formattedGunTime).toBe('10:15.500');
      expect(results[1].formattedGap).toBe('+00:15.500');

      // Check DNF, DQ, DNS
      const dnf = results.find(r => r.bibNumber === 103);
      expect(dnf?.status).toBe('dnf');

      const dq = results.find(r => r.bibNumber === 104);
      expect(dq?.status).toBe('dq');
      expect(dq?.disqualificationReason).toContain('اختصار مسار');

      const dns = results.find(r => r.bibNumber === 105);
      expect(dns?.status).toBe('dns');
    });
  });

  describe('Results Locking & Chief Judge Override', () => {
    it('manages the official locking lifecycle with mandatory override reason', () => {
      const compId = mockCompetition.id;
      expect(service.isCompetitionLocked(compId)).toBe(false);

      // 1. Lock results officially
      service.lockResults(compId, 'chief_judge_1', 'الحكم العام الأستاذ بوجمعة', 'اعتماد رسمي بعد انتهاء مهلة الطعون');
      expect(service.isCompetitionLocked(compId)).toBe(true);
      expect(service.getCompetitionResultStatus(compId)).toBe('official');

      // 2. Unlocking requires a reason
      expect(() => {
        service.unlockResults(compId, 'chief_judge_1', 'الحكم العام', '');
      }).toThrow();

      service.unlockResults(compId, 'chief_judge_1', 'الحكم العام', 'إعادة الفحص بناءً على الطعن رقم 12');
      expect(service.isCompetitionLocked(compId)).toBe(false);
      expect(service.getCompetitionResultStatus(compId)).toBe('under_review');

      // 3. Final Certification
      service.certifyResults(compId, 'chief_judge_1', 'الحكم العام');
      expect(service.getCompetitionResultStatus(compId)).toBe('certified');

      // Verify Audit log
      const auditLog = service.getLockAuditLog(compId);
      expect(auditLog.length).toBe(3);
      expect(auditLog[0].action).toBe('certify');
      expect(auditLog[1].action).toBe('unlock');
      expect(auditLog[2].action).toBe('lock');
    });
  });

  describe('Protests & Appeals Workflow (Rule 8)', () => {
    it('files and decides a protest according to World Athletics rules', () => {
      const compId = mockCompetition.id;

      const protest = service.fileProtest({
        competitionId: compId,
        bibNumber: 102,
        clubName: 'شباب بلوزداد',
        filedByName: 'المدرب كمال بن عيسى',
        reason: 'اعتراض على إعاقة عداء المنافس عند المنعرج الأخير',
        feeDeposited: true
      });

      expect(protest.id).toBeDefined();
      expect(protest.status).toBe('pending');
      expect(service.getCompetitionResultStatus(compId)).toBe('under_review');

      // Chief Judge decides
      const decided = service.decideProtest(
        protest.id, 
        'rejected', 
        'بعد الرجوع إلى فيديو المراقبة، لم يثبت وجود أي احتكاك غير قانوني', 
        'chief_judge_1'
      );

      expect(decided).toBe(true);
      const protests = service.listProtests(compId);
      expect(protests[0].status).toBe('rejected');
      expect(protests[0].decisionNote).toContain('لم يثبت');
    });
  });

  describe('Judge Matrix Telemetry', () => {
    it('records and queries multi-judge heartbeats and battery health', () => {
      service.updateJudgeTelemetry({
        judgeId: 'j_cp1',
        judgeName: 'حكم النقطة الأولى',
        role: 'checkpoint_judge',
        checkpointId: 'cp_1',
        checkpointCode: 'CP01',
        deviceId: 'PF-PHONE-A1',
        batteryPercent: 88,
        isOnline: true,
        lastHeartbeat: Date.now(),
        latencyMs: 14,
        passagesRecordedCount: 42
      });

      const matrix = service.getJudgeMatrix();
      expect(matrix.length).toBe(1);
      expect(matrix[0].judgeId).toBe('j_cp1');
      expect(matrix[0].batteryPercent).toBe(88);
      expect(matrix[0].latencyMs).toBe(14);
    });
  });
});
