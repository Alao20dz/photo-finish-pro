import React, { useState, useEffect } from 'react';
import { 
  X, 
  Crown, 
  Key, 
  Smartphone, 
  Copy, 
  Check, 
  ShieldCheck, 
  Trash2, 
  Share2, 
  Sparkles, 
  Activity, 
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { PhoneRole } from '../types/race';
import { licenseManager } from '../services/licenseManager';

interface AdminDashboardModalProps {
  roomCode: string;
  onClose: () => void;
  onSelectRole?: (role: PhoneRole) => void;
}

interface StoredLicense {
  id: string;
  code: string;
  tier: 'CLB8' | 'ENTX';
  tierName: string;
  clientName: string;
  deviceId: string;
  expiryDate: string;
  createdAt: string;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  roomCode,
  onClose,
  onSelectRole
}) => {
  const [activeTab, setActiveTab] = useState<'generator' | 'ledger' | 'preview' | 'network'>('generator');

  // حقول توليد الترخيص
  const [clientName, setClientName] = useState<string>('نادي الوفاق لألعاب القوى');
  const [tier, setTier] = useState<'CLB8' | 'ENTX'>('CLB8');
  const [durationMonths, setDurationMonths] = useState<number>(12);
  const [deviceIdInput, setDeviceIdInput] = useState<string>('GLOBAL');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedMsg, setCopiedMsg] = useState<boolean>(false);

  // سجل التراخيص
  const [licenseLedger, setLicenseLedger] = useState<StoredLicense[]>(() => {
    try {
      const saved = localStorage.getItem('pf_admin_license_ledger');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // محاكي الهاتف
  const [simRole, setSimRole] = useState<'start' | 'finish' | 'judge' | 'chambre_dappel'>('start');
  const [simLicenseActive, setSimLicenseActive] = useState<boolean>(false);
  const [simInputCode, setSimInputCode] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem('pf_admin_license_ledger', JSON.stringify(licenseLedger));
    } catch (e) {}
  }, [licenseLedger]);

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + durationMonths);
    const expDateStr = expDate.toISOString().split('T')[0];

    const code = await licenseManager.generateLicenseKey(tier, expDate, {
      targetDeviceId: deviceIdInput,
      clientName
    });
    setGeneratedCode(code);
    setIsGenerating(false);

    // إضافة إلى السجل
    const newEntry: StoredLicense = {
      id: `lic-${Date.now()}`,
      code,
      tier,
      tierName: tier === 'ENTX' ? 'رخصة الاتحادات الرسمية (Enterprise)' : 'باقة الأندية المعتمدة (Pro Club 8L)',
      clientName: clientName.trim() || 'مشترك جديد',
      deviceId: deviceIdInput.trim() || 'GLOBAL',
      expiryDate: expDateStr,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setLicenseLedger(prev => [newEntry, ...prev]);
  };

  const copyCodeOnly = (codeToCopy: string) => {
    navigator.clipboard.writeText(codeToCopy);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const copyWhatsAppMessage = (lic: { code: string; client: string; exp: string; tierName: string }) => {
    const text = `🏆 *منظومة PHOTO FINISH PRO لألعاب القوى* 🏆\n\nأهلاً بك كابتن *${lic.client}*،\nتم تفعيل اشتراككم بنجاح في:\n⭐ *${lic.tierName}*\n\n🔑 كود التفعيل المخصص لجهازكم:\n👉 \`${lic.code}\` 👈\n\n📅 صالح لغاية: ${lic.exp}\n\n*طريقة التفعيل:* افتح تطبيق الهاتف > اضغط على أيقونة الترقية 👑 أعلى الشاشة > ألصق الكود واضغط تفعيل.\nنتمنى لكم مواسم رياضية وبطولات ناجحة! 🏁`;
    navigator.clipboard.writeText(text);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2500);
  };

  const deleteLicense = (id: string) => {
    setLicenseLedger(prev => prev.filter(l => l.id !== id));
  };

  // رابط الباركود QR لكود التفعيل
  const qrCodeUrl = generatedCode 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=10&data=${encodeURIComponent(generatedCode)}`
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-scaleUp my-auto">
        
        {/* ترويسة لوحة المدير */}
        <div className="bg-gradient-to-r from-slate-900 via-purple-950/80 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-white">
                  لوحة مدير التطبيق والتراخيص المشفرة
                </h3>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                  Admin Control Suite 👑
                </span>
              </div>
              <p className="text-xs text-slate-400">
                توليد أكواد التفعيل أوفلاين • إدارة الاشتراكات • محاكي الهاتف الذكي للمعاينة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* أزرار التبويبات */}
        <div className="flex items-center gap-1.5 px-4 pt-3 border-b border-slate-800 bg-slate-950/60 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('generator')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs transition-all border-b-2 cursor-pointer ${
              activeTab === 'generator'
                ? 'bg-slate-900 text-amber-400 border-amber-500 shadow-md'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>توليد كود ترخيص جديد</span>
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs transition-all border-b-2 cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-slate-900 text-purple-400 border-purple-500 shadow-md'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>سجل التراخيص الصادرة ({licenseLedger.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs transition-all border-b-2 cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-slate-900 text-cyan-400 border-cyan-500 shadow-md'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>محاكي الهاتف للمعاينة المباشرة 📱</span>
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs transition-all border-b-2 cursor-pointer ${
              activeTab === 'network'
                ? 'bg-slate-900 text-emerald-400 border-emerald-500 shadow-md'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>مراقبة الغرفة والشبكة ({roomCode})</span>
          </button>
        </div>

        {/* محتوى التبويبات */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/40">
          
          {/* ═══════════════════════════════════════════════
              التبويب 1: مولد التراخيص الرقمية المشفرة
          ═══════════════════════════════════════════════ */}
          {activeTab === 'generator' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* نموذج إدخال البيانات */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>بيانات الترخيص والمشترك</span>
                  </h4>

                  {/* اسم المشترك / النادي */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">اسم النادي / الجهة الرياضية:</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="مثال: نادي الوفاق لألعاب القوى"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* اختيار الباقة */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">نوع الباقة والميزات:</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setTier('CLB8')}
                        className={`p-3 rounded-xl border text-start transition-all cursor-pointer ${
                          tier === 'CLB8'
                            ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-amber-400">باقة الأندية (Pro Club)</span>
                          <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-300">8 مسارات</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight">بوابات ثلاثية + تقارير رسمية بدون علامة مائية</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTier('ENTX')}
                        className={`p-3 rounded-xl border text-start transition-all cursor-pointer ${
                          tier === 'ENTX'
                            ? 'bg-purple-500/15 border-purple-500 text-white shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-purple-400">رخصة الاتحادات (Enterprise)</span>
                          <span className="text-[10px] bg-purple-500/20 px-2 py-0.5 rounded text-purple-300">10 مسارات</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight">تدقيق 1/1000s + ختم رسمي + كافة الأجهزة مفتوحة</p>
                      </button>
                    </div>
                  </div>

                  {/* مدة الصلاحية */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">مدة صلاحية الترخيص:</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'شهر واحد', m: 1 },
                        { label: 'سنة كاملة 🏆', m: 12 },
                        { label: 'سنتان', m: 24 },
                        { label: 'دائم (10 سنوات)', m: 120 },
                      ].map((item) => (
                        <button
                          key={item.m}
                          type="button"
                          onClick={() => setDurationMonths(item.m)}
                          className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            durationMonths === item.m
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* معرّف الجهاز (Device ID) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">معرّف هاتف العميل (Device ID):</label>
                      <button
                        type="button"
                        onClick={() => setDeviceIdInput('GLOBAL')}
                        className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                      >
                        ترخيص عام لجميع الأجهزة (GLOBAL)
                      </button>
                    </div>
                    <input
                      type="text"
                      value={deviceIdInput}
                      onChange={(e) => setDeviceIdInput(e.target.value.toUpperCase())}
                      placeholder="مثال: PF-84A2-9F1B أو اتركه GLOBAL"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-center tracking-widest text-xs outline-none focus:border-cyan-500 uppercase"
                    />
                    <p className="text-[10px] text-slate-500">
                      💡 يظهر هذا المعرف في شاشة الترقية داخل هاتف العميل لربط الكود بهاتفه فقط ومنع إعادة بيعه.
                    </p>
                  </div>

                  {/* زر التوليد المشفر */}
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    disabled={isGenerating}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all cursor-pointer"
                  >
                    <Key className="w-4 h-4" />
                    <span>توليد كود التفعيل المشفر أوفلاين (HMAC-SHA256)</span>
                  </button>
                </div>
              </div>

              {/* بطاقة عرض النتيجة والكود المولد والباركود */}
              <div className="lg:col-span-5 space-y-4">
                {generatedCode ? (
                  <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تم توليد التوقيع الرقمي بنجاح</span>
                    </div>

                    {/* عرض الكود بخط عريض */}
                    <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-3.5 shadow-inner">
                      <p className="text-[10px] text-slate-400 mb-1">كود الترخيص الرياضي المعتمد:</p>
                      <p className="text-base sm:text-lg font-black font-mono text-amber-300 tracking-wider select-all">
                        {generatedCode}
                      </p>
                    </div>

                    {/* باركود QR للمسح من كاميرا الهاتف */}
                    {qrCodeUrl && (
                      <div className="flex flex-col items-center justify-center">
                        <div className="bg-white p-2.5 rounded-2xl shadow-md border-2 border-amber-500/40 inline-block">
                          <img 
                            src={qrCodeUrl} 
                            alt="License QR Code" 
                            className="w-36 h-36 object-contain"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          امسح الباركود مباشرة من كاميرا هاتف العميل للتفعيل الفوري
                        </p>
                      </div>
                    )}

                    {/* أزرار النسخ */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => copyCodeOnly(generatedCode)}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedCode ? 'تم نسخ الكود!' : 'نسخ الكود فقط'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => copyWhatsAppMessage({
                          code: generatedCode,
                          client: clientName,
                          exp: new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                          tierName: tier === 'ENTX' ? 'رخصة الاتحادات الرسمية (Enterprise)' : 'باقة الأندية المعتمدة (Pro Club)'
                        })}
                        className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        {copiedMsg ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                        <span>{copiedMsg ? 'تم نسخ الرسالة!' : 'نسخ رسالة واتساب'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center h-full min-h-[300px] text-slate-500 space-y-3">
                    <div className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-600">
                      <Key className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-300 text-sm">لم يتم توليد كود حتى الآن</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                        اختر الباقة والمدة ومعرف الجهاز ثم اضغط على زر التوليد ليظهر كود التفعيل ورمز الـ QR هنا فورياً.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              التبويب 2: سجل التراخيص الصادرة
          ═══════════════════════════════════════════════ */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  قائمة بجميع التراخيص التي أصدرتها المنظومة والمحفوظة في سجل الإدارة المحلي:
                </p>
                <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/30">
                  إجمالي التراخيص: {licenseLedger.length}
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3">كود الترخيص</th>
                        <th className="p-3">اسم العميل / النادي</th>
                        <th className="p-3">نوع الباقة</th>
                        <th className="p-3">معرّف الجهاز</th>
                        <th className="p-3">تاريخ الانتهاء</th>
                        <th className="p-3">الحالة</th>
                        <th className="p-3 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {licenseLedger.map((lic) => {
                        const isExpired = new Date(lic.expiryDate) < new Date();
                        return (
                          <tr key={lic.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 font-mono font-bold text-amber-300 tracking-wider">
                              {lic.code}
                            </td>
                            <td className="p-3 font-semibold text-white">
                              {lic.clientName}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                lic.tier === 'ENTX' 
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}>
                                {lic.tier === 'ENTX' ? 'Enterprise' : 'Pro Club'}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-cyan-400 text-[11px]">
                              {lic.deviceId}
                            </td>
                            <td className="p-3 font-mono text-slate-400">
                              {lic.expiryDate}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isExpired 
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/30' 
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              }`}>
                                {isExpired ? 'منتهي الصلاحية' : 'نشط وسارٍ 🟢'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => copyCodeOnly(lic.code)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                  title="نسخ الكود"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyWhatsAppMessage({
                                    code: lic.code,
                                    client: lic.clientName,
                                    exp: lic.expiryDate,
                                    tierName: lic.tierName
                                  })}
                                  className="p-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-colors cursor-pointer"
                                  title="نسخ رسالة واتساب"
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteLicense(lic.id)}
                                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/30 text-red-400 transition-colors cursor-pointer"
                                  title="حذف من السجل"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              التبويب 3: محاكي الهاتف الذكي للمعاينة (Simulator)
          ═══════════════════════════════════════════════ */}
          {activeTab === 'preview' && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="flex items-center justify-between w-full max-w-md">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  <span>معاينة شاشة تطبيق الهاتف التفاعلية:</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSimRole('start')}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${simRole === 'start' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                  >
                    البداية 🚦
                  </button>
                  <button
                    onClick={() => setSimRole('finish')}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${simRole === 'finish' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                  >
                    النهاية 📸
                  </button>
                  <button
                    onClick={() => setSimRole('judge')}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${simRole === 'judge' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                  >
                    الحكم ⚖️
                  </button>
                  <button
                    onClick={() => setSimRole('chambre_dappel')}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${simRole === 'chambre_dappel' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                  >
                    النداء 📋
                  </button>
                </div>
              </div>

              {/* هيكل هاتف ذكي واقعي (Smartphone Frame) */}
              <div className="relative w-[340px] sm:w-[370px] h-[640px] bg-slate-950 rounded-[48px] border-[6px] border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
                {/* النوتش العلوي (Phone Notch) */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-4 bg-slate-850 rounded-b-2xl z-40 flex items-center justify-center">
                  <div className="w-10 h-1 bg-slate-700 rounded-full"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700 me-2"></div>
                </div>

                {/* شاشة الهاتف الداخلية */}
                <div className="flex-1 bg-slate-950 pt-5 pb-3 px-3 flex flex-col overflow-y-auto">
                  {/* شريط معلومات الهاتف */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-2 px-1">
                    <span>09:41 ⚡</span>
                    <span className="text-cyan-400">PF-84A2-9F1B</span>
                    <span>100% 🔋</span>
                  </div>

                  {/* شارة الترقية داخل محاكي الهاتف */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 mb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Crown className={`w-4 h-4 ${simLicenseActive ? 'text-amber-400' : 'text-slate-400'}`} />
                      <div>
                        <p className="text-[11px] font-bold text-white">
                          {simLicenseActive ? 'باقة الأندية PRO مفعلة 🏆' : 'النسخة التجريبية (Free Trial)'}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          {simLicenseActive ? 'صالح لغاية: 2027-12-31 (8 مسارات)' : 'متبقي 14 يوماً • 4 مسارات'}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                      simLicenseActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {simLicenseActive ? 'مُعتمد' : 'ترقية 👑'}
                    </span>
                  </div>

                  {/* صندوق تجربة إدخال الكود داخل المحاكي */}
                  {!simLicenseActive ? (
                    <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-2.5 mb-3 space-y-2">
                      <p className="text-[10px] font-bold text-slate-200">جرّب تفعيل كود ترخيص داخل الهاتف:</p>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={simInputCode}
                          onChange={(e) => setSimInputCode(e.target.value.toUpperCase())}
                          placeholder="ألصق كود الاشتراك هنا"
                          className="flex-1 bg-slate-950 border border-slate-700 text-white font-mono text-[10px] rounded-lg px-2 py-1 text-center uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (simInputCode.trim()) {
                              setSimLicenseActive(true);
                            }
                          }}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] px-2.5 py-1 rounded-lg"
                        >
                          تفعيل
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-2 mb-3 flex items-center justify-between">
                      <span className="text-[10px] text-emerald-300 font-bold">✅ تم فتح كافة الميزات الاحترافية</span>
                      <button
                        type="button"
                        onClick={() => setSimLicenseActive(false)}
                        className="text-[9px] text-slate-400 hover:underline"
                      >
                        إعادة للوضع التجريبي
                      </button>
                    </div>
                  )}

                  {/* معاينة شاشة الدور المختار */}
                  <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                        <span className="font-bold text-xs text-white">
                          {simRole === 'start' ? '🚦 هاتف البداية (Starter)' : simRole === 'finish' ? '📸 كاميرا النهاية (Finish)' : simRole === 'judge' ? '⚖️ التحكيم الرسمي' : '📋 غرفة النداء'}
                        </span>
                        <span className="text-[9px] text-cyan-400 font-mono">غرفة: {roomCode}</span>
                      </div>

                      {simRole === 'start' && (
                        <div className="space-y-2 text-center pt-3">
                          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
                            <span className="text-[10px] text-slate-400">توقيت الساعة المركزية:</span>
                            <p className="text-xl font-mono font-bold text-amber-400">00:09.845</p>
                          </div>
                          <div className="py-2.5 px-3 rounded-xl bg-red-600 text-white font-black text-xs">
                            طلقة البداية 💥 BANG!
                          </div>
                          <p className="text-[10px] text-slate-400">الأوامر الصوتية: خذ مكانك • استعد • طلقة الاسترجاع</p>
                        </div>
                      )}

                      {simRole === 'finish' && (
                        <div className="space-y-2 text-center pt-2">
                          <div className="h-28 bg-slate-950 border border-cyan-500/30 rounded-xl flex items-center justify-center relative overflow-hidden">
                            <div className="absolute top-0 bottom-0 end-1/4 w-0.5 bg-cyan-400"></div>
                            <div className="absolute top-0 bottom-0 end-1/2 w-1 bg-red-500"></div>
                            <div className="absolute top-0 bottom-0 end-3/4 w-0.5 bg-purple-400"></div>
                            <span className="text-[10px] text-slate-500">معاينة البوابات الثلاثية (Cyan | Red | Purple)</span>
                          </div>
                          <p className="text-[10px] text-emerald-400 font-bold">تسجيل عبور المسارات L1 - L4 أوتوماتيكياً</p>
                        </div>
                      )}

                      {simRole === 'judge' && (
                        <div className="space-y-1.5 text-start pt-1">
                          <p className="text-[10px] font-bold text-slate-300">النتائج الرسمية (Rule 164.2):</p>
                          <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-[10px] flex justify-between">
                            <span>1. يوسف العبدلي (L1)</span>
                            <span className="text-amber-400 font-mono font-bold">09.85s</span>
                          </div>
                          <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-[10px] flex justify-between">
                            <span>2. سفيان البقالي (L2)</span>
                            <span className="text-amber-400 font-mono font-bold">09.92s</span>
                          </div>
                          <div className="bg-emerald-600 text-black font-bold text-center text-[10px] py-1.5 rounded-lg mt-2">
                            اعتماد وختم النتيجة الرسمية ✓
                          </div>
                        </div>
                      )}

                      {simRole === 'chambre_dappel' && (
                        <div className="space-y-1.5 text-start pt-1">
                          <p className="text-[10px] font-bold text-slate-300">توزيع المجموعات الحالية (Séries):</p>
                          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-[10px] text-slate-400 space-y-1">
                            <p className="text-white font-bold">المجموعة 1 • 100m رجال</p>
                            <p>4 عدائين جاهزين في خط الانطلاق</p>
                          </div>
                          <div className="bg-emerald-600 text-white font-bold text-center text-[10px] py-1.5 rounded-lg mt-2">
                            إرسال المجموعة للانطلاق 🚀
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectRole) {
                          onSelectRole(simRole);
                          onClose();
                        }
                      }}
                      className="w-full py-1.5 mt-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>فتح هذا الدور في وضع الشاشة الكاملة</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* الشريط السفلي للهاتف */}
                <div className="h-4 bg-slate-900 flex items-center justify-center">
                  <div className="w-24 h-1 bg-slate-700 rounded-full"></div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              التبويب 4: مراقبة الغرفة والشبكة
          ═══════════════════════════════════════════════ */}
          {activeTab === 'network' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>حالة غرفة السباق الحالية ({roomCode})</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500">رمز الغرفة:</span>
                    <p className="text-base font-black font-mono text-amber-400">{roomCode}</p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500">بروتوكول التزامن:</span>
                    <p className="text-sm font-bold text-emerald-400">WebSocket Relay v2</p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500">كمون الشبكة (Latency):</span>
                    <p className="text-sm font-bold font-mono text-cyan-400">~ 1-3 ms</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <p className="text-xs font-bold text-slate-300">الأدوار المتزامنة مع هذا المتصفح:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
                      <span className="font-bold text-white">🚦 هاتف خط البداية (Starter)</span>
                      <span className="text-emerald-400 font-mono text-[10px]">جاهز</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-cyan-500/30 flex items-center justify-between">
                      <span className="font-bold text-white">📸 كاميرا خط النهاية (Finish)</span>
                      <span className="text-cyan-400 font-mono text-[10px]">بوابات ثلاثية</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/30 flex items-center justify-between">
                      <span className="font-bold text-white">⚖️ شاشة الحكم العام (Judge)</span>
                      <span className="text-amber-400 font-mono text-[10px]">اعتماد WA</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-purple-500/30 flex items-center justify-between">
                      <span className="font-bold text-white">📋 غرفة النداء (Call Room)</span>
                      <span className="text-purple-400 font-mono text-[10px]">توزيع السلاسل</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>
                    يمكن لأي هاتف محمول الدخول لنفس الغرفة عبر كتابة <strong>{roomCode}</strong> أو مسح رمز الاستجابة السريع.
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ذيل النافذة */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>نظام التراخيص الرياضية المشفرة • إصدار 2026</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
