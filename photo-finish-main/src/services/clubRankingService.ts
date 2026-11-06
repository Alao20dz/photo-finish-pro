/**
 * PHOTO FINISH PRO – Complete Athletics Management System
 * Club Ranking & World Athletics Rule 19 Team Scoring Service (Stage C7)
 * 
 * Rules:
 * 1. World Athletics Rule 19 (Cross-Country Team Scoring):
 *    - Team total points = Sum of individual ranks of the top N finishers.
 *    - Lowest points total wins!
 *    - Tie-breaking (Rule 19.3): The tie is resolved in favor of the team
 *      whose last scoring runner (the N-th runner) finished closest to 1st place.
 * 2. Multi-event Medal Tallies and Trophy Championship points.
 */

import { 
  RaceResultEntry, 
  ClubTeamScore, 
  TeamScoringRunner, 
  ClubMedalTally 
} from '../types/athletics';

export class ClubRankingService {
  /**
   * حساب ترتيب الفرق حسب لوائح الاتحاد الدولي لألعاب القوى (Rule 19)
   * @param results النتائج الفردية الرسمية للسباق
   * @param scoringCount عدد العدائين المحتسبين للفريق (افتراضياً 3 أو 4)
   */
  public computeTeamStandings(
    results: RaceResultEntry[], 
    scoringCount: number = 3
  ): ClubTeamScore[] {
    // تصفية العدائين المؤهلين (الذين أنهوا السباق ولم يستبعدوا)
    const finishers = results.filter(r => r.status === 'finished' && r.rank > 0 && r.rank < 1000);

    // تجميع حسب النادي
    const clubMap = new Map<string, RaceResultEntry[]>();
    finishers.forEach(r => {
      const club = r.clubName.trim() || 'فردي';
      if (
        club === 'فردي' || 
        club === 'مستقل' || 
        club.includes('فردي') || 
        club.includes('مستقل') ||
        club.toLowerCase() === 'individual'
      ) {
        return; // استبعاد المشاركات الفردية من ترتيب الفرق
      }

      const list = clubMap.get(club) || [];
      list.push(r);
      clubMap.set(club, list);
    });

    const teams: ClubTeamScore[] = [];

    clubMap.forEach((runners, clubName) => {
      // فرز عدائي النادي تصاعدياً حسب الترتيب الفردي
      runners.sort((a, b) => a.rank - b.rank);

      const teamRunners: TeamScoringRunner[] = runners.map((r, idx) => ({
        bibNumber: r.bibNumber,
        athleteName: r.athleteName,
        individualRank: r.rank,
        timeMs: r.gunTimeMs,
        formattedTime: r.formattedGunTime,
        isScorer: idx < scoringCount
      }));

      const isQualified = runners.length >= scoringCount;
      const scoringRunners = teamRunners.filter(r => r.isScorer);
      const totalPoints = scoringRunners.reduce((sum, r) => sum + r.individualRank, 0);
      const lastScorerRank = scoringRunners.length > 0 ? scoringRunners[scoringRunners.length - 1].individualRank : 9999;

      teams.push({
        rank: 0,
        clubName,
        totalPoints,
        scoringCount,
        runners: teamRunners,
        lastScorerRank,
        status: isQualified ? 'qualified' : 'incomplete'
      });
    });

    // فرز الفرق:
    // 1. المؤهلون (الذين لديهم N عدائين على الأقل) أولاً.
    // 2. الأقل نقاطاً أولاً (Lowest points wins).
    // 3. كسر التعادل (Rule 19.3): الأفضل في رتبة العداء الأخير المحتسب.
    const qualifiedTeams = teams.filter(t => t.status === 'qualified');
    qualifiedTeams.sort((a, b) => {
      if (a.totalPoints !== b.totalPoints) {
        return a.totalPoints - b.totalPoints;
      }
      // كسر التعادل برتبة العداء الأخير المحتسب
      if (a.lastScorerRank !== b.lastScorerRank) {
        return a.lastScorerRank - b.lastScorerRank;
      }
      // كسر تعادل إضافي بالعداء الذي قبله إن وجد
      for (let i = scoringCount - 2; i >= 0; i--) {
        const rankA = a.runners[i]?.individualRank || 9999;
        const rankB = b.runners[i]?.individualRank || 9999;
        if (rankA !== rankB) return rankA - rankB;
      }
      return 0;
    });

    qualifiedTeams.forEach((team, idx) => {
      team.rank = idx + 1;
    });

    // الفرق غير المكتملة
    const incompleteTeams = teams.filter(t => t.status === 'incomplete');
    incompleteTeams.sort((a, b) => {
      // الأكثر إنهاءً للسباق أولاً
      if (b.runners.length !== a.runners.length) {
        return b.runners.length - a.runners.length;
      }
      return a.totalPoints - b.totalPoints;
    });

    incompleteTeams.forEach((team, idx) => {
      team.rank = qualifiedTeams.length + idx + 1;
    });

    return [...qualifiedTeams, ...incompleteTeams];
  }

  /**
   * حساب جدول الميداليات ونقاط الدرع العام للبطولة
   * @param results قائمة النتائج الفردية
   */
  public computeMedalTally(results: RaceResultEntry[]): ClubMedalTally[] {
    const finishers = results.filter(r => r.status === 'finished' && r.rank > 0 && r.rank <= 8);

    const clubMap = new Map<string, { gold: number; silver: number; bronze: number; points: number }>();

    finishers.forEach(r => {
      const club = r.clubName.trim() || 'فردي';
      if (
        club === 'فردي' || 
        club === 'مستقل' || 
        club.includes('فردي') || 
        club.includes('مستقل') ||
        club.toLowerCase() === 'individual'
      ) return;

      const current = clubMap.get(club) || { gold: 0, silver: 0, bronze: 0, points: 0 };

      if (r.rank === 1) {
        current.gold += 1;
        current.points += 10;
      } else if (r.rank === 2) {
        current.silver += 1;
        current.points += 7;
      } else if (r.rank === 3) {
        current.bronze += 1;
        current.points += 5;
      } else if (r.rank === 4) {
        current.points += 4;
      } else if (r.rank === 5) {
        current.points += 3;
      } else if (r.rank === 6) {
        current.points += 2;
      } else if (r.rank >= 7) {
        current.points += 1;
      }

      clubMap.set(club, current);
    });

    const tallies: ClubMedalTally[] = [];
    clubMap.forEach((stats, clubName) => {
      tallies.push({
        rank: 0,
        clubName,
        gold: stats.gold,
        silver: stats.silver,
        bronze: stats.bronze,
        totalMedals: stats.gold + stats.silver + stats.bronze,
        trophyPoints: stats.points
      });
    });

    // فرز جدول الميداليات: الذهب أولاً، ثم الفضة، ثم البرونز، ثم النقاط
    tallies.sort((a, b) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return b.trophyPoints - a.trophyPoints;
    });

    tallies.forEach((t, idx) => {
      t.rank = idx + 1;
    });

    return tallies;
  }
}

export const clubRankingService = new ClubRankingService();
