import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, SwitchCamera, Flashlight, Sliders, Award, Crosshair, RotateCcw, Zap, BellRing, Film, Globe, LocateFixed, AlertTriangle, MapPin } from 'lucide-react';
import { Runner, RaceStatus, RaceSettings } from '../types/race';
import { opticalGateDetector, OpticalLaneResult } from '../services/motionDetector';
import { slitScanEngine } from '../services/slitScanEngine';
import { athleticsAudio } from '../services/audioService';
import { burstCaptureService } from '../services/burstCaptureService';
import { getPlacementOption, CAMERA_PLACEMENT_OPTIONS } from '../services/cameraPlacement';

interface FinishPhoneViewProps {
  raceStatus: RaceStatus;
  runners: Runner[];
  clockTimeMs: number;
  settings: RaceSettings;
  onLaneFinish: (lane: number, timeMs: number, snapshotUrl?: string) => void;
  onFinishRace: (panoramaUrl?: string) => void;
  onSharedResetRace: () => void;
  onViewPhotoFinish: () => void;
  onOpenSettings?: () => void;
  onOpenInternetBridge?: () => void;
  onStartBellSignal?: () => void;
  onStopBellSignal?: () => void;
  isHoldingBell?: boolean;
  isPeerSirenRinging?: boolean;
}

export const FinishPhoneView: React.FC<FinishPhoneViewProps> = ({
  raceStatus,
  runners,
  clockTimeMs,
  settings,
  onLaneFinish,
  onFinishRace,
  onSharedResetRace,
  onViewPhotoFinish,
  onOpenSettings,
  onOpenInternetBridge,
  onStartBellSignal,
  onStopBellSignal,
  isHoldingBell,
  isPeerSirenRinging
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const slitCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [finishLineX, setFinishLineX] = useState<number>(settings.finishLineXPercent || 0.35);
  const [preFinishLineX, setPreFinishLineX] = useState<number>(settings.preFinishLineXPercent || 0.22);
  const [postFinishLineX, setPostFinishLineX] = useState<number>(settings.postFinishLineXPercent || 0.52);
  const [laneResults, setLaneResults] = useState<OpticalLaneResult[]>([]);
  const [cameraError, setCameraError] = useState<string>('');
  const [showCalibration, setShowCalibration] = useState<boolean>(false);
  const [showPlacementGuide, setShowPlacementGuide] = useState<boolean>(false);

  // حالات التصوير المتتالي فائق السرعة (Burst Capture)
  const [isBurstActive, setIsBurstActive] = useState<boolean>(false);
  const [burstFrameCount, setBurstFrameCount] = useState<number>(0);
  const [preGateTriggered, setPreGateTriggered] = useState<boolean>(false);
  const [postGateTriggered, setPostGateTriggered] = useState<boolean>(false);

  // مراجع ثابتة لقراءة أحدث القيم داخل حلقة requestAnimationFrame
  const clockTimeMsRef = useRef<number>(clockTimeMs);
  clockTimeMsRef.current = clockTimeMs;
  const finishLineXRef = useRef<number>(finishLineX);
  finishLineXRef.current = finishLineX;
  const settingsRef = useRef<RaceSettings>(settings);
  settingsRef.current = settings;
  const runnersRef = useRef<Runner[]>(runners);
  runnersRef.current = runners;
  const onLaneFinishRef = useRef(onLaneFinish);
  onLaneFinishRef.current = onLaneFinish;
  const onFinishRaceRef = useRef(onFinishRace);
  onFinishRaceRef.current = onFinishRace;

  // تشغيل الكاميرا
  const startCamera = useCallback(async () => {
    try {
      setCameraError('');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('واجهة الكاميرا WebRTC غير مدعومة أو غير مفعلة في هذا النظام.');
        setCameraActive(false);
        return;
      }

      let stream: MediaStream | null = null;
      
      // 1. محاولة طلب الكاميرا الخلفية بدقة HD ومعدل إطارات عالٍ (دقة التوقيت تعتمد على هذا)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 60, min: 30 },
          },
          audio: false
        });
      } catch (firstErr) {
        console.warn('HD camera request failed, trying simple facingMode:', firstErr);
      }

      // 2. محاولة بديلة بقيود facingMode فقط
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode },
            audio: false
          });
        } catch (secondErr) {
          console.warn('facingMode request failed, trying basic video:', secondErr);
        }
      }

      // 3. محاولة بديلة نهائية: أي كاميرا متاحة بالجهاز
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      if (videoRef.current && stream) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.muted = true;
        video.defaultMuted = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        
        try {
          await video.play();
          setCameraActive(true);
          setCameraError('');
        } catch (playErr) {
          console.warn('Auto video play failed, waiting for user gesture:', playErr);
        }
        streamRef.current = stream;

        // قفل التعريض/التركيز/توازن الأبيض التلقائي حيث يدعمه الجهاز، لمنع أي تعديل تلقائي
        // مفاجئ (سطوع/تركيز) من خداع كاشف الحركة ويُسجَّل كوصول زائف
        try {
          const track = stream.getVideoTracks()[0];
          const caps = track.getCapabilities?.() as any;
          const advanced: any[] = [];
          if (caps?.focusMode?.includes?.('manual')) advanced.push({ focusMode: 'manual' });
          if (caps?.exposureMode?.includes?.('manual')) advanced.push({ exposureMode: 'manual' });
          if (caps?.whiteBalanceMode?.includes?.('manual')) advanced.push({ whiteBalanceMode: 'manual' });
          if (advanced.length) await track.applyConstraints({ advanced } as any);
        } catch (lockErr) {
          console.warn('Manual exposure/focus lock not supported on this device:', lockErr);
        }
      }
    } catch (e: any) {
      console.error('Camera access error:', e);
      const name = e?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('يرجى منح إذن الكاميرا من إعدادات الهاتف لتطبيق Photo Finish.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('لم يتم العثور على كاميرا في الهاتف.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setCameraError('الكاميرا قيد الاستخدام بواسطة تطبيق آخر أو حدث تعارض في العتاد.');
      } else {
        setCameraError('تعذر فتح الكاميرا: ' + (e?.message || 'يرجى مراجعة الصلاحيات'));
      }
      setCameraActive(false);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [startCamera]);

  // التحكم بفلاش الكاميرا
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities && capabilities.torch) {
        await (track as any).applyConstraints({
          advanced: [{ torch: !torchEnabled }]
        });
        setTorchEnabled(!torchEnabled);
      } else {
        alert('فلاش الكاميرا غير مدعوم على هذا المتصفح/الجهاز.');
      }
    } catch (e) {
      console.warn('Torch error:', e);
    }
  };

  // حلقة معالجة إطارات الكاميرا وحساس خط النهاية
  // تُستخدم requestVideoFrameCallback حيث تتوفر (Chrome/Edge/Safari الحديث) لأنها تستدعينا بالضبط
  // عند عرض إطار كاميرا جديد فعلياً، بدل التخمين عبر معدل تحديث الشاشة كما في requestAnimationFrame
  useEffect(() => {
    let animId: number;
    let vfcId: number;
    const video0 = videoRef.current;
    const supportsVFC = !!(video0 && 'requestVideoFrameCallback' in video0);

    const loop = () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current;

        if (raceStatus === 'racing') {
          const currentClock = clockTimeMsRef.current;
          const currentX = finishLineXRef.current;
          const currentSettings = settingsRef.current;
          const currentRunners = runnersRef.current;

          // 1. التقاط شريحة المسح الشريطي المتواصل
          slitScanEngine.captureSlice(video, currentX, currentClock);

          // عرض الشريط على شاشة المعاينة
          if (slitCanvasRef.current) {
            const previewCtx = slitCanvasRef.current.getContext('2d');
            const mainCanvas = slitScanEngine.getCanvas();
            const currW = slitScanEngine.getCurrentWidth();
            
            if (previewCtx && currW > 0) {
              const displayW = slitCanvasRef.current.width;
              const displayH = slitCanvasRef.current.height;
              previewCtx.clearRect(0, 0, displayW, displayH);
              const sourceX = Math.max(0, currW - displayW);
              previewCtx.drawImage(
                mainCanvas,
                sourceX, 0, displayW, mainCanvas.height,
                0, 0, displayW, displayH
              );
            }
          }

          // 2. كشف الحساس الضوئي لكل رواق (تمرير ساعة السباق نفسها، تُستخدم للاستيفاء الزمني الدقيق)
          const detected = opticalGateDetector.scan(
            video,
            currentSettings.laneCount,
            currentX,
            currentSettings.motionThreshold,
            currentClock
          );
          setLaneResults(detected);

          const triggeredLanes = detected.filter(r => r.isTriggered).map(r => r.lane);

          // فحص خط ما قبل النهاية (Pre-Finish Gate) - يبدأ التصوير المتتالي
          const preGate = opticalGateDetector.checkPreGateMotion(
            video,
            currentSettings.preFinishLineXPercent || 0.22,
            currentSettings.motionThreshold
          );
          if (preGate.isTriggered) {
            setPreGateTriggered(true);
          }

          // فحص خط ما بعد النهاية (Post-Finish Gate)
          const postGate = opticalGateDetector.checkPostGateMotion(
            video,
            currentSettings.postFinishLineXPercent || 0.52,
            currentSettings.motionThreshold
          );
          if (postGate.isTriggered) {
            setPostGateTriggered(true);
          }

          // بدء التصوير المتتالي فائق السرعة تلقائياً عند قطع خط ما قبل النهاية أو خط النهاية
          if ((preGate.isTriggered || triggeredLanes.length > 0) && !burstCaptureService.isCapturing) {
            burstCaptureService.startCapture();
            setIsBurstActive(true);
          }

          // التقاط الإطارات المتتالية فائقة السرعة مع توثيق خط النهاية وترتيب العدائين
          if (burstCaptureService.isCapturing) {
            const frame = burstCaptureService.captureFrame(
              video,
              currentX,
              currentClock,
              triggeredLanes,
              currentRunners
            );
            if (frame) {
              setBurstFrameCount(burstCaptureService.frames.length);
            }
          }

          // رصد لحظة قطع شعاع الحساس
          detected.forEach((res) => {
            const runner = currentRunners.find(r => r.lane === res.lane);
            if (res.isTriggered && runner && runner.finishTime === 0) {
              // تنبيه صوتي للحساس
              athleticsAudio.playSensorCutBeep(res.lane);

              // استخدم اللحظة المستوفاة رياضياً (أدق من لحظة اكتشاف العبور) إن توفرت
              const preciseTimeMs = res.interpolatedCrossMs ?? currentClock;
              const formatted = `${(preciseTimeMs / 1000).toFixed(3)}s`;
              const alreadyFinished = currentRunners.filter(r => r.finishTime > 0).length;
              const currentRank = alreadyFinished + 1;

              const snap = opticalGateDetector.captureSnapshot(
                video,
                res.lane,
                formatted,
                currentX,
                runner.name,
                runner.bib,
                currentRank
              );
              onLaneFinishRef.current(res.lane, preciseTimeMs, snap || undefined);
            }
          });

          // التوقف التلقائي للتصوير المتتالي عند وصول جميع العدائين
          const allFinished = currentRunners.length > 0 && currentRunners.every(r => r.finishTime > 0);
          if (allFinished && burstCaptureService.isCapturing) {
            burstCaptureService.stopCapture();
            setIsBurstActive(false);
          }
          if (allFinished && currentSettings.autoStopAfterLastRunner) {
            const panorama = slitScanEngine.exportCroppedPhotoFinishDataUrl(currentSettings.laneCount, currentRunners);
            setTimeout(() => onFinishRaceRef.current(panorama || undefined), 400);
          }
        }
      }

      if (supportsVFC) {
        vfcId = (videoRef.current as any).requestVideoFrameCallback(loop);
      } else {
        animId = requestAnimationFrame(loop);
      }
    };

    if (supportsVFC) {
      vfcId = (videoRef.current as any).requestVideoFrameCallback(loop);
    } else {
      animId = requestAnimationFrame(loop);
    }
    return () => {
      if (supportsVFC && videoRef.current && vfcId) {
        (videoRef.current as any).cancelVideoFrameCallback(vfcId);
      } else if (animId) {
        cancelAnimationFrame(animId);
      }
    };
  }, [raceStatus]);

  useEffect(() => {
    if (raceStatus === 'racing') {
      slitScanEngine.startCapture(Date.now());
      burstCaptureService.reset();
      setBurstFrameCount(0);
      setIsBurstActive(false);
      opticalGateDetector.reset();
    } else if (raceStatus === 'finished') {
      slitScanEngine.stopCapture();
      burstCaptureService.stopCapture();
      setIsBurstActive(false);
    }
  }, [raceStatus]);

  const formatClock = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(ms % 1000);
    return `${s}.${String(m).padStart(3, '0')}s`;
  };

  return (
    <div className="w-full max-w-lg mx-auto p-2 sm:p-4 space-y-2.5 sm:space-y-3" dir="rtl">
      {/* نافذة الكاميرا وخطوط الأروقة وخط النهاية */}
      <div 
        onClick={() => {
          if (videoRef.current) {
            videoRef.current.play().catch(console.warn);
          }
          if (!cameraActive) {
            startCamera();
          }
        }}
        className="relative bg-black rounded-3xl overflow-hidden aspect-[16/10] border border-slate-800 shadow-2xl cursor-pointer"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ pointerEvents: 'none' }}
          onPlay={() => {
            setCameraActive(true);
            setCameraError('');
          }}
          onPlaying={() => {
            setCameraActive(true);
            setCameraError('');
          }}
          onLoadedMetadata={async () => {
            if (videoRef.current) {
              try {
                await videoRef.current.play();
                setCameraActive(true);
                setCameraError('');
              } catch (err) {
                console.warn('Play on loadedmetadata failed:', err);
              }
            }
          }}
          className="w-full h-full object-cover"
        />

        {/* تنبيه إذا لم تبدأ الكاميرا تلقائياً أو حدث خطأ */}
        {(!cameraActive || cameraError) && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-4 text-center gap-2.5 z-20">
            <Camera className="w-10 h-10 text-amber-400 animate-pulse" />
            <span className="text-xs font-bold text-white max-w-[250px]">
              {cameraError || 'الكاميرا بانتظار إذن التشغيل في الهاتف'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                startCamera();
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 cursor-pointer active:scale-95 transition-all"
            >
              اضغط هنا لتفعيل وبدء الكاميرا 📷
            </button>
          </div>
        )}

        {/* خطوط تقسيم الأروقة بالمضمار (Lanes Dividers) */}
        <div className="absolute inset-0 pointer-events-none flex flex-col">
          {Array.from({ length: settings.laneCount }).map((_, i) => {
            const isCut = laneResults[i]?.isTriggered;
            const runner = runners.find(r => r.lane === i + 1);
            return (
              <div
                key={i}
                className={`flex-1 border-b border-dashed flex items-center justify-between px-3 transition-colors ${
                  isCut ? 'border-red-500 bg-red-500/20' : 'border-white/20'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-black/60 text-white border border-white/20">
                    رواق L{i + 1}
                  </span>
                  {runner && (
                    <span className="text-[10px] font-bold text-white/80 bg-black/40 px-1.5 py-0.5 rounded truncate max-w-[90px]">
                      {runner.name}
                    </span>
                  )}
                </div>

                {laneResults[i]?.motionScore !== undefined && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                    isCut ? 'bg-red-600 text-white animate-pulse' : 'bg-black/60 text-slate-300'
                  }`}>
                    {isCut ? '⚡ قطع الحساس!' : `${laneResults[i].motionScore}%`}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* خط ما قبل النهاية (Pre-Finish Gate) - بدء التصوير */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none transition-all"
          style={{
            left: `${preFinishLineX * 100}%`,
            width: '2px',
            backgroundColor: settings.preFinishLineColor || '#00E5FF',
            boxShadow: `0 0 12px ${settings.preFinishLineColor || '#00E5FF'}`,
            opacity: preGateTriggered ? 1 : 0.7,
          }}
        >
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 font-mono text-[8px] font-black px-1 py-0.5 rounded shadow whitespace-nowrap text-black"
            style={{ backgroundColor: settings.preFinishLineColor || '#00E5FF' }}
          >
            PRE-GATE • بدء التصوير
          </div>
        </div>

        {/* خط النهاية الرسمي والحساس الضوئي (Official Finish Gate) */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none transition-all"
          style={{
            left: `${finishLineX * 100}%`,
            width: `${settings.finishLineWidth}px`,
            backgroundColor: settings.finishLineColor || '#EF4444',
            boxShadow: `0 0 15px ${settings.finishLineColor || '#EF4444'}`,
          }}
        >
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 font-mono text-[9px] font-black px-1.5 py-0.5 rounded shadow whitespace-nowrap text-black font-bold"
            style={{ backgroundColor: settings.finishLineColor || '#EF4444' }}
          >
            FINISH GATE
          </div>
        </div>

        {/* خط ما بعد النهاية (Post-Finish Gate) - انتهاء التصوير */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none transition-all"
          style={{
            left: `${postFinishLineX * 100}%`,
            width: '2px',
            backgroundColor: settings.postFinishLineColor || '#A855F7',
            boxShadow: `0 0 12px ${settings.postFinishLineColor || '#A855F7'}`,
            opacity: postGateTriggered ? 1 : 0.7,
          }}
        >
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 font-mono text-[8px] font-black px-1 py-0.5 rounded shadow whitespace-nowrap text-black"
            style={{ backgroundColor: settings.postFinishLineColor || '#A855F7' }}
          >
            POST-GATE • انتهاء التصوير
          </div>
        </div>

        {/* رأس مؤشرات الكاميرا في الأعلى */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-auto">
          <div className="bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-white font-mono font-bold text-xs flex items-center gap-2 border border-white/10 shadow-lg">
            <span className={`w-2.5 h-2.5 rounded-full ${raceStatus === 'racing' ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} />
            <span>{formatClock(clockTimeMs)}</span>
          </div>

          {/* مؤشر التصوير المتتالي فائق السرعة فور وصول أول عداء */}
          {isBurstActive && (
            <div className="bg-red-600/90 backdrop-blur-md px-2.5 py-1 rounded-full text-white font-black text-[11px] flex items-center gap-1.5 border border-yellow-300 animate-pulse shadow-lg shadow-red-600/50">
              <span className="w-2 h-2 rounded-full bg-yellow-300 animate-ping" />
              <span>📸 تصوير متتالي فائق ({burstFrameCount} إطار)</span>
            </div>
          )}

          <div className="flex gap-1.5">
            {onOpenInternetBridge && (
              <button
                onClick={onOpenInternetBridge}
                className="p-1.5 rounded-lg bg-black/60 border border-white/10 text-cyan-300 hover:text-cyan-200 backdrop-blur-md flex items-center gap-1 text-[11px] font-bold"
                title="جسر الإنترنت للمسافات البعيدة"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">الجسر</span>
              </button>
            )}
            <button
              onClick={toggleTorch}
              className={`p-1.5 rounded-lg border backdrop-blur-md ${
                torchEnabled ? 'bg-amber-500 border-amber-400 text-black' : 'bg-black/60 border-white/10 text-white'
              }`}
              title="فلاش الكاميرا"
            >
              <Flashlight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
              className="p-1.5 rounded-lg bg-black/60 border border-white/10 text-white backdrop-blur-md"
              title="تبديل الكاميرا"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCalibration(!showCalibration)}
              className={`p-1.5 rounded-lg border backdrop-blur-md ${
                showCalibration ? 'bg-cyan-500 border-cyan-400 text-black' : 'bg-black/60 border-white/10 text-white'
              }`}
              title="محاذاة خط النهاية"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowPlacementGuide(!showPlacementGuide)}
              className={`p-1.5 rounded-lg border backdrop-blur-md ${
                showPlacementGuide ? 'bg-emerald-500 border-emerald-400 text-black' : 'bg-black/60 border-white/10 text-emerald-300'
              }`}
              title="دليل وضعية الكاميرا (دقة التوقيت)"
            >
              <LocateFixed className="w-4 h-4" />
            </button>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-1.5 rounded-lg bg-black/60 border border-white/10 text-amber-400 hover:text-amber-300 backdrop-blur-md"
                title="إعدادات السباق والأروقة"
              >
                <Sliders className="w-4 h-4 text-amber-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* لوحة محاذاة ومعايرة خط النهاية وإعدادات الأروقة */}
      {showCalibration && (
        <div className="bg-slate-900 border border-cyan-900/60 rounded-2xl p-3 space-y-3 text-xs shadow-xl">
          <div className="text-cyan-400 font-black flex items-center gap-1.5">
            <Crosshair className="w-4 h-4" />
            منظومة الخطوط الثلاثية (Triple Gate System):
          </div>

          {/* خط ما قبل النهاية (Pre-Finish Gate) */}
          <div className="space-y-1 p-2.5 rounded-xl border" style={{ borderColor: (settings.preFinishLineColor || '#00E5FF') + '60', backgroundColor: (settings.preFinishLineColor || '#00E5FF') + '08' }}>
            <div className="flex justify-between items-center font-bold">
              <span className="flex items-center gap-1.5" style={{ color: settings.preFinishLineColor || '#00E5FF' }}>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: settings.preFinishLineColor || '#00E5FF' }} />
                خط بدء التصوير (Pre-Finish Gate):
              </span>
              <span className="font-mono" style={{ color: settings.preFinishLineColor || '#00E5FF' }}>{Math.round(preFinishLineX * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.9"
              step="0.01"
              value={preFinishLineX}
              onChange={(e) => setPreFinishLineX(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[9px] text-slate-500">عند اقتراب العداء من هذا الخط يبدأ التصوير المتتالي فائق السرعة تلقائياً</p>
          </div>

          {/* خط النهاية الرسمي (Official Finish Line) */}
          <div className="space-y-1 p-2.5 rounded-xl border" style={{ borderColor: (settings.finishLineColor || '#EF4444') + '60', backgroundColor: (settings.finishLineColor || '#EF4444') + '08' }}>
            <div className="flex justify-between items-center font-bold">
              <span className="flex items-center gap-1.5" style={{ color: settings.finishLineColor || '#EF4444' }}>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: settings.finishLineColor || '#EF4444' }} />
                خط النهاية الرسمي (Official Finish):
              </span>
              <span className="font-mono" style={{ color: settings.finishLineColor || '#EF4444' }}>{Math.round(finishLineX * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.01"
              value={finishLineX}
              onChange={(e) => setFinishLineX(parseFloat(e.target.value))}
              className="w-full accent-red-500 cursor-pointer"
            />
            <p className="text-[9px] text-slate-500">خط التوقيت الرسمي ومحور المسح الشريطي (Slit-Scan Axis)</p>
          </div>

          {/* خط ما بعد النهاية (Post-Finish Gate) */}
          <div className="space-y-1 p-2.5 rounded-xl border" style={{ borderColor: (settings.postFinishLineColor || '#A855F7') + '60', backgroundColor: (settings.postFinishLineColor || '#A855F7') + '08' }}>
            <div className="flex justify-between items-center font-bold">
              <span className="flex items-center gap-1.5" style={{ color: settings.postFinishLineColor || '#A855F7' }}>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: settings.postFinishLineColor || '#A855F7' }} />
                خط انتهاء التصوير (Post-Finish Gate):
              </span>
              <span className="font-mono" style={{ color: settings.postFinishLineColor || '#A855F7' }}>{Math.round(postFinishLineX * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.95"
              step="0.01"
              value={postFinishLineX}
              onChange={(e) => setPostFinishLineX(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <p className="text-[9px] text-slate-500">بعد عبور العداء هذا الخط يتوقف التصوير المتتالي لهذا العداء</p>
          </div>
        </div>
      )}

      {/* ═══ دليل هندسة وضعية الكاميرا (Camera Placement Guide) — العامل الأهم في دقة التوقيت ═══ */}
      {showPlacementGuide && (() => {
        const activePlacement = getPlacementOption(settings.cameraPlacement);
        return (
          <div className="bg-slate-900 border border-emerald-800/60 rounded-2xl p-3 space-y-3 text-xs shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <span className="font-black text-emerald-400 flex items-center gap-1.5">
                <LocateFixed className="w-4 h-4" />
                دليل وضعية الكاميرا (Placement Guide):
              </span>
              <span
                className="text-[9px] font-black px-2 py-0.5 rounded-full border"
                style={{ color: activePlacement.accent, borderColor: activePlacement.accent + '70', backgroundColor: activePlacement.accent + '15' }}
              >
                الوضعية الحالية: {activePlacement.title}
              </span>
            </div>

            {/* مخططات الوضعيات الثلاث (عرض علوي للمضمار) */}
            <div className="grid grid-cols-3 gap-2">
              {CAMERA_PLACEMENT_OPTIONS.map((opt) => {
                const isActive = opt.id === activePlacement.id;
                return (
                  <div
                    key={opt.id}
                    className={`rounded-xl p-1.5 border-2 text-center space-y-1 ${
                      isActive ? 'bg-slate-950' : 'bg-slate-950/50 border-slate-800 opacity-60'
                    }`}
                    style={isActive ? { borderColor: opt.accent } : undefined}
                  >
                    <svg viewBox="0 0 100 64" className="w-full rounded-lg bg-slate-900">
                      {/* الأروقة (خطوط المضمار) */}
                      {[0, 1, 2, 3].map(i => (
                        <line key={i} x1="18" y1={10 + i * 14} x2="88" y2={10 + i * 14} stroke="#334155" strokeWidth="1" />
                      ))}
                      {/* اتجاه العدائين */}
                      <text x="53" y="62" fill="#64748b" fontSize="6" textAnchor="middle">اتجاه العدائين ←</text>
                      {/* خط النهاية */}
                      <line x1="34" y1="6" x2="34" y2="52" stroke="#EF4444" strokeWidth="2" />
                      {/* الكاميرا حسب الوضعية */}
                      {opt.id === 'tele_parallel' && (
                        <>
                          <circle cx="10" cy="30" r="5" fill={opt.accent} />
                          <line x1="15" y1="30" x2="33" y2="30" stroke={opt.accent} strokeWidth="1.5" strokeDasharray="3 2" />
                          <text x="10" y="8" fill={opt.accent} fontSize="6" textAnchor="middle">زاوية 0°</text>
                        </>
                      )}
                      {opt.id === 'angled_behind' && (
                        <>
                          <circle cx="14" cy="14" r="5" fill={opt.accent} />
                          <line x1="18" y1="17" x2="33" y2="26" stroke={opt.accent} strokeWidth="1.5" strokeDasharray="3 2" />
                          <text x="24" y="10" fill={opt.accent} fontSize="6" textAnchor="middle">≤10°</text>
                        </>
                      )}
                      {opt.id === 'side_classic' && (
                        <>
                          <circle cx="60" cy="30" r="5" fill={opt.accent} />
                          <line x1="55" y1="30" x2="35" y2="30" stroke={opt.accent} strokeWidth="1.5" strokeDasharray="3 2" />
                          <text x="72" y="32" fill={opt.accent} fontSize="6" textAnchor="middle">90°</text>
                        </>
                      )}
                    </svg>
                    <p className="text-[8.5px] font-black leading-tight" style={{ color: isActive ? opt.accent : '#94a3b8' }}>
                      {opt.title}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* خطوات التثبيت للوضعية النشطة */}
            <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 space-y-1.5">
              <p className="font-black text-[10px]" style={{ color: activePlacement.accent }}>
                خطوات التثبيت الصحيح للوضعية الحالية:
              </p>
              <ul className="space-y-1">
                {activePlacement.steps.map((step, i) => (
                  <li key={i} className="text-[10px] text-slate-300 flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full shrink-0 font-black text-[8px] flex items-center justify-center text-black" style={{ backgroundColor: activePlacement.accent }}>{i + 1}</span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* تحذير الوضعية إن وجد */}
            {activePlacement.warning && (
              <div className="flex items-start gap-1.5 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span className="leading-relaxed">{activePlacement.warning}</span>
              </div>
            )}

            {/* تذكير بتغيير الوضعية من الإعدادات */}
            {activePlacement.id !== 'tele_parallel' && (
              <div className="flex items-center justify-between gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2">
                <span className="text-[10px] text-emerald-300 font-bold leading-relaxed">
                  💡 للدقة الأولمبية المعتمدة: بدّل إلى «موازية أولمبية + تكبير» من إعدادات السباق
                </span>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>فتح الإعدادات</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* شريط المسح الشريطي التراكمي المباشر (Live Photo Finish Ribbon) */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2.5 space-y-1.5 shadow-inner">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            شريط المسح الشريطي اللحظي (Slit-Scan Stream):
          </span>
          <span className="text-[10px] text-cyan-400 font-mono">1 بكسل = ~1ms</span>
        </div>
        <div className="w-full h-16 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <canvas
            ref={slitCanvasRef}
            width={400}
            height={70}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* أزرار إنهاء السباق ومعاينة الصور المتتالية */}
      <div className="space-y-2">
        {/* زر معاينة الصور المتتالية فائقة السرعة وترتيب العدائين */}
        {burstCaptureService.frames.length > 0 && (
          <button
            onClick={onViewPhotoFinish}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-red-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 border border-amber-300 cursor-pointer active:scale-95 transition-all"
          >
            <Film className="w-4 h-4 fill-slate-950" />
            <span>📸 معاينة الصور المتتالية وترتيب العدائين ({burstCaptureService.frames.length} إطار متتالي)</span>
          </button>
        )}

        {raceStatus === 'racing' && (
          <button
            onClick={() => {
              const panorama = slitScanEngine.exportCroppedPhotoFinishDataUrl(settings.laneCount, runners);
              onFinishRace(panorama || undefined);
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-amber-600 to-yellow-500 hover:from-red-500 hover:to-yellow-400 text-slate-950 font-black text-base shadow-xl flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <span>🏁 إنهاء السباق واعتماد Photo Finish</span>
          </button>
        )}

        {raceStatus === 'finished' && (
          <button
            onClick={onViewPhotoFinish}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-base shadow-xl flex items-center justify-center gap-2"
          >
            <Award className="w-5 h-5 text-amber-300" />
            <span>فحص وتدقيق صورة Photo Finish الرسمية</span>
          </button>
        )}

        {/* زر جرس لفت الانتباه وفحص إشارة هاتف البداية (Signal Check) */}
        {onStartBellSignal && onStopBellSignal && (
          <button
            type="button"
            onPointerDown={onStartBellSignal}
            onPointerUp={onStopBellSignal}
            onPointerLeave={onStopBellSignal}
            onPointerCancel={onStopBellSignal}
            className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 select-none transition-all cursor-pointer shadow-lg active:scale-95 ${
              isHoldingBell
                ? isPeerSirenRinging
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white shadow-rose-600/40 border-2 border-yellow-300 animate-pulse scale-[1.02]'
                  : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-amber-600/30 border border-amber-400 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/40 hover:border-amber-400'
            }`}
          >
            <BellRing className={`w-4 h-4 ${isHoldingBell ? 'animate-bounce text-yellow-300' : 'text-amber-400'}`} />
            <span>
              {isHoldingBell
                ? isPeerSirenRinging
                  ? '🚨 هاتف البداية يرن الآن بصوت الشرطة! (اتركه لإيقاف الرنين)'
                  : '📡 جاري إرسال إشارة الرنين إلى هاتف البداية...'
                : '🔔 جرس لفت انتباه هاتف البداية (اضغط مطولاً لتشغيل صفارة الشرطة)'}
            </span>
          </button>
        )}

        {/* زر مشترك لإعادة البدء في سباق آخر على الهاتفين معاً */}
        <button
          onClick={onSharedResetRace}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-slate-800 via-slate-750 to-slate-800 hover:from-slate-700 hover:to-slate-700 text-cyan-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-cyan-500/40 shadow-lg active:scale-95 transition-all"
          title="يقوم بإعادة تعيين الساعة وحساس الكاميرا في كلا الهاتفين معاً في نفس اللحظة"
        >
          <RotateCcw className="w-4 h-4 text-cyan-400" />
          <span>🔄 إعادة ضبط وبدء سباق جديد (مشترك في الهواتف الثلاثة)</span>
        </button>
      </div>

      {/* لوحة تسجيل وصول العدائين حسب الأروقة مع صور الوصول */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-xl">
        <div className="text-[11px] font-bold text-slate-400 mb-2 flex justify-between">
          <span>حساسية الأروقة وتوثيق الوصول التلقائي:</span>
          <span className="text-[10px] text-amber-400 font-mono">
            {settings.heatName || `قائمة ${settings.heatNumber}`} • {runners.filter(r => r.finishTime > 0).length}/{runners.length} وصلوا
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {runners.map((r) => {
            const finished = r.finishTime > 0;
            return (
              <button
                key={r.id}
                disabled={finished || raceStatus !== 'racing'}
                onClick={() => onLaneFinish(r.lane, clockTimeMs)}
                className={`p-2.5 rounded-xl text-right font-mono border transition-all overflow-hidden relative ${
                  finished
                    ? 'bg-emerald-950/60 border-emerald-600 text-emerald-400'
                    : raceStatus === 'racing'
                    ? 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-white active:scale-95'
                    : 'bg-slate-900/70 border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">رواق L{r.lane}</span>
                  {r.rank && r.rank > 0 && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 rounded font-black">
                      #{r.rank}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-300 truncate font-sans">{r.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-[11px] font-bold text-amber-400">
                    {finished ? `${(r.finishTime / 1000).toFixed(3)}s` : 'قطع الحساس 🏃'}
                  </div>
                  {r.crossingSnapshot && (
                    <img
                      src={r.crossingSnapshot}
                      alt="finish"
                      className="w-8 h-5 object-cover rounded border border-cyan-400/50"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
