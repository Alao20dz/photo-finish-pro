"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, Radio } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/**
 * Hero بخلفية "مسح شريطي" (Slit-Scan) حية: شرائح عمودية تُلتقط من مشهد عدّائين
 * متحرك وتُصنع منها صورة فوتو-فينيش تمرر زمنياً — كلها مرسومة Canvas بلا صور ثقيلة.
 * تحترم prefers-reduced-motion (تُعرض صورة مركّبة ثابتة).
 */
export function Hero() {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ms, setMs] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let W = 0, H = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const scene = document.createElement("canvas");
    const sctx = scene.getContext("2d")!;

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      W = Math.floor(rect.width); H = Math.floor(rect.height);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      scene.width = W; scene.height = H;
    };
    resize();
    window.addEventListener("resize", resize);

    /** مشهد العدّائين: مضمار + عدّاءان بظلال أرجل متحركة */
    const drawScene = (time: number) => {
      const g = sctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#101725");
      g.addColorStop(0.55, "#182236");
      g.addColorStop(1, "#1f1a16");
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, W, H);

      // حارات المضمار
      const laneY = H * 0.78;
      for (let i = 0; i < 5; i++) {
        sctx.strokeStyle = `rgba(255,255,255,${0.10 - i * 0.015})`;
        sctx.lineWidth = 2;
        sctx.beginPath();
        sctx.moveTo(0, laneY + i * (H * 0.05));
        sctx.lineTo(W, laneY + i * (H * 0.05));
        sctx.stroke();
      }

      // عدّاءان — أشكال هندسية مجردة بأرجل متحركة
      const runner = (x: number, scale: number, phase: number, tint: string) => {
        const y = laneY - 6 * scale;
        sctx.save();
        sctx.translate(x % (W + 200) - 100, y);
        sctx.scale(scale, scale);
        // الجسم
        sctx.fillStyle = tint;
        sctx.beginPath();
        sctx.ellipse(0, -34, 9, 16, 0.18, 0, Math.PI * 2);
        sctx.fill();
        // الرأس
        sctx.beginPath();
        sctx.arc(4, -56, 7.5, 0, Math.PI * 2);
        sctx.fill();
        // الأرجل بزاوية متحركة
        const leg = Math.sin(phase) * 16;
        sctx.strokeStyle = tint;
        sctx.lineWidth = 5;
        sctx.lineCap = "round";
        sctx.beginPath();
        sctx.moveTo(0, -22); sctx.lineTo(leg, 2);
        sctx.moveTo(0, -22); sctx.lineTo(-leg, 2);
        sctx.stroke();
        // الذراعان
        sctx.lineWidth = 4;
        sctx.beginPath();
        sctx.moveTo(0, -42); sctx.lineTo(-leg * 0.7, -30);
        sctx.moveTo(0, -42); sctx.lineTo(leg * 0.7, -50);
        sctx.stroke();
        sctx.restore();
      };

      runner(time * 0.16, H / 190, time * 0.012, "rgba(230,57,23,0.92)");
      runner(time * 0.11 + W * 0.55, H / 210, time * 0.010 + 1.6, "rgba(255,209,102,0.85)");
    };

    /** مؤثر المسح الشريطي: نسخ شريحة عمودية من المشهد إلى عمود دوّار */
    const STRIP = 3;
    let column = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = now - last;
      last = now;
      const time = now;

      drawScene(time);

      // تقدم الأعمدة بسرعة تتناسب مع الإطارات
      column = (column + Math.max(1, Math.round(dt / 8))) % W;
      for (let i = 0; i < STRIP; i++) {
        const sx = (column * STRIP + i) % W;
        ctx.drawImage(scene, sx, 0, 1, H, sx, 0, 1, H);
      }

      // طبقة تعتيم متدرجة فوق الصورة القديمة تدريجياً (بصمة المسح)
      ctx.fillStyle = "rgba(8,10,16,0.012)";
      ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(frame);
    };

    if (reduced) {
      // صورة مركّبة ثابتة
      drawScene(4000);
      ctx.drawImage(scene, 0, 0);
      ctx.fillStyle = "rgba(8,10,16,0.25)";
      ctx.fillRect(0, 0, W, H);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // عدّاد زمن حي بالمللي ثانية (أرقام جدولية أحادية العرض)
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let raf = 0;
    const tick = () => {
      setMs(performance.now() % 100000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const secs = (ms / 1000).toFixed(2).padStart(5, "0");
  const mss = Math.floor(ms % 100).toString().padStart(2, "0");

  return (
    <section className="relative overflow-hidden bg-[#0a0c12] text-white" aria-label="hero">
      <canvas ref={canvasRef} className="absolute inset-0 opacity-70" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c12] via-transparent to-[#0a0c12]/60" aria-hidden />
      {/* شريط المسح */}
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-b from-primary/70 to-transparent animate-scanline" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-4 pt-32 pb-20 sm:pt-40 sm:pb-28 flex flex-col items-center text-center gap-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur px-4 py-1.5 text-xs font-bold tracking-wide">
          <Radio className="w-3.5 h-3.5 text-primary animate-pulse" aria-hidden />
          {t("heroBadge")}
        </span>

        <h1 className="text-4xl sm:text-6xl font-black leading-[1.15] tracking-tight max-w-3xl">
          {t("heroTitle1")}{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-l from-primary via-[#ff7a45] to-[#ffb100]">
            {t("heroTitle2")}
          </span>
        </h1>

        <p className="text-base sm:text-lg text-white/75 max-w-2xl leading-relaxed">
          {t("heroSub")}
        </p>

        {/* عداد زمني حي */}
        <div className="tnum select-none text-4xl sm:text-5xl font-bold text-white/95 bg-white/5 border border-white/15 rounded-2xl px-6 py-3 backdrop-blur-sm" dir="ltr" aria-label="live clock">
          00:{secs}
          <span className="text-primary">.{mss}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="font-extrabold text-base px-7 h-12">
            <a href="#competitions">{t("heroCta1")}</a>
          </Button>
          <Button asChild size="lg" variant="outline" className="font-extrabold text-base px-7 h-12 border-white/30 text-white hover:bg-white/10 hover:text-white">
            <Link href="/league">{t("heroCta2")}</Link>
          </Button>
        </div>

        <a href="#competitions" className="mt-6 text-white/50 hover:text-white/90 transition-colors" aria-label="scroll">
          <ArrowDown className="w-5 h-5 animate-bounce" aria-hidden />
        </a>
      </div>
    </section>
  );
}
