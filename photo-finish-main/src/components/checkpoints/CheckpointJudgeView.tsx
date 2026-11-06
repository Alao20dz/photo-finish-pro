import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Wifi, 
  WifiOff, 
  RotateCcw, 
  Camera, 
  Send, 
  Users, 
  ChevronRight, 
  Clock 
} from 'lucide-react';
import jsQR from 'jsqr';
import { Checkpoint, AthleticsCompetition, PassageEvent } from '../../types/athletics';
import { passageSyncEngine, SyncState } from '../../services/passageSyncEngine';
import { checkpointStorage } from '../../services/checkpointStorage';

interface CheckpointJudgeViewProps {
  competition: AthleticsCompetition;
  checkpoint: Checkpoint;
  onExit: () => void;
  onOpenMonitoring?: () => void;
}

export const CheckpointJudgeView: React.FC<CheckpointJudgeViewProps> = ({
  competition,
  checkpoint,
  onExit,
  onOpenMonitoring,
}) => {
  const [currentLap, setCurrentLap] = useState<number>(1);
  const [bibInput, setBibInput] = useState<string>('');
  const [recentPassages, setRecentPassages] = useState<PassageEvent[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'warn' | 'error' } | null>(null);

  // الكاميرا وقارئ الـ QR
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const lastScannedBibRef = useRef<{ bib: number; time: number } | null>(null);

  // نافذة طلب التصحيح
  const [correctingEvent, setCorrectingEvent] = useState<PassageEvent | null>(null);
  const [newBibInput, setNewBibInput] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('خطأ في إدخال رقم الصدرية');

  // تحميل أحدث الأحداث المسجلة في هذه النقطة
  const refreshRecentPassages = async () => {
    try {
      const all = await checkpointStorage.getPassagesForCompetition(competition.id);
      const filtered = all
        .filter(p => p.checkpointId === checkpoint.id)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 15);
      setRecentPassages(filtered);
    } catch (e) {}
  };

  useEffect(() => {
    refreshRecentPassages();

    // الاستماع لحالة المزامنة
    const unsubSync = passageSyncEngine.onSyncStateChange((state, count) => {
      setSyncState(state);
      setPendingCount(count);
    });

    // الاستماع للأحداث الجديدة
    const unsubPassage = passageSyncEngine.onPassage((ev) => {
      if (ev.checkpointId === checkpoint.id) {
        refreshRecentPassages();
      }
    });

    return () => {
      unsubSync();
      unsubPassage();
    };
  }, [checkpoint.id, competition.id]);

  // إظهار تنبيه مرئي سريع ومؤقت
  const triggerFeedback = (text: string, type: 'success' | 'warn' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'error') navigator.vibrate([100, 50, 100]);
      else if (type === 'warn') navigator.vibrate(80);
      else navigator.vibrate(40);
    }
    setTimeout(() => setFeedbackMsg(null), 2500);
  };

  // ═══════════════════════════════════════════════════
  // تسجيل مرور عداء (سواء من لوحة الأرقام أو الباركود)
  // ═══════════════════════════════════════════════════
  const handleRecordBib = async (bibNum: number, source: 'quick_button' | 'qr_scan' | 'manual_entry' = 'quick_button') => {
    if (!bibNum || isNaN(bibNum) || bibNum <= 0) return;

    try {
      const res = await passageSyncEngine.recordPassage(
        competition.id,
        checkpoint,
        bibNum,
        currentLap,
        source,
        competition.actualStartTime
      );

      if (res.isDuplicate) {
        triggerFeedback(`⚠️ تحذير: الصدرية #${bibNum} مسجلة مسبقاً في نفس النقطة والحلقة!`, 'warn');
      } else {
        triggerFeedback(`✅ تم تسجيل العداء #${bibNum} في ${checkpoint.code}`, 'success');
      }

      setBibInput('');
      refreshRecentPassages();
    } catch (err: any) {
      triggerFeedback(`فشل التسجيل: ${err.message}`, 'error');
    }
  };

  const handleKeypadPress = (val: string) => {
    if (val === 'C') {
      setBibInput('');
    } else if (val === 'ENTER') {
      if (bibInput.trim()) {
        handleRecordBib(parseInt(bibInput.trim(), 10), 'quick_button');
      }
    } else {
      if (bibInput.length < 5) {
        setBibInput(prev => prev + val);
      }
    }
  };

  // ═══════════════════════════════════════════════════
  // قارئ الـ QR المتتابع عالي السرعة (Continuous Scanner)
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    if (!isScannerOpen) {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
      return;
    }

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();

          scanIntervalRef.current = setInterval(() => {
            scanVideoFrame();
          }, 150);
        }
      })
      .catch(err => {
        triggerFeedback('تعذر فتح الكاميرا: ' + err.message, 'error');
        setIsScannerOpen(false);
      });

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isScannerOpen]);

  const scanVideoFrame = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== 4) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });

    if (code && code.data) {
      // استخراج رقم الصدرية (يدعم إما رقم نقي أو صيغة BIB:123 أو رابط يحتوي bib=123)
      let detectedBib: number | null = null;
      if (/^\d+$/.test(code.data.trim())) {
        detectedBib = parseInt(code.data.trim(), 10);
      } else {
        const match = code.data.match(/bib[=:](\d+)/i);
        if (match) detectedBib = parseInt(match[1], 10);
      }

      if (detectedBib && detectedBib > 0) {
        // حماية من المسح المتكرر لنفس الصدرية خلال ثانيتين
        const now = Date.now();
        if (
          !lastScannedBibRef.current || 
          lastScannedBibRef.current.bib !== detectedBib || 
          now - lastScannedBibRef.current.time > 2000
        ) {
          lastScannedBibRef.current = { bib: detectedBib, time: now };
          handleRecordBib(detectedBib, 'qr_scan');
        }
      }
    }
  };

  // تقديم طلب تصحيح
  const handleSubmitCorrection = async () => {
    if (!correctingEvent || !newBibInput.trim()) return;
    const newBib = parseInt(newBibInput.trim(), 10);
    if (isNaN(newBib) || newBib <= 0) return;

    await passageSyncEngine.submitCorrection(
      correctingEvent.id,
      correctingEvent.bibNumber,
      newBib,
      correctionReason
    );
    triggerFeedback(`تم إرسال طلب تصحيح الصدرية #${correctingEvent.bibNumber} إلى #${newBib}`, 'success');
    setCorrectingEvent(null);
    setNewBibInput('');
    refreshRecentPassages();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none" dir="rtl">
      {/* الشريط العلوي لنقطة المراقبة */}
      <header className="bg-slate-900 border-b border-slate-800 p-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={onExit}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="الرجوع للقائمة"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-emerald-400 text-lg tracking-wider">{checkpoint.code}</span>
              <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                {checkpoint.name} ({checkpoint.distanceKm} كم)
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs">{competition.name}</p>
          </div>
        </div>

        {/* مؤشر المزامنة والطابور غير المتصل */}
        <div className="flex items-center gap-2">
          {onOpenMonitoring && (
            <button
              onClick={onOpenMonitoring}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow"
            >
              <Users className="w-3.5 h-3.5" />
              <span>المراقبة والترتيب</span>
            </button>
          )}

          <div 
            onClick={() => passageSyncEngine.flushPendingQueue()}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
              syncState === 'synced' && pendingCount === 0
                ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700'
                : 'bg-amber-900/40 text-amber-300 border border-amber-600 animate-pulse'
            }`}
            title="حالة المزامنة المحلية"
          >
            {pendingCount > 0 ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>{pendingCount} معلق</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>مُتزامن</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* شريط تنبيه الاستجابة السريع */}
      {feedbackMsg && (
        <div className={`p-2.5 text-center text-sm font-bold flex items-center justify-center gap-2 transition-all ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-600 text-white' 
            : feedbackMsg.type === 'warn' 
            ? 'bg-amber-600 text-white' 
            : 'bg-rose-600 text-white'
        }`}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* محدد رقم الحلقة (إذا كانت المنافسة تحتوي عدة حلقات) */}
      {competition.lapCount > 1 && (
        <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-slate-400 font-bold whitespace-nowrap">الحلقة:</span>
          {Array.from({ length: competition.lapCount }, (_, i) => i + 1).map(lapNum => (
            <button
              key={lapNum}
              onClick={() => setCurrentLap(lapNum)}
              className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                currentLap === lapNum
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50 scale-105'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              حلقة {lapNum}
            </button>
          ))}
        </div>
      )}

      {/* مساحة العمل الرئيسية: مقسمة بين لوحة التسجيل السريع وسجل آخر العابرين */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-3 grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* العمود الأيمن: لوحة الأرقام السريعة والمحدد */}
        <div className="md:col-span-7 flex flex-col gap-3">
          {/* شاشة رقم الصدرية الحالي */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-bold">الصدرية:</span>
              <span className="text-4xl font-black font-mono tracking-wider text-emerald-400 min-w-[120px]">
                {bibInput || '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsScannerOpen(prev => !prev)}
                className={`p-3 rounded-xl border flex items-center gap-1.5 font-bold text-xs transition ${
                  isScannerOpen
                    ? 'bg-rose-600 border-rose-500 text-white'
                    : 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300 hover:bg-indigo-600 hover:text-white'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>{isScannerOpen ? 'إغلاق الكاميرا' : 'مسح QR'}</span>
              </button>
            </div>
          </div>

          {/* قارئ الكاميرا المدمج (عند تفعيله) */}
          {isScannerOpen && (
            <div className="relative rounded-2xl overflow-hidden border border-indigo-500 bg-black aspect-video max-h-60 flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-2 border-indigo-400/50 pointer-events-none flex items-center justify-center">
                <div className="w-36 h-36 border-2 border-emerald-400 rounded-xl animate-pulse flex items-center justify-center">
                  <span className="text-[10px] bg-black/70 px-2 py-0.5 rounded text-white font-mono">وجه الكود هنا</span>
                </div>
              </div>
            </div>
          )}

          {/* لوحة الأزرار الكبيرة عالية التباين (Rapid Number Pad) */}
          <div className="grid grid-cols-3 gap-2 flex-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'ENTER'].map(key => (
              <button
                key={key}
                onClick={() => handleKeypadPress(key)}
                className={`p-4 rounded-2xl text-2xl font-black font-mono flex items-center justify-center transition active:scale-95 shadow ${
                  key === 'ENTER'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50'
                    : key === 'C'
                    ? 'bg-slate-800 hover:bg-slate-700 text-rose-400'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-800'
                }`}
              >
                {key === 'ENTER' ? <Send className="w-6 h-6 rotate-180" /> : key}
              </button>
            ))}
          </div>
        </div>

        {/* العمود الأيسر: جدول العابرين الأخير مع إمكانية التصحيح الفوري */}
        <div className="md:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col h-full shadow-lg">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-200">آخر المسجلين في النقطة</h3>
            </div>
            <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-400">
              {recentPassages.length} عداء
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {recentPassages.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-slate-500 text-xs text-center p-4">
                <Clock className="w-8 h-8 mb-2 opacity-30" />
                <p>لم يتم تسجيل أي عداء بعد في هذه النقطة</p>
                <p className="text-[11px] mt-1 text-slate-600">اضغط الأرقام أو امسح الباركود للتسجيل السريع</p>
              </div>
            ) : (
              recentPassages.map((ev) => (
                <div 
                  key={ev.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                    ev.isFlagged 
                      ? 'bg-amber-950/30 border-amber-800/80' 
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-mono font-black text-sm flex items-center justify-center">
                      #{ev.bibNumber}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-200">حلقة {ev.lapNumber}</span>
                        {ev.source === 'qr_scan' && (
                          <span className="text-[9px] bg-indigo-950 text-indigo-300 px-1.5 py-0.2 rounded font-mono">QR</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(ev.timestamp).toLocaleTimeString('ar-EG')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setCorrectingEvent(ev);
                        setNewBibInput(String(ev.bibNumber));
                      }}
                      className="text-[11px] text-slate-400 hover:text-amber-300 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-lg transition"
                      title="تصحيح رقم الصدرية"
                    >
                      تصحيح
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* نافذة منبثقة لطلب تصحيح الصدرية (Audit Trail Correction) */}
      {correctingEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-400 border-b border-slate-800 pb-3">
              <RotateCcw className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-100">طلب تصحيح تسجيل عداء</h3>
            </div>

            <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <p>الحدث الأصلي: <span className="font-bold text-emerald-400">الصدرية #{correctingEvent.bibNumber}</span></p>
              <p>النقطة: <span className="font-bold text-slate-300">{checkpoint.code} (حلقة {correctingEvent.lapNumber})</span></p>
              <p>التوقيت: <span className="font-mono text-slate-400">{new Date(correctingEvent.timestamp).toLocaleTimeString()}</span></p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">رقم الصدرية الصحيح:</label>
              <input
                type="number"
                value={newBibInput}
                onChange={(e) => setNewBibInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 font-mono text-lg font-bold text-emerald-400 text-center"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">سبب التصحيح:</label>
              <select
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-slate-200"
              >
                <option value="خطأ في إدخال رقم الصدرية">خطأ في إدخال رقم الصدرية</option>
                <option value="الصدرية كانت مطوية أو غير واضحة">الصدرية كانت مطوية أو غير واضحة</option>
                <option value="تأكيد من كاميرا الفيديو المساعدة">تأكيد من كاميرا الفيديو المساعدة</option>
                <option value="طلب من الحكم المساعد للنقطة">طلب من الحكم المساعد للنقطة</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSubmitCorrection}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl text-xs transition"
              >
                تأكيد وإرسال التصحيح
              </button>
              <button
                onClick={() => setCorrectingEvent(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
