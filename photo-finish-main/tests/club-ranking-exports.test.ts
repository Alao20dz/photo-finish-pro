import { describe, it, expect } from 'vitest';
import { ClubRankingService } from '../src/services/clubRankingService';
import { ExportService } from '../src/services/exportService';
import { AthleticsCompetition, RaceResultEntry } from '../src/types/athletics';

describe('Stage C7: Club Ranking, Team Scoring (Rule 19) & Enterprise Exports', () => {
  const rankingService = new ClubRankingService();
  const exportService = new ExportService();

  const mockCompetition: AthleticsCompetition = {
    id: 'comp_cross_algiers_2026',
    name: 'بطولة الجزائر للعدو الريفي 2026',
    type: 'cross_country',
    venue: 'غابة باينام',
    date: '2026-11-15',
    distanceKm: 8.0,
    lapCount: 4,
    category: 'SENIOR',
    gender: 'M',
    status: 'official',
    checkpoints: [],
    runners: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  describe('World Athletics Rule 19 Team Scoring', () => {
    it('calculates team score by summing individual ranks of top N runners (lowest points wins)', () => {
      // مولودية الجزائر: رتب 2, 4, 7 -> مجموع 13
      // شباب بلوزداد: رتب 1, 5, 8 -> مجموع 14
      const results: RaceResultEntry[] = [
        { rank: 1, bibNumber: 101, athleteName: 'ع 1', clubName: 'شباب بلوزداد', category: 'SENIOR', gender: 'M', gunTimeMs: 600000, netTimeMs: 600000, formattedGunTime: '10:00', formattedNetTime: '10:00', gapMs: 0, formattedGap: '-', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 2, bibNumber: 102, athleteName: 'ع 2', clubName: 'مولودية الجزائر', category: 'SENIOR', gender: 'M', gunTimeMs: 602000, netTimeMs: 602000, formattedGunTime: '10:02', formattedNetTime: '10:02', gapMs: 2000, formattedGap: '+02.0', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 3, bibNumber: 103, athleteName: 'ع 3', clubName: 'فردي مستقل', category: 'SENIOR', gender: 'M', gunTimeMs: 605000, netTimeMs: 605000, formattedGunTime: '10:05', formattedNetTime: '10:05', gapMs: 5000, formattedGap: '+05.0', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 4, bibNumber: 104, athleteName: 'ع 4', clubName: 'مولودية الجزائر', category: 'SENIOR', gender: 'M', gunTimeMs: 608000, netTimeMs: 608000, formattedGunTime: '10:08', formattedNetTime: '10:08', gapMs: 8000, formattedGap: '+08.0', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 5, bibNumber: 105, athleteName: 'ع 5', clubName: 'شباب بلوزداد', category: 'SENIOR', gender: 'M', gunTimeMs: 610000, netTimeMs: 610000, formattedGunTime: '10:10', formattedNetTime: '10:10', gapMs: 10000, formattedGap: '+10.0', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 7, bibNumber: 107, athleteName: 'ع 7', clubName: 'مولودية الجزائر', category: 'SENIOR', gender: 'M', gunTimeMs: 615000, netTimeMs: 615000, formattedGunTime: '10:15', formattedNetTime: '10:15', gapMs: 15000, formattedGap: '+15.0', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 8, bibNumber: 108, athleteName: 'ع 8', clubName: 'شباب بلوزداد', category: 'SENIOR', gender: 'M', gunTimeMs: 618000, netTimeMs: 618000, formattedGunTime: '10:18', formattedNetTime: '10:18', gapMs: 18000, formattedGap: '+18.0', completedLaps: 4, status: 'finished', isLocked: true }
      ];

      const standings = rankingService.computeTeamStandings(results, 3);

      expect(standings.length).toBe(2);
      expect(standings[0].clubName).toBe('مولودية الجزائر');
      expect(standings[0].rank).toBe(1);
      expect(standings[0].totalPoints).toBe(13); // 2 + 4 + 7

      expect(standings[1].clubName).toBe('شباب بلوزداد');
      expect(standings[1].rank).toBe(2);
      expect(standings[1].totalPoints).toBe(14); // 1 + 5 + 8
    });

    it('breaks ties using Rule 19.3 based on the rank of the last scoring runner', () => {
      // وفاق سطيف: رتب 1, 6, 9 -> مجموع 16 (آخر عداء رتبته 9)
      // أهلي البرج: رتب 2, 4, 10 -> مجموع 16 (آخر عداء رتبته 10)
      const results: RaceResultEntry[] = [
        { rank: 1, bibNumber: 201, athleteName: 'ع 1', clubName: 'وفاق سطيف', category: 'SENIOR', gender: 'M', gunTimeMs: 600000, netTimeMs: 600000, formattedGunTime: '10:00', formattedNetTime: '10:00', gapMs: 0, formattedGap: '-', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 2, bibNumber: 202, athleteName: 'ع 2', clubName: 'أهلي البرج', category: 'SENIOR', gender: 'M', gunTimeMs: 601000, netTimeMs: 601000, formattedGunTime: '10:01', formattedNetTime: '10:01', gapMs: 1000, formattedGap: '+01.0', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 4, bibNumber: 204, athleteName: 'ع 4', clubName: 'أهلي البرج', category: 'SENIOR', gender: 'M', gunTimeMs: 604000, netTimeMs: 604000, formattedGunTime: '10:04', formattedNetTime: '10:04', gapMs: 4000, formattedGap: '+04.0', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 6, bibNumber: 206, athleteName: 'ع 6', clubName: 'وفاق سطيف', category: 'SENIOR', gender: 'M', gunTimeMs: 606000, netTimeMs: 606000, formattedGunTime: '10:06', formattedNetTime: '10:06', gapMs: 6000, formattedGap: '+06.0', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 9, bibNumber: 209, athleteName: 'ع 9', clubName: 'وفاق سطيف', category: 'SENIOR', gender: 'M', gunTimeMs: 609000, netTimeMs: 609000, formattedGunTime: '10:09', formattedNetTime: '10:09', gapMs: 9000, formattedGap: '+09.0', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 10, bibNumber: 210, athleteName: 'ع 10', clubName: 'أهلي البرج', category: 'SENIOR', gender: 'M', gunTimeMs: 610000, netTimeMs: 610000, formattedGunTime: '10:10', formattedNetTime: '10:10', gapMs: 10000, formattedGap: '+10.0', completedLaps: 4, status: 'finished', isLocked: true }
      ];

      const standings = rankingService.computeTeamStandings(results, 3);

      expect(standings.length).toBe(2);
      expect(standings[0].totalPoints).toBe(16);
      expect(standings[1].totalPoints).toBe(16);

      // وفاق سطيف تفوز لأن آخر عداء محتسب لها رتبته 9 وهي أفضل من 10 (Rule 19.3)
      expect(standings[0].clubName).toBe('وفاق سطيف');
      expect(standings[0].rank).toBe(1);
      expect(standings[1].clubName).toBe('أهلي البرج');
      expect(standings[1].rank).toBe(2);
    });

    it('marks incomplete teams with status "incomplete" and places them after qualified teams', () => {
      const results: RaceResultEntry[] = [
        { rank: 1, bibNumber: 301, athleteName: 'ع 1', clubName: 'نادي الشلف', category: 'SENIOR', gender: 'M', gunTimeMs: 600000, netTimeMs: 600000, formattedGunTime: '10:00', formattedNetTime: '10:00', gapMs: 0, formattedGap: '-', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 2, bibNumber: 302, athleteName: 'ع 2', clubName: 'نادي الشلف', category: 'SENIOR', gender: 'M', gunTimeMs: 602000, netTimeMs: 602000, formattedGunTime: '10:02', formattedNetTime: '10:02', gapMs: 2000, formattedGap: '+02.0', completedLaps: 4, status: 'finished', isLocked: true },
        // نادي الشلف لديه عداءين فقط بينما المطلوب 3 عدائين
      ];

      const standings = rankingService.computeTeamStandings(results, 3);
      expect(standings.length).toBe(1);
      expect(standings[0].status).toBe('incomplete');
    });
  });

  describe('Medal Tally & Trophy Championship Points', () => {
    it('accurately compiles medal table and trophy points', () => {
      const results: RaceResultEntry[] = [
        { rank: 1, bibNumber: 1, athleteName: 'ذهب', clubName: 'مولودية الجزائر', category: 'SENIOR', gender: 'M', gunTimeMs: 600000, netTimeMs: 600000, formattedGunTime: '10:00', formattedNetTime: '10:00', gapMs: 0, formattedGap: '-', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 2, bibNumber: 2, athleteName: 'فضة', clubName: 'شباب بلوزداد', category: 'SENIOR', gender: 'M', gunTimeMs: 602000, netTimeMs: 602000, formattedGunTime: '10:02', formattedNetTime: '10:02', gapMs: 2000, formattedGap: '+02.0', completedLaps: 4, status: 'finished', isLocked: true },
        { rank: 3, bibNumber: 3, athleteName: 'برونز', clubName: 'مولودية الجزائر', category: 'SENIOR', gender: 'M', gunTimeMs: 605000, netTimeMs: 605000, formattedGunTime: '10:05', formattedNetTime: '10:05', gapMs: 5000, formattedGap: '+05.0', completedLaps: 4, status: 'finished', isLocked: true },
      ];

      const tallies = rankingService.computeMedalTally(results);
      expect(tallies.length).toBe(2);

      expect(tallies[0].clubName).toBe('مولودية الجزائر');
      expect(tallies[0].gold).toBe(1);
      expect(tallies[0].bronze).toBe(1);
      expect(tallies[0].trophyPoints).toBe(15); // 10 + 5

      expect(tallies[1].clubName).toBe('شباب بلوزداد');
      expect(tallies[1].silver).toBe(1);
      expect(tallies[1].trophyPoints).toBe(7);
    });
  });

  describe('Enterprise Exports', () => {
    const sampleResults: RaceResultEntry[] = [
      {
        rank: 1,
        bibNumber: 42,
        athleteName: 'نور الدين مرسلي',
        clubName: 'مولودية الجزائر',
        category: 'SENIOR',
        gender: 'M',
        gunTimeMs: 600000,
        netTimeMs: 599800,
        formattedGunTime: '10:00.000',
        formattedNetTime: '09:59.800',
        gapMs: 0,
        formattedGap: '-',
        completedLaps: 4,
        status: 'finished',
        isLocked: true
      }
    ];

    it('exports CSV with UTF-8 BOM so Excel opens Arabic correctly', () => {
      const csv = exportService.exportToCsv(mockCompetition, sampleResults);

      expect(csv.charCodeAt(0)).toBe(0xFEFF); // UTF-8 BOM
      expect(csv).toContain('بطولة الجزائر للعدو الريفي 2026');
      expect(csv).toContain('نور الدين مرسلي');
      expect(csv).toContain('مولودية الجزائر');
      expect(csv).toContain('10:00.000');
    });

    it('exports standard JSON payload with competition and results metadata', () => {
      const jsonStr = exportService.exportToJson(mockCompetition, sampleResults);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.version).toBe('PHOTO_FINISH_PRO_AI_2026');
      expect(parsed.competition.name).toBe(mockCompetition.name);
      expect(parsed.results.length).toBe(1);
      expect(parsed.results[0].athleteName).toBe('نور الدين مرسلي');
    });

    it('generates printable HTML with official signature block', () => {
      const html = exportService.generatePrintableHtml(mockCompetition, sampleResults);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('dir="rtl"');
      expect(html).toContain(mockCompetition.name);
      expect(html).toContain('الحكم العام للسباق (Chief Judge)');
      expect(html).toContain('نور الدين مرسلي');
    });
  });
});
