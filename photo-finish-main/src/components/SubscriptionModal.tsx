import React, { useState, useEffect } from 'react';
import { 
  X, 
  Crown, 
  Sparkles, 
  Check, 
  Copy, 
  Clock, 
  CreditCard, 
  MessageCircle, 
  HelpCircle, 
  CheckCircle2, 
  Radio
} from 'lucide-react';
import { licenseManager, StoredLicense } from '../services/licenseManager';
import { pricingService, CurrencyCode, CustomPackage } from '../services/pricingService';
import { LicensePoolInfo } from '../types/race';

interface SubscriptionModalProps {
  onClose: () => void;
  onConnectToMeshRoom?: (roomCode: string) => void;
  sharedPoolLicense?: LicensePoolInfo | null;
  currentRoomCode?: string;
  isPaywallLock?: boolean; // هل النافذة معروضة كحاجز إجباري لانتهاء الـ 7 أيام
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  onClose,
  onConnectToMeshRoom,
  sharedPoolLicense,
  currentRoomCode = 'RACE-2026',
  isPaywallLock = false
}) => {
  const [activeTab, setActiveTab] = useState<'plans' | 'activate' | 'how_to_subscribe' | 'mesh_connect'>('plans');
  const [currency, setCurrency] = useState<CurrencyCode>(pricingService.displayCurrency);
  const [customPackages, setCustomPackages] = useState<CustomPackage[]>(pricingService.settings.customPackages || []);
  const [activeLicense, setActiveLicense] = useState<StoredLicense | null>(licenseManager.activeLicense);
  const [deviceId] = useState<string>(licenseManager.deviceId);
  
  // حقول التفعيل
  const [activationInput, setActivationInput] = useState<string>('');
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [activationError, setActivationError] = useState<string>('');
  const [activationSuccess, setActivationSuccess] = useState<string>('');
  const [activatedLicense, setActivatedLicense] = useState<StoredLicense | null>(null);
  const [copiedDevId, setCopiedDevId] = useState<boolean>(false);

  // حقل الاتصال بغرفة شبكية 1*4
  const [meshRoomInput, setMeshRoomInput] = useState<string>(currentRoomCode);

  useEffect(() => {
    const unsubLicense = licenseManager.subscribe(() => {
      setActiveLicense(licenseManager.activeLicense);
    });
    const unsubPricing = pricingService.subscribe(() => {
      setCurrency(pricingService.displayCurrency);
      setCustomPackages(pricingService.settings.customPackages || []);
    });
    return () => {
      unsubLicense();
      unsubPricing();
    };
  }, []);

  const handleCopyDeviceId = () => {
    navigator.clipboard.writeText(deviceId);
    setCopiedDevId(true);
    setTimeout(() => setCopiedDevId(false), 2500);
  };

  const handleActivate = async () => {
    setActivationError('');
    setActivationSuccess('');
    setActivatedLicense(null);
    if (!activationInput.trim()) {
      setActivationError('يرجى إدخال أو لصق كود الاشتراك أولاً.');
      return;
    }

    setIsActivating(true);
    try {
      const res = await licenseManager.activateCode(activationInput);
      if (res.success) {
        setActivationSuccess(res.message);
        setActivatedLicense(res.license || null);
        if (res.license) setActiveLicense(res.license);
        setActivationInput('');
      } else {
        setActivationError(res.message);
      }
    } catch (e: any) {
      setActivationError(e?.message || 'حدث خطأ أثناء فحص الكود.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleOpenWhatsApp = () => {
    const text = `السلام عليكم، أرغب في الاشتراك في تطبيق Photo Finish Pro.\nمعرّف جهازي هو: ${deviceId}`;
    const url = `https://wa.me/${pricingService.settings.contactWhatsApp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const isExpired = pricingService.isTrialExpired() && !activeLicense && !sharedPoolLicense;
  const trialText = pricingService.getRemainingTrialText();

  // تنسيق تاريخ انتهاء الرخصة (YYYY-MM-DD) بصدق مع المنطقة الزمنية المحلية
  const formatExpiryDate = (dateStr: string): string =>
    new Date(`${dateStr}T23:59:59`).toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' });

  // الأيام المتبقية لرخصة ما
  const daysLeftOf = (dateStr: string): number =>
    Math.max(0, Math.ceil((new Date(`${dateStr}T23:59:59`).getTime() - Date.now()) / 86400000));

  // نص مدة الاشتراك للرخصة المفعّلة حديثاً (تاريخ الانتهاء + الأيام المتبقية)
  const activatedExpiryText = activatedLicense
    ? `حتى ${formatExpiryDate(activatedLicense.expiryDate)} — تبقى ${daysLeftOf(activatedLicense.expiryDate)} يوم`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* رأس النافذة */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/25">
              <Crown className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  خطط الاشتراك والترخيص الرسمي
                </h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  IAAF CERTIFIED
                </span>
              </div>
              <p className="text-xs text-slate-400">
                نظام التحكيم والتوقيت الإلكتروني المتكامل لألعاب القوى (Photo Finish Quad-Sync 1*4)
              </p>
            </div>
          </div>

          {!isPaywallLock && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* شريط حالة الاشتراك أو الفترة التجريبية الـ 7 أيام */}
        <div className={`px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b text-xs ${
          activeLicense
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            : sharedPoolLicense
            ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300'
            : isExpired
            ? 'bg-red-950/40 border-red-500/30 text-red-300'
            : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
        }`}>
          <div className="flex items-center gap-2 font-bold">
            {activeLicense ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>الاشتراك نشط: {activeLicense.tierName} (صالح لغاية {formatExpiryDate(activeLicense.expiryDate)})</span>
              </>
            ) : sharedPoolLicense ? (
              <>
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>متقاسم الصلاحيات عبر شبكة 1*4 ({sharedPoolLicense.tierName}) 🏆</span>
              </>
            ) : isExpired ? (
              <>
                <Clock className="w-4 h-4 text-red-400" />
                <span>انتهت فترة الـ 7 أيام التجريبية المجانية. يرجى الاشتراك للمتابعة أو الاتصال بهاتف مشترك (1*4).</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 text-amber-400" />
                <span>فترة تجريبية مجانية مفتوحة (7 أيام بكامل الميزات وخصائص 1*4) • {trialText}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
            <span>معرّف جهازك:</span>
            <strong className="text-cyan-400">{deviceId}</strong>
          </div>
        </div>

        {/* أزرار التبويب ومحول العملات */}
        <div className="flex flex-wrap items-center justify-between px-5 pt-3 border-b border-slate-800 bg-slate-950/30 gap-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('plans')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'plans'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span>أنواع الاشتراكات والأسعار</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('how_to_subscribe')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'how_to_subscribe'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>كيفية الاشتراك والتواصل</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('activate')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'activate'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-emerald-400" />
              <span>تفعيل كود الاشتراك ⚡</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('mesh_connect')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'mesh_connect'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span>الاتصال بشبكة 1*4</span>
            </button>
          </div>

          {/* العملة الرسمية المعتمدة الوحيدة للظهور في التطبيق */}
          <div className="flex items-center gap-1.5 pb-2">
            <span className="text-[10px] text-slate-400 font-bold">العملة المعتمدة:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 text-[10px] flex items-center gap-1">
              <span>{currency === 'DZD' ? '🇩🇿 الدينار الجزائري (د.ج)' : currency === 'EUR' ? '🇪🇺 اليورو (€)' : '🇺🇸 الدولار ($)'}</span>
            </span>
          </div>
        </div>

        {/* محتوى التبويبات */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* ══════════════════════════════════════
              التبويب 1: أنواع الاشتراكات والأسعار
          ══════════════════════════════════════ */}
          {activeTab === 'plans' && (
            <div className="space-y-5">
              {/* بطاقة باقة الأندية Pro Club */}
              <div className="bg-slate-950 border-2 border-amber-500/40 hover:border-amber-400 rounded-3xl p-5 shadow-xl transition-all space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-amber-300">
                        1. باقة الأندية والمدربين المعتمدة (Pro Club)
                      </h3>
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                        الأكثر طلباً
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      مثالية للأندية الرياضية، المدربين، والمدارس لتنظيم وإدارة السباقات الرسمية حتى 8 أروقة.
                    </p>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-3.5 py-2 text-center shrink-0">
                    <p className="text-[10px] text-slate-400">ابتداءً من</p>
                    <p className="text-base font-black text-amber-300 font-mono">
                      {pricingService.formatPrice(pricingService.settings.clubProPrices[0].prices[currency], currency)}
                    </p>
                  </div>
                </div>

                {/* ميزات باقة الأندية */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>تحكيم حتى <strong>8 مسارات (أروقة)</strong> كاملة</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>تفعيل شبكي 1*4:</strong> يكفي هاتف واحد ليتقاسم 4 هواتف الترخيص</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>حساسات بصرية فائقة الدقة 1/1000 ثانية</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>تصدير نتائج السباق الرسمية واستمارة التحكيم IAAF</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>إمكانية تحويل التفعيل المتبقي إلى هاتف آخر بأمان</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>إزالة العلامة المائية وتخصيص اسم النادي</span>
                  </div>
                </div>

                {/* خيارات المدة والأسعار */}
                <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {pricingService.settings.clubProPrices.map((item) => (
                    <div key={item.months} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                      <p className="text-[11px] font-bold text-slate-300">{item.label}</p>
                      <p className="text-sm font-black text-amber-300 font-mono mt-0.5">
                        {pricingService.formatPrice(item.prices[currency], currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* بطاقة رخصة الاتحادات الرسمية Enterprise */}
              <div className="bg-slate-950 border-2 border-purple-500/40 hover:border-purple-400 rounded-3xl p-5 shadow-xl transition-all space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-purple-300">
                        2. رخصة الاتحادات والبطولات الرسمية (Enterprise)
                      </h3>
                      <span className="text-[9px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                        شامل وغير محدود
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      مخصصة للاتحادات الوطنية، الرابطات الولائية، والبطولات الدولية الكبرى (حتى 10 أروقة).
                    </p>
                  </div>

                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl px-3.5 py-2 text-center shrink-0">
                    <p className="text-[10px] text-slate-400">ابتداءً من</p>
                    <p className="text-base font-black text-purple-300 font-mono">
                      {pricingService.formatPrice(pricingService.settings.enterprisePrices[0].prices[currency], currency)}
                    </p>
                  </div>
                </div>

                {/* ميزات باقة الاتحادات */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>تحكيم حتى <strong>10 مسارات (أروقة)</strong> أولمبية</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    <span><strong>تفعيل شبكي 1*4 متقدم</strong> لكافة محطات المضمار</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>تقارير تحكيم متوافقة 100% مع لوائح الاتحاد الدولي IAAF/WA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>شريط مسح بانورامي (Slit-Scan) عالي الجودة وتصدير فوتوفينش</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>دعم فني خاص وتدريب كوادر التحكيم</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>تخزين سحابي لنتائج البطولات والمسابقات السنوية</span>
                  </div>
                </div>

                {/* خيارات المدة والأسعار */}
                <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pricingService.settings.enterprisePrices.map((item) => (
                    <div key={item.months} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                      <p className="text-[11px] font-bold text-slate-300">{item.label}</p>
                      <p className="text-sm font-black text-purple-300 font-mono mt-0.5">
                        {pricingService.formatPrice(item.prices[currency], currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* بطاقات الباقات الخاصة المخصصة المعتمدة من الإدارة */}
              {customPackages && customPackages.length > 0 && (
                <div className="space-y-4 pt-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-black text-white">3. باقات وعروض خاصة مخصصة</h3>
                    <span className="text-[9px] bg-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded-full border border-cyan-500/30">
                      عروض معتمدة
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {customPackages.map((pkg) => (
                      <div key={pkg.id} className="bg-slate-950 border-2 border-cyan-500/40 hover:border-cyan-400 rounded-3xl p-5 shadow-xl transition-all space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-black text-cyan-300">{pkg.name}</h4>
                              {pkg.badge && (
                                <span className="text-[9px] bg-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded-full border border-cyan-500/30">
                                  {pkg.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-300 mt-1">{pkg.description}</p>
                          </div>

                          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl px-3.5 py-2 text-center shrink-0">
                            <p className="text-[10px] text-slate-400">{pkg.durationLabel}</p>
                            <p className="text-base font-black text-cyan-300 font-mono">
                              {pricingService.formatPrice(pricingService.getPackagePrice(pkg, currency), currency)}
                            </p>
                          </div>
                        </div>

                        {/* ميزات الباقة */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                            <span>تحكيم حتى <strong>{pkg.laneCount} أروقة</strong> كاملة</span>
                          </div>
                          {pkg.isQuadPool && (
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                              <span><strong>تفعيل شبكي 1*4:</strong> يتقاسم 4 هواتف الصلاحيات معاً</span>
                            </div>
                          )}
                          {pkg.features.map((feat, fIdx) => (
                            <div key={fIdx} className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════
              التبويب 2: كيفية الاشتراك والتواصل
          ══════════════════════════════════════ */}
          {activeTab === 'how_to_subscribe' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-cyan-400" />
                  <span>خطوات الاشتراك والتفعيل بثلاث خطوات بسيطة:</span>
                </h3>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-start gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-black flex items-center justify-center shrink-0">1</span>
                    <div>
                      <p className="font-bold text-white">انسخ معرّف هذا الهاتف (Device ID):</p>
                      <p className="text-slate-400 mt-0.5">معرف جهازك الحالي هو: <strong className="text-cyan-400 font-mono">{deviceId}</strong></p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-black flex items-center justify-center shrink-0">2</span>
                    <div>
                      <p className="font-bold text-white">تواصل مع إدارة النظام لتأكيد الباقة والدفع:</p>
                      <p className="text-slate-400 mt-0.5">أرسل معرف جهازك واختر الباقة ومدة الاشتراك (3 أشهر، 6 أشهر، سنة، إلخ).</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-black flex items-center justify-center shrink-0">3</span>
                    <div>
                      <p className="font-bold text-white">استلم كود التفعيل المعتمد وفعّله فورياً:</p>
                      <p className="text-slate-400 mt-0.5">تصلك رسالة تحتوي كود التفعيل <code>PFP1-...</code>، أدخله في تبويب "تفعيل كود الاشتراك" ليعمل التطبيق مباشرة أوفلاين بدون إنترنت.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* أزرار الاتصال المباشر */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>تواصل عبر واتساب لطلب الاشتراك 💬</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyDeviceId}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 cursor-pointer transition-all active:scale-[0.98]"
                >
                  {copiedDevId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedDevId ? 'تم نسخ معرف الجهاز!' : 'نسخ معرّف الجهاز (Device ID)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════
              التبويب 3: تفعيل كود الاشتراك ⚡
          ══════════════════════════════════════ */}
          {activeTab === 'activate' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>أدخل كود الترخيص المشفر (أو كود النقل TRF1):</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyDeviceId}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>معرف الجهاز: {deviceId}</span>
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                <textarea
                  value={activationInput}
                  onChange={(e) => setActivationInput(e.target.value.toUpperCase())}
                  placeholder="مثال: PFP1-CLB8-2712-XXXX-XXXXXX أو كود النقل TRF1-..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 text-white font-mono font-bold text-sm rounded-xl p-3 outline-none uppercase placeholder:text-slate-600"
                />

                {activationError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                    {activationError}
                  </div>
                )}

                {activationSuccess && (
                  <div className="rounded-2xl overflow-hidden border border-emerald-500/40">
                    {/* رسالة نجاح التفعيل */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/15 border-b border-emerald-500/25 text-emerald-300 text-xs font-black">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{activationSuccess}</span>
                    </div>

                    {/* بطاقة معلومات الاشتراك المُفعّل */}
                    {activatedLicense && (
                      <div className="p-3.5 bg-slate-950/80 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 tracking-wide">معلومات الإشتراك:</p>

                        <div className="flex items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 shrink-0">
                            <Crown className="w-4 h-4 text-amber-400" />
                            <span>نوع الباقة</span>
                          </div>
                          <span className="text-xs font-black text-amber-300 text-left">{activatedLicense.tierName}</span>
                        </div>

                        <div className="flex items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 shrink-0">
                            <Radio className="w-4 h-4 text-cyan-400" />
                            <span>نمط التوزيع</span>
                          </div>
                          <span className="text-xs font-black text-cyan-300 text-left">
                            {activatedLicense.isQuadPool
                              ? `شبكي 1*4 — يتقاسمه ${activatedLicense.maxSharedSlots} هواتف في نفس السباق`
                              : 'مقيد بجهاز واحد — هذا الهاتف فقط'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 shrink-0">
                            <Clock className="w-4 h-4 text-emerald-400" />
                            <span>مدة الاشتراك</span>
                          </div>
                          <span className="text-xs font-black text-emerald-300 text-left">{activatedExpiryText}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={isActivating}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>{isActivating ? 'جاري التحقق الرقمي...' : 'تفعيل الاشتراك الآن ⚡'}</span>
                </button>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════
              التبويب 4: خاصية الاتصال بشبكة المشترك (1*4)
          ══════════════════════════════════════ */}
          {activeTab === 'mesh_connect' && (
            <div className="space-y-4">
              <div className="bg-purple-950/30 border border-purple-500/40 rounded-2xl p-4 text-xs text-purple-200 space-y-2">
                <p className="font-bold flex items-center gap-1.5 text-purple-300 text-sm">
                  <Radio className="w-4 h-4 text-purple-400" />
                  <span>خاصية الاتصال بشبكة المشترك (1*4 Mesh Connect):</span>
                </p>
                <p className="leading-relaxed text-slate-300">
                  حتى لو انتهت فترة الـ 7 أيام التجريبية في هذا الهاتف، يمكنك استخدام التطبيق مجاناً في أي منافسة بمجرد الاتصال بنفس غرفة سباق هاتف مشترك يملك ترخيصاً نشطاً!
                  سيتقاسم هذا الهاتف الترخيص معه تلقائياً حتى نهاية المنافسة.
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <label className="text-xs font-bold text-slate-300">
                  أدخل رمز غرفة السباق المشتركة (Room Code) للاتصال بالهاتف المضيف:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={meshRoomInput}
                    onChange={(e) => setMeshRoomInput(e.target.value.toUpperCase())}
                    placeholder="مثال: RACE-2026"
                    className="flex-1 bg-slate-900 border border-slate-700 focus:border-purple-400 text-white font-mono font-bold text-center tracking-widest text-base rounded-xl py-2 px-3 outline-none uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (onConnectToMeshRoom && meshRoomInput.trim()) {
                        onConnectToMeshRoom(meshRoomInput.trim());
                        onClose();
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>اتصال 🔗</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
