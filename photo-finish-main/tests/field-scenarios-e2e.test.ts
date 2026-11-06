import { describe, it, expect } from 'vitest';
import { 
  AthleticsCompetition, 
  PassageEvent, 
  FieldEventScorepad,
  FieldAthleteScore,
  ClubTeamScore,
  ClubMedalTally
} from '../src/types/athletics';
import { multiJudgeMergeEngine } from '../src/services/multiJudgeMergeEngine';
import { chiefJudgeControlService } from '../src/services/chiefJudgeControlService';
import { clubRankingService } from '../src/services/clubRankingService';
import { exportService } from '../src/services/exportService';
import { aiRaceAssistantService } from '../src/services/aiRaceAssistant';
import { courseDesignerService } from '../src/services/courseDesignerService';

describe('Comprehensive Athletics Field Scenarios E2E (Stage C8)', () => {

  // ══════════════════════════════════════════════════════════════
  // السيناريو 1: بطولة اختراق الضاحية 8 كم (Cross-Country Championship)
  // ══════════════════════════════════════════════════════════════
  describe('Scenario 1: Cross-Country 8km Championship Lifecycle', () => {
    const competition: AthleticsCompetition = {
      id: 'cc-champ-2026',
      name: 'البطولة الوطنية لاختراق الضاحية للأكابر 8 كم',
      type: 'cross_country',
      venue: 'غابة باينام - الجزائر',
      date: '2026-12-20',
      distanceKm: 8,
      lapCount: 1, // دورة واحدة 8 كم
      category: 'SENIOR',
      gender: 'M',
      status: 'in_progress',
      checkpoints: [
        { id: 'cp-start', competitionId: 'cc-champ-2026', name: 'خط الانطلاق', code: 'START', order: 0, distanceKm: 0 },
        { id: 'cp-lap1', competitionId: 'cc-champ-2026', name: 'الحلقة 1 (2 كم)', code: 'LAP1', order: 1, distanceKm: 2.0 },
        { id: 'cp-lap2', competitionId: 'cc-champ-2026', name: 'الحلقة 2 (4 كم)', code: 'LAP2', order: 2, distanceKm: 4.0 },
        { id: 'cp-lap3', competitionId: 'cc-champ-2026', name: 'الحلقة 3 (6 كم)', code: 'LAP3', order: 3, distanceKm: 6.0 },
        { id: 'cp-finish', competitionId: 'cc-champ-2026', name: 'خط النهاية (8 كم)', code: 'FINISH', order: 4, distanceKm: 8.0 },
      ],
      runners: [
        // نادي مولودية الجزائر MCA (4 عدائين)
        { id: 'r1', bibNumber: 101, name: 'سليم بن عيسى', club: 'مولودية الجزائر', startTime: 1700000000000 },
        { id: 'r2', bibNumber: 102, name: 'عادل حماني', club: 'مولودية الجزائر', startTime: 1700000000000 },
        { id: 'r3', bibNumber: 103, name: 'سمير قادري', club: 'مولودية الجزائر', startTime: 1700000000000 },
        { id: 'r4', bibNumber: 104, name: 'كريم بلحاج', club: 'مولودية الجزائر', startTime: 1700000000000 },

        // نادي شباب بلوزداد CRB (4 عدائين)
        { id: 'r5', bibNumber: 201, name: 'ياسين حتحات', club: 'شباب بلوزداد', startTime: 1700000000000 },
        { id: 'r6', bibNumber: 202, name: 'هشام بوشيشة', club: 'شباب بلوزداد', startTime: 1700000000000 },
        { id: 'r7', bibNumber: 203, name: 'جمال سجاتي', club: 'شباب بلوزداد', startTime: 1700000000000 },
        { id: 'r8', bibNumber: 204, name: 'رضا بورعدة', club: 'شباب بلوزداد', startTime: 1700000000000 },

        // نادي وفاق سطيف ESS (4 عدائين)
        { id: 'r9', bibNumber: 301, name: 'فؤاد خلوفي', club: 'وفاق سطيف', startTime: 1700000000000 },
        { id: 'r10', bibNumber: 302, name: 'طارق مبارك', club: 'وفاق سطيف', startTime: 1700000000000 },
        { id: 'r11', bibNumber: 303, name: 'عصام نعماني', club: 'وفاق سطيف', startTime: 1700000000000 },
        { id: 'r12', bibNumber: 304, name: 'محمد الأمين', club: 'وفاق سطيف', startTime: 1700000000000 },

        // نادي بارادو PAC (4 عدائين)
        { id: 'r13', bibNumber: 401, name: 'أمين بلفرار', club: 'نادي بارادو', startTime: 1700000000000 },
        { id: 'r14', bibNumber: 402, name: 'توفيق مخلوفي', club: 'نادي بارادو', startTime: 1700000000000 },
        { id: 'r15', bibNumber: 403, name: 'مراد بوعمرة', club: 'نادي بارادو', startTime: 1700000000000 },
        { id: 'r16', bibNumber: 404, name: 'منير شريف', club: 'نادي بارادو', startTime: 1700000000000 },
      ],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    };

    const gunTime = 1700000000000;

    it('processes multi-judge consensus, detects cheating anomaly, executes Rule 8 DQ, locks official results, computes Rule 19 team standings, and exports press package', () => {
      // 1. تسجيل قراءات الحكام عبر النقاط (Multiple Judges Recording)
      const rawPassages: PassageEvent[] = [];

      // البطل سليم بن عيسى (101): زمن نهائي 24:00 (1440000 ms)
      // الحكام j-finish-1 و j-finish-2 سجلاه بفارق 200ms
      rawPassages.push(
        { id: 'p1-1', competitionId: competition.id, bibNumber: 101, athleteName: 'سليم بن عيسى', club: 'مولودية الجزائر', checkpointId: 'cp-finish', timestamp: gunTime + 1440000, recordedByJudgeId: 'j-finish-1' },
        { id: 'p1-2', competitionId: competition.id, bibNumber: 101, athleteName: 'سليم بن عيسى', club: 'مولودية الجزائر', checkpointId: 'cp-finish', timestamp: gunTime + 1440200, recordedByJudgeId: 'j-finish-2' }
      );

      // المركز 2: فؤاد خلوفي (301): 24:15 (1455000 ms)
      rawPassages.push(
        { id: 'p2-1', competitionId: competition.id, bibNumber: 301, athleteName: 'فؤاد خلوفي', club: 'وفاق سطيف', checkpointId: 'cp-finish', timestamp: gunTime + 1455000, recordedByJudgeId: 'j-finish-1' }
      );

      // المركز 3: ياسين حتحات (201): 24:30 (1470000 ms)
      rawPassages.push(
        { id: 'p3-1', competitionId: competition.id, bibNumber: 201, athleteName: 'ياسين حتحات', club: 'شباب بلوزداد', checkpointId: 'cp-finish', timestamp: gunTime + 1470000, recordedByJudgeId: 'j-finish-1' }
      );

      // المركز 4: عادل حماني (102): 24:45 (1485000 ms)
      rawPassages.push(
        { id: 'p4-1', competitionId: competition.id, bibNumber: 102, athleteName: 'عادل حماني', club: 'مولودية الجزائر', checkpointId: 'cp-finish', timestamp: gunTime + 1485000, recordedByJudgeId: 'j-finish-1' }
      );

      // المركز 5: هشام بوشيشة (202): 24:50 (1490000 ms)
      rawPassages.push(
        { id: 'p5-1', competitionId: competition.id, bibNumber: 202, athleteName: 'هشام بوشيشة', club: 'شباب بلوزداد', checkpointId: 'cp-finish', timestamp: gunTime + 1490000, recordedByJudgeId: 'j-finish-1' }
      );

      // المركز 6: طارق مبارك (302): 25:05 (1505000 ms)
      rawPassages.push(
        { id: 'p6-1', competitionId: competition.id, bibNumber: 302, athleteName: 'طارق مبارك', club: 'وفاق سطيف', checkpointId: 'cp-finish', timestamp: gunTime + 1505000, recordedByJudgeId: 'j-finish-1' }
      );

      // المركز 7: جمال سجاتي (203): 25:20 (1520000 ms)
      rawPassages.push(
        { id: 'p7-1', competitionId: competition.id, bibNumber: 203, athleteName: 'جمال سجاتي', club: 'شباب بلوزداد', checkpointId: 'cp-finish', timestamp: gunTime + 1520000, recordedByJudgeId: 'j-finish-1' }
      );

      // المركز 8: سمير قادري (103): 25:35 (1535000 ms)
      rawPassages.push(
        { id: 'p8-1', competitionId: competition.id, bibNumber: 103, athleteName: 'سمير قادري', club: 'مولودية الجزائر', checkpointId: 'cp-finish', timestamp: gunTime + 1535000, recordedByJudgeId: 'j-finish-1' }
      );

      // عداء مشبوه (قطع المسار بسرعة مستحيلة): كريم بلحاج (104)
      // سجل في LAP1 و FINISH خلال 30 ثانية فقط! (سرعة > 200 كم/س)
      rawPassages.push(
        { id: 'p9-1', competitionId: competition.id, bibNumber: 104, athleteName: 'كريم بلحاج', club: 'مولودية الجزائر', checkpointId: 'cp-lap1', timestamp: gunTime + 300000, recordedByJudgeId: 'j-lap-1' },
        { id: 'p9-2', competitionId: competition.id, bibNumber: 104, athleteName: 'كريم بلحاج', club: 'مولودية الجزائر', checkpointId: 'cp-finish', timestamp: gunTime + 330000, recordedByJudgeId: 'j-finish-1' }
      );

      // 2. الدمج الذكي للتحكيم وكشف الشذوذ (Multi-Judge Consensus & Anomaly Engine)
      const mergeResult = multiJudgeMergeEngine.processPassages(competition, rawPassages);
      expect(mergeResult.mergedPassages.length).toBeGreaterThan(0);

      // التحقق من دمج قراءتي البطل سليم بن عيسى في قراءة إجماع واحدة
      const winnerPassages = mergeResult.mergedPassages.filter(p => p.bibNumber === 101 && p.checkpointId === 'cp-finish');
      expect(winnerPassages.length).toBe(1);
      expect(winnerPassages[0].corroboratingJudges.length).toBe(2);
      expect(winnerPassages[0].confidenceScore).toBeGreaterThanOrEqual(0.85);

      // التحقق من كشف الشذوذ للمتسابق 104 (تخطي نقاط المراقبة أو سرعة مستحيلة لقطع المسار)
      const cheatAnomaly = mergeResult.anomalies.find(a => a.bibNumber === 104);
      expect(cheatAnomaly).toBeDefined();
      expect(['skipped_checkpoint', 'speed_anomaly']).toContain(cheatAnomaly?.type);

      // 3. غرفة الحكم العام: استبعاد العداء المخالف (DQ) بموجب لوائح World Athletics Rule 8
      // تحويل حالة مرور المتسابق المخالف إلى disqualified
      const runner104Passages = mergeResult.mergedPassages.filter(p => p.bibNumber === 104);
      runner104Passages.forEach(p => {
        p.status = 'disqualified';
        p.anomalyReason = 'استبعاد بموجب المادة 8 لقطع مسار السباق (Disqualified Course Cut)';
      });

      const officialResults = chiefJudgeControlService.computeOfficialResults(
        competition,
        mergeResult.mergedPassages,
        gunTime
      );

      const dqRunner = officialResults.find(r => r.bibNumber === 104);
      expect(dqRunner?.status).toBe('dq');

      // 4. قفل النتائج الرسمية وتصديقها
      const lockSuccess = chiefJudgeControlService.lockResults(
        competition.id,
        'judge-chief-01',
        'الحكم الدولي عبد القادر بن عيسى'
      );
      expect(lockSuccess).toBe(true);
      expect(chiefJudgeControlService.isCompetitionLocked(competition.id)).toBe(true);

      const certSuccess = chiefJudgeControlService.certifyResults(
        competition.id,
        'judge-chief-01',
        'الحكم الدولي عبد القادر بن عيسى'
      );
      expect(certSuccess).toBe(true);
      expect(chiefJudgeControlService.getCompetitionResultStatus(competition.id)).toBe('certified');

      // 5. احتساب ترتيب الفرق بموجب World Athletics Rule 19
      // نقاط أفضل 3 عدائين لكل نادٍ:
      // CRB (شباب بلوزداد): رتب 3 (ياسين) + 5 (هشام) + 7 (جمال) = 15 نقطة. العداء الثالث رتبته 7.
      // MCA (مولودية الجزائر): رتب 1 (سليم) + 4 (عادل) + 8 (سمير) = 13 نقطة. (104 مستبعد DQ ولا يحتسب).
      const teamStandings = clubRankingService.computeTeamStandings(officialResults, 3);
      expect(teamStandings.length).toBeGreaterThanOrEqual(2);

      // المركز الأول للفرق: مولودية الجزائر بـ 13 نقطة
      expect(teamStandings[0].clubName).toBe('مولودية الجزائر');
      expect(teamStandings[0].totalPoints).toBe(13);
      expect(teamStandings[0].rank).toBe(1);
      expect(teamStandings[0].status).toBe('qualified');

      // المركز الثاني للفرق: شباب بلوزداد بـ 15 نقطة
      expect(teamStandings[1].clubName).toBe('شباب بلوزداد');
      expect(teamStandings[1].totalPoints).toBe(15);
      expect(teamStandings[1].rank).toBe(2);

      // 6. التحليل التكتيكي للذكاء الاصطناعي وصياغة التقرير الصحفي
      const aiReport = aiRaceAssistantService.generateFullRaceReport(
        competition,
        officialResults,
        teamStandings,
        mergeResult.anomalies,
        mergeResult.mergedPassages
      );

      expect(aiReport.winnerHeadline).toContain('سليم بن عيسى');
      expect(aiReport.teamChampionHeadline).toContain('مولودية الجزائر');
      expect(aiReport.fullNarrativeArabic).toContain('مولودية الجزائر');
      expect(aiReport.fullNarrativeArabic).toContain('13 نقطة');
      expect(aiReport.triageRecommendations).toBeDefined();

      // 7. التصدير للمؤسسات (CSV مع UTF-8 BOM، JSON، HTML للطباعة)
      const csvData = exportService.exportToCsv(competition, officialResults);
      expect(csvData.startsWith('\uFEFF')).toBe(true); // UTF-8 BOM
      expect(csvData).toContain('سليم بن عيسى');
      expect(csvData).toContain('مولودية الجزائر');

      const jsonData = exportService.exportToJson(competition, officialResults, teamStandings);
      const parsedJson = JSON.parse(jsonData);
      expect(parsedJson.competition.name).toBe(competition.name);
      expect(parsedJson.results.length).toBeGreaterThan(0);
      expect(parsedJson.teamStandings.length).toBeGreaterThan(0);

      const htmlData = exportService.generatePrintableHtml(competition, officialResults, teamStandings);
      expect(htmlData).toContain('<!DOCTYPE html>');
      expect(htmlData).toContain('سليم بن عيسى');
      // الترويسة الثنائية اللغة (عربي/فرنسي) تتضمن مرجع القاعدة 19
      expect(htmlData).toContain('Règle 19 World Athletics');
      expect(htmlData).toContain('Procès-verbal officiel des résultats');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // السيناريو 2: نهائي الوثب الطويل وكسر التعادل (WA Rule 25 Countback)
  // ══════════════════════════════════════════════════════════════
  describe('Scenario 2: Long Jump Final & WA Rule 25 Countback', () => {
    it('ranks jumpers by best valid mark and breaks ties using the second best jump', () => {
      // رياضيان متعادلان في المحاولة الأفضل 8.12m
      // اللاعب A: 8.12m, 8.05m, X, 7.90m, 8.01m, X
      // اللاعب B: 8.12m, 8.01m, 7.95m, X, X, 8.00m
      // بموجب المادة 25، يفوز اللاعب A لأن ثاني أفضل قفزة له هي 8.05m مقابل 8.01m للاعب B
      const athleteA: FieldAthleteScore = {
        athleteId: 'ath-1',
        bibNumber: 11,
        athleteName: 'محمد ياسر تريكي',
        clubName: 'نادي المجمع البترولي',
        attempts: [
          { attemptNumber: 1, value: 8.12, status: 'valid', wind: 1.2 },
          { attemptNumber: 2, value: 8.05, status: 'valid', wind: 0.8 },
          { attemptNumber: 3, value: 0, status: 'foul' },
          { attemptNumber: 4, value: 7.90, status: 'valid', wind: 1.5 },
          { attemptNumber: 5, value: 8.01, status: 'valid', wind: 0.4 },
          { attemptNumber: 6, value: 0, status: 'foul' },
        ],
        bestAttempt: 8.12,
        rank: 0,
      };

      const athleteB: FieldAthleteScore = {
        athleteId: 'ath-2',
        bibNumber: 12,
        athleteName: 'هشام خليل',
        clubName: 'أولمبي الشلف',
        attempts: [
          { attemptNumber: 1, value: 8.12, status: 'valid', wind: 1.0 },
          { attemptNumber: 2, value: 8.01, status: 'valid', wind: 0.5 },
          { attemptNumber: 3, value: 7.95, status: 'valid', wind: 0.7 },
          { attemptNumber: 4, value: 0, status: 'foul' },
          { attemptNumber: 5, value: 0, status: 'foul' },
          { attemptNumber: 6, value: 8.00, status: 'valid', wind: 1.1 },
        ],
        bestAttempt: 8.12,
        rank: 0,
      };

      const scorepad: FieldEventScorepad = {
        id: 'scorepad-lj',
        competitionId: 'comp-track-field',
        name: 'نهائي الوثب الطويل - أكابر رجال',
        discipline: 'long_jump',
        gender: 'M',
        category: 'SENIOR',
        venue: 'ملعب 5 جويلية',
        date: '2026-07-10',
        totalAttemptsAllowed: 6,
        athletes: [athleteB, athleteA], // ترتيب عشوائي في البداية
        status: 'completed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // تطبيق لوائح كسر التعادل للوثب الأفقي (Rule 25 Countback)
      const rankedAthletes = [...scorepad.athletes].sort((a, b) => {
        // 1. المقارنة بأفضل محاولة
        if (b.bestAttempt !== a.bestAttempt) {
          return b.bestAttempt - a.bestAttempt;
        }

        // 2. كسر التعادل بثاني أفضل محاولة (Rule 25)
        const getSortedValidMarks = (ath: FieldAthleteScore) => 
          ath.attempts
            .filter(att => att.status === 'valid')
            .map(att => att.value)
            .sort((m1, m2) => m2 - m1);

        const aMarks = getSortedValidMarks(a);
        const bMarks = getSortedValidMarks(b);

        for (let i = 1; i < Math.max(aMarks.length, bMarks.length); i++) {
          const mA = aMarks[i] || 0;
          const mB = bMarks[i] || 0;
          if (mA !== mB) {
            return mB - mA;
          }
        }
        return 0;
      });

      // التحقق من فوز محمد ياسر تريكي بفضل ثاني أفضل محاولة (8.05m مقابل 8.01m)
      expect(rankedAthletes[0].bibNumber).toBe(11);
      expect(rankedAthletes[0].athleteName).toBe('محمد ياسر تريكي');
      expect(rankedAthletes[1].bibNumber).toBe(12);
      expect(rankedAthletes[1].athleteName).toBe('هشام خليل');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // السيناريو 3: نهائي الوثب العالي (WA Rule 26 Vertical Tie-Break)
  // ══════════════════════════════════════════════════════════════
  describe('Scenario 3: High Jump Final & WA Rule 26 Countback', () => {
    it('resolves vertical jump ties by fewest misses at winning height, then lowest total failures', () => {
      // ارتفاع الفوز 2.24m:
      // الواثب A: اجتاز 2.24m من المحاولة الأولى (O). مجموع الأخطاء طوال المسابقة: 2.
      // الواثب B: اجتاز 2.24m من المحاولة الثالثة (XXO). مجموع الأخطاء طوال المسابقة: 2.
      // الواثب C: اجتاز 2.24m من المحاولة الأولى (O). مجموع الأخطاء طوال المسابقة: 4.
      //
      // الترتيب وفق المادة 26:
      // 1. المركز الأول: الواثب A (اجتاز من المحاولة 1، وأقل أخطاء إجمالية = 2)
      // 2. المركز الثاني: الواثب C (اجتاز من المحاولة 1، لكن أخطاؤه الإجمالية = 4)
      // 3. المركز الثالث: الواثب B (اجتاز من المحاولة 3)

      interface HighJumperResult {
        bib: number;
        name: string;
        clearedHeight: number;
        attemptsAtClearedHeight: number;
        totalFailures: number;
      }

      const jumpers: HighJumperResult[] = [
        { bib: 3, name: 'الواثب C', clearedHeight: 2.24, attemptsAtClearedHeight: 1, totalFailures: 4 },
        { bib: 1, name: 'الواثب A', clearedHeight: 2.24, attemptsAtClearedHeight: 1, totalFailures: 2 },
        { bib: 2, name: 'الواثب B', clearedHeight: 2.24, attemptsAtClearedHeight: 3, totalFailures: 2 },
      ];

      const ranked = [...jumpers].sort((a, b) => {
        // 1. أعلى ارتفاع تم اجتيازه
        if (b.clearedHeight !== a.clearedHeight) {
          return b.clearedHeight - a.clearedHeight;
        }
        // 2. أقل عدد محاولات عند هذا الارتفاع الأخير (Rule 26.8.1)
        if (a.attemptsAtClearedHeight !== b.attemptsAtClearedHeight) {
          return a.attemptsAtClearedHeight - b.attemptsAtClearedHeight;
        }
        // 3. أقل مجموع أخطاء على مدار المسابقة بأكملها (Rule 26.8.2)
        return a.totalFailures - b.totalFailures;
      });

      expect(ranked[0].bib).toBe(1); // الواثب A (ذهبية)
      expect(ranked[1].bib).toBe(3); // الواثب C (فضية)
      expect(ranked[2].bib).toBe(2); // الواثب B (برونزية)
    });
  });

  // ══════════════════════════════════════════════════════════════
  // السيناريو 4: حزم الباركود المؤمنة ومارشالينج نقاط المراقبة
  // ══════════════════════════════════════════════════════════════
  describe('Scenario 4: Secured Offline QR Token Marshalling', () => {
    it('generates server-signed Ed25519 QR tokens and verifies authenticity offline', async () => {
      // محاكاة نقطة النهاية الخادمية /api/checkpoint/sign
      const { signCheckpointQr, getPublicKeyBase64 } = await import('../server/security.js');
      const { setTrustedPublicKeyBase64 } = await import('../src/services/securityService');
      setTrustedPublicKeyBase64(getPublicKeyBase64());
      const serverSignFetch = async (url: string, init?: RequestInit): Promise<Response> => {
        if (typeof url === 'string' && url.includes('/api/checkpoint/sign')) {
          const body = JSON.parse(String(init?.body || '{}'));
          const signature = signCheckpointQr(body);
          return new Response(JSON.stringify({ ok: true, signature }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404 });
      };
      const originalFetch = globalThis.fetch;
      globalThis.fetch = serverSignFetch as typeof fetch;
      try {
      const mockCheckpoint = {
        id: 'cp-tizi-15',
        competitionId: 'trail-ultra-2026',
        name: 'قمة تيكجدة (15 كم)',
        code: 'TIK-15',
        order: 1,
        distanceKm: 15,
        type: 'checkpoint' as const,
        requiredLaps: [1],
        assignedJudgeIds: []
      };

      // توليد حزمة الباركود المؤمنة لنقطة المراقبة
      const qrPack = await courseDesignerService.generateSecuredQrPack('trail-ultra-2026', mockCheckpoint);

      expect(qrPack.id).toBeDefined();
      expect(qrPack.checkpointId).toBe('cp-tizi-15');
      expect(qrPack.checkpointCode).toBe('TIK-15');
      expect(qrPack.signature.length).toBeGreaterThanOrEqual(80);
      expect(qrPack.token).toContain('PFP_CP:TIK-15:');

      // التحقق من صحة التوقيع الأمني دون اتصال بالإنترنت
      const verifyResult = await courseDesignerService.verifySecuredQrToken(qrPack.token, 'trail-ultra-2026');
      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.checkpointCode).toBe('TIK-15');

      // محاولة تلاعب بمحتوى التوكن (مسابقة غير متطابقة)
      const wrongCompResult = await courseDesignerService.verifySecuredQrToken(qrPack.token, 'wrong-comp-id');
      expect(wrongCompResult.valid).toBe(false);
      expect(wrongCompResult.error).toContain('أخرى');

      // رمز غير صادر من النظام يُرفض (ثغرة القبول الأعمى مغلقة)
      const unknownResult = await courseDesignerService.verifySecuredQrToken('PFP_CP:FAKE:cp-fake:ABCD1234', 'trail-ultra-2026');
      expect(unknownResult.valid).toBe(false);
      expect(unknownResult.error).toContain('غير معروف');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ══════════════════════════════════════════════════════════════
  // السيناريو 5: درع البطولة العام وحصاد الميداليات للأندية
  // ══════════════════════════════════════════════════════════════
  describe('Scenario 5: Club Medal Tally & General Trophy', () => {
    it('computes medal standings and calculates trophy points (Gold=5, Silver=3, Bronze=1)', () => {
      const tally: ClubMedalTally[] = [
        { rank: 1, clubName: 'مولودية الجزائر', gold: 5, silver: 2, bronze: 3, totalMedals: 10, trophyPoints: 0 },
        { rank: 2, clubName: 'شباب بلوزداد', gold: 3, silver: 4, bronze: 1, totalMedals: 8, trophyPoints: 0 },
        { rank: 3, clubName: 'وفاق سطيف', gold: 2, silver: 3, bronze: 4, totalMedals: 9, trophyPoints: 0 },
      ];

      // حساب درع البطولة
      tally.forEach(c => {
        c.trophyPoints = (c.gold * 5) + (c.silver * 3) + (c.bronze * 1);
      });

      // MCA: 5*5 + 2*3 + 3*1 = 25 + 6 + 3 = 34 pts
      // CRB: 3*5 + 4*3 + 1*1 = 15 + 12 + 1 = 28 pts
      // ESS: 2*5 + 3*3 + 4*1 = 10 + 9 + 4 = 23 pts
      expect(tally[0].trophyPoints).toBe(34);
      expect(tally[1].trophyPoints).toBe(28);
      expect(tally[2].trophyPoints).toBe(23);

      expect(tally[0].trophyPoints).toBeGreaterThan(tally[1].trophyPoints);
      expect(tally[1].trophyPoints).toBeGreaterThan(tally[2].trophyPoints);
    });
  });

});
