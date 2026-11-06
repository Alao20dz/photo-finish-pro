import { TopBar } from "@/components/site/TopBar";
import { Hero } from "@/components/site/Hero";
import { StatsStrip } from "@/components/site/StatsStrip";
import { CompetitionsSection } from "@/components/site/CompetitionsSection";
import { ResultsTicker, HowItWorks, Capabilities, LeaguesDirectory, Faq, Footer } from "@/components/site/Sections";
import { db } from "@/lib/db";
import type { PlatformStats, PublicCompetition, PublicLeague, PublicResultItem } from "@/lib/publicTypes";

export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  "100m": "100م", "400m": "400م", long_jump: "وثب طويل", high_jump: "وثب عالي",
  shot_put: "دفع الجلة", cross_4k: "ريفي 4كم", cross_5k: "ريفي 5كم", cross_6k: "ريفي 6كم",
  cross_7k: "ريفي 7كم", road_10k: "طريق 10كم",
};

export default async function Home() {
  const [leagues, comps, clubCount, athleteCount, regCount] = await Promise.all([
    db.league.findMany({ where: { status: "active" }, include: { clubs: true } }),
    db.competition.findMany({
      where: { visibility: "public", status: { notIn: ["draft"] } },
      include: { league: true, _count: { select: { events: true } } },
      orderBy: { startDate: "asc" },
    }),
    db.club.count({ where: { approvalStatus: "approved" } }),
    db.athlete.count(),
    db.registration.count({ where: { status: "approved" } }),
  ]);

  const stats: PlatformStats = {
    leagues: leagues.length,
    clubs: clubCount,
    athletes: athleteCount,
    competitions: comps.length,
    registrations: regCount,
  };

  const publicLeagues: PublicLeague[] = leagues.map((l) => ({
    id: l.id,
    nameAr: l.nameAr,
    nameFr: l.nameFr,
    wilaya: l.wilaya,
    code: l.code,
    colors: safeColors(l.colorsJson),
    clubsCount: l.clubs.filter((c) => c.approvalStatus === "approved").length,
  }));

  const publicComps: PublicCompetition[] = comps
    .filter((c) => leagues.some((l) => l.id === c.leagueId))
    .map((c) => {
      const league = publicLeagues.find((l) => l.id === c.leagueId)!;
      return {
        id: c.id,
        titleAr: c.titleAr,
        type: c.type,
        venue: c.venue || "",
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status,
        registrationDeadline: c.registrationDeadline,
        eventsCount: c._count.events,
        league,
      };
    });

  // نتائج معتمدة (من التظاهرة المنتهية) — لاحقاً من جدول نتائج رسمي
  const results: PublicResultItem[] = [
    { id: "r1", competitionTitle: "دورة القدم الذهبية — الجزائر", discipline: "ريفي 6كم", athlete: "بلال مسعودي", club: "شباب بلوزداد", mark: "18:42.65", status: "official" },
    { id: "r2", competitionTitle: "دورة القدم الذهبية — الجزائر", discipline: "ريفي 6كم", athlete: "نبيل حمداوي", club: "اتحاد العاصمة", mark: "19:07.31", status: "official" },
    { id: "r3", competitionTitle: "دورة القدم الذهبية — الجزائر", discipline: "ريفي 6كم", athlete: "يوسف قادري", club: "مولودية وهران", mark: "19:21.08", status: "official" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1">
        <Hero />
        <StatsStrip stats={stats} />
        <ResultsTicker results={results} />
        <CompetitionsSection competitions={publicComps} />
        <HowItWorks />
        <Capabilities />
        <LeaguesDirectory leagues={publicLeagues} />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}

function safeColors(json: string | null): { primary?: string; secondary?: string } | null {
  try {
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}
