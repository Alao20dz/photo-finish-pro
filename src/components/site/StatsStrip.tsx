"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Flag, Club, Trophy, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { PlatformStats } from "@/lib/publicTypes";

/** شريط أرقام حية — عدّادات تتحرك عند الظهور */
export function StatsStrip({ stats }: { stats: PlatformStats }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const items = [
    { icon: Flag, value: stats.leagues, label: t("statsLeagues") },
    { icon: Building2, value: stats.clubs, label: t("statsClubs") },
    { icon: Users, value: stats.athletes, label: t("statsAthletes") },
    { icon: Trophy, value: stats.competitions, label: t("statsCompetitions") },
    { icon: Club, value: stats.registrations, label: t("statsRegistrations") },
  ];

  return (
    <div ref={ref} className="border-y border-border bg-card/60">
      <div className="mx-auto max-w-6xl px-4 py-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
        {items.map((it, i) => (
          <Counter key={i} icon={it.icon} value={it.value} label={it.label} start={shown} delay={i * 90} />
        ))}
      </div>
    </div>
  );
}

function Counter({ icon: Icon, value, label, start, delay }: { icon: typeof Flag; value: number; label: string; start: boolean; delay: number }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const dur = 900;
    let t0 = 0;
    const step = (now: number) => {
      if (!t0) t0 = now + delay;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const p = reduced ? 1 : Math.min(1, Math.max(0, (now - t0) / dur));
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [start, value, delay]);

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <Icon className="w-5 h-5 text-primary" aria-hidden />
      <span className="tnum text-3xl font-extrabold">{n.toLocaleString("ar-DZ")}</span>
      <span className="text-xs sm:text-sm text-muted-foreground font-medium">{label}</span>
    </div>
  );
}
