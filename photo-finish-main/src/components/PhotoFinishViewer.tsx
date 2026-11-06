import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Download, ZoomIn, ZoomOut, ArrowRight, Play, Pause, 
  ChevronLeft, ChevronRight, Award, Film, Sliders, Share2, 
  Maximize2, Minimize2, RotateCw, Crosshair, Check, Expand
} from 'lucide-react';
import { Runner, RaceSettings } from '../types/race';
import { slitScanEngine } from '../services/slitScanEngine';
import { burstCaptureService, BurstFrame } from '../services/burstCaptureService';
import { CertificateExporter } from '../utils/certificateExporter';

interface PhotoFinishViewerProps {
  runners: Runner[];
  settings: RaceSettings;
  fullPhotoFinishUrl?: string;
  onUpdateRunnerTime: (lane: number, verifiedTimeMs: number) => void;
  onClose: () => void;
}

export const PhotoFinishViewer: React.FC<PhotoFinishViewerProps> = ({
  runners,
  settings,
  fullPhotoFinishUrl,
  onUpdateRunnerTime,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'burst' | 'slitscan' | 'certificate'>('burst');

  // حالات معرض الصور المتتالية (Burst Frames)
  const burstFrames = burstCaptureService.frames;
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed] = useState<number>(1);
  const [burstZoom, setBurstZoom] = useState<number>(1);
  const playIntervalRef = useRef<any>(null);

  // حالات المسح الشريطي (Slit-Scan)
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const [cursorX, setCursorX] = useState<number>(100);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedLane, setSelectedLane] = useState<number>(1);
  const [inspectedTimeMs, setInspectedTimeMs] = useState<number>(0);
  const [photoFinishDataUrl, setPhotoFinishDataUrl] = useState<string | null>(null);

  // 1. ميزات تكبير الشاشة ملء الشاشة والأبعاد الكاملة (Full Screen & Immersive Mode)
  const [isImmersive, setIsImmersive] = useState<boolean>(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false);

  // 2. ميزة تدوير الشاشة لتكون بالعرض (Landscape Rotation)
  const [isRotatedLandscape, setIsRotatedLandscape] = useState<boolean>(false);

  // شهادة النتائج المجمعة
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [applySuccessToast, setApplySuccessToast] = useState<string | null>(null);

  // تتبع مسافة اللمس للـ Pinch to zoom
  const touchStartDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);

  // مراقبة وضع ملء الشاشة من النظام
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // تبديل ملء الشاشة الأصلي (Native Fullscreen)
  const toggleNativeFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
        setIsNativeFullscreen(true);
      } else {
        await document.exitFullscreen().catch(() => {});
        setIsNativeFullscreen(false);
      }
    } catch (e) {
      console.warn('Fullscreen toggle failed:', e);
    }
  };

  // تبديل تدوير الشاشة بالعرض (Landscape Orientation)
  const toggleOrientation = async () => {
    const nextState = !isRotatedLandscape;
    setIsRotatedLandscape(nextState);

    // محاولة قفل الاتجاه عبر Screen Orientation API إن كان مدعوماً
    try {
      if (typeof screen !== 'undefined' && screen.orientation) {
        if (nextState) {
          await (screen.orientation as any).lock?.('landscape').catch(() => {});
        } else {
          (screen.orientation as any).unlock?.();
        }
      }
    } catch (e) {
      console.warn('Orientation lock notice:', e);
    }
  };

  // تهيئة عند الفتح
  useEffect(() => {
    if (burstFrames.length > 0) {
      setActiveTab('burst');
      const firstFinishIdx = burstFrames.findIndex(f => f.isFinishMoment);
      setCurrentFrameIdx(firstFinishIdx >= 0 ? firstFinishIdx : 0);
    } else {
      setActiveTab('slitscan');
    }

    const url = fullPhotoFinishUrl || slitScanEngine.exportCroppedPhotoFinishDataUrl(settings.laneCount, runners);
    setPhotoFinishDataUrl(url);

    const w = slitScanEngine.getCurrentWidth();
    if (w > 0) {
      const initialX = Math.floor(w / 2);
      setCursorX(initialX);
      setInspectedTimeMs(slitScanEngine.getTimeAtX(initialX));
    }

    burstCaptureService.generateCompositeCertificate(settings.distance, settings.windSpeed)
      .then(url => setCertificateUrl(url));
  }, []);

  // تشغيل وإيقاف تشغيل الصور المتتالية
  useEffect(() => {
    if (isPlaying && burstFrames.length > 0) {
      const delay = Math.max(30, Math.floor(100 / playbackSpeed));
      playIntervalRef.current = setInterval(() => {
        setCurrentFrameIdx(prev => {
          if (prev >= burstFrames.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, playbackSpeed, burstFrames.length]);

  // رسم شريط المسح الشريطي مع المسطرة الزمنية وخط الحسم (IAAF 164.2)
  useEffect(() => {
    if (activeTab !== 'slitscan') return;
    const canvas = imageCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sourceCanvas = slitScanEngine.getCanvas();
    const sourceW = slitScanEngine.getCurrentWidth();
    if (sourceW === 0) return;

    const rulerHeight = 24;
    canvas.width = sourceW;
    canvas.height = sourceCanvas.height + rulerHeight;

    // 1. رسم محتوى الكاميرا لشريط المسح
    ctx.drawImage(sourceCanvas, 0, rulerHeight, sourceW, sourceCanvas.height);

    // 2. رسم مسطرة الوقت العلوية (Millisecond Timeline Ruler)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, sourceW, rulerHeight);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rulerHeight);
    ctx.lineTo(sourceW, rulerHeight);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    // علامات كل 50 و 100 بكسل (~ 50ms / 100ms)
    for (let x = 0; x < sourceW; x += 50) {
      const isMajor = x % 100 === 0;
      ctx.strokeStyle = isMajor ? '#00f0ff' : '#64748b';
      ctx.lineWidth = isMajor ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, rulerHeight - (isMajor ? 12 : 6));
      ctx.lineTo(x, rulerHeight);
      ctx.stroke();

      if (isMajor && x + 30 < sourceW) {
        const timeAtTick = slitScanEngine.getTimeAtX(x);
        const timeStr = `${(timeAtTick / 1000).toFixed(2)}s`;
        ctx.fillText(timeStr, x, 10);
      }
    }

    // 3. رسم خط حسم الصدرية الرأسي الأحمر (Torso Finish Hairline)
    ctx.strokeStyle = '#ff0033';
    ctx.lineWidth = Math.max(1.5, 2.5 / zoomLevel);
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, canvas.height);
    ctx.stroke();

    // نقطة ارتكاز ومؤشر علوي
    ctx.fillStyle = '#ff0033';
    ctx.beginPath();
    ctx.arc(cursorX, rulerHeight / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // شارة توقيت تطفو عند موضع الخط
    const formatted = `${(inspectedTimeMs / 1000).toFixed(3)}s`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    const badgeW = 60;
    const badgeX = Math.max(5, Math.min(sourceW - badgeW - 5, cursorX - badgeW / 2));
    ctx.fillRect(badgeX, rulerHeight + 5, badgeW, 18);
    ctx.strokeStyle = '#ff0033';
    ctx.strokeRect(badgeX, rulerHeight + 5, badgeW, 18);
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(formatted, badgeX + badgeW / 2, rulerHeight + 18);
  }, [cursorX, zoomLevel, activeTab, inspectedTimeMs]);

  // تفاعل الفأرة واللمس لتحديد خط النهاية (مع مراعاة التدوير)
  const handleCanvasInteraction = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = imageCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    let clickX: number;
    if (isRotatedLandscape) {
      // إذا كان معروضاً بتدوير 90 درجة، يتم حساب الإحداثي وفق التدوير
      clickX = (clientY - rect.top) / zoomLevel;
    } else {
      clickX = (clientX - rect.left) / zoomLevel;
    }

    const maxW = slitScanEngine.getCurrentWidth();
    if (maxW === 0) return;

    const clampedX = Math.max(0, Math.min(Math.floor(clickX), maxW));
    setCursorX(clampedX);
    const time = slitScanEngine.getTimeAtX(clampedX);
    setInspectedTimeMs(time);
  }, [zoomLevel, isRotatedLandscape]);

  // تعديل موضعي دقيق للزمن بالمللي ثانية (Micro-stepping)
  const stepCursor = (deltaPx: number) => {
    const maxW = slitScanEngine.getCurrentWidth();
    if (maxW === 0) return;
    const newX = Math.max(0, Math.min(maxW, cursorX + deltaPx));
    setCursorX(newX);
    const time = slitScanEngine.getTimeAtX(newX);
    setInspectedTimeMs(time);
  };

  // معالجة اللمس المتعدد للتكبير (Pinch-to-zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      initialZoomRef.current = activeTab === 'burst' ? burstZoom : zoomLevel;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleFactor = dist / touchStartDistRef.current;
      const targetZoom = Math.max(0.5, Math.min(5, initialZoomRef.current * scaleFactor));
      if (activeTab === 'burst') {
        setBurstZoom(targetZoom);
      } else {
        setZoomLevel(targetZoom);
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
  };

  const currentBurstFrame: BurstFrame | undefined = burstFrames[currentFrameIdx];

  const handleJumpToRunnerFrame = (finisher: any) => {
    const idx = burstFrames.findIndex(f => f.finishers.some(fn => fn.lane === finisher.lane && fn.isNewArrival));
    if (idx >= 0) {
      setCurrentFrameIdx(idx);
      setIsPlaying(false);
    }
  };

  const handleApplyTimeToRunner = () => {
    const timeToApply = activeTab === 'burst' && currentBurstFrame ? currentBurstFrame.timeMs : inspectedTimeMs;
    if (timeToApply > 0 && selectedLane) {
      onUpdateRunnerTime(selectedLane, timeToApply);
      const runner = runners.find(r => r.lane === selectedLane);
      const msg = `تم اعتماد توقيت ${(timeToApply / 1000).toFixed(3)}s للرواق L${selectedLane} (${runner?.name || ''})`;
      setApplySuccessToast(msg);
      setTimeout(() => setApplySuccessToast(null), 3000);
    }
  };

  const handleDownloadActiveImage = async () => {
    if (activeTab === 'burst' && currentBurstFrame) {
      await CertificateExporter.downloadDataUrlAsPng(
        currentBurstFrame.dataUrl,
        `photo-finish-frame-${currentBurstFrame.frameIndex}-${settings.distance}.png`
      );
    } else if (activeTab === 'certificate' && certificateUrl) {
      await CertificateExporter.downloadDataUrlAsPng(
        certificateUrl,
        `photo-finish-certificate-${settings.distance}.png`
      );
    } else if (photoFinishDataUrl) {
      await CertificateExporter.downloadDataUrlAsPng(
        photoFinishDataUrl,
        `photo-finish-slitscan-${settings.distance}.png`
      );
    }
  };

  const handleShareActiveImage = async () => {
    let targetUrl: string | null = null;
    let filename = `photo-finish-${settings.distance}.png`;
    if (activeTab === 'burst' && currentBurstFrame) {
      targetUrl = currentBurstFrame.dataUrl;
      filename = `photo-finish-frame-${currentBurstFrame.frameIndex}-${settings.distance}.png`;
    } else if (activeTab === 'certificate' && certificateUrl) {
      targetUrl = certificateUrl;
      filename = `photo-finish-certificate-${settings.distance}.png`;
    } else if (photoFinishDataUrl) {
      targetUrl = photoFinishDataUrl;
      filename = `photo-finish-slitscan-${settings.distance}.png`;
    }
    if (!targetUrl) return;

    try {
      const res = await fetch(targetUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: 'image/png' });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'توثيق Photo Finish',
          text: `صورة فوتو فينيش رسمية لسباق ${settings.distance}`
        });
        return;
      }
    } catch (e) {
      console.warn('Share failed:', e);
    }
    await handleDownloadActiveImage();
  };

  return (
    <div 
      className={`fixed inset-0 z-50 bg-slate-950 text-white flex flex-col overflow-hidden select-none transition-all ${
        isImmersive ? 'p-0 m-0' : 'p-2 sm:p-3'
      }`} 
      dir="rtl"
    >
      {/* تنبيه اعتماد التوقيت بنجاح */}
      {applySuccessToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-2xl flex items-center gap-2 border border-emerald-300 animate-bounce">
          <Check className="w-4 h-4 text-emerald-200" />
          <span>{applySuccessToast}</span>
        </div>
      )}

      {/* رأس النافذة وأزرار التبديل والتحكم (يختفي في وضع المساحة الكاملة) */}
      {!isImmersive && (
        <div className="flex flex-col gap-2 pb-2 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer shrink-0"
                title="إغلاق والعودة للوحة التحكم"
              >
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-xs sm:text-base font-black bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent truncate">
                    غرفة فحص الـ Photo Finish
                  </h2>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-mono shrink-0">
                    IAAF 164.2 FAT
                  </span>
                </div>
              </div>
            </div>

            {/* أدوات التكبير ملء الشاشة والتدوير بالعرض */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* زر تدوير الشاشة بالعرض */}
              <button
                type="button"
                onClick={toggleOrientation}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold text-[11px] sm:text-xs transition-all cursor-pointer border shadow-sm ${
                  isRotatedLandscape
                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                    : 'bg-slate-800 hover:bg-slate-750 text-cyan-300 border-cyan-500/30'
                }`}
                title="تدوير شاشة العرض بالعرض (Landscape) للاستفادة الكاملة من عرض الهاتف"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRotatedLandscape ? 'animate-spin-reverse' : ''}`} />
                <span>{isRotatedLandscape ? 'تدوير بالطول' : 'تدوير بالعرض 🔄'}</span>
              </button>

              {/* زر أخذ المساحة الكاملة (Immersive Focus) */}
              <button
                type="button"
                onClick={() => setIsImmersive(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-[11px] sm:text-xs shadow-md transition-all cursor-pointer active:scale-95"
                title="أخذ المساحة الكاملة وإخفاء القوائم للتدقيق الدقيق"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">المساحة الكاملة</span>
              </button>

              {/* زر ملء الشاشة الأصلي */}
              <button
                type="button"
                onClick={toggleNativeFullscreen}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title={isNativeFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة الكامل'}
              >
                {isNativeFullscreen ? <Minimize2 className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* أزرار التبديل بين أنماط العرض الثلاثة + التنزيل والمشاركة */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-xl overflow-x-auto no-scrollbar shrink-0">
              <button
                onClick={() => setActiveTab('burst')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] sm:text-xs transition-all whitespace-nowrap ${
                  activeTab === 'burst'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>الصور المتتالية ({burstFrames.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('slitscan')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] sm:text-xs transition-all whitespace-nowrap ${
                  activeTab === 'slitscan'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>المسح الشريطي (Slit-Scan)</span>
              </button>

              <button
                onClick={() => setActiveTab('certificate')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] sm:text-xs transition-all whitespace-nowrap ${
                  activeTab === 'certificate'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>الوثيقة المجمعة 🏆</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleDownloadActiveImage}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-[11px] sm:text-xs font-bold border border-slate-700 text-cyan-300 shadow cursor-pointer active:scale-95"
                title="تنزيل كصورة PNG مباشرة"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>تنزيل PNG</span>
              </button>
              <button
                type="button"
                onClick={handleShareActiveImage}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-[11px] sm:text-xs font-bold border border-indigo-500/40 text-indigo-200 shadow cursor-pointer active:scale-95"
                title="مشاركة الصورة للهاتف أو واتساب"
              >
                <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>مشاركة 📲</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* شريط أدوات عائم عند تفعيل وضع المساحة الكاملة (Immersive HUD) */}
      {isImmersive && (
        <div className="absolute top-2 left-2 right-2 z-30 flex items-center justify-between pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700/80 shadow-2xl flex items-center gap-2 pointer-events-auto">
            <span className="text-[11px] font-bold text-amber-400 font-mono">
              {activeTab === 'burst' ? (currentBurstFrame?.formattedTime || '0.000s') : `${(inspectedTimeMs / 1000).toFixed(3)}s`}
            </span>
            <div className="w-px h-3 bg-slate-700" />
            <select
              value={selectedLane}
              onChange={(e) => setSelectedLane(parseInt(e.target.value))}
              className="bg-slate-950 border border-slate-700 text-white rounded-lg px-2 py-0.5 text-xs font-bold outline-none"
            >
              {runners.map(r => (
                <option key={r.id} value={r.lane}>
                  L{r.lane} - {r.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleApplyTimeToRunner}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-xs flex items-center gap-1 text-white shadow active:scale-95"
              title="اعتماد التوقيت للعداء"
            >
              <Check className="w-3.5 h-3.5" />
              <span>اعتماد</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-slate-700/80 shadow-2xl">
            <button
              onClick={toggleOrientation}
              className={`p-1.5 rounded-xl border ${
                isRotatedLandscape ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-800 text-white border-slate-700'
              }`}
              title="تدوير بالعرض"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (activeTab === 'burst') setBurstZoom(prev => Math.max(0.7, prev - 0.25));
                else setZoomLevel(prev => Math.max(0.5, prev - 0.25));
              }}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white"
              title="تصغير"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs px-1 font-bold">
              {(activeTab === 'burst' ? burstZoom : zoomLevel).toFixed(1)}x
            </span>
            <button
              onClick={() => {
                if (activeTab === 'burst') setBurstZoom(prev => Math.min(4, prev + 0.25));
                else setZoomLevel(prev => Math.min(5, prev + 0.25));
              }}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white"
              title="تكبير"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsImmersive(false)}
              className="p-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow font-bold text-xs"
              title="الخروج من وضع المساحة الكاملة"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* المحتوى الرئيسي للتبويبات */}
      <div 
        className="flex-1 flex flex-col min-h-0 relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 1. تبويب الصور المتتالية فائقة السرعة */}
        {activeTab === 'burst' && (
          <div className="flex-1 flex flex-col gap-2 min-h-0 pt-1">
            {/* بطاقات وصول العدائين للقفز الفوري */}
            {burstCaptureService.finishersOrder.length > 0 && !isImmersive && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs shrink-0">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 whitespace-nowrap">
                  وصول العدائين:
                </span>
                {burstCaptureService.finishersOrder.map((f) => (
                  <button
                    key={f.lane}
                    onClick={() => handleJumpToRunnerFrame(f)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-xl font-bold border whitespace-nowrap transition-all text-[11px] shrink-0 ${
                      f.rank === 1
                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 shadow-sm'
                        : f.rank === 2
                        ? 'bg-slate-300/20 border-slate-400/50 text-slate-200'
                        : 'bg-amber-700/20 border-amber-600/50 text-amber-300'
                    }`}
                  >
                    <span>{f.rank === 1 ? '🥇' : f.rank === 2 ? '🥈' : f.rank === 3 ? '🥉' : `#${f.rank}`}</span>
                    <span className="text-white">L{f.lane} {f.name}</span>
                    <span className="font-mono text-cyan-300 bg-black/40 px-1 py-0.2 rounded text-[10px]">{f.formattedTime}</span>
                  </button>
                ))}
              </div>
            )}

            {/* شريط التحكم بالإطارات (Scrubber) */}
            {burstFrames.length > 0 && !isImmersive && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentFrameIdx(prev => Math.max(0, prev - 1))}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="الإطار السابق"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 text-xs transition-all ${
                      isPlaying ? 'bg-red-600 text-white' : 'bg-amber-500 text-slate-950 font-black'
                    }`}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{isPlaying ? 'إيقاف' : 'تشغيل'}</span>
                  </button>
                  <button
                    onClick={() => setCurrentFrameIdx(prev => Math.min(burstFrames.length - 1, prev + 1))}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="الإطار التالي"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 flex items-center gap-2 min-w-[150px]">
                  <span className="font-mono text-slate-400 text-[10px] whitespace-nowrap">
                    {currentFrameIdx + 1}/{burstFrames.length}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={burstFrames.length - 1}
                    value={currentFrameIdx}
                    onChange={(e) => {
                      setCurrentFrameIdx(parseInt(e.target.value));
                      setIsPlaying(false);
                    }}
                    className="flex-1 accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <span className="font-mono font-bold text-amber-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-amber-500/30 text-[11px]">
                    {currentBurstFrame?.formattedTime || '0.000s'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setBurstZoom(prev => Math.max(0.7, prev - 0.25))}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700"
                    title="تصغير"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono px-1.5 font-bold text-[11px]">{burstZoom.toFixed(1)}x</span>
                  <button
                    onClick={() => setBurstZoom(prev => Math.min(4, prev + 0.25))}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700"
                    title="تكبير"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* مساحة عرض الصورة مع دعم التدوير بالعرض */}
            <div className="flex-1 bg-black border border-slate-800 rounded-2xl overflow-auto relative p-1 shadow-inner flex items-center justify-center min-h-0">
              {currentBurstFrame ? (
                <div 
                  style={{ 
                    transform: `scale(${burstZoom}) ${isRotatedLandscape ? 'rotate(90deg)' : ''}`, 
                    transformOrigin: 'center center',
                    transition: 'transform 0.2s ease-out'
                  }}
                  className="flex items-center justify-center max-w-full max-h-full"
                >
                  <img
                    src={currentBurstFrame.dataUrl}
                    alt={`Frame ${currentBurstFrame.frameIndex}`}
                    className="max-h-[80vh] max-w-[95vw] object-contain rounded-xl shadow-2xl border border-slate-700/60"
                  />
                </div>
              ) : (
                <div className="text-center p-6 space-y-2">
                  <Film className="w-8 h-8 text-amber-400 mx-auto" />
                  <div className="font-bold text-xs sm:text-sm text-slate-300">
                    لم يتم تسجيل صور متتالية بعد
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    سيبدأ التصوير فائق السرعة تلقائياً في كاميرا هاتف النهاية فور ملامسة أول عداء لخط النهاية.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. تبويب المسح الشريطي المتواصل (SLIT-SCAN) مع التحكم الدقيق بالخط والزوم */}
        {activeTab === 'slitscan' && (
          <div className="flex-1 flex flex-col gap-1.5 min-h-0 pt-1">
            {!isImmersive && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs shrink-0">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">توقيت خط الصدرية (Torso):</span>
                  <span className="font-mono font-black text-amber-400 text-lg tracking-wider">
                    {`${Math.floor(inspectedTimeMs / 1000)}.${String(Math.floor(inspectedTimeMs % 1000)).padStart(3, '0')}s`}
                  </span>
                </div>

                {/* أزرار التقديم والتأخير الدقيق بالمللي ثانية */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-1.5 flex items-center justify-between gap-1">
                  <span className="text-slate-400 text-[10px] shrink-0">تدقيق:</span>
                  <div className="flex items-center gap-1 font-mono">
                    <button
                      onClick={() => stepCursor(-10)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-cyan-300"
                      title="تراجع 10ms"
                    >
                      -10ms
                    </button>
                    <button
                      onClick={() => stepCursor(-1)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-300"
                      title="تراجع 1ms"
                    >
                      -1ms
                    </button>
                    <button
                      onClick={() => stepCursor(1)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-300"
                      title="تقديم 1ms"
                    >
                      +1ms
                    </button>
                    <button
                      onClick={() => stepCursor(10)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-cyan-300"
                      title="تقديم 10ms"
                    >
                      +10ms
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-1.5 flex items-center gap-1.5">
                  <select
                    value={selectedLane}
                    onChange={(e) => setSelectedLane(parseInt(e.target.value))}
                    className="bg-slate-950 border border-slate-700 text-white rounded-lg p-1 font-bold outline-none text-xs flex-1 truncate"
                  >
                    {runners.map(r => (
                      <option key={r.id} value={r.lane}>
                        مسار L{r.lane} - {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleApplyTimeToRunner}
                    className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-xs flex items-center justify-center gap-1 text-white shrink-0 active:scale-95 shadow"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>اعتماد</span>
                  </button>
                </div>
              </div>
            )}

            {/* مساحة شريط المسح الشريطي المتواصل */}
            <div
              ref={containerRef}
              className="flex-1 bg-black border border-slate-800 rounded-2xl overflow-auto relative p-1 shadow-inner flex items-center justify-center min-h-0"
            >
              {slitScanEngine.getCurrentWidth() > 0 ? (
                <div 
                  style={{ 
                    transform: `scale(${zoomLevel}) ${isRotatedLandscape ? 'rotate(90deg)' : ''}`, 
                    transformOrigin: 'center center',
                    transition: 'transform 0.15s ease-out'
                  }}
                  className="flex items-center justify-center"
                >
                  <canvas
                    ref={imageCanvasRef}
                    onClick={handleCanvasInteraction}
                    onTouchMove={handleCanvasInteraction}
                    className="cursor-crosshair shadow-2xl block border border-slate-700"
                  />
                </div>
              ) : (
                <div className="text-center text-slate-500 text-xs p-6 space-y-1">
                  <Crosshair className="w-8 h-8 mx-auto text-cyan-400 animate-pulse" />
                  <div className="font-bold text-slate-300">لم يتم تسجيل شريط Photo Finish بعد</div>
                  <p className="text-[11px] text-slate-500">ابدأ السباق من هاتف البداية لتوليد شريط المسح الزمني اللحظي.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. تبويب وثيقة النتائج المجمعة */}
        {activeTab === 'certificate' && (
          <div className="flex-1 flex flex-col gap-2 min-h-0 pt-2 items-center justify-center overflow-auto">
            {certificateUrl ? (
              <div 
                style={{ 
                  transform: isRotatedLandscape ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.2s ease-out' 
                }}
                className="max-h-[85vh] max-w-[95vw] overflow-auto p-1.5 border border-slate-800 rounded-2xl bg-black shadow-2xl flex items-center justify-center"
              >
                <img
                  src={certificateUrl}
                  alt="Photo Finish Certificate"
                  className="max-h-[80vh] max-w-[90vw] object-contain rounded-xl"
                />
              </div>
            ) : (
              <div className="text-center p-6 text-slate-400 space-y-2">
                <Award className="w-10 h-10 text-amber-400 mx-auto animate-bounce" />
                <div className="font-bold text-xs sm:text-sm text-white">وثيقة النتائج المعتمدة</div>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  تتولد الوثيقة فور انتهاء السباق متضمنة لقطات وصول العدائين بترتيبهم الرسمي وأزمنتهم الموثقة.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* شريط الإرشادات السفلي المصغر (يختفي في وضع المساحة الكاملة) */}
      {!isImmersive && (
        <div className="mt-1 text-center text-[10px] text-slate-400 flex flex-wrap items-center justify-center gap-1 sm:gap-2 shrink-0">
          <span>💡 قاعدة IAAF 164.2: التوقيت يُقاس عند ملامسة صدر العداء (Torso) لخط النهاية.</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">انقر أو اسحب على الشريط لتحريك خط القياس.</span>
        </div>
      )}
    </div>
  );
};
