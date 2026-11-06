import React, { useState } from 'react';
import { 
  X, 
  QrCode, 
  Flag, 
  Camera, 
  Award, 
  Copy, 
  Check, 
  ExternalLink, 
  Users,
  Radio
} from 'lucide-react';
import { PhoneRole } from '../types/race';
import { athleticsNetwork } from '../services/networkService';

interface PhoneQrModalProps {
  roomCode: string;
  onClose: () => void;
  defaultRole?: PhoneRole;
}

export const PhoneQrModal: React.FC<PhoneQrModalProps> = ({
  roomCode,
  onClose,
  defaultRole = 'finish'
}) => {
  const [selectedRole, setSelectedRole] = useState<'start' | 'finish' | 'judge' | 'chambre_dappel'>(
    (defaultRole === 'start' || defaultRole === 'judge' || defaultRole === 'chambre_dappel') 
      ? defaultRole 
      : 'finish'
  );
  const [copied, setCopied] = useState<boolean>(false);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const sessionToken = athleticsNetwork.sessionToken;
  const tokenParam = sessionToken ? `&token=${encodeURIComponent(sessionToken)}` : '';
  const roleUrl = `${currentOrigin}/?role=${selectedRole}&room=${roomCode}${tokenParam}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(roleUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(roleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-scaleUp my-auto">
        {/* ترويسة النافذة */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-inner">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-2">
                <span>ربط الهواتف بمسح الباركود (QR Code)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  يعمل عبر 4G فوري ⚡
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                امسح الباركود بكاميرا أي هاتف لفتحه فوراً والانضمام لنفس السباق
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 text-xs">
          {/* تبويبات اختيار دور الهاتف الأربعة */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setSelectedRole('start')}
              className={`py-2 px-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                selectedRole === 'start'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>1. البداية 🚦</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('finish')}
              className={`py-2 px-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                selectedRole === 'finish'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>2. النهاية 📸</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('judge')}
              className={`py-2 px-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                selectedRole === 'judge'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>3. التحكيم ⚖️</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('chambre_dappel')}
              className={`py-2 px-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                selectedRole === 'chambre_dappel'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>4. غرفة النداء 📋</span>
            </button>
          </div>

          {/* الباركود المعروض في المنتصف */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative p-3.5 bg-white rounded-3xl shadow-2xl border-4 border-slate-800 group">
              <img
                src={qrApiUrl}
                alt={`QR Code for ${selectedRole}`}
                className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-xl"
              />
              <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                <span className="text-white text-xs font-bold bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700">
                  وجّه الكاميرا للباركود 📷
                </span>
              </div>
            </div>

            <div className="mt-2.5 text-center">
              <div className="font-bold text-white text-xs flex items-center justify-center gap-1.5">
                <span>الدور المستهدف بالباركود: </span>
                <strong className={
                  selectedRole === 'start' ? 'text-emerald-400' :
                  selectedRole === 'finish' ? 'text-cyan-400' :
                  selectedRole === 'judge' ? 'text-amber-400' : 'text-indigo-400'
                }>
                  {selectedRole === 'start' && 'هاتف البداية (Start Gun) 🚦'}
                  {selectedRole === 'finish' && 'كاميرا خط النهاية (Photo Finish) 📸'}
                  {selectedRole === 'judge' && 'غرفة التحكيم وإحصاء النتائج ⚖️'}
                  {selectedRole === 'chambre_dappel' && 'غرفة النداء وتسجيل القوائم 📋'}
                </strong>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex flex-wrap items-center justify-center gap-2">
                <span>رمز الغرفة: <strong className="text-amber-300 font-bold">{roomCode}</strong></span>
                {sessionToken && (
                  <span className="text-[9px] bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded border border-slate-700">
                    رمز الجلسة: <span className="font-mono">{sessionToken.substring(0, 8)}...</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* معلومات شبكة 4G والاتصال الذكي */}
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span className="flex items-center gap-1 text-emerald-400">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>اتصال 4G سحابي فوري (MQTT Cloud Broker):</span>
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                مضمون 100% بدون إعدادات
              </span>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              بفضل بروتوكول MQTT السحابي المدمج، تعمل الهواتف الأربعة حتى لو كان كل هاتف متصلاً بشبكة 4G مختلفة (Ooredoo، Mobilis، Djezzy) أو Wi-Fi دون الحاجة لأي راوتر أو إعدادات شبكة!
            </p>

            {/* صندوق الرابط مع زر النسخ والفتح */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl p-1.5">
              <input
                type="text"
                readOnly
                value={roleUrl}
                className="bg-transparent flex-1 text-slate-300 font-mono text-[10px] outline-none px-1 select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'تم النسخ!' : 'نسخ الرابط'}</span>
              </button>
              <a
                href={roleUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="فتح في تبويب جديد"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-950/70 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
