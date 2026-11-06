import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import jsQR from 'jsqr';
import { PhoneRole } from '../types/race';

interface QrScannerModalProps {
  onSuccess: (data: { roomCode: string; role?: PhoneRole }) => void;
  onClose: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ onSuccess, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const handleScanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !isScanning) {
      animationFrameId.current = requestAnimationFrame(handleScanFrame);
      return;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animationFrameId.current = requestAnimationFrame(handleScanFrame);
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    // فحص الباركود عبر مكتبة jsQR
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      const rawData = code.data.trim();
      setScannedResult(rawData);
      setIsScanning(false);

      // تحليل الرابط أو كود الغرفة المستلم
      try {
        let detectedRoom: string = '';
        let detectedRole: PhoneRole = null;

        if (rawData.startsWith('http://') || rawData.startsWith('https://')) {
          const url = new URL(rawData);
          const rParam = url.searchParams.get('role');
          const roomParam = url.searchParams.get('room');

          if (roomParam) detectedRoom = roomParam.trim().toUpperCase();
          if (rParam === 'start' || rParam === 'finish' || rParam === 'judge' || rParam === 'chambre_dappel') {
            detectedRole = rParam;
          }
        } else if (rawData.includes('room=') || rawData.includes('role=')) {
          const params = new URLSearchParams(rawData.replace(/^[?&]/, ''));
          const rParam = params.get('role');
          const roomParam = params.get('room');

          if (roomParam) detectedRoom = roomParam.trim().toUpperCase();
          if (rParam === 'start' || rParam === 'finish' || rParam === 'judge' || rParam === 'chambre_dappel') {
            detectedRole = rParam;
          }
        } else {
          // كود غرفة نصي مباشر (مثل RACE-2026)
          detectedRoom = rawData.toUpperCase();
        }

        if (detectedRoom) {
          stopCamera();
          onSuccess({ roomCode: detectedRoom, role: detectedRole });
          return;
        }
      } catch (e) {
        console.warn('QR parse notice:', e);
      }

      // إذا لم يتطابق الرابط مباشرة، نعتبر النص كود الغرفة
      stopCamera();
      onSuccess({ roomCode: rawData.toUpperCase() });
      return;
    }

    animationFrameId.current = requestAnimationFrame(handleScanFrame);
  }, [isScanning, onSuccess, stopCamera]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setErrorMsg(null);
    setIsScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        animationFrameId.current = requestAnimationFrame(handleScanFrame);
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setErrorMsg('تعذر الوصول إلى الكاميرا. يرجى التأكد من منح الإذن لاستخدام الكاميرا.');
    }
  }, [facingMode, handleScanFrame, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-scaleUp text-slate-100 flex flex-col">
        {/* ترويسة النافذة */}
        <div className="p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white flex items-center gap-1.5">
                <span>مسح باركود الهاتف المقابل (QR Scanner)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                  تلقائي ⚡
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">
                وجّه الكاميرا نحو باركود الهاتف الأول للاتصال الفوري
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="تبديل الكاميرا الخلفية / الأمامية"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* مساحة الكاميرا ومربع المسح المستهدف */}
        <div className="relative bg-black flex items-center justify-center overflow-hidden min-h-[300px]">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-72 sm:h-80 object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* إطار المسح الليزري البصري */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
            <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-cyan-400/80 rounded-3xl relative shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              {/* زوايا بارزة */}
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-cyan-300 rounded-tr-xl" />
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-cyan-300 rounded-tl-xl" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-cyan-300 rounded-br-xl" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-cyan-300 rounded-bl-xl" />

              {/* خط المسح المتحرك */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#22d3ee] animate-pulse top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* رسالة الخطأ إن تعذرت الكاميرا */}
          {errorMsg && (
            <div className="absolute inset-4 bg-slate-950/95 border border-rose-500/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <span className="font-bold text-xs text-rose-300">{errorMsg}</span>
              <button
                type="button"
                onClick={startCamera}
                className="mt-2 px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-700"
              >
                إعادة المحاولة 🔄
              </button>
            </div>
          )}

          {/* نتيجة القراءة الناجحة لحظياً */}
          {scannedResult && (
            <div className="absolute bottom-3 inset-x-3 bg-emerald-600/90 text-white p-2.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs animate-fade-in shadow-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>تم التعرف على الباركود بنجاح! جاري الاتصال...</span>
            </div>
          )}
        </div>

        {/* تذييل النافذة والإرشادات */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 space-y-2 text-center text-xs">
          <p className="text-[11px] text-slate-400">
            يمكنك مسح باركود الغرفة أو باركود أي دور (البداية 🚦، النهاية 📸، التحكيم ⚖️، النداء 📋)
          </p>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
          >
            إلغاء ومتابعة يدوياً
          </button>
        </div>
      </div>
    </div>
  );
};
