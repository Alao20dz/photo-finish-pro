/**
 * حساس البوابة الضوئية وكاشف حركة خط النهاية (High-Precision Optical Gate Detector)
 * يراقب خط النهاية لكل رواق بالمضمار ويرصد لحظة قطع شعاع الحساس
 * لحساب التوقيت والترتيب التلقائي للعدائين (الأول، الثاني...) بدقة متناهية
 */

export interface OpticalLaneResult {
  lane: number;
  motionScore: number;
  isTriggered: boolean;
  /**
   * اللحظة الحقيقية المستوفاة رياضياً للمس خط النهاية (بالمللي ثانية، على مقياس ساعة السباق نفسه)
   * أدق من زمن "اكتشاف" العبور لأنها تُحسب رجعياً بين آخر عيّنة دون العتبة والعيّنة التي تجاوزتها.
   * استخدم هذه القيمة بدل زمن استدعاء scan() نفسه عند تسجيل وصول العداء.
   */
  interpolatedCrossMs: number | null;
}

export interface MultiGateScanResult {
  laneResults: OpticalLaneResult[];
  isPreGateTriggered: boolean;
  preGateScore: number;
  isPostGateTriggered: boolean;
  postGateScore: number;
}

export class OpticalGateDetector {
  private prevFrameData: Uint8ClampedArray | null = null;
  private prevPreGateData: Uint8ClampedArray | null = null;
  private prevPostGateData: Uint8ClampedArray | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private preCanvas: HTMLCanvasElement;
  private preCtx: CanvasRenderingContext2D;
  private postCanvas: HTMLCanvasElement;
  private postCtx: CanvasRenderingContext2D;
  private triggeredLanes: Set<number> = new Set();

  // تاريخ آخر عيّنة (النسبة المئوية + زمن السباق) لكل رواق، لازم لتأكيد العبور واستيفاء لحظته الحقيقية
  private laneScoreHistory: Map<number, { score: number; t: number }> = new Map();
  // عداد التأكيد: نطلب تجاوز العتبة في عيّنتين متتاليتين قبل اعتباره عبوراً حقيقياً (يلغي ضوضاء اللحظة الواحدة)
  private laneConfirmCount: Map<number, number> = new Map();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.preCanvas = document.createElement('canvas');
    this.preCtx = this.preCanvas.getContext('2d', { willReadFrequently: true })!;
    this.postCanvas = document.createElement('canvas');
    this.postCtx = this.postCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  public reset() {
    this.prevFrameData = null;
    this.prevPreGateData = null;
    this.prevPostGateData = null;
    this.triggeredLanes.clear();
    this.laneScoreHistory.clear();
    this.laneConfirmCount.clear();
  }

  /**
   * فحص حركة خط ما قبل النهاية (Pre-Finish Gate) لبدء التصوير المتتالي
   */
  public checkPreGateMotion(
    video: HTMLVideoElement,
    preLineXPercent: number = 0.22,
    threshold: number = 20
  ): { motionScore: number; isTriggered: boolean } {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return { motionScore: 0, isTriggered: false };

    const bandWidth = 20;
    const lineX = Math.floor(width * preLineXPercent);
    const startX = Math.max(0, lineX - Math.floor(bandWidth / 2));

    this.preCanvas.width = bandWidth;
    this.preCanvas.height = height;
    this.preCtx.drawImage(video, startX, 0, bandWidth, height, 0, 0, bandWidth, height);
    const frame = this.preCtx.getImageData(0, 0, bandWidth, height);
    const currData = frame.data;

    if (!this.prevPreGateData || this.prevPreGateData.length !== currData.length) {
      this.prevPreGateData = new Uint8ClampedArray(currData);
      return { motionScore: 0, isTriggered: false };
    }

    const prev = this.prevPreGateData;
    let changed = 0;
    let total = 0;
    for (let i = 0; i < currData.length; i += 16) {
      const gCurr = currData[i] * 0.299 + currData[i + 1] * 0.587 + currData[i + 2] * 0.114;
      const gPrev = prev[i] * 0.299 + prev[i + 1] * 0.587 + prev[i + 2] * 0.114;
      if (Math.abs(gCurr - gPrev) > threshold) changed++;
      total++;
    }

    const score = total > 0 ? (changed / total) * 100 : 0;
    this.prevPreGateData.set(currData);
    return {
      motionScore: Math.round(score),
      isTriggered: score > 12 // حساسية مناسبة لرصد مقدمة العداء أو ظله قبل خط النهاية
    };
  }

  /**
   * فحص حركة خط ما بعد النهاية (Post-Finish Gate)
   */
  public checkPostGateMotion(
    video: HTMLVideoElement,
    postLineXPercent: number = 0.52,
    threshold: number = 20
  ): { motionScore: number; isTriggered: boolean } {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return { motionScore: 0, isTriggered: false };

    const bandWidth = 20;
    const lineX = Math.floor(width * postLineXPercent);
    const startX = Math.max(0, lineX - Math.floor(bandWidth / 2));

    this.postCanvas.width = bandWidth;
    this.postCanvas.height = height;
    this.postCtx.drawImage(video, startX, 0, bandWidth, height, 0, 0, bandWidth, height);
    const frame = this.postCtx.getImageData(0, 0, bandWidth, height);
    const currData = frame.data;

    if (!this.prevPostGateData || this.prevPostGateData.length !== currData.length) {
      this.prevPostGateData = new Uint8ClampedArray(currData);
      return { motionScore: 0, isTriggered: false };
    }

    const prev = this.prevPostGateData;
    let changed = 0;
    let total = 0;
    for (let i = 0; i < currData.length; i += 16) {
      const gCurr = currData[i] * 0.299 + currData[i + 1] * 0.587 + currData[i + 2] * 0.114;
      const gPrev = prev[i] * 0.299 + prev[i + 1] * 0.587 + prev[i + 2] * 0.114;
      if (Math.abs(gCurr - gPrev) > threshold) changed++;
      total++;
    }

    const score = total > 0 ? (changed / total) * 100 : 0;
    this.prevPostGateData.set(currData);
    return {
      motionScore: Math.round(score),
      isTriggered: score > 14
    };
  }

  /**
   * فحص الحساس الضوئي لكل رواق عند خط النهاية الرسمي
   */
  public scan(
    video: HTMLVideoElement,
    laneCount: number = 4,
    finishLineXPercent: number = 0.35,
    threshold: number = 20,
    currentRaceTimeMs: number = 0
  ): OpticalLaneResult[] {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return [];

    // شريط ضيق ومحدد حول خط النهاية (Laser Beam ROI)
    const bandWidth = 20;
    const lineX = Math.floor(width * finishLineXPercent);
    const startX = Math.max(0, lineX - Math.floor(bandWidth / 2));

    this.canvas.width = bandWidth;
    this.canvas.height = height;

    this.ctx.drawImage(video, startX, 0, bandWidth, height, 0, 0, bandWidth, height);
    const frame = this.ctx.getImageData(0, 0, bandWidth, height);
    const currData = frame.data;

    const results: OpticalLaneResult[] = [];
    const laneHeight = Math.floor(height / laneCount);

    if (!this.prevFrameData || this.prevFrameData.length !== currData.length) {
      this.prevFrameData = new Uint8ClampedArray(currData);
      for (let l = 1; l <= laneCount; l++) {
        results.push({ lane: l, motionScore: 0, isTriggered: false, interpolatedCrossMs: null });
      }
      return results;
    }

    const prev = this.prevFrameData;

    for (let laneIdx = 0; laneIdx < laneCount; laneIdx++) {
      const laneNumber = laneIdx + 1;
      const yStart = laneIdx * laneHeight;
      const yEnd = (laneIdx + 1) * laneHeight;

      let changedPixels = 0;
      let totalSamples = 0;

      for (let y = yStart; y < yEnd; y += 2) {
        for (let x = 0; x < bandWidth; x += 2) {
          const idx = (y * bandWidth + x) * 4;
          
          const grayCurr = (currData[idx] * 0.299 + currData[idx + 1] * 0.587 + currData[idx + 2] * 0.114);
          const grayPrev = (prev[idx] * 0.299 + prev[idx + 1] * 0.587 + prev[idx + 2] * 0.114);

          if (Math.abs(grayCurr - grayPrev) > threshold) {
            changedPixels++;
          }
          totalSamples++;
        }
      }

      const scorePercent = totalSamples > 0 ? (changedPixels / totalSamples) * 100 : 0;

      // --- تأكيد العبور + استيفاء اللحظة الحقيقية ---
      const prevSample = this.laneScoreHistory.get(laneNumber) || { score: 0, t: currentRaceTimeMs };
      let isTriggered = false;
      let interpolatedCrossMs: number | null = null;

      if (scorePercent > 16) {
        const confirmCount = (this.laneConfirmCount.get(laneNumber) || 0) + 1;
        this.laneConfirmCount.set(laneNumber, confirmCount);
        if (confirmCount >= 2) {
          isTriggered = true;
          // استيفاء خطي بين آخر عيّنة دون العتبة (prevSample) والعيّنة الحالية، لاسترجاع لحظة اللمس الحقيقية
          const frac = scorePercent > prevSample.score
            ? (16 - prevSample.score) / (scorePercent - prevSample.score)
            : 0;
          const clampedFrac = Math.max(0, Math.min(1, frac));
          interpolatedCrossMs = prevSample.t + clampedFrac * (currentRaceTimeMs - prevSample.t);
        }
      } else {
        this.laneConfirmCount.set(laneNumber, 0);
      }

      this.laneScoreHistory.set(laneNumber, { score: scorePercent, t: currentRaceTimeMs });

      results.push({
        lane: laneNumber,
        motionScore: Math.round(scorePercent),
        isTriggered,
        interpolatedCrossMs
      });
    }

    this.prevFrameData.set(currData);

    // --- حماية من التحفيز الجماعي الزائف (اهتزاز الكاميرا / ومضة ضوئية / تغيّر إضاءة مفاجئ) ---
    // إذا تجاوز أكثر من نصف الأروقة العتبة في نفس اللحظة تقريباً، هذا اضطراب عام للمشهد كله
    // وليس وصولاً حقيقياً متزامناً، فنُلغي هذه الدفعة من التحفيزات لتفادي تسجيل أزمنة خاطئة.
    const triggeredCount = results.filter(r => r.isTriggered).length;
    if (triggeredCount > 0 && triggeredCount > Math.ceil(laneCount / 2)) {
      results.forEach(r => { r.isTriggered = false; r.interpolatedCrossMs = null; });
    }

    return results;
  }

  /**
   * التقاط لقطة تذكارية رسمية فائقة الوضوح للحساس مع توثيق الرواق وترتيب العداء
   */
  public captureSnapshot(
    video: HTMLVideoElement,
    laneNumber: number,
    timeFormatted: string,
    finishLineXPercent: number = 0.35,
    runnerName?: string,
    bib?: number,
    rank?: number
  ): string | null {
    if (!video.videoWidth || !video.videoHeight) return null;
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = 500;
    snapCanvas.height = 300;
    const sCtx = snapCanvas.getContext('2d');
    if (!sCtx) return null;

    // رسم المشهد المباشر
    sCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
    
    const lineX = snapCanvas.width * finishLineXPercent;

    // رسم خط النهاية المضيء (Official Finish Line Plane)
    sCtx.save();
    sCtx.shadowColor = 'rgba(239, 68, 68, 0.8)';
    sCtx.shadowBlur = 8;
    sCtx.strokeStyle = '#ef4444';
    sCtx.lineWidth = 3;
    sCtx.beginPath();
    sCtx.moveTo(lineX, 0);
    sCtx.lineTo(lineX, snapCanvas.height);
    sCtx.stroke();

    // خيط أبيض دقيق وسطه
    sCtx.shadowBlur = 0;
    sCtx.strokeStyle = '#ffffff';
    sCtx.lineWidth = 1;
    sCtx.beginPath();
    sCtx.moveTo(lineX, 0);
    sCtx.lineTo(lineX, snapCanvas.height);
    sCtx.stroke();

    // بطاقة توثيق IAAF الرسمية للعداء
    const badgeW = 240;
    const badgeH = 50;
    const badgeX = lineX > snapCanvas.width / 2 ? lineX - badgeW - 12 : lineX + 12;
    const badgeY = snapCanvas.height - badgeH - 12;

    sCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    sCtx.strokeStyle = rank === 1 ? '#eab308' : rank === 2 ? '#94a3b8' : '#38bdf8';
    sCtx.lineWidth = 1.5;
    sCtx.beginPath();
    sCtx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    sCtx.fill();
    sCtx.stroke();

    // شارة الرواق والترتيب
    sCtx.fillStyle = rank === 1 ? '#eab308' : rank === 2 ? '#94a3b8' : '#f59e0b';
    sCtx.font = 'bold 13px sans-serif';
    sCtx.textAlign = 'right';
    const rankTitle = rank ? (rank === 1 ? '🥇 المركز الأول' : rank === 2 ? '🥈 المركز الثاني' : rank === 3 ? '🥉 المركز الثالث' : `#${rank}`) : '';
    sCtx.fillText(`${rankTitle} | رواق L${laneNumber}`, badgeX + badgeW - 8, badgeY + 18);

    // اسم المتسابق ورقمه والتوقيت
    sCtx.fillStyle = '#ffffff';
    sCtx.font = 'bold 12px sans-serif';
    const nameStr = runnerName ? `${runnerName} (صدر #${bib || laneNumber})` : `رواق L${laneNumber}`;
    sCtx.fillText(nameStr, badgeX + badgeW - 8, badgeY + 33);

    sCtx.fillStyle = '#38bdf8';
    sCtx.font = 'black 14px monospace';
    sCtx.textAlign = 'left';
    sCtx.fillText(timeFormatted, badgeX + 8, badgeY + 44);

    sCtx.restore();

    return snapCanvas.toDataURL('image/jpeg', 0.82);
  }
}

export const opticalGateDetector = new OpticalGateDetector();
export const motionDetector = opticalGateDetector;
