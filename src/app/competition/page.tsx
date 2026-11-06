"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, ClipboardCheck, Loader2, MapPin, QrCode, ScanLine, Timer, UserCheck, WifiOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/site/TopBar";
import { Footer } from "@/components/site/Sections";

interface Task {
  role: string;
  league: { nameAr: string; code: string };
  competition: { id: string; titleAr: string; venue: string; startDate: string };
  station: string | null;
  note: string | null;
  masked: string;
  checkedInAt: string;
  remainingUses: number;
}

const ROLE_LABEL: Record<string, string> = {
  checkpoint_judge: "roleCheckpointJudge",
  field_judge: "roleFieldJudge",
  chief_judge: "roleChiefJudge",
  call_room: "roleCallRoom",
  results_clerk: "roleResultsClerk",
};

export default function CompetitionModePage() {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [checkedInAt, setCheckedInAt] = useState<string>("");

  const deviceId = (() => {
    try {
      let d = localStorage.getItem("pf_device_id");
      if (!d) {
        d = `WEB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        localStorage.setItem("pf_device_id", d);
      }
      return d;
    } catch {
      return "no-storage-device";
    }
  })();

  const redeem = async (value?: string) => {
    const theCode = (value ?? code).trim();
    if (!theCode || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: theCode, deviceId }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setError(t("rateLimited"));
      } else if (res.ok && data.ok) {
        setTask(data.task);
        setCheckedInAt(new Intl.DateTimeFormat("ar-DZ", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.task.checkedInAt)));
      } else {
        setError(t("codeInvalid"));
      }
    } catch {
      setError(t("codeInvalid"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 pt-14 track-lines">
        <div className="mx-auto max-w-lg px-4 py-12">
          {!task ? (
            <section className="rounded-3xl border border-border bg-card p-7 shadow-sm" aria-labelledby="code-title">
              <span className="grid place-items-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-md mb-4">
                <ScanLine className="w-7 h-7" aria-hidden />
              </span>
              <h1 id="code-title" className="text-2xl font-black tracking-tight">{t("compModeTitle")}</h1>
              <p className="text-muted-foreground text-sm mt-1 mb-6">{t("compModeSub")}</p>

              <label htmlFor="duty-code" className="text-sm font-bold mb-1.5 block">{t("compCodeLabel")}</label>
              <input
                id="duty-code"
                dir="ltr"
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
                onKeyDown={(e) => e.key === "Enter" && redeem()}
                placeholder={t("compCodePlaceholder")}
                autoFocus
                autoComplete="off"
                className="tnum w-full text-center text-2xl font-bold tracking-[0.15em] rounded-2xl border-2 border-input bg-background px-4 py-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
              <p className="text-xs text-muted-foreground mt-2">{t("compCodeHint")}</p>

              {error && (
                <p role="alert" className="mt-3 text-sm font-bold text-destructive flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" aria-hidden />
                  {error}
                </p>
              )}

              <Button onClick={() => redeem()} disabled={loading || code.trim().length < 6} className="w-full mt-5 h-12 text-base font-extrabold">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : <BadgeCheck className="w-5 h-5" aria-hidden />}
                {t("compCodeSubmit")}
              </Button>

              <Button variant="outline" className="w-full mt-3 font-bold" disabled>
                <QrCode className="w-5 h-5" aria-hidden />
                {t("compCodeQr")}
              </Button>

              {/* أكواد المعاينة التجريبية */}
              <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/50 p-4">
                <p className="text-xs font-black text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5" aria-hidden /> {t("demoNote")}
                </p>
                {[
                  { code: "LIG31-7K4M-Q9TX", label: t("demoCode1") },
                  { code: "LIG16-CHF2-M4RK", label: t("demoCode2") },
                ].map((dc) => (
                  <button
                    key={dc.code}
                    onClick={() => { setCode(dc.code); redeem(dc.code); }}
                    className="w-full flex items-center justify-between gap-2 rounded-xl bg-background border border-border px-3 py-2.5 mb-2 last:mb-0 hover:border-primary/60 transition-colors text-start"
                  >
                    <span className="text-xs text-muted-foreground font-bold">{dc.label}</span>
                    <span className="tnum text-sm font-extrabold text-primary" dir="ltr">{dc.code}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            /* ═══ بطاقة المهمة ═══ */
            <section className="rounded-3xl border-2 border-primary/30 bg-card overflow-hidden shadow-lg" aria-labelledby="task-title">
              <div className="bg-primary text-primary-foreground px-6 py-4 flex items-center justify-between">
                <h1 id="task-title" className="text-lg font-black flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" aria-hidden />
                  {t("taskCard")}
                </h1>
                <span className="tnum text-xs font-bold bg-white/20 rounded-full px-3 py-1" dir="ltr">{task.masked}</span>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-12 h-12 rounded-2xl bg-secondary text-secondary-foreground">
                    <UserCheck className="w-6 h-6" aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground font-bold">{t("taskRole")}</p>
                    <p className="font-extrabold text-lg">{t((ROLE_LABEL[task.role] || "roleFieldJudge") as never)}</p>
                  </div>
                </div>

                <dl className="grid gap-3 text-sm">
                  <Row label={t("taskLeague")} value={task.league.nameAr} />
                  <Row label={t("taskCompetition")} value={task.competition.titleAr} />
                  {task.station && <Row label={t("taskStation")} value={task.station} />}
                  <Row label={t("taskSince")} value={checkedInAt} tnum />
                  {task.note && <Row label={t("taskNote")} value={task.note} />}
                </dl>

                <p className="text-xs text-muted-foreground rounded-xl bg-muted p-3 leading-relaxed">
                  <WifiOff className="inline w-3.5 h-3.5 me-1 -mt-0.5" aria-hidden />
                  {t("taskOfflineNote")}
                </p>

                <Button asChild className="h-12 text-base font-extrabold">
                  <a href="/field/" target="_blank" rel="noopener">
                    <MapPin className="w-5 h-5" aria-hidden />
                    {t("taskStart")}
                  </a>
                </Button>

                <button onClick={() => { setTask(null); setCode(""); }} className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                  {t("backHome")}
                </button>
              </div>
            </section>
          )}

          <p className="text-center mt-6">
            <Link href="/field/" className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors underline underline-offset-4">
              {t("openFieldApp")} ↗
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Row({ label, value, tnum }: { label: string; value: string; tnum?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-2.5">
      <dt className="text-muted-foreground font-bold shrink-0">{label}</dt>
      <dd className={`font-extrabold text-end ${tnum ? "tnum" : ""}`}>{value}</dd>
    </div>
  );
}
