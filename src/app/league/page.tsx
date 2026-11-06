"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, CalendarRange, CheckCircle2, FileSignature, KeyRound, Loader2, LockKeyhole, ShieldCheck, UserRoundCog, Users, Radio, Archive } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/site/TopBar";
import { Footer } from "@/components/site/Sections";

/** بوابة المدير التنفيذي — دخول MFA تجريبي ثم هيكل الوحدات مع حالة خطة التسليم */
export default function LeaguePortalPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("manager@lig-oran.dz");
  const [totp, setTotp] = useState("");
  const [loading, setLoading] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setTimeout(() => {
      // دخول معاينة: يُستبدل بـ Supabase Auth + MFA (AAL2) في المرحلة 4
      if (totp.trim() === "246810") setUnlocked(true);
      else setError("رمز التحقق غير صحيح — كود المعاينة: 246810");
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 pt-14">
        {!unlocked ? (
          <div className="mx-auto max-w-md px-4 py-16">
            <section className="rounded-3xl border border-border bg-card p-7 shadow-sm">
              <span className="grid place-items-center w-14 h-14 rounded-2xl bg-secondary text-secondary-foreground shadow-md mb-4">
                <ShieldCheck className="w-7 h-7" aria-hidden />
              </span>
              <h1 className="text-2xl font-black">{t("leaguePortal")}</h1>
              <p className="text-sm text-muted-foreground mt-1 mb-6">دخول بحساب + تحقق بخطوتين (TOTP) — إلزامي للمدير التنفيذي</p>

              <label className="text-sm font-bold mb-1.5 block" htmlFor="lg-email">البريد الإداري</label>
              <input
                id="lg-email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm mb-4 outline-none focus:border-primary"
              />
              <label className="text-sm font-bold mb-1.5 block" htmlFor="lg-totp">رمز التحقق (TOTP)</label>
              <input
                id="lg-totp" dir="ltr" value={totp}
                onChange={(e) => { setTotp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="••••••" inputMode="numeric" autoFocus
                className="tnum w-full rounded-xl border border-input bg-background px-3.5 py-3 text-xl tracking-[0.3em] text-center mb-2 outline-none focus:border-primary"
              />
              {error && <p role="alert" className="text-xs font-bold text-destructive mb-2">{error}</p>}
              <p className="text-xs text-muted-foreground mb-4">وضع المعاينة: أي بريد + الكود <span className="tnum font-bold">246810</span></p>
              <Button onClick={submit} disabled={loading} className="w-full h-12 font-extrabold">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : <KeyRound className="w-5 h-5" aria-hidden />}
                دخول آمن
              </Button>
            </section>
          </div>
        ) : (
          <Dashboard email={email} />
        )}
      </main>
      <Footer />
    </div>
  );
}

function Dashboard({ email }: { email: string }) {
  const { t } = useI18n();

  const modules = [
    { icon: BarChart3, name: "نظرة عامة: مؤشرات وتنبيهات", phase: 4 },
    { icon: CalendarRange, name: "التظاهرات: معالج إنشاء ونشر", phase: 4 },
    { icon: Users, name: "التسجيلات: قائمة الانتظار والموافقة", phase: 5 },
    { icon: UserRoundCog, name: "الأندية والمدربون: اعتماد وحصص", phase: 5 },
    { icon: FileSignature, name: "الأكواد: إصدار وإبطال وQR", phase: 6 },
    { icon: Radio, name: "النتائج والتقارير والتصدير", phase: 7 },
    { icon: Archive, name: "الإعدادات: الأصناف والتدقيق والنسخ", phase: 9 },
  ];

  const done = [
    "المرحلة 0 — الأمان: إزالة كل الأسرار وتوقيع Ed25519 (127/127 اختباراً)",
    "المرحلة 1 — Supabase: المخطط + RLS + seed + اختبارات (supabase/)",
    "المرحلة 2 — نظام التصميم + i18n ثلاثي (جارٍ في هذه الصفحة)",
    "المرحلة 3 — الموقع العام (الصفحة الرئيسية تعرض تظاهرات رابطتك)",
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-black">{t("leaguePortal")}</h1>
          <p dir="ltr" className="text-sm text-muted-foreground">{email}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="font-bold">
          <Link href="/competition">إصدار كود وضع منافسة (تجريبي)</Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-extrabold mb-4 flex items-center gap-2">
            <LockKeyhole className="w-4.5 h-4.5 text-primary w-5 h-5" aria-hidden /> مكتمل حتى الآن
          </h2>
          <ul className="flex flex-col gap-2.5 text-sm">
            {done.map((d) => (
              <li key={d} className="flex items-start gap-2 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" aria-hidden />
                {d}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-extrabold mb-4">وحدات اللوحة وخطة تسليمها</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {modules.map((m) => (
              <li key={m.name} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2">
                <span className="flex items-center gap-2 font-bold">
                  <m.icon className="w-4 h-4 text-muted-foreground" aria-hidden />
                  {m.name}
                </span>
                <span className="tnum text-[11px] font-black text-muted-foreground border border-border rounded-full px-2 py-0.5 shrink-0">
                  {t("phase")} {m.phase}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
