import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowLeftRight, 
  Smartphone, 
  AlertTriangle, 
  Copy, 
  Check, 
  Download,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { licenseManager, StoredLicense } from '../services/licenseManager';
import { LicenseTransferTicket } from '../types/race';

interface LicenseTransferModalProps {
  onClose: () => void;
  onLicenseChanged?: () => void;
}

export const LicenseTransferModal: React.FC<LicenseTransferModalProps> = ({
  onClose,
  onLicenseChanged
}) => {
  const [activeTab, setActiveTab] = useState<'transfer_out' | 'receive_in'>('transfer_out');
  const [activeLicense, setActiveLicense] = useState<StoredLicense | null>(licenseManager.activeLicense);
  const [myDeviceId] = useState<string>(licenseManager.deviceId);
  
  // حقول التحويل إلى جهاز آخر
  const [targetDeviceId, setTargetDeviceId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [transferTicket, setTransferTicket] = useState<LicenseTransferTicket | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copiedVoucher, setCopiedVoucher] = useState<boolean>(false);

  // حقول استقبال ترخيص منقول
  const [incomingVoucher, setIncomingVoucher] = useState<string>('');
  const [isActivatingIncoming, setIsActivatingIncoming] = useState<boolean>(false);
  const [receiveSuccessMsg, setReceiveSuccessMsg] = useState<string>('');
  const [receiveErrorMsg, setReceiveErrorMsg] = useState<string>('');

  useEffect(() => {
    const unsub = licenseManager.subscribe(() => {
      setActiveLicense(licenseManager.activeLicense);
    });
    return () => {
      unsub();
    };
  }, []);

  const handleStartTransfer = async () => {
    setErrorMessage('');
    if (!targetDeviceId.trim()) {
      setErrorMessage('يرجى كتابة معرّف الهاتف الهدف (Target Device ID) الذي تريد نقل التفعيل إليه.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await licenseManager.createTransferTicket(targetDeviceId);
      if (res.success && res.ticket) {
        setTransferTicket(res.ticket);
        if (onLicenseChanged) onLicenseChanged();
      } else {
        setErrorMessage(res.message);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'حدث خطأ أثناء إجراء عملية النقل.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActivateIncoming = async () => {
    setReceiveErrorMsg('');
    setReceiveSuccessMsg('');
    if (!incomingVoucher.trim()) {
      setReceiveErrorMsg('يرجى إدخال كود النقل المستلم (TRF1-...).');
      return;
    }

    setIsActivatingIncoming(true);
    try {
      const res = await licenseManager.activateCode(incomingVoucher);
      if (res.success) {
        setReceiveSuccessMsg(res.message);
        if (onLicenseChanged) onLicenseChanged();
      } else {
        setReceiveErrorMsg(res.message);
      }
    } catch (e: any) {
      setReceiveErrorMsg(e?.message || 'فشل تفعيل كود النقل.');
    } finally {
      setIsActivatingIncoming(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVoucher(true);
    setTimeout(() => setCopiedVoucher(false), 2500);
  };

  const qrCodeUrl = transferTicket
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(transferTicket.voucherCode)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* رأس النافذة */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-inner">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>تحويل ونقل الترخيص إلى هاتف آخر</span>
                <span className="text-[9px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full border border-red-500/30">
                  منع الازدواجية 🛡️
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                نقل المدة المتبقية مع إبطال فوري للهاتف الأول وتثبيته في الهاتف الجديد
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* أزرار التبويب */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('transfer_out')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'transfer_out'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>نقل الترخيص من هذا الهاتف</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('receive_in')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'receive_in'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>استقبال ترخيص منقول بهذا الهاتف</span>
          </button>
        </div>

        {/* المحتوى */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* ══════════════════════════════════════
              التبويب 1: نقل الترخيص إلى هاتف آخر
          ══════════════════════════════════════ */}
          {activeTab === 'transfer_out' && (
            <div className="space-y-4">
              {/* بطاقة معلومات هذا الهاتف */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400">معرّف هذا الهاتف الحالي (المصدر):</p>
                  <p className="text-sm font-mono font-bold text-cyan-400">{myDeviceId}</p>
                </div>
                <div className="text-end">
                  <p className="text-[10px] text-slate-400">حالة الاشتراك الحالي:</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    activeLicense 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {activeLicense ? activeLicense.tierName : 'نسخة تجريبية (لا يوجد ترخيص مدفوع)'}
                  </span>
                </div>
              </div>

              {!transferTicket ? (
                <>
                  {activeLicense ? (
                    <div className="space-y-4">
                      {/* تنبيه منع الازدواجية والحرق الفوري */}
                      <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-3.5 text-amber-200 space-y-1.5 text-xs">
                        <div className="flex items-center gap-2 font-bold text-amber-300">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>قاعدة الأمان الرياضي: شرط عدم تفعيل كود واحد في هاتفين</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          عند تأكيد النقل، سيتم <strong>إبطال الترخيص وحرقه في هذا الهاتف فوراً</strong> ليعود للوضع التجريبي، 
                          وسيتم توليد كود وتوقيع رقمي مخصص مشفر يرتبط بمعرف الهاتف الجديد فقط، مع الحفاظ الكامل على المدة المتبقية.
                        </p>
                      </div>

                      {/* حقل إدخال معرف الجهاز الهدف */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                          <span>أدخل معرّف الهاتف الجديد المراد نقل التفعيل إليه:</span>
                        </label>
                        <input
                          type="text"
                          value={targetDeviceId}
                          onChange={(e) => setTargetDeviceId(e.target.value.toUpperCase())}
                          placeholder="مثال: PF-9C3E-11B4"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 text-white font-mono font-bold text-center tracking-widest text-base rounded-xl py-2.5 px-3 outline-none uppercase placeholder:text-slate-600"
                        />
                        <p className="text-[10px] text-slate-400">
                          يمكنك معرفة معرّف الجهاز الهدف من شاشة الهاتف الآخر في تطبيق Photo Finish Pro.
                        </p>
                      </div>

                      {errorMessage && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                          {errorMessage}
                        </div>
                      )}

                      {/* زر تنفيذ النقل */}
                      <button
                        type="button"
                        onClick={handleStartTransfer}
                        disabled={isProcessing}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 via-amber-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-orange-600/20 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Flame className="w-4 h-4" />
                        <span>{isProcessing ? 'جاري التشفير والإبطال...' : 'إبطال الترخيص في هذا الهاتف ونقله الآن ⚡'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400 space-y-2">
                      <p className="font-bold text-slate-300">لا يوجد ترخيص مدفوع نشط في هذا الهاتف</p>
                      <p className="text-xs">
                        هذا الهاتف يعمل حالياً بالنسخة التجريبية. لنقل اشتراك، يجب أن يكون هناك كود مدفوع مفعل مسبقاً.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                /* بطاقة نجاح النقل وإبراز كود الـ QR وكود النقل */
                <div className="space-y-4 bg-slate-950/80 border border-emerald-500/40 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تم إبطال الترخيص في هذا الهاتف وتوليد شهادة النقل المشفرة بنجاح!</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-slate-400">كود النقل المخصص للهاتف الجديد:</p>
                    <p className="text-base font-black font-mono text-amber-300 tracking-wider break-all select-all">
                      {transferTicket.voucherCode}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>المدة المتبقية المنقولة: <strong>{transferTicket.remainingDays} يوماً</strong></span>
                      <span>صالح لغاية: <strong>{transferTicket.expiryDate}</strong></span>
                    </div>
                  </div>

                  {qrCodeUrl && (
                    <div className="flex flex-col items-center justify-center pt-1">
                      <div className="bg-white p-2.5 rounded-2xl shadow-md border-2 border-emerald-500/40 inline-block">
                        <img 
                          src={qrCodeUrl} 
                          alt="Transfer QR Code" 
                          className="w-36 h-36 object-contain"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                        امسح هذا الباركود من كاميرا الهاتف الهدف ({transferTicket.targetDeviceId}) لتفعيله فورياً
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(transferTicket.voucherCode)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                    >
                      {copiedVoucher ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedVoucher ? 'تم نسخ كود النقل!' : 'نسخ كود النقل'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════
              التبويب 2: استقبال ترخيص منقول بهذا الهاتف
          ══════════════════════════════════════ */}
          {activeTab === 'receive_in' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                <p className="text-[10px] text-slate-400">معرّف هذا الهاتف لاستقبال الترخيص:</p>
                <div className="flex items-center justify-between">
                  <p className="text-base font-mono font-bold text-amber-300">{myDeviceId}</p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(myDeviceId)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  أعطِ هذا المعرف للهاتف الذي يريد نقل الترخيص إليك.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ألصق كود النقل المستلم (TRF1-...):</span>
                </label>
                <textarea
                  value={incomingVoucher}
                  onChange={(e) => setIncomingVoucher(e.target.value.toUpperCase())}
                  placeholder="TRF1-CLB8-2712-XXXX-XXXXXX"
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white font-mono font-bold text-sm rounded-xl p-3 outline-none uppercase placeholder:text-slate-600"
                />
              </div>

              {receiveErrorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                  {receiveErrorMsg}
                </div>
              )}

              {receiveSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{receiveSuccessMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleActivateIncoming}
                disabled={isActivatingIncoming}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-cyan-600/20 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{isActivatingIncoming ? 'جاري التحقق...' : 'تفعيل الترخيص المنقول في هذا الهاتف ⚡'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
