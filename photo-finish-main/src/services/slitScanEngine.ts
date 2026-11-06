/**
 * محرك المسح الشريطي البانورامي المستمر الحقيقي (Continuous Slit-Scan Imaging Engine)
 * - يلتقط شريحة رأسية متناهية الدقة (1-2px) من مستوى خط النهاية مع كل إطار
 * - يركب شريطاً زمنياً مستمراً (Time-Space Matrix) يمثل فيه المحور الأفقي الزمن بدقة المللي ثانية
 * - يرسم مسطرة التوقيت الرسمية لـ IAAF مع خطوط الأروقة وعلامات وصول صدور العدائين
 */

import { Runner } from '../types/race';

export interface SlitTimeMarker {
  xPosition: number;
  timeMs: number;
}

export class SlitScanEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentX: number = 0;
  public startTimeMs: number = 0;
  private timeMarkers: SlitTimeMarker[] = [];
  public isCapturing: boolean = false;
  private sliceWidth: number = 2; // عرض الشريحة بالبكسل

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 4000;
    this.canvas.height = 720;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.reset();
  }

  public reset(height: number = 720) {
    this.canvas.width = 4000;
    this.canvas.height = height;
    this.ctx.fillStyle = '#0a0f1d';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.currentX = 0;
    this.startTimeMs = 0;
    this.timeMarkers = [];
    this.isCapturing = false;
  }

  public startCapture(startTime: number) {
    this.reset();
    this.startTimeMs = startTime;
    this.isCapturing = true;
  }

  public stopCapture() {
    this.isCapturing = false;
  }

  /**
   * استخراج الشريحة العمودية من إطار الفيديو وإضافتها للشريط البانورامي
   */
  public captureSlice(video: HTMLVideoElement, finishLineXRatio: number = 0.35, currentRaceTimeMs: number): void {
    if (!this.isCapturing || !video.videoWidth) return;

    const sourceX = Math.floor(video.videoWidth * finishLineXRatio);
    const sourceHeight = video.videoHeight;

    // توسيع اللوحة تلقائياً إذا شارف الشريط على الامتلاء
    if (this.currentX + this.sliceWidth >= this.canvas.width) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.canvas.width;
      tempCanvas.height = this.canvas.height;
      tempCanvas.getContext('2d')!.drawImage(this.canvas, 0, 0);

      this.canvas.width += 2500;
      this.ctx.drawImage(tempCanvas, 0, 0);
    }

    // نسخ الشريحة الرأسية بدقة متناهية
    this.ctx.drawImage(
      video,
      sourceX, 0, this.sliceWidth, sourceHeight,
      this.currentX, 0, this.sliceWidth, this.canvas.height
    );

    // تسجيل مؤشر الزمن للبحث الدقيق بالمللي ثانية
    this.timeMarkers.push({
      xPosition: this.currentX,
      timeMs: currentRaceTimeMs
    });

    this.currentX += this.sliceWidth;
  }

  /**
   * إيجاد الزمن المقابل لموقع المؤشر (X position) بالمللي ثانية
   */
  public getTimeAtX(x: number): number {
    if (!this.timeMarkers.length) return 0;
    if (x <= 0) return this.timeMarkers[0].timeMs;
    if (x >= this.currentX) return this.timeMarkers[this.timeMarkers.length - 1].timeMs;

    for (let i = 0; i < this.timeMarkers.length; i++) {
      if (this.timeMarkers[i].xPosition >= x) {
        return this.timeMarkers[i].timeMs;
      }
    }
    return this.timeMarkers[this.timeMarkers.length - 1].timeMs;
  }

  /**
   * إيجاد موقع البكسل X المقابل لزمن محدد بالمللي ثانية
   */
  public getXAtTime(timeMs: number): number {
    if (!this.timeMarkers.length) return 0;
    for (let i = 0; i < this.timeMarkers.length; i++) {
      if (this.timeMarkers[i].timeMs >= timeMs) {
        return this.timeMarkers[i].xPosition;
      }
    }
    return this.currentX;
  }

  /**
   * استخراج شريط المسح البانورامي المستمر المكتمل كـ DataURL عالي الدقة
   * مع مسطرة التوقيت، تقسيم الأروقة، وعلامات وصول العدائين
   */
  public exportCroppedPhotoFinishDataUrl(laneCount: number = 4, runners: Runner[] = []): string | null {
    if (this.currentX < 20) {
      // إذا لم يكن هناك تسجيل حقيقي كافٍ، نولّد شريطاً بانورامياً نموذجياً
      return this.generateSyntheticFinishPanorama(runners, laneCount, '100m');
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.currentX;
    const rulerHeight = 44;
    exportCanvas.height = this.canvas.height + rulerHeight;
    const eCtx = exportCanvas.getContext('2d')!;

    // 1. رسم خلفية داكنة احترافية
    eCtx.fillStyle = '#050811';
    eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // 2. رسم صورة المسح الشريطي المستمر
    eCtx.drawImage(this.canvas, 0, 0, this.currentX, this.canvas.height, 0, 0, this.currentX, this.canvas.height);

    // 3. رسم خطوط الأروقة الأفقية الخفيفة
    const laneHeight = this.canvas.height / laneCount;
    eCtx.lineWidth = 1;
    eCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    eCtx.setLineDash([6, 6]);
    for (let l = 1; l < laneCount; l++) {
      const y = l * laneHeight;
      eCtx.beginPath();
      eCtx.moveTo(0, y);
      eCtx.lineTo(this.currentX, y);
      eCtx.stroke();

      // تسمية الرواق
      eCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      eCtx.font = 'bold 11px monospace';
      eCtx.fillText(`LANE ${l}`, 10, y - 5);
    }
    eCtx.fillText(`LANE ${laneCount}`, 10, this.canvas.height - 5);
    eCtx.setLineDash([]); // إعادة الخط المتصل

    // 4. رسم خطوط التوقيت الرأسية لكل عداء وصل (IAAF Torso Finish Cursors)
    runners.filter(r => r.finishTime > 0).forEach(runner => {
      const targetX = this.getXAtTime(runner.finishTime);
      if (targetX > 0 && targetX <= this.currentX) {
        // خط أحمر رأسي رفيع فائق الدقة يمر بنقطة التلامس
        eCtx.strokeStyle = runner.color || '#ef4444';
        eCtx.lineWidth = 1.5;
        eCtx.beginPath();
        eCtx.moveTo(targetX, 0);
        eCtx.lineTo(targetX, this.canvas.height);
        eCtx.stroke();

        // شارة العداء التوضيحية بأعلى الخط
        const badgeY = (runner.lane - 0.5) * laneHeight;
        eCtx.fillStyle = runner.color || '#ef4444';
        eCtx.beginPath();
        eCtx.roundRect(targetX - 25, Math.max(10, badgeY - 14), 50, 24, 6);
        eCtx.fill();

        eCtx.fillStyle = '#ffffff';
        eCtx.font = 'bold 10px monospace';
        eCtx.textAlign = 'center';
        eCtx.fillText(`L${runner.lane} #${runner.bib}`, targetX, Math.max(22, badgeY + 2));
        eCtx.textAlign = 'right';
      }
    });

    // 5. رسم مسطرة الزمن الرسمية في الأسفل (Time Graduation Ruler)
    eCtx.fillStyle = '#0f172a';
    eCtx.fillRect(0, this.canvas.height, this.currentX, rulerHeight);
    eCtx.strokeStyle = '#38bdf8';
    eCtx.lineWidth = 1.5;
    eCtx.beginPath();
    eCtx.moveTo(0, this.canvas.height);
    eCtx.lineTo(this.currentX, this.canvas.height);
    eCtx.stroke();

    eCtx.fillStyle = '#38bdf8';
    eCtx.font = 'bold 11px monospace';

    let lastLabeledSec = -1;
    this.timeMarkers.forEach((marker, idx) => {
      const sec = Math.floor(marker.timeMs / 1000);
      const ms = Math.floor(marker.timeMs % 1000);

      // شرطات كل 20 مللي ثانية
      if (idx % 2 === 0) {
        eCtx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        eCtx.beginPath();
        eCtx.moveTo(marker.xPosition, this.canvas.height);
        eCtx.lineTo(marker.xPosition, this.canvas.height + 6);
        eCtx.stroke();
      }

      // شرطات أكبر كل 100 مللي ثانية
      if (ms % 100 < 20) {
        eCtx.strokeStyle = '#38bdf8';
        eCtx.beginPath();
        eCtx.moveTo(marker.xPosition, this.canvas.height);
        eCtx.lineTo(marker.xPosition, this.canvas.height + 12);
        eCtx.stroke();
      }

      // كتابة التوقيت الرقمي الكامل عند كل ثانية
      if (ms < 50 && sec !== lastLabeledSec) {
        lastLabeledSec = sec;
        eCtx.fillStyle = '#fde047';
        eCtx.fillText(`${sec}.${String(ms).padStart(3, '0')}s`, marker.xPosition - 15, this.canvas.height + 28);
      }
    });

    // شارة الاعتماد الرسمية لـ Photo Finish
    eCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    eCtx.fillRect(this.currentX - 160, 10, 150, 36);
    eCtx.strokeStyle = '#eab308';
    eCtx.lineWidth = 1;
    eCtx.strokeRect(this.currentX - 160, 10, 150, 36);
    eCtx.fillStyle = '#fde047';
    eCtx.font = 'bold 10px monospace';
    eCtx.fillText('IAAF PHOTO FINISH', this.currentX - 15, 24);
    eCtx.fillStyle = '#ffffff';
    eCtx.fillText('FULLY AUTOMATIC TIMING', this.currentX - 15, 38);

    return exportCanvas.toDataURL('image/png');
  }

  /**
   * توليد شريط مسح بانورامي نموذجي فائق الجمال والواقعية (Synthetic Real Photo-Finish Strip)
   * يُستخدم للمعاينة والسباقات النموذجية لضمان وجود شريط بانورامي مكتمل دائماً
   */
  public generateSyntheticFinishPanorama(runners: Runner[] = [], laneCount: number = 4, distance: string = '100m'): string {
    const width = 1600;
    const height = 480;
    const rulerH = 44;
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height + rulerH;
    const ctx = c.getContext('2d')!;

    // تدرج لوني يحاكي أرضية المضمار ومستوى خط النهاية في الضوء
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#111827');
    grad.addColorStop(0.3, '#1f2937');
    grad.addColorStop(0.6, '#111827');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const laneH = height / laneCount;

    // خطوط الأروقة الأفقية
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let l = 1; l < laneCount; l++) {
      ctx.beginPath();
      ctx.moveTo(0, l * laneH);
      ctx.lineTo(width, l * laneH);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // قاعدة زمنية من 9.700 ثانية إلى 10.300 ثانية
    const baseTimeMs = 9700;
    const endWindowMs = 10300;
    const timeSpan = endWindowMs - baseTimeMs;

    // رسم تأثير المسح الشريطي الواقعي لحركة العدائين (المحور الأفقي هو الزمن)
    runners.forEach((r, idx) => {
      const runnerTime = r.finishTime > 0 ? r.finishTime : baseTimeMs + (idx * 110) + 80;
      const normalizedRatio = Math.max(0.1, Math.min(0.9, (runnerTime - baseTimeMs) / timeSpan));
      const torsoX = normalizedRatio * width;
      const centerY = (r.lane - 0.5) * laneH;

      // 1. رسم أثر حركة العداء الممسوح شريطياً
      const bodyGrad = ctx.createLinearGradient(torsoX - 120, centerY, torsoX + 40, centerY);
      bodyGrad.addColorStop(0, 'transparent');
      bodyGrad.addColorStop(0.4, `${r.color}33`);
      bodyGrad.addColorStop(0.85, `${r.color}cc`);
      bodyGrad.addColorStop(1, '#ffffff');

      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      // شكل انسيابي يحاكي صدر ورأس العداء المندفع للأمام عند خط النهاية
      ctx.ellipse(torsoX - 35, centerY, 55, laneH * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();

      // رأس العداء
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(torsoX - 10, centerY - laneH * 0.18, 12, 0, Math.PI * 2);
      ctx.fill();

      // قميص النادي
      ctx.fillStyle = r.color || '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(torsoX - 30, centerY - laneH * 0.12, 28, laneH * 0.32, 6);
      ctx.fill();

      // رقم الصدرية
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.bib}`, torsoX - 16, centerY + 3);

      // 2. خط التوقيت العمودي الدقيق عند نقطة الصدر (Torso Plane)
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(torsoX, 0);
      ctx.lineTo(torsoX, height);
      ctx.stroke();

      // بطاقة التوقيت العلوية للعداء
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = r.color || '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(torsoX - 45, Math.max(8, centerY - 28), 90, 24, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`L${r.lane} ${(runnerTime / 1000).toFixed(3)}s`, torsoX, Math.max(24, centerY - 12));
    });

    // 3. مسطرة التوقيت IAAF بالأسفل
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, height, width, rulerH);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();

    // تدريجات المللي ثانية
    for (let t = baseTimeMs; t <= endWindowMs; t += 10) {
      const x = ((t - baseTimeMs) / timeSpan) * width;
      const isSec = t % 1000 === 0;
      const isTenth = t % 100 === 0;

      ctx.strokeStyle = isSec ? '#fde047' : isTenth ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = isSec ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x, height + (isSec ? 16 : isTenth ? 10 : 5));
      ctx.stroke();

      if (isTenth) {
        ctx.fillStyle = isSec ? '#fde047' : '#94a3b8';
        ctx.font = isSec ? 'bold 11px monospace' : '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${(t / 1000).toFixed(2)}s`, x, height + 28);
      }
    }

    // شارة اعتماد
    // 4. علامة مميزة توضح أن هذا شريط محاكاة تجريبي (DEMO / SYNTHETIC) وليس كاميرا حقيقية
    ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
    ctx.fillRect(width - 340, 12, 330, 48);
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(width - 340, 12, 330, 48);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`[DEMO / SYNTHETIC] • ${distance}`, width - 15, 30);
    ctx.fillStyle = '#fecaca';
    ctx.font = '10px monospace';
    ctx.fillText('SIMULATION PREVIEW • محاكاة شريطية تجريبية', width - 15, 48);

    return c.toDataURL('image/png');
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getCurrentWidth(): number {
    return this.currentX;
  }
}

export const slitScanEngine = new SlitScanEngine();
