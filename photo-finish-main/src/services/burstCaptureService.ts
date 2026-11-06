/**
 * محرك التصوير المتتالي فائق السرعة لكاميرا خط النهاية (High-Speed Photo Finish Burst Engine)
 * - يبدأ فور ملامسة أول عداء لخط النهاية ويستمر حتى وصول آخر العدائين
 * - يلتقط صوراً متتالية فائقة السرعة والوضوح
 * - يُظهر خط النهاية الرسمي، التوقيت بالمللي ثانية، وترتيب العدائين (الأول، الثاني، الثالث...)
 */

import { Runner } from '../types/race';

export interface BurstFinisher {
  lane: number;
  name: string;
  bib: number;
  rank: number;
  timeMs: number;
  formattedTime: string;
  isNewArrival?: boolean;
}

export interface BurstFrame {
  id: number;
  frameIndex: number;
  timeMs: number;
  formattedTime: string;
  dataUrl: string;
  isFinishMoment: boolean;
  triggeredLanes: number[];
  finishers: BurstFinisher[];
  leadingRunner?: string;
}

export class BurstCaptureService {
  public isCapturing: boolean = false;
  public frames: BurstFrame[] = [];
  public finishersOrder: {
    lane: number;
    name: string;
    bib: number;
    rank: number;
    timeMs: number;
    formattedTime: string;
    snapshotUrl: string;
  }[] = [];

  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  private maxFrames: number = 150; // سعة كافية لتغطية ثواني الحسم بكامل السرعة
  private lastCapturedTimeMs: number = 0;
  private captureIntervalMs: number = 30; // التقاط بمعدل ~33 إطار/ثانية لدقة قصوى

  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = 1280;
    this.offscreenCanvas.height = 720;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  public reset(): void {
    this.isCapturing = false;
    this.frames = [];
    this.finishersOrder = [];
    this.lastCapturedTimeMs = 0;
  }

  public startCapture(): void {
    this.reset();
    this.isCapturing = true;
    console.log('[BurstEngine] High-Speed Burst Capture Started!');
  }

  public stopCapture(): void {
    this.isCapturing = false;
    console.log(`[BurstEngine] Capture stopped. Total frames recorded: ${this.frames.length}`);
  }

  /**
   * التقاط إطار متتالي عالي الوضوح متضمن خط النهاية وترتيب العدائين
   */
  public captureFrame(
    video: HTMLVideoElement,
    finishLineXRatio: number,
    currentTimeMs: number,
    triggeredLanes: number[],
    runners: Runner[]
  ): BurstFrame | null {
    if (!this.isCapturing || !video.videoWidth || !video.videoHeight) return null;

    // التحكم بمعدل الإطارات لتجنب استهلاك الذاكرة وضمان ثبات 33 إطار/ثانية
    if (currentTimeMs - this.lastCapturedTimeMs < this.captureIntervalMs) {
      return null;
    }
    this.lastCapturedTimeMs = currentTimeMs;

    if (this.frames.length >= this.maxFrames) {
      return null;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    this.offscreenCanvas.width = vw;
    this.offscreenCanvas.height = vh;
    const ctx = this.offscreenCtx;

    // 1. رسم المشهد الفعلي من الكاميرا بكامل دقته
    ctx.drawImage(video, 0, 0, vw, vh);

    const finishLineX = Math.floor(vw * finishLineXRatio);

    // 2. فحص هل هناك عداء جديد وصل في هذا الإطار
    const newFinishersInFrame: BurstFinisher[] = [];
    let isFinishMoment = false;

    triggeredLanes.forEach((laneNum) => {
      const runner = runners.find(r => r.lane === laneNum);
      if (runner) {
        const alreadyRecorded = this.finishersOrder.find(f => f.lane === laneNum);
        if (!alreadyRecorded) {
          const rank = this.finishersOrder.length + 1;
          const s = Math.floor(currentTimeMs / 1000);
          const ms = Math.floor(currentTimeMs % 1000);
          const formattedTime = `${s}.${String(ms).padStart(3, '0')}s`;

          const finisherObj = {
            lane: laneNum,
            name: runner.name,
            bib: runner.bib,
            rank,
            timeMs: currentTimeMs,
            formattedTime,
            snapshotUrl: ''
          };

          this.finishersOrder.push(finisherObj);
          newFinishersInFrame.push({
            ...finisherObj,
            isNewArrival: true
          });
          isFinishMoment = true;
        }
      }
    });

    // 3. رسم خط النهاية الرسمي عالي الوضوح (Official IAAF Finish Line)
    // خط متوهج واضح جداً
    ctx.save();
    ctx.shadowColor = 'rgba(255, 0, 51, 0.8)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#ff0033';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(finishLineX, 0);
    ctx.lineTo(finishLineX, vh);
    ctx.stroke();

    // خيط قياس أبيض دقيق وسطه
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(finishLineX, 0);
    ctx.lineTo(finishLineX, vh);
    ctx.stroke();

    // شريط علامات أعلى وأسفل خط النهاية
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(finishLineX - 6, 0, 12, 24);
    ctx.fillRect(finishLineX - 6, vh - 24, 12, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH', finishLineX, 16);
    ctx.restore();

    // 4. رسم شريط التوقيت والبيانات الرسمية أعلى الصورة
    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 30, 0.82)';
    ctx.fillRect(0, 0, vw, 38);

    const s = Math.floor(currentTimeMs / 1000);
    const ms = Math.floor(currentTimeMs % 1000);
    const formatted = `${s}.${String(ms).padStart(3, '0')}s`;

    // مؤقت الساعة
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`⏱️ ${formatted}`, 14, 25);

    // عداد الإطارات
    const frameIndex = this.frames.length + 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`FRAME #${frameIndex}`, 140, 24);

    // ترتيب العدائين في الشريط العلوي
    let rankBadgeX = vw - 14;
    ctx.textAlign = 'right';
    if (this.finishersOrder.length > 0) {
      const topSummary = this.finishersOrder.slice(0, 3).map(f => {
        const medal = f.rank === 1 ? '🥇' : f.rank === 2 ? '🥈' : '🥉';
        return `${medal} L${f.lane} ${f.name} (${f.formattedTime})`;
      }).join('  |  ');

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(topSummary, rankBadgeX, 24);
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('📸 بانتظار وصول أول عداء إلى خط النهاية...', rankBadgeX, 24);
    }

    // 5. إذا كان هذا الإطار لحظة وصول عداء (Finish Moment)؛ إضافة شارة توثيق ملفتة
    if (newFinishersInFrame.length > 0) {
      newFinishersInFrame.forEach((finisher, idx) => {
        const badgeY = 60 + idx * 45;
        ctx.fillStyle = finisher.rank === 1 ? 'rgba(234, 179, 8, 0.95)' : finisher.rank === 2 ? 'rgba(148, 163, 184, 0.95)' : 'rgba(217, 119, 6, 0.95)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;

        const badgeW = 260;
        const badgeX = finishLineX > vw / 2 ? finishLineX - badgeW - 15 : finishLineX + 15;
        
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, 36, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'black 14px sans-serif';
        ctx.textAlign = 'right';
        const medal = finisher.rank === 1 ? '🥇 الأول' : finisher.rank === 2 ? '🥈 الثاني' : finisher.rank === 3 ? '🥉 الثالث' : `#${finisher.rank}`;
        ctx.fillText(`${medal} - رواق ${finisher.lane}: ${finisher.name}`, badgeX + badgeW - 10, badgeY + 23);
      });
    }

    ctx.restore();

    // استخراج الصورة عالية الوضوح
    const dataUrl = this.offscreenCanvas.toDataURL('image/jpeg', 0.88);

    // حفظ لقطة العداء
    newFinishersInFrame.forEach(f => {
      const recorded = this.finishersOrder.find(o => o.lane === f.lane);
      if (recorded && !recorded.snapshotUrl) {
        recorded.snapshotUrl = dataUrl;
      }
    });

    const burstFrame: BurstFrame = {
      id: Date.now() + Math.random(),
      frameIndex,
      timeMs: currentTimeMs,
      formattedTime: formatted,
      dataUrl,
      isFinishMoment,
      triggeredLanes: [...triggeredLanes],
      finishers: [...this.finishersOrder]
    };

    this.frames.push(burstFrame);
    return burstFrame;
  }

  /**
   * إنشاء لوحة تجميعية نهائية رسمية تجمع خط النهاية مع صور وصول العدائين بترتيبهم
   */
  public async generateCompositeCertificate(distance: string, windSpeed: string): Promise<string | null> {
    if (this.finishersOrder.length === 0) return null;

    const certCanvas = document.createElement('canvas');
    certCanvas.width = 1200;
    certCanvas.height = 700;
    const ctx = certCanvas.getContext('2d')!;

    // خلفية راقية
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, certCanvas.width, certCanvas.height);

    // رأس الوثيقة
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 1200, 70);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'black 22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`🏆 وثيقة الترتيب الرسمي المعتمد لسباق ${distance} (Photo Finish)`, 1160, 42);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`IAAF RULE 164.2  |  WIND: ${windSpeed || '+0.0 m/s'}  |  DATE: ${new Date().toLocaleDateString('ar-DZ')}`, 40, 42);

    // رسم جدول العدائين مع لقطة الوصول
    const topFinishers = this.finishersOrder.slice(0, 4);
    const colWidth = (1200 - 80) / Math.max(1, topFinishers.length);

    for (let i = 0; i < topFinishers.length; i++) {
      const f = topFinishers[i];
      const x = 40 + i * colWidth;
      const y = 90;

      // بطاقة العداء
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = f.rank === 1 ? '#eab308' : f.rank === 2 ? '#94a3b8' : '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + 5, y, colWidth - 10, 560, 14);
      ctx.fill();
      ctx.stroke();

      // شارة الترتيب
      ctx.fillStyle = f.rank === 1 ? '#eab308' : f.rank === 2 ? '#94a3b8' : '#d97706';
      ctx.font = 'black 20px sans-serif';
      ctx.textAlign = 'center';
      const medal = f.rank === 1 ? '🥇 المركز الأول' : f.rank === 2 ? '🥈 المركز الثاني' : f.rank === 3 ? '🥉 المركز الثالث' : `المركز ${f.rank}`;
      ctx.fillText(medal, x + colWidth / 2, y + 36);

      // اسم وتوقيت العداء
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`الرواق L${f.lane}: ${f.name}`, x + colWidth / 2, y + 68);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'black 22px monospace';
      ctx.fillText(f.formattedTime, x + colWidth / 2, y + 98);

      // رسم صورة الوصول إذا توفرت
      if (f.snapshotUrl) {
        try {
          const img = new Image();
          img.src = f.snapshotUrl;
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
          ctx.drawImage(img, x + 15, y + 115, colWidth - 30, 420);
        } catch (e) {
          // ignore
        }
      }
    }

    return certCanvas.toDataURL('image/png');
  }
}

export const burstCaptureService = new BurstCaptureService();
