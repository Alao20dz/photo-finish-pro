"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ClipboardList, Flag, GanttChartSquare, Radar, ShieldCheck, Timer, WifiOff, FileBarChart } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { PublicLeague, PublicResultItem } from "@/lib/publicTypes";

/* ═══ شريط النتائج المتحرك ═══ */
export function ResultsTicker({ results }: { results: PublicResultItem[] }) {
  const { t } = useI18n();
  if (results.length === 0) return null;
  const doubled = [...results, ...results];

  return (
    <section className="border-y border-border bg-secondary text-secondary-foreground overflow-hidden" aria-label={t("resultsTitle")}>
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
        <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-black">
          <span className="w-2 h-2 rounded-full bg-live animate-pulse" aria-hidden />
          {t("resultsTitle")}
        </span>
        <div className="relative flex-1 overflow-hidden" dir="ltr">
          <div className="animate-ticker flex gap-8 whitespace-nowrap w-max">
            {doubled.map((r, i) => (
              <span key={i} className="text-sm flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-primary" aria-hidden />
                <span className="font-bold">{r.competitionTitle}</span>
                <span className="opacity-70">· {r.discipline}</span>
                <span className="font-extrabold">{r.athlete}</span>
                <span className="opacity-60">({r.club})</span>
                <span className="tnum font-bold text-[--primary]" style={{ color: "var(--primary)" }}>{r.mark}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══ كيف تعمل المنصة ═══ */
export function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { icon: GanttChartSquare, title: t("how1Title"), sub: t("how1Sub") },
    { icon: ClipboardList, title: t("how2Title"), sub: t("how2Sub") },
    { icon: Radar, title: t("how3Title"), sub: t("how3Sub") },
  ];
  return (
    <section id="how" className="border-t border-border bg-muted/40 scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-center mb-10">{t("howTitle")}</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="relative rounded-2xl border border-border bg-card p-6 flex flex-col gap-3">
              <span className="tnum absolute top-4 end-5 text-4xl font-black text-primary/15 select-none" aria-hidden>
                {i + 1}
              </span>
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-accent text-accent-foreground">
                <s.icon className="w-5 h-5" aria-hidden />
              </span>
              <h3 className="font-extrabold text-lg">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══ قدرات المنصة (Mockups مرسومة بالشفرة) ═══ */
export function Capabilities() {
  const { t } = useI18n();
  const caps = [
    { icon: Timer, title: t("cap1"), sub: t("cap1s"), mock: <StripMock /> },
    { icon: GanttChartSquare, title: t("cap2"), sub: t("cap2s"), mock: <LanesMock /> },
    { icon: Radar, title: t("cap3"), sub: t("cap3s"), mock: <MapMock /> },
    { icon: ShieldCheck, title: t("cap4"), sub: t("cap4s"), mock: <HeightsMock /> },
    { icon: WifiOff, title: t("cap5"), sub: t("cap5s"), mock: <OfflineMock /> },
    { icon: FileBarChart, title: t("cap6"), sub: t("cap6s"), mock: <ReportMock /> },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-center mb-10">{t("capTitle")}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {caps.map((c, i) => (
          <article key={i} className="rounded-2xl border border-border bg-card overflow-hidden group hover:border-primary/40 transition-colors">
            <div className="h-28 bg-[#0b1b3a] relative overflow-hidden" aria-hidden>
              {c.mock}
            </div>
            <div className="p-5 flex flex-col gap-2">
              <span className="inline-flex items-center gap-2 font-extrabold">
                <c.icon className="w-4.5 h-4.5 text-primary w-5 h-5" aria-hidden />
                {c.title}
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.sub}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* Mockups مصغّرة مرسومة بالشفرة */
function StripMock() {
  return (
    <div className="absolute inset-0 flex items-end gap-[3px] p-3" dir="ltr">
      {Array.from({ length: 48 }).map((_, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{ height: `${30 + Math.abs(Math.sin(i * 0.55)) * 60}%`, background: i % 7 === 3 ? "#e63917" : "rgba(255,255,255,0.25)" }} />
      ))}
    </div>
  );
}
function LanesMock() {
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2 px-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-2 rounded-full bg-white/15 relative">
          <span className="absolute top-1/2 -translate-y-1/2 w-6 h-2.5 rounded-full" style={{ insetInlineStart: `${12 + i * 20}%`, background: i === 1 ? "#ffb100" : "#e63917" }} />
        </div>
      ))}
    </div>
  );
}
function MapMock() {
  return (
    <svg viewBox="0 0 200 90" className="absolute inset-0 w-full h-full" aria-hidden>
      <path d="M15 75 C 40 20, 80 85, 110 40 S 170 25, 190 15" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeDasharray="6 5" />
      {[[15, 75], [70, 55], [130, 35], [190, 15]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="6" fill="#e63917" stroke="#fff" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
}
function HeightsMock() {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-2" dir="ltr">
      {[1.75, 1.80, 1.85, 1.90].map((h, i) => (
        <div key={h} className={`tnum rounded-lg px-2 py-1 text-xs font-bold ${i === 2 ? "bg-[#ffb100] text-black" : "bg-white/15 text-white"}`}>
          {h.toFixed(2)}
        </div>
      ))}
    </div>
  );
}
function OfflineMock() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-4 py-2">
        <WifiOff className="w-4 h-4 text-[#ffb100]" aria-hidden />
        <span className="tnum text-white text-xs font-bold">1,248 records · synced</span>
      </div>
    </div>
  );
}
function ReportMock() {
  return (
    <div className="absolute inset-0 p-4 flex flex-col justify-center gap-1.5" dir="ltr">
      {["1", "2", "3"].map((r) => (
        <div key={r} className="flex items-center gap-2">
          <span className="tnum w-4 text-[10px] text-white/60">{r}</span>
          <div className="h-1.5 rounded-full bg-white/25 flex-1" />
          <span className="tnum text-[10px] text-[#ffb100] font-bold">{(9.58 - Number(r) * 0.08).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══ دليل الرابطات ═══ */
export function LeaguesDirectory({ leagues }: { leagues: PublicLeague[] }) {
  const { t } = useI18n();
  return (
    <section id="leagues" className="border-t border-border bg-muted/40 scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{t("leaguesTitle")}</h2>
          <p className="text-muted-foreground mt-1">{t("leaguesSub")}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leagues.map((l) => (
            <Link
              key={l.id}
              href={`/league/${l.id}`}
              className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4 hover:border-primary/50 hover:shadow-md transition-all"
            >
              <span
                className="grid place-items-center w-12 h-12 rounded-xl text-white font-black shadow-sm shrink-0"
                style={{ background: l.colors?.primary || "#0b1b3a" }}
                aria-hidden
              >
                {l.code}
              </span>
              <div className="min-w-0">
                <h3 className="font-extrabold truncate">{l.nameAr}</h3>
                <p className="text-xs text-muted-foreground">
                  {l.wilaya} · {l.clubsCount} {t("clubsCount")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══ الأسئلة الشائعة ═══ */
export function Faq() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);
  const faqs = [
    { q: t("faq1q"), a: t("faq1a") },
    { q: t("faq2q"), a: t("faq2a") },
    { q: t("faq3q"), a: t("faq3a") },
    { q: t("faq4q"), a: t("faq4a") },
  ];
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-center mb-8">{t("faqTitle")}</h2>
      <div className="flex flex-col gap-3">
        {faqs.map((f, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
            <button
              className="w-full flex items-center justify-between gap-3 p-4 text-start font-extrabold text-sm sm:text-base"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
            >
              {f.q}
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {open === i && <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{f.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══ التذييل ═══ */
export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-auto border-t border-border bg-secondary text-secondary-foreground">
      <div className="mx-auto max-w-6xl px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-8 h-8 rounded-xl bg-primary text-white">
            <Timer className="w-4 h-4" aria-hidden />
          </span>
          <span className="font-extrabold">{t("brand")}</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm opacity-80" aria-label="footer">
          <a href="#" className="hover:opacity-100">{t("footerAbout")}</a>
          <a href="#" className="hover:opacity-100">{t("footerPrivacy")}</a>
          <a href="#" className="hover:opacity-100">{t("footerTerms")}</a>
          <a href="#" className="hover:opacity-100">{t("footerContact")}</a>
          <Link href="/field/" className="hover:opacity-100 font-bold">{t("openFieldApp")}</Link>
        </nav>
        <p className="text-xs opacity-60 text-center sm:text-end max-w-xs">{t("footerRights")}</p>
      </div>
    </footer>
  );
}
