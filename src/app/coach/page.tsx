"use client";

import { ArrowLeft, ArrowRight, ClipboardList, Database, FileUp, Send, UserRound, CalendarCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/site/TopBar";
import { Footer } from "@/components/site/Sections";

/** نافذة تسجيل العدائين — هيكل المعالج (المرحلة 5 في خطة التسليم) */
export default function CoachPortalPage() {
  const { t } = useI18n();

  const steps = [
    { icon: Database, label: "الرابطة والنادي", hint: "تُملأ الرابطة من التظاهرة، ويُختار النادي بالبحث" },
    { icon: UserRound, label: "بيانات العداء", hint: "الصنف يُحسب فورياً من تاريخ الميلاد + كشف التكرار" },
    { icon: ClipboardList, label: "التخصصات", hint: "مسابقات مفتوحة لصنفه فقط، بقائمة مستقلة لكل تخصص" },
    { icon: FileUp, label: "عدة عدائين", hint: "جدول سريع أو استيراد Excel/CSV بقالب جاهز" },
    { icon: Send, label: "المراجعة والإرسال", hint: "ملخص + إقرار → قائمة انتظار الرابطة" },
    { icon: CalendarCheck, label: "المتابعة", hint: "حالات القرار، التعديل وإعادة الإرسال، الإشعارات" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 pt-14">
        <div className="mx-auto max-w-2xl px-4 py-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground border border-primary/20 px-3.5 py-1.5 text-xs font-black mb-4">
            {t("underConstruction")} — {t("phase")} 5
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{t("coachPortal")}</h1>
          <p className="text-muted-foreground text-sm mt-2 mb-8 leading-relaxed">
            معالج خطوات على الهاتف يُفتح من زر «{t("registerNow")}» في بطاقة التظاهرة. لا يظهر أي عداء في القوائم الرسمية إلا بعد موافقة الرابطة، وبعد غلق التسجيل تُجمَّد القوائم (Snapshot) وأي تعديل لاحق مرقّم بسبب.
          </p>

          <ol className="flex flex-col gap-3" aria-label="wizard steps">
            {steps.map((s, i) => (
              <li key={i} className={`rounded-2xl border p-4 flex items-center gap-4 transition-colors ${i === 0 ? "border-primary/50 bg-accent/50" : "border-border bg-card"}`}>
                <span className={`tnum grid place-items-center w-9 h-9 rounded-xl font-black shrink-0 ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-extrabold flex items-center gap-2">
                    <s.icon className="w-4 h-4 text-muted-foreground" aria-hidden />
                    {s.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.hint}</p>
                </div>
                {i === 0 && <ArrowRight className="w-4 h-4 text-primary ms-auto shrink-0 rtl:block ltr:hidden" aria-hidden />}
                {i === 0 && <ArrowLeft className="w-4 h-4 text-primary ms-auto shrink-0 ltr:block rtl:hidden" aria-hidden />}
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">التحقق في الخادم أيضاً:</strong> الأصناف والأهلية والتكرار وحد المسابقات في اليوم تُفرض بقيود قاعدة البيانات ودوال خادمية (قيود UNIQUE + دوال Supabase)، لا في الواجهة فقط.
          </div>

          <Button asChild className="mt-6 font-extrabold">
            <a href="/#competitions">{t("navCompetitions")} المتاحة الآن ←</a>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
