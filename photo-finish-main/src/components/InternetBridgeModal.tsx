import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Copy, 
  Check, 
  Link2, 
  RefreshCw, 
  X, 
  ShieldCheck, 
  Zap, 
  Smartphone, 
  Flag, 
  Camera, 
  Award,
  CheckCircle2,
  QrCode,
  Radio,
  Wifi,
  Users,
  Key,
  Layers,
  Clock,
  ClipboardList
} from 'lucide-react';
import { athleticsNetwork, ConnectionQuality } from '../services/networkService';
import { PhoneRole } from '../types/race';
import { PhoneQrModal } from './PhoneQrModal';

interface InternetBridgeModalProps {
  role: PhoneRole;
  roomCode: string;
  isConnected: boolean;
  latencyMs: number;
  onClose: () => void;
  onSendTestPing?: () => void;
}

export const InternetBridgeModal: React.FC<InternetBridgeModalProps> = ({
  role,
  roomCode,
  isConnected,
  latencyMs,
  onClose,
  onSendTestPing
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);
  const [customAddressInput, setCustomAddressInput] = useState<string>('');
  const [roomStatus, setRoomStatus] = useState<any>(null);
  const [quality, setQuality] = useState<ConnectionQuality>(() => athleticsNetwork.getConnectionQuality());

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const myAddress = athleticsNetwork.myAddress;
  const sessionToken = athleticsNetwork.sessionToken;
  const tokenParam = sessionToken ? `&token=${encodeURIComponent(sessionToken)}` : '';

  const startAddress = `APF-START-${roomCode}`;
  const finishAddress = `APF-FINISH-${roomCode}`;
  const judgeAddress = `APF-JUDGE-${roomCode}`;
  const chambreAddress = `APF-CALLROOM-${roomCode}`;

  const startUrl = `${origin}/?role=start&room=${roomCode}${tokenParam}`;
  const finishUrl = `${origin}/?role=finish&room=${roomCode}${tokenParam}`;
  const judgeUrl = `${origin}/?role=judge&room=${roomCode}${tokenParam}`;
  const chambreUrl = `${origin}/?role=chambre_dappel&room=${roomCode}${tokenParam}`;

  // تحديث حالة الأجهزة المتصلة وجودة الشبكة بشكل دوري
  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      const status = await athleticsNetwork.fetchRoomStatus();
      if (isMounted) {
        if (status) setRoomStatus(status);
        setQuality(athleticsNetwork.getConnectionQuality());
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [roomCode]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleConnectToAll = () => {
    setIsConnecting(true);
    setConnectMessage('جاري محاولة ربط الهواتف معاً...');
    athleticsNetwork.connectToAllTargets();
    setTimeout(() => {
      setIsConnecting(false);
      setConnectMessage('تم تحديث اتصالات الجسر السحابي والمحلي!');
      setTimeout(() => setConnectMessage(null), 3000);
    }, 1200);
  };

  const handleConnectToCustom = () => {
    if (!customAddressInput.trim()) return;
    setIsConnecting(true);
    athleticsNetwork.connectToTargetAddress(customAddressInput.trim());
    setConnectMessage(`جاري إرسال طلب الربط إلى: ${customAddressInput.toUpperCase()}...`);
    setTimeout(() => {
      setIsConnecting(false);
      setConnectMessage('تم إرسال طلب الربط، بانتظار استجابة الهاتف.');
      setTimeout(() => setConnectMessage(null), 3000);
    }, 1500);
  };

  // تحديد ما إذا كان كل هاتف متصلاً
  const isStartOnline = roomStatus?.hasStart || athleticsNetwork.hasStartPhone || role === 'start';
  const isFinishOnline = roomStatus?.hasFinish || athleticsNetwork.hasFinishPhone || role === 'finish';
  const isJudgeOnline = roomStatus?.hasJudge || athleticsNetwork.hasJudgePhone || role === 'judge';
  const isChambreOnline = roomStatus?.hasChambre || athleticsNetwork.hasChambrePhone || role === 'chambre_dappel';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl animate-scaleUp my-auto">
        {/* رأس النافذة */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-inner">
              <Globe className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-2">
                <span>جسر الربط والمزامنة الثلاثية الفورية</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                  غرفة: {roomCode}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                ربط هاتف البداية 🚦، كاميرا النهاية 📸، وهاتف التحكيم ⚖️ عبر الواي فاي أو شبكات 4G/5G
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* محتوى النافذة */}
        <div className="p-4 sm:p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
          {/* مؤشر حالة الجسر وطبقة الاتصال الرئيسية */}
          <div className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
            isConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
              <div>
                <div className="font-black text-xs sm:text-sm flex items-center gap-2">
                  <span>{isConnected ? '🟢 الجسر متصل ونشط' : '🟡 بانتظار اتصال الهواتف المقترنة'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900/80 font-mono font-normal text-slate-300 border border-slate-700">
                    {athleticsNetwork.localWsConnected
                      ? '⚡ خادم محلي فائق السرعة (WS)'
                      : athleticsNetwork.connectionMode === 'dual_sync'
                      ? 'مزامنة مزدوجة (محلي + سحابي)'
                      : athleticsNetwork.connectionMode === 'local_hub'
                      ? 'خادم محلي فائق السرعة'
                      : athleticsNetwork.connectionMode === 'internet_bridge'
                      ? 'جسر إنترنت سحابي P2P'
                      : 'بانتظار الربط'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono">
                  {isConnected
                    ? `كمون النبضة: ${latencyMs}ms • فارق الساعات NTP: ${quality.clockOffset}ms • دقة التوقيت: ${quality.syncAccuracy}`
                    : 'يمكنك فتح الروابط المباشرة أدناه في الهواتف الأخرى للربط الفوري'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onSendTestPing && (
                <button
                  type="button"
                  onClick={onSendTestPing}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-yellow-300 border border-slate-600 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow"
                  title="إرسال نبضة فحص التزامن"
                >
                  <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span>فحص النبضة</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleConnectToAll}
                disabled={isConnecting}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow disabled:opacity-50"
                title="إعادة محاولة الربط بجميع الهواتف"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                <span>تحديث الربط</span>
              </button>
            </div>
          </div>

          {/* لوحة جودة الشبكة متعددة الطبقات (Multi-Layer Diagnostic Matrix) */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>طبقات الاتصال وجودة المزامنة الفورية:</span>
              </span>
              {sessionToken && (
                <span className="text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Key className="w-3 h-3 text-cyan-400" />
                  <span>جلسة: {sessionToken.substring(0, 8)}...</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* طبقة 1: WebSocket المحلي */}
              <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                quality.localWsConnected
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-cyan-400" />
                    <span>WS المحلي</span>
                  </span>
                  <span className={`w-2 h-2 rounded-full ${quality.localWsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                </div>
                <div className="mt-1.5">
                  <div className="font-mono text-sm font-black text-white">
                    {quality.localWsConnected ? `${quality.localWsLatency}ms` : 'غير متصل'}
                  </div>
                  <div className="text-[9px] text-slate-400">الأولوية 1 (1-3ms)</div>
                </div>
              </div>

              {/* طبقة 2: MQTT السحابي */}
              <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                quality.mqttConnected
                  ? 'bg-blue-950/30 border-blue-500/40 text-blue-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="flex items-center gap-1">
                    <Radio className="w-3 h-3 text-blue-400" />
                    <span>سحابة MQTT</span>
                  </span>
                  <span className={`w-2 h-2 rounded-full ${quality.mqttConnected ? 'bg-blue-400' : 'bg-slate-600'}`} />
                </div>
                <div className="mt-1.5">
                  <div className="font-mono text-sm font-black text-white">
                    {quality.mqttConnected ? `${quality.mqttLatency}ms` : 'احتياطي'}
                  </div>
                  <div className="text-[9px] text-slate-400">4G/5G عن بعد</div>
                </div>
              </div>

              {/* طبقة 3: WebRTC P2P */}
              <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                quality.webRtcPeers > 0
                  ? 'bg-purple-950/30 border-purple-500/40 text-purple-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-purple-400" />
                    <span>WebRTC</span>
                  </span>
                  <span className={`w-2 h-2 rounded-full ${quality.webRtcPeers > 0 ? 'bg-purple-400' : 'bg-slate-600'}`} />
                </div>
                <div className="mt-1.5">
                  <div className="font-mono text-sm font-black text-white">
                    {quality.webRtcPeers} أقران
                  </div>
                  <div className="text-[9px] text-slate-400">اتصال P2P مشفر</div>
                </div>
              </div>

              {/* طبقة 4: مزامنة التوقيت NTP */}
              <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                quality.syncAccuracy === 'excellent'
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : quality.syncAccuracy === 'good'
                  ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-300'
                  : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
              }`}>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>دقة NTP</span>
                  </span>
                  <span className="text-[9px] font-mono">
                    {quality.syncAccuracy === 'excellent' ? 'ممتاز ⭐' : quality.syncAccuracy === 'good' ? 'جيد ✅' : 'متوسط'}
                  </span>
                </div>
                <div className="mt-1.5">
                  <div className="font-mono text-sm font-black text-white">
                    {quality.clockOffset >= 0 ? `+${quality.clockOffset}` : quality.clockOffset}ms
                  </div>
                  <div className="text-[9px] text-slate-400">انحراف ساعة الحائط</div>
                </div>
              </div>
            </div>
          </div>

          {connectMessage && (
            <div className="text-xs text-cyan-300 font-bold bg-cyan-500/10 p-2.5 rounded-xl border border-cyan-500/20 animate-fadeIn flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{connectMessage}</span>
            </div>
          )}

          {/* عنوان هذا الهاتف (This Device Identity) */}
          <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>هذا الهاتف مخصص كـ:</span>
              </span>
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                role === 'start'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : role === 'finish'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : role === 'judge'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
              }`}>
                {role === 'start' ? '🚦 هاتف 1 (مسدس البداية)' : role === 'finish' ? '📸 هاتف 2 (كاميرا النهاية)' : role === 'judge' ? '⚖️ هاتف 3 (التحكيم وإحصاء النتائج)' : '📋 هاتف 4 (غرفة النداء والقوائم)'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-900 border border-cyan-500/40 rounded-xl p-2.5 font-mono text-center font-black text-amber-300 text-sm tracking-wider select-all">
                {myAddress}
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(myAddress, 'my_addr')}
                className="py-2.5 px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition-all cursor-pointer shrink-0"
              >
                {copiedKey === 'my_addr' ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKey === 'my_addr' ? 'تم النسخ!' : 'نسخ العنوان'}</span>
              </button>
            </div>
          </div>

          {/* لوحة الهواتف الثلاثة والروابط المباشرة (Triple-Phone Matrix) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-amber-400" />
                <span>حالة وروابط الهواتف الثلاثة في السباق:</span>
              </span>
              <span className="text-[10px] text-slate-400">
                افتح الرابط في الهاتف المطلوب ليتم ربطه تلقائياً
              </span>
            </div>

            {/* زر مسح الباركود السريع للهواتف */}
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-cyan-600/30 via-blue-600/30 to-indigo-600/30 hover:from-cyan-600/50 hover:to-indigo-600/50 border border-cyan-500/40 text-cyan-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>مسح باركود QR للهواتف (بدون كتابة أو تنصيب) 📲</span>
            </button>

            <div className="grid grid-cols-1 gap-2.5">
              {/* بطاقة هاتف 1: البداية (START) */}
              <div className={`p-3 rounded-2xl border transition-all ${
                role === 'start'
                  ? 'bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                  : isStartOnline
                  ? 'bg-slate-950/70 border-emerald-500/30'
                  : 'bg-slate-950/50 border-slate-800'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30">
                      <Flag className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <span>الهاتف 1: هاتف البداية (START)</span>
                        {role === 'start' && (
                          <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                            هذا الهاتف
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        العنوان: {startAddress}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                      isStartOnline
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isStartOnline ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                      <span>{isStartOnline ? 'متصل 🟢' : 'بانتظار الاتصال ⚪'}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(startUrl, 'url_start')}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                      title="نسخ رابط هاتف البداية وفتحه على الهاتف الآخر"
                    >
                      {copiedKey === 'url_start' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      <span>{copiedKey === 'url_start' ? 'تم نسخ الرابط!' : 'نسخ رابط هاتف 1'}</span>
                    </button>

                    {role !== 'start' && (
                      <button
                        type="button"
                        onClick={() => athleticsNetwork.connectToTargetAddress(startAddress)}
                        className="px-2 py-1 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition-all cursor-pointer"
                        title="محاولة الربط المباشر مع هاتف البداية"
                      >
                        ربط 🔗
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* بطاقة هاتف 2: النهاية والكاميرا (FINISH) */}
              <div className={`p-3 rounded-2xl border transition-all ${
                role === 'finish'
                  ? 'bg-cyan-950/30 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                  : isFinishOnline
                  ? 'bg-slate-950/70 border-cyan-500/30'
                  : 'bg-slate-950/50 border-slate-800'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs border border-cyan-500/30">
                      <Camera className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <span>الهاتف 2: كاميرا خط النهاية (FINISH)</span>
                        {role === 'finish' && (
                          <span className="text-[9px] bg-cyan-500/30 text-cyan-300 px-1.5 py-0.2 rounded font-bold">
                            هذا الهاتف
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        العنوان: {finishAddress}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                      isFinishOnline
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isFinishOnline ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'}`} />
                      <span>{isFinishOnline ? 'متصل 🟢' : 'بانتظار الاتصال ⚪'}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(finishUrl, 'url_finish')}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                      title="نسخ رابط هاتف كاميرا النهاية وفتحه على الهاتف الآخر"
                    >
                      {copiedKey === 'url_finish' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      <span>{copiedKey === 'url_finish' ? 'تم نسخ الرابط!' : 'نسخ رابط هاتف 2'}</span>
                    </button>

                    {role !== 'finish' && (
                      <button
                        type="button"
                        onClick={() => athleticsNetwork.connectToTargetAddress(finishAddress)}
                        className="px-2 py-1 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold transition-all cursor-pointer"
                        title="محاولة الربط المباشر مع كاميرا النهاية"
                      >
                        ربط 🔗
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* بطاقة هاتف 3: التحكيم وإحصاء النتائج (JUDGE) */}
              <div className={`p-3 rounded-2xl border transition-all ${
                role === 'judge'
                  ? 'bg-amber-950/30 border-amber-500/50 shadow-md shadow-amber-500/10'
                  : isJudgeOnline
                  ? 'bg-slate-950/70 border-amber-500/30'
                  : 'bg-slate-950/50 border-slate-800'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-500/30">
                      <Award className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <span>الهاتف 3: غرفة التحكيم وإحصاء النتائج (CHIEF JUDGE)</span>
                        {role === 'judge' && (
                          <span className="text-[9px] bg-amber-500/30 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                            هذا الهاتف
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        العنوان: {judgeAddress}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                      isJudgeOnline
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isJudgeOnline ? 'bg-amber-400 animate-ping' : 'bg-slate-500'}`} />
                      <span>{isJudgeOnline ? 'متصل 🟢' : 'بانتظار الاتصال ⚪'}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(judgeUrl, 'url_judge')}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                      title="نسخ رابط هاتف التحكيم وفتحه على الهاتف الآخر"
                    >
                      {copiedKey === 'url_judge' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      <span>{copiedKey === 'url_judge' ? 'تم نسخ الرابط!' : 'نسخ رابط هاتف 3'}</span>
                    </button>

                    {role !== 'judge' && (
                      <button
                        type="button"
                        onClick={() => athleticsNetwork.connectToTargetAddress(judgeAddress)}
                        className="px-2 py-1 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 text-[10px] font-bold transition-all cursor-pointer"
                        title="محاولة الربط المباشر مع هاتف التحكيم"
                      >
                        ربط 🔗
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* بطاقة هاتف 4: غرفة النداء وتسجيل القوائم (CHAMBRE D'APPEL) */}
              <div className={`p-3 rounded-2xl border transition-all ${
                role === 'chambre_dappel'
                  ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                  : isChambreOnline
                  ? 'bg-slate-950/70 border-indigo-500/30'
                  : 'bg-slate-950/50 border-slate-800'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/30">
                      <ClipboardList className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <span>الهاتف 4: غرفة النداء وتسجيل القوائم (CALL ROOM)</span>
                        {role === 'chambre_dappel' && (
                          <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded font-bold">
                            هذا الهاتف
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        العنوان: {chambreAddress}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                      isChambreOnline
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isChambreOnline ? 'bg-indigo-400 animate-ping' : 'bg-slate-500'}`} />
                      <span>{isChambreOnline ? 'متصل 🟢' : 'بانتظار الاتصال ⚪'}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(chambreUrl, 'url_chambre')}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                      title="نسخ رابط هاتف غرفة النداء وفتحه على الهاتف الآخر"
                    >
                      {copiedKey === 'url_chambre' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      <span>{copiedKey === 'url_chambre' ? 'تم نسخ الرابط!' : 'نسخ رابط هاتف 4'}</span>
                    </button>

                    {role !== 'chambre_dappel' && (
                      <button
                        type="button"
                        onClick={() => athleticsNetwork.connectToTargetAddress(chambreAddress)}
                        className="px-2 py-1 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold transition-all cursor-pointer"
                        title="محاولة الربط المباشر مع غرفة النداء"
                      >
                        ربط 🔗
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ربط يدوي بعنوان مخصص (Custom Target Registration) */}
          <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-2xl space-y-2">
            <span className="font-bold text-slate-400 text-[11px] block">
              ربط يدوي بعنوان مخصص (إذا كان أحد الهواتف يستخدم معرفاً بديلاً):
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customAddressInput}
                onChange={(e) => setCustomAddressInput(e.target.value.toUpperCase())}
                placeholder="مثال: APF-JUDGE-RACE-2026 أو معرف مخصص..."
                className="flex-1 bg-slate-900 border border-slate-700 focus:border-cyan-400 text-white font-mono font-bold text-xs rounded-xl py-2 px-3 outline-none"
              />
              <button
                type="button"
                disabled={isConnecting || !customAddressInput.trim()}
                onClick={handleConnectToCustom}
                className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer shrink-0"
              >
                <span>ربط بالمعرف</span>
              </button>
            </div>
          </div>

          {/* مزايا وإرشادات الربط في الملاعب */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-1.5 text-[11px] text-slate-400">
            <div className="font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>كيف تضمن ربطاً فورياً وناجحاً 100% بين الهواتف الثلاثة:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[10px] text-slate-400 pr-1 leading-relaxed">
              <li><strong>على شبكة Wi-Fi أو نقطة اتصال الهاتف (Hotspot):</strong> يعمل خادم الترحيل المحلي بزمن استجابة أقل من 3 مللي ثانية وبث مباشر لجميع الأجهزة دون استهلاك إنترنت.</li>
              <li><strong>عبر بيانات الهاتف (4G / 5G):</strong> يعمل جسر WebRTC السحابي المدعوم بخوادم STUN/TURN الدولية للربط بين الهواتف على مسافات 100م إلى 1500م.</li>
              <li>اضغط <strong>"نسخ رابط هاتف 1"</strong> أو <strong>"نسخ رابط هاتف 2"</strong> أو <strong>"نسخ رابط هاتف 3"</strong> وأرسله للهواتف الأخرى لتفتح فوراً على الدور الصحيح بنفس رمز الغرفة!</li>
            </ul>
          </div>
        </div>

        {/* أسفل النافذة */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
          <div className="text-[11px] text-slate-400 font-mono">
            نظام المزامنة الثلاثية الأولمبي • Photo Finish Pro
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* نافذة مسح الباركود للهواتف */}
      {showQrModal && (
        <PhoneQrModal
          roomCode={roomCode}
          defaultRole={role}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </div>
  );
};
