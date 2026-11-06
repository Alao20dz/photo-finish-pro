"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Search, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PublicCompetition } from "@/lib/publicTypes";

const TYPES = ["all", "track", "cross_country", "road", "field"] as const;

const statusKey: Record<string, string> = {
  draft: "statusDraft",
  published: "statusPublished",
  registration_open: "statusRegistrationOpen",
  registration_closed: "statusRegistrationClosed",
  frozen: "statusFrozen",
  running: "statusRunning",
  finished: "statusFinished",
  results_published: "statusResultsPublished",
};

const liveStatuses = new Set(["running"]);

export function CompetitionsSection({ competitions }: { competitions: PublicCompetition[] }) {
  const { t } = useI18n();
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      competitions.filter((c) => {
        if (type !== "all" && c.type !== type) return false;
        if (q && !(c.titleAr.includes(q) || c.venue.includes(q) || c.league.nameAr.includes(q) || (c.league.nameFr || "").toLowerCase().includes(q.toLowerCase()))) return false;
        return true;
      }),
    [competitions, type, q]
  );

  const byLeague = useMemo(() => {
    const m = new Map<string, { league: PublicCompetition["league"]; comps: PublicCompetition[] }>();
    for (const c of filtered) {
      if (!m.has(c.league.id)) m.set(c.league.id, { league: c.league, comps: [] });
      m.get(c.league.id)!.comps.push(c);
    }
    return Array.from(m.values());
  }, [filtered]);

  const typeLabel: Record<string, string> = {
    all: t("filterAll"),
    track: t("filterTrack"),
    field: t("filterField"),
    cross_country: t("filterCross"),
    road: t("filterRoad"),
  };

  return (
    <section id="competitions" className="mx-auto max-w-6xl px-4 py-16 scroll-mt-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{t("compsTitle")}</h2>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t("compsSub")}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="w-full rounded-xl border border-input bg-card px-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-1" role="tablist" aria-label={t("compsTitle")}>
        {TYPES.map((tt) => (
          <button
            key={tt}
            role="tab"
            aria-selected={type === tt}
            onClick={() => setType(tt)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold border transition-colors ${
              type === tt ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"
            }`}
          >
            {typeLabel[tt]}
          </button>
        ))}
      </div>

      {byLeague.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          {t("emptyComps")}
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {byLeague.map(({ league, comps }) => (
            <div key={league.id}>
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="grid place-items-center w-10 h-10 rounded-xl text-white font-black text-sm shadow-sm shrink-0"
                  style={{ background: league.colors?.primary || "#0b1b3a" }}
                  aria-hidden
                >
                  {league.code}
                </span>
                <div>
                  <h3 className="font-extrabold text-lg leading-tight">{league.nameAr}</h3>
                  <p className="text-xs text-muted-foreground">{league.nameFr || league.wilaya} · {league.clubsCount} {t("clubsCount")}</p>
                </div>
                <div className="flex-1 border-t border-border/70 mx-2" aria-hidden />
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {comps.map((c) => (
                  <CompCard key={c.id} comp={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CompCard({ comp }: { comp: PublicCompetition }) {
  const { t } = useI18n();
  const isLive = liveStatuses.has(comp.status);

  return (
    <article className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/40 transition-all flex flex-col">
      <div className="h-1.5" style={{ background: comp.league.colors?.primary || "var(--primary)" }} aria-hidden />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Badge
            variant={isLive ? "default" : "secondary"}
            className={`gap-1.5 font-bold ${isLive ? "bg-live text-white" : ""}`}
          >
            {isLive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden />}
            {t(statusKey[comp.status] || "statusPublished" as never)}
          </Badge>
          <span className="text-[11px] font-bold text-muted-foreground border border-border rounded-full px-2.5 py-0.5">
            {typeLabel(comp.type, t)}
          </span>
        </div>

        <h4 className="font-extrabold text-lg leading-snug group-hover:text-primary transition-colors">
          {comp.titleAr}
        </h4>

        <div className="text-sm text-muted-foreground flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 shrink-0" aria-hidden />
            <span className="tnum">{fmtDate(comp.startDate)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-4 h-4 shrink-0" aria-hidden />
            {comp.venue}
          </span>
        </div>

        <div className="mt-auto pt-2 flex items-center justify-between gap-2 border-t border-border/70">
          <span className="text-xs font-bold text-muted-foreground">
            {comp.eventsCount} {t("events")}
            {comp.registrationDeadline && comp.status === "registration_open" && (
              <span className="tnum"> · {daysLeft(comp.registrationDeadline)} {t("days")}</span>
            )}
          </span>
          {comp.status === "registration_open" ? (
            <Button asChild size="sm" className="font-extrabold">
              <Link href={`/coach?competition=${comp.id}`}>{t("registerNow")}</Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline" className="font-bold">
              <Link href={`/competition/${comp.id}`}>{t("viewPage")}</Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function typeLabel(type: string, t: (k: never) => string): string {
  const map: Record<string, string> = {
    track: "مضمار", field: "ميدان", cross_country: "ريفي", road: "طريق",
  };
  return map[type] || type;
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-DZ", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function daysLeft(iso: string): number {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return Math.max(0, d);
}
