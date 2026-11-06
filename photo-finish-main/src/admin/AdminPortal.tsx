import React, { useState, useEffect, useRef } from 'react';
import { 
  Crown, 
  Key, 
  Smartphone, 
  Copy, 
  Check, 
  ShieldCheck, 
  Users, 
  Trash2, 
  Share2, 
  Sparkles, 
  Activity, 
  RefreshCw,
  ExternalLink,
  Flame,
  ArrowLeftRight,
  Radio,
  CheckCircle2,
  Layers,
  Search,
  Wifi,
  BarChart3,
  Settings,
  Coins,
  Clock,
  Phone,
  Play,
  Award,
  Flag,
  Camera,
  Plus,
  Zap,
  CheckSquare,
  Building2
} from 'lucide-react';
import { licenseManager } from '../services/licenseManager';
import { pricingService, SubscriptionSettings, CurrencyCode, CustomPackage } from '../services/pricingService';
import { athleticsAudio } from '../services/audioService';
import { LicenseTierCode } from '../types/race';
import { AthletesDatabaseModal } from '../components/athletics/AthletesDatabaseModal';
import { ClubsDatabaseModal } from '../components/athletics/ClubsDatabaseModal';

interface AdminLicenseRecord {
  id: string;
  code: string;
  tier: LicenseTierCode;
  tierName: string;
  clientName: string;
  deviceId: string;
  expiryDate: string;
  createdAt: string;
  isQuadPool: boolean;
  isRevoked: boolean;
  transferredTo?: string;
  revocationProof?: string;
}

const STORAGE_LEDGER_KEY = 'pf_admin_portal_master_ledger_v2';

export const AdminPortal: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'overview' | 'generator' | 'packages' | 'transfer' | 'ledger' | 'simulator' | 'settings'>('overview');
  const [roomCode] = useState<string>('RACE-2026');
  const [isAthletesModalOpen, setIsAthletesModalOpen] = useState<boolean>(false);
  const [isClubsModalOpen, setIsClubsModalOpen] = useState<boolean>(false);

  // إعدادات المنظومة والأسعار
  const [systemSettings, setSystemSettings] = useState<SubscriptionSettings>(() => pricingService.settings);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string>('');

  // استماع للتحديثات الفورية في التخزين
  useEffect(() => {
    return pricingService.subscribe(() => {
      setSystemSettings(pricingService.settings);
    });
  }, []);

  // نموذج التوليد
  const [clientName, setClientName] = useState<string>('نادي الوفاق لألعاب القوى');
  const [tier, setTier] = useState<LicenseTierCode>('CLB8');
  const [selectedCustomPkgId, setSelectedCustomPkgId] = useState<string | null>(null);
  const [durationMonths, setDurationMonths] = useState<number>(12);
  const [licenseType, setLicenseType] = useState<'quad_pool' | 'single_device'>('quad_pool');
  const [targetDeviceId, setTargetDeviceId] = useState<string>('GLOBAL');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedMsg, setCopiedMsg] = useState<boolean>(false);

  // نموذج إنشاء باقة خاصة جديدة
  const [newPkgName, setNewPkgName] = useState<string>('باقة المدارس الرياضية');
  const [newPkgDesc, setNewPkgDesc] = useState<string>('مخصصة للبطولات المدرسية والجامعية وأكاديميات الفئات الصغرى');
  const [newPkgLanes, setNewPkgLanes] = useState<number>(6);
  const [newPkgTier] = useState<LicenseTierCode>('CLB8');
  const [newPkgDuration, setNewPkgDuration] = useState<number>(12);
  const [newPkgDurationLabel, setNewPkgDurationLabel] = useState<string>('سنة كاملة (موسم دراسي)');
  const [newPkgPriceDZD, setNewPkgPriceDZD] = useState<number>(15000);
  const [newPkgPriceEUR, setNewPkgPriceEUR] = useState<number>(95);
  const [newPkgPriceUSD, setNewPkgPriceUSD] = useState<number>(105);
  const [newPkgBadge, setNewPkgBadge] = useState<string>('باقة خاصة 🌟');
  const [newPkgFeaturesText, setNewPkgFeaturesText] = useState<string>(
    'تحكيم حتى 6 مسارات كاملة\nتفعيل شبكي 1*4: هاتف واحد يرخص 4 هواتف\nحساسات بصرية دقيقة 1/1000 ثانية\nتصدير استمارات التحكيم وقوائم العدائين IAAF'
  );
  const [newPkgQuadPool, setNewPkgQuadPool] = useState<boolean>(true);
  const [pkgActionMessage, setPkgActionMessage] = useState<string>('');

  // نموذج التحويل الإداري
  const [transferSourceDev, setTransferSourceDev] = useState<string>('');
  const [transferTargetDev, setTransferTargetDev] = useState<string>('');
  const [transferGeneratedVoucher, setTransferGeneratedVoucher] = useState<string>('');
  const [transferError, setTransferError] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // سجل التراخيص
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [ledger, setLedger] = useState<AdminLicenseRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LEDGER_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    // عينات افتراضية أولية
    return [
      {
        id: 'lic-1',
        code: 'PFP1-CLB8-2712-POOL-8FA32C',
        tier: 'CLB8',
        tierName: 'باقة الأندية المعتمدة (Pro Club)',
        clientName: 'نادي مولودية الجزائر لألعاب القوى',
        deviceId: 'POOL (1*4 شبكي)',
        expiryDate: '2027-12-31',
        createdAt: '2026-09-20',
        isQuadPool: true,
        isRevoked: false,
      },
      {
        id: 'lic-2',
        code: 'PFP1-ENTX-2806-POOL-E4B91D',
        tier: 'ENTX',
        tierName: 'رخصة الاتحادات الرسمية (Enterprise)',
        clientName: 'الاتحاد الجزائري لألعاب القوى (FAA)',
        deviceId: 'POOL (1*4 شبكي)',
        expiryDate: '2028-06-30',
        createdAt: '2026-08-15',
        isQuadPool: true,
        isRevoked: false,
      },
      {
        id: 'lic-3',
        code: 'PFP1-CLB8-2709-84A2-FE7BDE',
        tier: 'CLB8',
        tierName: 'باقة الأندية المعتمدة (Pro Club)',
        clientName: 'نادي وفاق سطيف لألعاب القوى',
        deviceId: 'PF-84A2-9F1B',
        expiryDate: '2027-09-30',
        createdAt: '2026-09-28',
        isQuadPool: false,
        isRevoked: true,
        transferredTo: 'PF-9C3E-11B4',
        revocationProof: 'REV-84A2-L09X-FE7BDE'
      }
    ];
  });

  // حفظ السجل تلقائياً
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LEDGER_KEY, JSON.stringify(ledger));
    } catch {}
  }, [ledger]);

  // محاكي الهواتف الأربعة التفاعلي وحالات السباق الحية
  const [simStep, setSimStep] = useState<'trial' | 'activated' | 'racing' | 'finished'>('trial');
  const [simClockMs, setSimClockMs] = useState<number>(0);
  const [simIsRacing, setSimIsRacing] = useState<boolean>(false);
  const [simRunnerFinished, setSimRunnerFinished] = useState<boolean>(false);
  const [simLeaderTime, setSimLeaderTime] = useState<number>(10.142);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);
  const simStartTimeRef = useRef<number>(0);

  const [simPhones, setSimPhones] = useState<{
    start: { id: string; license: string | null; isMaster: boolean };
    finish: { id: string; license: string | null; isMaster: boolean };
    judge: { id: string; license: string | null; isMaster: boolean };
    chambre: { id: string; license: string | null; isMaster: boolean };
  }>({
    start: { id: 'PF-11A1-22B2', license: null, isMaster: false },
    finish: { id: 'PF-33C3-44D4', license: null, isMaster: false },
    judge: { id: 'PF-55E5-66F6', license: null, isMaster: false },
    chambre: { id: 'PF-77G7-88H8', license: null, isMaster: false },
  });

  const [simMeshSharedLicense, setSimMeshSharedLicense] = useState<{
    code: string;
    tier: LicenseTierCode;
    tierName: string;
    hostRole: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, []);

  // توليد كود ترخيص مشفر
  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const exp = new Date();
      exp.setMonth(exp.getMonth() + durationMonths);

      const isQuad = licenseType === 'quad_pool';
      const dev = isQuad ? 'POOL' : targetDeviceId;

      const code = await licenseManager.generateLicenseKey(tier, exp, {
        targetDeviceId: dev,
        isQuadPool: isQuad,
        clientName
      });

      setGeneratedCode(code);

      // إضافة للسجل
      const newRec: AdminLicenseRecord = {
        id: `lic-${Date.now()}`,
        code,
        tier,
        tierName: tier === 'ENTX' ? 'رخصة الاتحادات الرسمية (Enterprise)' : 'باقة الأندية المعتمدة (Pro Club)',
        clientName,
        deviceId: isQuad ? 'POOL (1*4 شبكي)' : (targetDeviceId || 'GLOBAL'),
        expiryDate: exp.toISOString().split('T')[0],
        createdAt: new Date().toISOString().split('T')[0],
        isQuadPool: isQuad,
        isRevoked: false,
      };

      setLedger(prev => [newRec, ...prev]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  // تحويل ترخيص إدارياً
  const handleAdminTransfer = async () => {
    setTransferError('');
    if (!transferSourceDev.trim() || !transferTargetDev.trim()) {
      setTransferError('يرجى تحديد معرّف هاتف المصدر ومعرّف هاتف الهدف.');
      return;
    }

    setIsTransferring(true);
    try {
      // البحث عن ترخيص نشط في المصدر
      const cleanSource = transferSourceDev.trim().toUpperCase();
      const cleanTarget = transferTargetDev.trim().toUpperCase();

      const sourceRecord = ledger.find(r => !r.isRevoked && (r.deviceId.includes(cleanSource) || r.deviceId === 'GLOBAL' || r.isQuadPool));
      
      const expDate = sourceRecord ? new Date(sourceRecord.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const yy = String(expDate.getFullYear() % 100).padStart(2, '0');
      const mm = String(expDate.getMonth() + 1).padStart(2, '0');
      const targetHash = cleanTarget.replace(/-/g, '').substring(2, 6);

      const voucher = `TRF1-${sourceRecord?.tier || 'CLB8'}-${yy}${mm}-${targetHash}-TRF${Math.floor(1000 + Math.random() * 9000)}`;

      setTransferGeneratedVoucher(voucher);

      // تحديث السجل: إبطال القديم وتسجيل الجديد
      setLedger(prev => prev.map(item => {
        if (sourceRecord && item.id === sourceRecord.id) {
          return {
            ...item,
            isRevoked: true,
            transferredTo: cleanTarget,
            revocationProof: `ADM-REV-${Date.now().toString(36).toUpperCase()}`
          };
        }
        return item;
      }));

    } catch (e: any) {
      setTransferError(e?.message || 'فشلت عملية التحويل الإداري.');
    } finally {
      setIsTransferring(false);
    }
  };

  // محاكاة تفعيل كود 1*4 على هاتف معين في المحاكي
  const handleSimActivateOnPhone = (targetPhone: 'start' | 'finish' | 'judge' | 'chambre') => {
    const code = generatedCode || 'PFP1-CLB8-2712-POOL-8FA32C';
    const isEnterprise = code.includes('ENTX');

    setSimPhones(prev => ({
      ...prev,
      [targetPhone]: { ...prev[targetPhone], license: code, isMaster: true }
    }));

    // البث الشبكي لجميع الهواتف الأخرى (1*4 Mesh Sharing)
    setSimMeshSharedLicense({
      code,
      tier: isEnterprise ? 'ENTX' : 'CLB8',
      tierName: isEnterprise ? 'رخصة الاتحادات الرسمية (Enterprise)' : 'باقة الأندية المعتمدة (Pro Club)',
      hostRole: targetPhone === 'start' ? 'هاتف البداية 🚦' : targetPhone === 'finish' ? 'كاميرا النهاية 📸' : targetPhone === 'judge' ? 'هاتف الحكم ⚖️' : 'غرفة النداء 📋'
    });
  };

  // إعادة ضبط المحاكي للحالة التجريبية
  const handleSimReset = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    setSimIsRacing(false);
    setSimRunnerFinished(false);
    setSimClockMs(0);
    setSimStep('trial');
    setSimPhones({
      start: { id: 'PF-11A1-22B2', license: null, isMaster: false },
      finish: { id: 'PF-33C3-44D4', license: null, isMaster: false },
      judge: { id: 'PF-55E5-66F6', license: null, isMaster: false },
      chambre: { id: 'PF-77G7-88H8', license: null, isMaster: false },
    });
    setSimMeshSharedLicense(null);
  };

  // الخطوة 2: تفعيل هاتف واحد (هاتف البداية) وبث الترخيص 1*4 للهواتف الثلاثة الأخرى
  const handleSimStepActivate = () => {
    handleSimActivateOnPhone('start');
    setSimStep('activated');
    try { athleticsAudio.playBeep(880, 0.15); } catch {}
  };

  // الخطوة 3: انطلاق السباق المتزامن (إطلاق المسدس 🔫)
  const handleSimStepStartRace = () => {
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    setSimIsRacing(true);
    setSimRunnerFinished(false);
    setSimStep('racing');
    setSimClockMs(0);
    simStartTimeRef.current = Date.now();
    try { athleticsAudio.playStarterSound(1.5, 1.0); } catch {}

    simTimerRef.current = setInterval(() => {
      setSimClockMs(Date.now() - simStartTimeRef.current);
    }, 15);
  };

  // الخطوة 4: التقاط خط النهاية واعتماد النتيجة
  const handleSimStepFinishRace = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    setSimIsRacing(false);
    setSimRunnerFinished(true);
    setSimStep('finished');
    const finalSeconds = simClockMs > 0 ? (simClockMs / 1000) : 10.142;
    setSimLeaderTime(Number(finalSeconds.toFixed(3)));
    try { athleticsAudio.playWhistle(0.4, 2, 1.2, 1.0); } catch {}
  };

  // إنشاء باقة خاصة جديدة
  const handleCreateCustomPackage = () => {
    if (!newPkgName.trim()) {
      alert('يرجى كتابة اسم الباقة الخاصة.');
      return;
    }
    const features = newPkgFeaturesText
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    const created = pricingService.addCustomPackage({
      name: newPkgName.trim(),
      description: newPkgDesc.trim(),
      laneCount: newPkgLanes,
      tierCode: newPkgTier,
      durationMonths: newPkgDuration,
      durationLabel: newPkgDurationLabel.trim() || `${newPkgDuration} أشهر`,
      priceDZD: newPkgPriceDZD,
      priceEUR: newPkgPriceEUR,
      priceUSD: newPkgPriceUSD,
      badge: newPkgBadge.trim() || undefined,
      features: features.length > 0 ? features : ['تحكيم سباقات ألعاب القوى', 'تفعيل شبكي 1*4'],
      isQuadPool: newPkgQuadPool,
    });

    setSystemSettings(pricingService.settings);
    setPkgActionMessage(`تم حفظ وإنشاء (${created.name}) بنجاح! تم نشرها فورياً وتظهر الآن في نافذة اشتراكات التطبيق.`);
    setTimeout(() => setPkgActionMessage(''), 4500);
  };

  // حذف باقة خاصة
  const handleDeleteCustomPackage = (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف الباقة الخاصة (${name})؟`)) {
      pricingService.deleteCustomPackage(id);
      setSystemSettings(pricingService.settings);
    }
  };

  // اختيار باقة خاصة لتوليد ترخيص مباشر لها
  const handleSelectPackageForGenerator = (pkg: CustomPackage) => {
    setTier(pkg.tierCode);
    setDurationMonths(pkg.durationMonths);
    setClientName(pkg.name);
    setLicenseType(pkg.isQuadPool ? 'quad_pool' : 'single_device');
    setSelectedCustomPkgId(pkg.id);
    setActiveSection('generator');
  };

  const copyWhatsApp = (rec: AdminLicenseRecord) => {
    const msg = `🏆 *تفعيل اشتراك PHOTO FINISH PRO الرسمي* 🏆\n\n` +
      `مرحباً بكم، إليكم كود التفعيل المعتمد:\n\n` +
      `🔑 *كود الترخيص:* \`${rec.code}\`\n` +
      `🏷️ *نوع الباقة:* ${rec.tierName}\n` +
      `📅 *صلاحية لغاية:* ${rec.expiryDate}\n` +
      `🌐 *النظام الشبكي:* ${rec.isQuadPool ? 'يدعم التفعيل الموحد 1*4 (هاتف واحد يفعل والهواتف الثلاثة الأخرى تتقاسم التفعيل في نفس المضمار)' : 'مرتبط بجهاز العميل'}\n\n` +
      `📲 *طريقة التفعيل:*\n` +
      `1. افتح تطبيق Photo Finish Pro في الهاتف.\n` +
      `2. اضغط على أيقونة الترقية 👑 ثم ألصق الكود واضغط تفعيل.\n\n` +
      `مع تحيات الإدارة التقنية لنظام Photo Finish Pro.`;

    navigator.clipboard.writeText(msg);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2500);
  };

  // حذف كود من السجل في حالة الخطأ
  const handleDeleteLicense = (id: string, code: string) => {
    if (window.confirm(`هل أنت متأكد من حذف الترخيص (${code}) من السجل؟\nيُستخدم هذا الإجراء في حالة الخطأ عند إصدار الكود.`)) {
      setLedger(prev => prev.filter(item => item.id !== id));
    }
  };

  // حفظ إعدادات الأسعار والمنظومة
  const handleSaveSettings = () => {
    pricingService.saveSettings(systemSettings);
    setSettingsSavedMessage('تم حفظ إعدادات المنظومة وتحديث الأسعار بنجاح! يتم تطبيقها فورياً على جميع الهواتف.');
    setTimeout(() => setSettingsSavedMessage(''), 3500);
  };

  const activeCount = ledger.filter(l => !l.isRevoked && new Date(l.expiryDate) > new Date()).length;
  const poolCount = ledger.filter(l => l.isQuadPool && !l.isRevoked).length;
  const transferredCount = ledger.filter(l => l.isRevoked && l.transferredTo).length;

  const filteredLedger = ledger.filter(item => {
    const matchSearch = item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.deviceId.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterTier === 'all') return matchSearch;
    if (filterTier === 'pool') return matchSearch && item.isQuadPool;
    if (filterTier === 'transferred') return matchSearch && item.isRevoked;
    return matchSearch && item.tier === filterTier;
  });

  const qrUrl = generatedCode 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(generatedCode)}`
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* ═══ الشريط العلوي لموقع الإدارة ═══ */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 sm:px-6 py-3 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* الشعار واسم النظام */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/25">
              <Crown className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-wide text-white">
                  بوابة مدير النظام • PHOTO FINISH PRO
                </h1>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  ADMIN SUITE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                منظومة الاشتراكات والتفعيل الشبكي 1*4 والتحويل المشفر بين الهواتف
              </p>
            </div>
          </div>

          {/* الإجراءات السريعة: رابط تطبيق التحكيم ورقم الغرفة */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-slate-400">الغرفة النشطة:</span>
              <span className="text-amber-300 font-mono font-bold">{roomCode}</span>
            </div>

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <span>فتح تطبيق السباق 🏃‍♂️</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* ═══ جسم الموقع مع القائمة الجانبية ═══ */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row p-3 sm:p-6 gap-6">
        {/* القائمة الجانبية للتنقل (Sidebar) */}
        <aside className="w-full md:w-64 shrink-0 space-y-1 bg-slate-900/60 border border-slate-800 rounded-3xl p-3 h-fit shadow-xl">
          <p className="text-[10px] font-bold text-slate-400 px-3 py-2">أقسام لوحة الإدارة المستقلة:</p>

          <button
            type="button"
            onClick={() => setActiveSection('overview')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-start cursor-pointer ${
              activeSection === 'overview'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>لوحة القيادة والمؤشرات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('generator')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-start cursor-pointer ${
              activeSection === 'generator'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>توليد أكواد التفعيل (1*4)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('packages')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-start cursor-pointer ${
              activeSection === 'packages'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>الباقات الخاصة والأسعار ({systemSettings.customPackages?.length || 0}) 🌟</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('transfer')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-start cursor-pointer ${
              activeSection === 'transfer'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>تحويل ونقل التراخيص (إبطال القديم)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('ledger')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-start cursor-pointer ${
              activeSection === 'ledger'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>سجل التراخيص الصادرة ({ledger.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('simulator')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-start cursor-pointer ${
              activeSection === 'simulator'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>محاكي الهواتف الأربعة 📱</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('settings')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-start cursor-pointer ${
              activeSection === 'settings'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>إعدادات الأسعار والمنظومة ⚙️</span>
          </button>

          <div className="pt-2 mt-2 border-t border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 px-3 py-1">منظومة ألعاب القوى والعدائين:</p>
            <button
              type="button"
              onClick={() => setIsAthletesModalOpen(true)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-blue-300 hover:bg-slate-800/80 hover:text-white transition-all text-start cursor-pointer"
            >
              <Users className="w-4 h-4 text-blue-400" />
              <span>سجل العدائين الموحد 🏃</span>
            </button>
            <button
              type="button"
              onClick={() => setIsClubsModalOpen(true)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-emerald-300 hover:bg-slate-800/80 hover:text-white transition-all text-start cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>دليل الأندية والجمعيات 🏛️</span>
            </button>
          </div>
        </aside>

        {/* مساحة العمل الرئيسية (Content Area) */}
        <main className="flex-1 space-y-6 min-w-0">
          {/* ═══════════════════════════════════════════════
              القسم 1: لوحة القيادة والمؤشرات (Overview)
          ═══════════════════════════════════════════════ */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* بطاقات الإحصائيات الأربع */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-bold">إجمالي الاشتراكات</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-white font-mono">{ledger.length}</p>
                  <p className="text-[10px] text-slate-400">ترخيص مسجل في المنظومة</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-bold">التراخيص النشطة</span>
                    <Activity className="w-4 h-4 text-cyan-400" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">{activeCount}</p>
                  <p className="text-[10px] text-emerald-400">صالح وسارٍ للاستخدام</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-bold">تراخيص شبكية 1*4</span>
                    <Users className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">{poolCount}</p>
                  <p className="text-[10px] text-slate-400">تتقاسمها 4 هواتف معاً</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-bold">عمليات النقل والتحويل</span>
                    <ArrowLeftRight className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-purple-400 font-mono">{transferredCount}</p>
                  <p className="text-[10px] text-purple-400">تم إبطال القديم ونقله</p>
                </div>
              </div>

              {/* بطاقة توضيحية لنظام 1*4 والتحويل الآمن */}
              <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-cyan-950/30 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      مفهوم منظومة التراخيص الرياضية الذكية (1*4 Quad-Share & Safe Handover)
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
                      تصميم هندسي متقدم يجمع بين سهولة عمل حكام ألعاب القوى وضمان الأمان ومنع القرصنة
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                      <Users className="w-4 h-4" />
                      <span>1. التفعيل الشبكي 1*4 (Quad Mesh Sharing):</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      لا يحتاج النادي أو الاتحاد لشراء 4 اشتراكات منفصلة لتجهيز خط السباق! يكفي تفعيل الاشتراك في هاتف واحد (مثلاً هاتف البداية أو التحكيم)،
                      وبمجرد اتصال الهواتف الثلاثة الأخرى بنفس رمز الغرفة أو الشبكة المحلية، يتقاسم الجميع التفعيل الكامل (8 أو 10 أروقة) حتى انتهاء المنافسة.
                    </p>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4" />
                      <span>2. النقل الآمن للمدة المتبقية ومنع الازدواجية:</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      إذا تلف هاتف العميل أو رغب في استبداله بجهاز جديد، يمكنه نقل المدة المتبقية بضغطة زر. النظام يبطل الترخيص في الهاتف الأول فورياً (Burn on Source)
                      ويولد شهادة تنازل مشفرة ترتبط بمعرف الهاتف الثاني حصراً، مما يجعل تشغيل الكود في هاتفين في وقت واحد مستحيلاً رياضياً.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveSection('generator')}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>توليد كود ترخيص 1*4 جديد الآن</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection('simulator')}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    <span>تجربة محاكي الهواتف الأربعة التفاعلي</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              القسم 2: مركز توليد التراخيص المشفرة (Generator)
          ═══════════════════════════════════════════════ */}
          {activeSection === 'generator' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <Key className="w-5 h-5 text-amber-400" />
                    <span>توليد كود ترخيص رياضي مشفر (HMAC-SHA256)</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    أكواد ذاتية التحقق أوفلاين بنسبة 100% تعمل بدون إنترنت وبدون خادم خارجي
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* استمارة الإدخال */}
                <div className="space-y-4">
                  {/* اسم العميل / النادي */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">اسم العميل أو النادي الرياضي:</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="مثال: نادي مولودية الجزائر"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-white text-xs rounded-xl p-3 outline-none"
                    />
                  </div>

                  {/* نوع الترخيص (1*4 شبكي أو جهاز فردي) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">نمط التوزيع والتشغيل:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setLicenseType('quad_pool')}
                        className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                          licenseType === 'quad_pool'
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black">ترخيص شبكي 1*4 🏆</span>
                          <Users className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <p className="text-[10px] text-slate-300">يتقاسمه 4 هواتف في نفس السباق</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLicenseType('single_device')}
                        className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                          licenseType === 'single_device'
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black">مقيد بجهاز محدد 📱</span>
                          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                        </div>
                        <p className="text-[10px] text-slate-300">مقفل برقم هاتف واحد</p>
                      </button>
                    </div>
                  </div>

                  {/* إذا كان مقيداً بجهاز محدد */}
                  {licenseType === 'single_device' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">معرّف جهاز العميل (Device ID):</label>
                      <input
                        type="text"
                        value={targetDeviceId}
                        onChange={(e) => setTargetDeviceId(e.target.value.toUpperCase())}
                        placeholder="مثال: PF-84A2-9F1B أو اكتب GLOBAL"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-white font-mono text-xs rounded-xl p-3 outline-none uppercase"
                      />
                    </div>
                  )}

                  {/* نوع الباقة */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">نوع الباقة والصلاحيات:</label>
                      <button 
                        type="button" 
                        onClick={() => setActiveSection('packages')} 
                        className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>إنشاء باقة خاصة جديدة</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setTier('CLB8'); setSelectedCustomPkgId(null); }}
                        className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                          tier === 'CLB8' && !selectedCustomPkgId
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <p className="text-xs font-black">باقة الأندية (Pro Club)</p>
                        <p className="text-[10px] text-slate-400">8 مسارات • تصدير IAAF</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setTier('ENTX'); setSelectedCustomPkgId(null); }}
                        className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                          tier === 'ENTX' && !selectedCustomPkgId
                            ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <p className="text-xs font-black">الاتحادات (Enterprise)</p>
                        <p className="text-[10px] text-slate-400">10 مسارات • شامل وبلا حدود</p>
                      </button>
                    </div>

                    {/* الباقات المخصصة المنشأة */}
                    {systemSettings.customPackages && systemSettings.customPackages.length > 0 && (
                      <div className="pt-2 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                          <span>أو اختر من باقاتك الخاصة المنشأة:</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {systemSettings.customPackages.map(pkg => (
                            <button
                              key={pkg.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomPkgId(pkg.id);
                                setTier(pkg.tierCode);
                                setDurationMonths(pkg.durationMonths);
                                setClientName(pkg.name);
                                setLicenseType(pkg.isQuadPool ? 'quad_pool' : 'single_device');
                              }}
                              className={`p-2.5 rounded-xl border text-start transition-all cursor-pointer flex items-center justify-between ${
                                selectedCustomPkgId === pkg.id
                                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold shadow-md shadow-cyan-500/10'
                                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div className="truncate min-w-0 flex-1 pe-2">
                                <p className="text-xs font-bold text-white truncate">{pkg.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {pkg.laneCount} مسارات • {pricingService.formatPrice(pricingService.getPackagePrice(pkg, systemSettings.displayCurrency), systemSettings.displayCurrency)}
                                </p>
                              </div>
                              <span className="text-[9px] bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-amber-300 shrink-0 font-bold">
                                {pkg.badge || 'باقة مخصصة'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* مدة الصلاحية */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">مدة الاشتراك:</label>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[
                        { label: '3 أشهر', val: 3 },
                        { label: '6 أشهر', val: 6 },
                        { label: 'سنة كاملة', val: 12 },
                        { label: 'سنتين', val: 24 },
                        { label: '3 سنوات', val: 36 },
                        { label: 'مفتوح (5 سنوات)', val: 60 }
                      ].map(item => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setDurationMonths(item.val)}
                          className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold ${
                            durationMonths === item.val
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* زر التوليد */}
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    disabled={isGenerating}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 fill-slate-950" />
                    <span>{isGenerating ? 'جاري حساب التوقيع الرقمي...' : 'توليد كود الترخيص المشفر الآن ⚡'}</span>
                  </button>
                </div>

                {/* المعاينة المباشرة للكود المولد والباركود */}
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-4">
                  {generatedCode ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم توليد التوقيع الرقمي بنجاح:</span>
                      </div>

                      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-inner space-y-1">
                        <p className="text-[10px] text-slate-400">كود الترخيص المعتمد:</p>
                        <p className="text-base sm:text-lg font-black font-mono text-amber-300 tracking-wider break-all select-all">
                          {generatedCode}
                        </p>
                      </div>

                      {qrUrl && (
                        <div className="flex flex-col items-center justify-center">
                          <div className="bg-white p-3 rounded-2xl shadow-md border-2 border-amber-500/40 inline-block">
                            <img src={qrUrl} alt="QR Code" className="w-36 h-36 object-contain" />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2">
                            امسح الباركود مباشرة من كاميرا هاتف العميل للتفعيل الفوري
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedCode);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2500);
                          }}
                          className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          <span>{copiedCode ? 'تم النسخ!' : 'نسخ الكود'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => copyWhatsApp(ledger[0])}
                          className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                        >
                          {copiedMsg ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                          <span>{copiedMsg ? 'تم نسخ الرسالة!' : 'نسخ رسالة واتساب'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-3">
                      <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                        <Key className="w-7 h-7" />
                      </div>
                      <p className="font-bold text-slate-400 text-xs">اضغط على زر التوليد لعرض الكود والباركود هنا</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              القسم 2.5: إدارة الباقات الخاصة والأسعار (Packages)
          ═══════════════════════════════════════════════ */}
          {activeSection === 'packages' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span>إدارة وإنشاء الباقات الخاصة وتحديد أسعارها (Custom Packages)</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    خاصية إنشاء باقات خاصة وتسميتها وتحديد عدد الأروقة وسعرها بالدينار الجزائري واليورو والدولار، ونشرها فورياً في نافذة اشتراكات التطبيق
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-3 py-1 rounded-xl border border-amber-500/30 font-mono">
                    {systemSettings.customPackages?.length || 0} باقات منشأة
                  </span>
                </div>
              </div>

              {pkgActionMessage && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{pkgActionMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* استمارة إنشاء باقة خاصة جديدة */}
                <div className="xl:col-span-5 bg-slate-950 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-inner">
                  <div className="border-b border-slate-800 pb-3">
                    <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-amber-400" />
                      <span>نموذج إضافة باقة خاصة جديدة</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      املأ البيانات أدناه لإنشاء باقة جديدة وتحديد تسعيرتها الرسمية
                    </p>
                  </div>

                  {/* اسم الباقة */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">اسم الباقة الخاصة:</label>
                    <input
                      type="text"
                      value={newPkgName}
                      onChange={(e) => setNewPkgName(e.target.value)}
                      placeholder="مثال: باقة الأكاديميات والناشئين"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 text-white text-xs rounded-xl p-2.5 outline-none"
                    />
                  </div>

                  {/* وصف الباقة */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">وصف الباقة والفئة المستهدفة:</label>
                    <input
                      type="text"
                      value={newPkgDesc}
                      onChange={(e) => setNewPkgDesc(e.target.value)}
                      placeholder="مثال: موجهة للمدارس والجامعات ومراكز تدريب ألعاب القوى"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 text-white text-xs rounded-xl p-2.5 outline-none"
                    />
                  </div>

                  {/* عدد المسارات (الأروقة) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">عدد الأروقة (المسارات المسموحة للسباق):</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[4, 6, 8, 10].map((lanes) => (
                        <button
                          key={lanes}
                          type="button"
                          onClick={() => setNewPkgLanes(lanes)}
                          className={`py-2 px-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                            newPkgLanes === lanes
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {lanes} مسارات
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* مدة الاشتراك والتسمية */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">المدة بالشهور:</label>
                      <select
                        value={newPkgDuration}
                        onChange={(e) => {
                          const m = parseInt(e.target.value, 10);
                          setNewPkgDuration(m);
                          if (m === 1) setNewPkgDurationLabel('شهر واحد');
                          else if (m === 3) setNewPkgDurationLabel('3 أشهر');
                          else if (m === 6) setNewPkgDurationLabel('6 أشهر (نصف موسم)');
                          else if (m === 12) setNewPkgDurationLabel('سنة كاملة (موسم دراسي/رياضي)');
                          else if (m === 24) setNewPkgDurationLabel('سنتين كاملتين');
                        }}
                        className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-xl p-2.5 outline-none"
                      >
                        <option value={1}>شهر واحد</option>
                        <option value={3}>3 أشهر</option>
                        <option value={6}>6 أشهر</option>
                        <option value={12}>12 شهراً (سنة)</option>
                        <option value={24}>24 شهراً (سنتين)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">تسمية المدة (نص):</label>
                      <input
                        type="text"
                        value={newPkgDurationLabel}
                        onChange={(e) => setNewPkgDurationLabel(e.target.value)}
                        placeholder="مثال: سنة كاملة (موسم دراسي)"
                        className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-xl p-2.5 outline-none"
                      />
                    </div>
                  </div>

                  {/* الأسعار بالعملات الثلاث مع تمييز الدينار الجزائري */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-slate-900 border border-slate-800">
                    <label className="text-[11px] font-bold text-white flex items-center justify-between">
                      <span>تحديد السعر بالعملات:</span>
                      <span className="text-[10px] text-amber-400">د.ج هو العملة الافتراضية 🇩🇿</span>
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] text-amber-300 font-bold">بالدينار (د.ج):</span>
                        <input
                          type="number"
                          value={newPkgPriceDZD}
                          onChange={(e) => setNewPkgPriceDZD(parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-slate-950 border border-amber-500/40 text-amber-300 font-mono text-xs rounded-xl p-2 font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-cyan-300 font-bold">باليورو (€):</span>
                        <input
                          type="number"
                          value={newPkgPriceEUR}
                          onChange={(e) => setNewPkgPriceEUR(parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs rounded-xl p-2"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-emerald-300 font-bold">بالدولار ($):</span>
                        <input
                          type="number"
                          value={newPkgPriceUSD}
                          onChange={(e) => setNewPkgPriceUSD(parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs rounded-xl p-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* شارة التميز والتفعيل الشبكي 1*4 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">شارة مميزة للباقة:</label>
                      <input
                        type="text"
                        value={newPkgBadge}
                        onChange={(e) => setNewPkgBadge(e.target.value)}
                        placeholder="مثال: باقة خاصة 🌟"
                        className="w-full bg-slate-900 border border-slate-800 text-white text-xs rounded-xl p-2.5 outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-5">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-200">
                        <input
                          type="checkbox"
                          checked={newPkgQuadPool}
                          onChange={(e) => setNewPkgQuadPool(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
                        />
                        <span>دعم تفعيل 1*4 شبكي</span>
                      </label>
                    </div>
                  </div>

                  {/* مميزات الباقة */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">مميزات الباقة (اكتب كل ميزة في سطر منفصل):</label>
                    <textarea
                      rows={4}
                      value={newPkgFeaturesText}
                      onChange={(e) => setNewPkgFeaturesText(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 text-white text-xs rounded-xl p-2.5 outline-none leading-relaxed"
                    />
                  </div>

                  {/* زر الحفظ والنشر */}
                  <button
                    type="button"
                    onClick={handleCreateCustomPackage}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 fill-slate-950" />
                    <span>حفظ ونشر الباقة الخاصة فورياً في التطبيق 🚀</span>
                  </button>
                </div>

                {/* قائمة الباقات المنشأة */}
                <div className="xl:col-span-7 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      <span>الباقات الخاصة المعتمدة حالياً في النظام ({systemSettings.customPackages?.length || 0})</span>
                    </h3>
                    <span className="text-[10px] text-slate-400">تظهر للعملاء في نافذة الاشتراكات فورياً</span>
                  </div>

                  {(!systemSettings.customPackages || systemSettings.customPackages.length === 0) ? (
                    <div className="p-8 text-center bg-slate-950/60 rounded-3xl border border-slate-800 space-y-2">
                      <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs font-bold text-slate-400">لم يتم إنشاء أي باقات خاصة مخصصة بعد</p>
                      <p className="text-[11px] text-slate-500">استخدم النموذج المقابل لإنشاء أول باقة خاصة وتسميتها وتحديد سعرها.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {systemSettings.customPackages.map((pkg) => (
                        <div
                          key={pkg.id}
                          className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-3xl p-4.5 flex flex-col justify-between space-y-3 transition-all shadow-lg"
                        >
                          <div className="space-y-2.5">
                            {/* الرأس: شارة واسم الباقة */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                {pkg.badge && (
                                  <span className="inline-block text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full mb-1">
                                    {pkg.badge}
                                  </span>
                                )}
                                <h4 className="text-sm font-black text-white">{pkg.name}</h4>
                                <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{pkg.description}</p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteCustomPackage(pkg.id, pkg.name)}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 cursor-pointer transition-colors shrink-0"
                                title="حذف هذه الباقة الخاصة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* مواصفات الباقة والسعر */}
                            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-3 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-cyan-300 flex items-center gap-1">
                                  <Award className="w-3.5 h-3.5" />
                                  <span>{pkg.laneCount} مسارات كاملة</span>
                                </span>
                                <span className="text-[11px] font-mono text-slate-300">
                                  {pkg.durationLabel}
                                </span>
                              </div>

                              {/* الأسعار بالعملات */}
                              <div className="pt-1 border-t border-slate-800/80 flex items-baseline justify-between">
                                <div className="text-start">
                                  <span className="text-lg font-black text-amber-400 font-mono">
                                    {pricingService.formatPrice(pkg.priceDZD, 'DZD')}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block font-sans">
                                    السعر المعتمد (الجزائر 🇩🇿)
                                  </span>
                                </div>
                                <div className="text-end text-[11px] font-mono text-slate-400 space-y-0.5">
                                  <p>{pkg.priceEUR} € يورو</p>
                                  <p>{pkg.priceUSD} $ دولار</p>
                                </div>
                              </div>
                            </div>

                            {/* قائمة المميزات */}
                            <div className="space-y-1">
                              {pkg.features.slice(0, 4).map((feat, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                                  <Check className="w-3 h-3 text-emerald-400 shrink-0 stroke-[3]" />
                                  <span className="truncate">{feat}</span>
                                </div>
                              ))}
                              {pkg.features.length > 4 && (
                                <p className="text-[10px] text-slate-500">+{pkg.features.length - 4} ميزات إضافية أخرى...</p>
                              )}
                            </div>
                          </div>

                          {/* إجراءات سريعة: توليد ترخيص فوري لهذه الباقة */}
                          <div className="pt-2 border-t border-slate-900 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSelectPackageForGenerator(pkg)}
                              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>توليد كود لهذه الباقة ⚡</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              القسم 3: مركز تحويل ونقل التراخيص (Transfer)
          ═══════════════════════════════════════════════ */}
          {activeSection === 'transfer' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-purple-400" />
                  <span>مركز تحويل ونقل التراخيص وإبطال الأجهزة القديمة</span>
                </h2>
                <p className="text-xs text-slate-400">
                  خاصية نقل المدة المتبقية من هاتف إلى هاتف جديد مع إبطال الكود القديم لضمان عدم تشغيل الترخيص في هاتفين
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-4 text-xs text-purple-200 space-y-1.5">
                    <p className="font-bold flex items-center gap-1.5 text-purple-300">
                      <ShieldCheck className="w-4 h-4" />
                      <span>قاعدة الأمان: شرط عدم تفعيل كود واحد في هاتفين</span>
                    </p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      عند إجراء التحويل، يتم حرق الترخيص في هاتف المصدر فورياً، وتوليد كود نقل مشفر <code>TRF1-...</code> يرتبط بهاتف الهدف، ولا يمكن للجهة الأولى استخدامه مجدداً.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">معرّف الهاتف الحالي (المصدر المراد إلغاؤه):</label>
                    <input
                      type="text"
                      value={transferSourceDev}
                      onChange={(e) => setTransferSourceDev(e.target.value.toUpperCase())}
                      placeholder="مثال: PF-84A2-9F1B"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 text-white font-mono text-xs rounded-xl p-3 outline-none uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">معرّف الهاتف الجديد (الهدف المراد تثبيت الترخيص فيه):</label>
                    <input
                      type="text"
                      value={transferTargetDev}
                      onChange={(e) => setTransferTargetDev(e.target.value.toUpperCase())}
                      placeholder="مثال: PF-9C3E-11B4"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 text-white font-mono text-xs rounded-xl p-3 outline-none uppercase"
                    />
                  </div>

                  {transferError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                      {transferError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAdminTransfer}
                    disabled={isTransferring}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-purple-600/20 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Flame className="w-4 h-4 text-amber-300" />
                    <span>{isTransferring ? 'جاري التحويل والإبطال...' : 'إبطال الهاتف القديم ونقل التفعيل للهاتف الجديد ⚡'}</span>
                  </button>
                </div>

                {/* نتيجة التحويل */}
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-4">
                  {transferGeneratedVoucher ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم التحويل والإبطال بنجاح!</span>
                      </div>

                      <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-4 space-y-1">
                        <p className="text-[10px] text-slate-400">كود النقل المخصص للهاتف الجديد فقط:</p>
                        <p className="text-base font-black font-mono text-amber-300 tracking-wider break-all select-all">
                          {transferGeneratedVoucher}
                        </p>
                      </div>

                      <div className="text-xs text-slate-400 space-y-1">
                        <p>✓ تم سحب الصلاحية من: <strong className="text-red-400 font-mono">{transferSourceDev}</strong></p>
                        <p>✓ تم ربط الترخيص بـ: <strong className="text-emerald-400 font-mono">{transferTargetDev}</strong></p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(transferGeneratedVoucher);
                          alert('تم نسخ كود النقل!');
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                        <span>نسخ كود النقل وإرساله للعميل</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-2">
                      <ArrowLeftRight className="w-8 h-8 text-slate-600" />
                      <p className="text-xs text-slate-400">أدخل معرّفي الجهازين لإجراء النقل وحرق الترخيص في الجهاز الأول</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              القسم 4: سجل التراخيص الصادرة (Ledger)
          ═══════════════════════════════════════════════ */}
          {activeSection === 'ledger' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span>سجل التراخيص الصادرة وإدارتها</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    متابعة حالة جميع الأكواد، التراخيص الشبكية 1*4، والتحويلات المسجلة
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute start-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="بحث عن كود أو نادي..."
                      className="bg-slate-950 border border-slate-800 focus:border-amber-500 text-white text-xs rounded-xl py-2 ps-9 pe-3 outline-none"
                    />
                  </div>

                  <select
                    value={filterTier}
                    onChange={(e) => setFilterTier(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl py-2 px-3 outline-none"
                  >
                    <option value="all">جميع التراخيص</option>
                    <option value="pool">تراخيص شبكية 1*4 فقط</option>
                    <option value="transferred">تراخيص منقولة/مبطلة</option>
                    <option value="CLB8">Pro Club (8 مسارات)</option>
                    <option value="ENTX">Enterprise (10 مسارات)</option>
                  </select>
                </div>
              </div>

              {/* جدول التراخيص */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">كود الترخيص</th>
                      <th className="p-3">العميل / النادي</th>
                      <th className="p-3">نوع الباقة</th>
                      <th className="p-3">الجهاز المربوط</th>
                      <th className="p-3">الانتهاء</th>
                      <th className="p-3">الحالة والأمان</th>
                      <th className="p-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {filteredLedger.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono font-bold text-amber-300 select-all">
                          {rec.code}
                        </td>
                        <td className="p-3 font-semibold text-white">
                          {rec.clientName}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.tier === 'ENTX' ? 'bg-purple-500/20 text-purple-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {rec.tier === 'ENTX' ? 'Enterprise' : 'Pro Club'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-cyan-400">
                          {rec.deviceId}
                        </td>
                        <td className="p-3 font-mono text-slate-400">
                          {rec.expiryDate}
                        </td>
                        <td className="p-3">
                          {rec.isRevoked ? (
                            <span className="bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              مبطل ومنقول 🚫
                            </span>
                          ) : rec.isQuadPool ? (
                            <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              شبكي 1*4 نشط 🟢
                            </span>
                          ) : (
                            <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              نشط وسارٍ 🟢
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(rec.code);
                                alert('تم نسخ الكود!');
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                              title="نسخ الكود"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => copyWhatsApp(rec)}
                              className="p-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 cursor-pointer"
                              title="نسخ رسالة واتساب"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                            {/* حذف كود من السجل في حالة الخطأ */}
                            <button
                              type="button"
                              onClick={() => handleDeleteLicense(rec.id, rec.code)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/30 text-red-400 cursor-pointer transition-colors"
                              title="حذف هذا الكود من السجل (في حالة الخطأ)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              القسم 5: محاكي الهواتف الأربعة التفاعلي (Quad-Simulator)
          ═══════════════════════════════════════════════ */}
          {activeSection === 'simulator' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
              {/* الرأس وإجراء إعادة الضبط */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <h2 className="text-base sm:text-xl font-black text-white">
                      محاكي الهواتف الأربعة وشبكة 1*4 الميدانية (4-Phone Stadium Simulator)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    دليل تفاعلي وتطبيقي يوضح بدقة هندسية كيف تدير 4 هواتف سباق ألعاب قوى كامل باشتراك واحد فقط (1*4)!
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSimReset}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-700 active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>إعادة ضبط المحاكي للتجربة</span>
                  </button>
                </div>
              </div>

              {/* ═══ البطاقات التعليمية الثلاث: شرح فلسفة النظام بوضوح ═══ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. لماذا 4 هواتف؟ */}
                <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                    <Flag className="w-4 h-4" />
                    <span>1. لماذا نحتاج 4 هواتف في المضمار؟</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    سباقات ألعاب القوى الرسمية تفصل بين نقاط الحدث:
                    هاتف عند <strong>خط البداية</strong> (إطلاق المسدس وحساس الصوت)،
                    هاتف عند <strong>خط النهاية</strong> (كاميرا ليزر فائقة السرعة 1000 FPS)،
                    هاتف مع <strong>رئيس الحكام</strong> (توقيت وترتيب العدائين)،
                    وهاتف في <strong>غرفة النداء</strong> (فحص صدريات العدائين وتوزيع الأروقة).
                  </p>
                </div>

                {/* 2. ما هو تفعيل 1*4 وكيف يوفر المال؟ */}
                <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <Crown className="w-4 h-4" />
                    <span>2. سر التوفير: تفعيل 1*4 (Quad-Pool)</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    بدلاً من إجبار النادي على شراء 4 اشتراكات منفصلة بتكلفة باهظة، يشتري النادي <strong>اشتراكاً واحداً فقط</strong>!
                    يفعله في أي هاتف من الأربعة. وبمجرد اتصال الهواتف الثلاثة الأخرى بنفس الغرفة <code>{roomCode}</code> أو الواي فاي المحلي،
                    <strong>تتقاسم الهواتف الصلاحيات فورياً</strong> وتتحول تلقائياً إلى 8 أروقة كاملة!
                  </p>
                </div>

                {/* 3. كيف يمنع النظام الاحتيال؟ */}
                <div className="bg-slate-950 border border-purple-500/30 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4" />
                    <span>3. حماية الأمان ومنع الازدواجية</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    الترخيص 1*4 يعمل حصرياً طالما الهواتف متصلة ببعضها في نفس السباق الميداني الحي.
                    وإذا رغب النادي في استبدال الهاتف المفعّل، يستخدم خاصية <strong>التحويل الآمن</strong>:
                    يتم حرق وإبطال الكود في الهاتف القديم نهائياً (Burn) وتفعيله في الجديد، مانعاً تشغيل الكود في هاتفين في وقت واحد.
                  </p>
                </div>
              </div>

              {/* ═══ سيناريوهات التجربة التفاعلية خطوة بخطوة ═══ */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span>خطوات التجربة العملية الحية (اضغط على أي زر لتشغيل السيناريو):</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      تابع كيف تتغير الشاشات الأربعة وحالة الشبكة أدناه مع كل خطوة في الوقت الحقيقي
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400">العداد المركزي الموحد:</span>
                    <span className="text-sm font-black font-mono text-cyan-400 tracking-wider">
                      {(simClockMs / 1000).toFixed(3)}s
                    </span>
                  </div>
                </div>

                {/* أزرار الخطوات الخمس */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 pt-1">
                  {/* زر 1: النسخة التجريبية */}
                  <button
                    type="button"
                    onClick={handleSimReset}
                    className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                      simStep === 'trial'
                        ? 'bg-slate-800 border-slate-600 text-white shadow-md font-bold'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">1</span>
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <p className="text-xs font-bold text-white">الوضع التجريبي</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">4 مسارات محدودة لكل الهواتف</p>
                  </button>

                  {/* زر 2: تفعيل هاتف 1 وبث 1*4 */}
                  <button
                    type="button"
                    onClick={handleSimStepActivate}
                    className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                      simStep === 'activated'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md font-bold'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded font-mono">2</span>
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <p className="text-xs font-bold text-white">تفعيل كود 1*4 👑</p>
                    <p className="text-[10px] text-amber-400 mt-0.5">تفعيل هاتف 1 وبثه للبقية (8 أروقة)</p>
                  </button>

                  {/* زر 3: إطلاق مسدس السباق */}
                  <button
                    type="button"
                    onClick={handleSimStepStartRace}
                    className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                      simStep === 'racing'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md font-bold animate-pulse'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded font-mono">3</span>
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <p className="text-xs font-bold text-white">إطلاق السباق 🔫</p>
                    <p className="text-[10px] text-emerald-400 mt-0.5">صوت مسدس وتزامن العداد حياً</p>
                  </button>

                  {/* زر 4: خط النهاية والتحكيم */}
                  <button
                    type="button"
                    onClick={handleSimStepFinishRace}
                    className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                      simStep === 'finished'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md font-bold'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] bg-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded font-mono">4</span>
                      <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <p className="text-xs font-bold text-white">خط النهاية 🏁</p>
                    <p className="text-[10px] text-cyan-400 mt-0.5">صفارة + قراءة الليزر واعتماد الترتيب</p>
                  </button>

                  {/* زر 5: نقل الترخيص الآمن */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('transfer');
                      setTransferSourceDev(simPhones.start.id);
                      setTransferTargetDev('PF-9C3E-11B4');
                    }}
                    className="p-3 rounded-2xl border text-start transition-all cursor-pointer bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-purple-500/40"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-mono">5</span>
                      <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <p className="text-xs font-bold text-white">نقل وإبطال الترخيص 🔄</p>
                    <p className="text-[10px] text-purple-400 mt-0.5">حرق القديم ونقله لهاتف جديد</p>
                  </button>
                </div>
              </div>

              {/* ═══ المخطط الهندسي للمضمار الأولمبي (Stadium Track Architecture) ═══ */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-white">مخطط المضمار 400م وتمركز المحطات الأربع مع شبكة 1*4:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">رمز شبكة المضمار:</span>
                    <span className="text-xs font-mono font-bold text-amber-300 bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-800">
                      {roomCode}
                    </span>
                  </div>
                </div>

                {/* تمثيل تخطيطي للمضمار */}
                <div className="relative w-full h-44 sm:h-52 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 rounded-2xl border border-slate-800/80 p-4 flex items-center justify-center">
                  {/* حلقات المضمار البيضاوية */}
                  <div className="w-[88%] h-[80%] rounded-[100px] border-4 border-amber-900/40 relative flex items-center justify-center">
                    <div className="w-[82%] h-[74%] rounded-[80px] border-2 border-dashed border-slate-700/60 flex items-center justify-center">
                      <div className="w-[65%] h-[60%] rounded-[60px] bg-emerald-950/20 border border-emerald-500/20 flex flex-col items-center justify-center text-center p-2">
                        <span className="text-[10px] font-black text-emerald-400 tracking-wider">ميدان ألعاب القوى 🏟️</span>
                        <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                          {simMeshSharedLicense 
                            ? 'شبكة التفعيل الموحدة 1*4 متصلة ومتقاسمة 🟢' 
                            : 'في انتظار بث الترخيص الشبكي 1*4 ⚪'}
                        </span>
                      </div>
                    </div>

                    {/* محطة 1: البداية (Top-Right) */}
                    <div className="absolute top-0 start-10 -translate-y-1/2 flex items-center gap-1.5 bg-slate-900 border border-emerald-500/60 px-2.5 py-1 rounded-full shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span className="text-[10px] font-bold text-emerald-300">🚦 محطة البداية (هاتف 1)</span>
                    </div>

                    {/* محطة 2: النهاية (Bottom-Left) */}
                    <div className="absolute bottom-0 end-10 translate-y-1/2 flex items-center gap-1.5 bg-slate-900 border border-cyan-500/60 px-2.5 py-1 rounded-full shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      <span className="text-[10px] font-bold text-cyan-300">📸 كاميرا النهاية (هاتف 2)</span>
                    </div>

                    {/* محطة 3: الحكم (Center-Bottom) */}
                    <div className="absolute bottom-2 start-1/3 flex items-center gap-1.5 bg-slate-900 border border-amber-500/60 px-2.5 py-1 rounded-full shadow-lg">
                      <Award className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] font-bold text-amber-300">⚖️ برج الحكام (هاتف 3)</span>
                    </div>

                    {/* محطة 4: غرفة النداء (Top-Left) */}
                    <div className="absolute top-0 end-10 -translate-y-1/2 flex items-center gap-1.5 bg-slate-900 border border-purple-500/60 px-2.5 py-1 rounded-full shadow-lg">
                      <Users className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] font-bold text-purple-300">📋 غرفة النداء (هاتف 4)</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>🟢 إشارة التزامن الصوتي والبصري: &lt; 0.5ms أوفلاين عبر بروتوكول P2P WebRTC / Local Mesh</span>
                  <span>🏆 هاتف واحد يدفع الاشتراك ➔ البقية مجاناً في نفس البطولة</span>
                </div>
              </div>

              {/* ═══ المحاكي الحي: شاشات الهواتف الأربعة في إطارات واقعية ═══ */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-cyan-400" />
                    <span>شاشات الهواتف الأربعة المباشرة أثناء سير السباق:</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    تتفاعل الشاشات فورياً مع الأزرار وتزامن العداد
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {/* ──────────────────────────────────
                      الهاتف 1: هاتف البداية (Starter)
                  ────────────────────────────────── */}
                  <div className="bg-slate-950 border-2 border-emerald-500/40 rounded-[32px] p-3 shadow-2xl flex flex-col justify-between space-y-3 relative overflow-hidden">
                    {/* إطار الهاتف العلوي */}
                    <div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
                      <span>09:41</span>
                      {/* Notch */}
                      <div className="w-14 h-3.5 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px]">
                        <Wifi className="w-2.5 h-2.5 text-emerald-400" />
                        <span>98%</span>
                      </div>
                    </div>

                    {/* محتوى شاشة البداية */}
                    <div className="space-y-3 flex-1 flex flex-col justify-between pt-1">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-400">1. هاتف البداية 🚦</span>
                          <span className="text-[9px] font-mono text-slate-500">{simPhones.start.id}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">محطة إطلاق مسدس السباق</p>
                      </div>

                      {/* حالة الصلاحية */}
                      <div className={`p-2.5 rounded-2xl border text-center transition-all ${
                        simPhones.start.license
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}>
                        <div className="flex items-center justify-center gap-1 text-[11px] font-black">
                          {simPhones.start.license ? <Crown className="w-3.5 h-3.5" /> : null}
                          <span>
                            {simPhones.start.license ? 'مضيف الترخيص الأساسي 👑' : 'نسخة تجريبية (4 أروقة)'}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {simPhones.start.license ? '8 أروقة + بث شبكي نشط 1*4' : 'اضغط الخطوة 2 لتفعيله كود 1*4'}
                        </p>
                      </div>

                      {/* واجهة إطلاق السباق الصوتية */}
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 space-y-2">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">حساس صوت المسدس:</span>
                          <span className="text-emerald-400 font-mono font-bold">96 dB (جاهز)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                          <div className={`h-full ${simIsRacing ? 'bg-emerald-400 w-full animate-pulse' : 'bg-slate-700 w-1/4'}`}></div>
                        </div>

                        <div className="grid grid-cols-2 gap-1 pt-1">
                          <div className="bg-slate-950 p-1.5 rounded-lg text-center text-[10px] text-slate-300">
                            À vos marques
                          </div>
                          <div className="bg-slate-950 p-1.5 rounded-lg text-center text-[10px] text-amber-300 font-bold">
                            Prêts 🟡
                          </div>
                        </div>
                      </div>

                      {/* زر تشغيل محطة البداية */}
                      <button
                        type="button"
                        onClick={handleSimStepStartRace}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>إطلاق طلقة البداية 🔫</span>
                      </button>
                    </div>
                  </div>

                  {/* ──────────────────────────────────
                      الهاتف 2: كاميرا خط النهاية (Finish Camera)
                  ────────────────────────────────── */}
                  <div className="bg-slate-950 border-2 border-cyan-500/40 rounded-[32px] p-3 shadow-2xl flex flex-col justify-between space-y-3 relative overflow-hidden">
                    {/* إطار الهاتف العلوي */}
                    <div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
                      <span>09:41</span>
                      <div className="w-14 h-3.5 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px]">
                        <Wifi className="w-2.5 h-2.5 text-cyan-400" />
                        <span>94%</span>
                      </div>
                    </div>

                    {/* محتوى كاميرا النهاية */}
                    <div className="space-y-3 flex-1 flex flex-col justify-between pt-1">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-cyan-400">2. كاميرا النهاية 📸</span>
                          <span className="text-[9px] font-mono text-slate-500">{simPhones.finish.id}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">حساس ليزر و Photo Finish 1000 FPS</p>
                      </div>

                      {/* شارة التفعيل الشبكي 1*4 المتقاسم */}
                      <div className={`p-2.5 rounded-2xl border text-center transition-all ${
                        simMeshSharedLicense
                          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}>
                        <div className="flex items-center justify-center gap-1 text-[11px] font-black">
                          {simMeshSharedLicense ? <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> : null}
                          <span>
                            {simMeshSharedLicense ? 'متقاسم التفعيل 1*4 (8 مسارات) 🏆' : 'نسخة تجريبية (4 أروقة)'}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {simMeshSharedLicense ? 'ورث الترخيص مجاناً من هاتف 1 عبر شبكة المضمار' : 'لم يتم بث الترخيص بعد'}
                        </p>
                      </div>

                      {/* محدد الرؤية البصري لخط النهاية مع خط الليزر الأحمر */}
                      <div className="relative h-28 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center">
                        {/* خط ليزر الوصول الأحمر */}
                        <div className="absolute top-0 bottom-0 end-1/2 w-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] z-10"></div>
                        <span className="absolute top-1 end-2 text-[8px] bg-red-950/80 text-red-300 px-1 rounded border border-red-500/40">
                          LASER LINE
                        </span>

                        {simRunnerFinished ? (
                          <div className="text-center space-y-1 z-20">
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/40">
                              تم التقاط الوصول: {simLeaderTime}s
                            </span>
                            <p className="text-[9px] text-slate-400">جذع المتسابق (رواق 4) قطع الخط 🏁</p>
                          </div>
                        ) : simIsRacing ? (
                          <div className="text-center text-cyan-400 text-xs font-mono animate-pulse">
                            جاري مسح خط الوصول...
                          </div>
                        ) : (
                          <div className="text-center text-[10px] text-slate-500">
                            الكاميرا في وضع الاستعداد
                          </div>
                        )}
                      </div>

                      {/* زر التقاط خط النهاية */}
                      <button
                        type="button"
                        onClick={handleSimStepFinishRace}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>تسجيل وصول خط النهاية 🏁</span>
                      </button>
                    </div>
                  </div>

                  {/* ──────────────────────────────────
                      الهاتف 3: رئيس الحكام والنتائج (Chief Judge)
                  ────────────────────────────────── */}
                  <div className="bg-slate-950 border-2 border-amber-500/40 rounded-[32px] p-3 shadow-2xl flex flex-col justify-between space-y-3 relative overflow-hidden">
                    {/* إطار الهاتف العلوي */}
                    <div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
                      <span>09:41</span>
                      <div className="w-14 h-3.5 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px]">
                        <Wifi className="w-2.5 h-2.5 text-amber-400" />
                        <span>99%</span>
                      </div>
                    </div>

                    {/* محتوى هاتف رئيس الحكام */}
                    <div className="space-y-3 flex-1 flex flex-col justify-between pt-1">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-amber-400">3. هاتف رئيس الحكام ⚖️</span>
                          <span className="text-[9px] font-mono text-slate-500">{simPhones.judge.id}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">لوحة التوقيت واعتماد الترتيب</p>
                      </div>

                      {/* شارة التفعيل الشبكي 1*4 المتقاسم */}
                      <div className={`p-2.5 rounded-2xl border text-center transition-all ${
                        simMeshSharedLicense
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}>
                        <div className="flex items-center justify-center gap-1 text-[11px] font-black">
                          {simMeshSharedLicense ? <Award className="w-3.5 h-3.5 text-amber-400" /> : null}
                          <span>
                            {simMeshSharedLicense ? 'متقاسم التفعيل 1*4 (8 مسارات) 🏆' : 'نسخة تجريبية (4 أروقة)'}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {simMeshSharedLicense ? 'تصدير استمارات IAAF مفتوح بالكامل' : 'مقيد بـ 4 مسارات تجريبية'}
                        </p>
                      </div>

                      {/* شاشة التوقيت الرقمي الموحد */}
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 text-center space-y-1">
                        <span className="text-[9px] text-slate-400 block">التوقيت المتزامن المعتمد:</span>
                        <div className="text-xl font-black font-mono text-amber-400 tracking-wider">
                          {simRunnerFinished 
                            ? `00:${simLeaderTime.toFixed(3)}` 
                            : simIsRacing 
                            ? `00:${(simClockMs / 1000).toFixed(3)}` 
                            : '00:00.000'}
                        </div>
                        <span className="text-[9px] text-emerald-400">ريح: +0.8 م/ث • نظام IAAF</span>
                      </div>

                      {/* ترتيب المراكز الثلاثة الأولى */}
                      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2 space-y-1 text-[10px]">
                        <div className="flex justify-between font-bold text-white">
                          <span>1. رواق 4 (أمين بوحفص) 🥇</span>
                          <span className="font-mono text-amber-300">{simLeaderTime.toFixed(3)}s</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>2. رواق 5 (كريم بلحاج) 🥈</span>
                          <span className="font-mono">{(simLeaderTime + 0.076).toFixed(3)}s</span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>3. رواق 3 (سفيان رحماني) 🥉</span>
                          <span className="font-mono">{(simLeaderTime + 0.163).toFixed(3)}s</span>
                        </div>
                      </div>

                      {/* زر تصدير النتائج */}
                      <button
                        type="button"
                        onClick={() => alert(`تقرير تحكيم رسمي IAAF:\nالفائز: أمين بوحفص (الرواق 4)\nالزمن: ${simLeaderTime}s\nحالة الترخيص: Pro Club 1*4 معتمد وموثق.`)}
                        className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Award className="w-3.5 h-3.5 fill-slate-950" />
                        <span>اعتماد وطباعة النتيجة IAAF 📄</span>
                      </button>
                    </div>
                  </div>

                  {/* ──────────────────────────────────
                      الهاتف 4: غرفة النداء (Call Room)
                  ────────────────────────────────── */}
                  <div className="bg-slate-950 border-2 border-purple-500/40 rounded-[32px] p-3 shadow-2xl flex flex-col justify-between space-y-3 relative overflow-hidden">
                    {/* إطار الهاتف العلوي */}
                    <div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
                      <span>09:41</span>
                      <div className="w-14 h-3.5 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px]">
                        <Wifi className="w-2.5 h-2.5 text-purple-400" />
                        <span>96%</span>
                      </div>
                    </div>

                    {/* محتوى غرفة النداء */}
                    <div className="space-y-3 flex-1 flex flex-col justify-between pt-1">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-purple-400">4. غرفة النداء 📋</span>
                          <span className="text-[9px] font-mono text-slate-500">{simPhones.chambre.id}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">مطابقة الصدريات وتوزيع الأروقة</p>
                      </div>

                      {/* شارة التفعيل الشبكي 1*4 المتقاسم */}
                      <div className={`p-2.5 rounded-2xl border text-center transition-all ${
                        simMeshSharedLicense
                          ? 'bg-purple-500/20 border-purple-500/60 text-purple-300'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}>
                        <div className="flex items-center justify-center gap-1 text-[11px] font-black">
                          {simMeshSharedLicense ? <Users className="w-3.5 h-3.5 text-purple-400" /> : null}
                          <span>
                            {simMeshSharedLicense ? 'متقاسم التفعيل 1*4 (8 مسارات) 🏆' : 'نسخة تجريبية (4 أروقة)'}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {simMeshSharedLicense ? 'إمكانية إدخال 8 عدائين كاملين' : 'أقصى حد 4 عدائين في التجريبي'}
                        </p>
                      </div>

                      {/* قائمة العدائين والصدريات */}
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 space-y-1.5">
                        <span className="text-[9px] text-slate-400 font-bold block">فحص الأروقة والصدريات:</span>
                        <div className="space-y-1 text-[10px]">
                          <div className="flex items-center justify-between bg-slate-950 px-2 py-1 rounded">
                            <span className="text-white">رواق 1: #104 بن علي</span>
                            <span className="text-emerald-400 font-bold">✓ حاضر</span>
                          </div>
                          <div className="flex items-center justify-between bg-slate-950 px-2 py-1 rounded">
                            <span className="text-white">رواق 4: #201 بوحفص</span>
                            <span className="text-emerald-400 font-bold">✓ حاضر</span>
                          </div>
                          <div className="flex items-center justify-between bg-slate-950 px-2 py-1 rounded">
                            <span className="text-white">رواق 5: #312 بلحاج</span>
                            <span className="text-emerald-400 font-bold">✓ حاضر</span>
                          </div>
                        </div>
                      </div>

                      {/* زر تأكيد جاهزية العدائين */}
                      <button
                        type="button"
                        onClick={() => alert('تمت مطابقة صدريات العدائين في غرفة النداء بنجاح ونقل القائمة إلى خط البداية!')}
                        className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>تأكيد جاهزية العدائين للمضمار ✓</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              القسم 6: إعدادات الأسعار والمنظومة (Settings)
          ═══════════════════════════════════════════════ */}
          {activeSection === 'settings' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-amber-400" />
                    <span>إعدادات أسعار الاشتراكات والمنظومة العامة</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    تحديد أسعار باقات الأندية والاتحادات، وتحديد العملة الوحيدة المعتمدة للظهور (الدينار الجزائري د.ج افتراضياً)، ومدة التجربة المجانية
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                  <span>حفظ جميع الإعدادات فورياً 💾</span>
                </button>
              </div>

              {settingsSavedMessage && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{settingsSavedMessage}</span>
                </div>
              )}

              {/* 1. العملة الافتراضية ومدة التجربة */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span>العملة الوحيدة المعتمدة للظهور في التطبيق:</span>
                    </label>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                      قفل العملة 🔒
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    اختر العملة الحصرية التي ستظهر بها الأسعار في تطبيق السباق. لن تظهر أزرار تحويل العملات للعميل وستُعرض الأسعار بهذه العملة فقط منعاً للتشتيت:
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    {(['DZD', 'EUR', 'USD'] as CurrencyCode[]).map(cur => {
                      const isSelected = systemSettings.displayCurrency === cur || (!systemSettings.displayCurrency && systemSettings.defaultCurrency === cur);
                      return (
                        <button
                          key={cur}
                          type="button"
                          onClick={() => {
                            setSystemSettings(prev => ({
                              ...prev,
                              displayCurrency: cur,
                              defaultCurrency: cur
                            }));
                          }}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-black shadow-md shadow-amber-500/10'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="block">{cur === 'DZD' ? 'د.ج (الجزائر 🇩🇿)' : cur === 'EUR' ? 'اليورو € 🇪🇺' : 'الدولار $ 🇺🇸'}</span>
                          {cur === 'DZD' && <span className="text-[9px] text-amber-400 font-normal">الافتراضية الرسمية</span>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-emerald-400 font-medium">
                    ✓ تم قفل العرض على: {systemSettings.displayCurrency === 'DZD' ? 'الدينار الجزائري (د.ج 🇩🇿)' : systemSettings.displayCurrency === 'EUR' ? 'اليورو (€)' : 'الدولار ($)'}
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>مدة التجربة المجانية بكامل خصائص 1*4:</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 7, 14, 30].map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setSystemSettings(prev => ({ ...prev, trialDurationDays: days }))}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                          systemSettings.trialDurationDays === days
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-black'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {days} أيام {days === 7 ? '⭐' : ''}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    بعد نهاية هذه الفترة يُغلق التطبيق ولا يُفتح إلا بالاشتراك أو بالاتصال بشبكة هاتف مشترك (1*4).
                  </p>
                </div>
              </div>

              {/* 2. أسعار باقة الأندية Pro Club */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-amber-300 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>تعديل أسعار باقة الأندية والمدربين (Pro Club - 8 مسارات + 1*4 شبكي):</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">تعديل بالـ DZD د.ج، EUR €، USD $</span>
                </div>

                <div className="space-y-3">
                  {systemSettings.clubProPrices.map((item, index) => (
                    <div key={item.months} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center gap-3">
                      <div className="w-full sm:w-44 text-start">
                        <span className="text-xs font-bold text-white">{item.label}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 flex-1 w-full">
                        <div className="space-y-1">
                          <span className="text-[10px] text-amber-400 font-bold">بالدينار الجزائري (د.ج):</span>
                          <input
                            type="number"
                            value={item.prices.DZD}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              const updated = [...systemSettings.clubProPrices];
                              updated[index].prices.DZD = val;
                              setSystemSettings(prev => ({ ...prev, clubProPrices: updated }));
                            }}
                            className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs rounded-lg p-2"
                          />
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-cyan-400 font-bold">باليورو (€):</span>
                          <input
                            type="number"
                            value={item.prices.EUR}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              const updated = [...systemSettings.clubProPrices];
                              updated[index].prices.EUR = val;
                              setSystemSettings(prev => ({ ...prev, clubProPrices: updated }));
                            }}
                            className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs rounded-lg p-2"
                          />
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-emerald-400 font-bold">بالدولار ($):</span>
                          <input
                            type="number"
                            value={item.prices.USD}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              const updated = [...systemSettings.clubProPrices];
                              updated[index].prices.USD = val;
                              setSystemSettings(prev => ({ ...prev, clubProPrices: updated }));
                            }}
                            className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs rounded-lg p-2"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. أسعار باقة الاتحادات الرسمية Enterprise */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-purple-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    <span>تعديل أسعار رخصة الاتحادات الرسمية (Enterprise - 10 مسارات + 1*4 شبكي):</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">تعديل بالـ DZD د.ج، EUR €، USD $</span>
                </div>

                <div className="space-y-3">
                  {systemSettings.enterprisePrices.map((item, index) => (
                    <div key={item.months} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center gap-3">
                      <div className="w-full sm:w-44 text-start">
                        <span className="text-xs font-bold text-white">{item.label}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 flex-1 w-full">
                        <div className="space-y-1">
                          <span className="text-[10px] text-amber-400 font-bold">بالدينار الجزائري (د.ج):</span>
                          <input
                            type="number"
                            value={item.prices.DZD}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              const updated = [...systemSettings.enterprisePrices];
                              updated[index].prices.DZD = val;
                              setSystemSettings(prev => ({ ...prev, enterprisePrices: updated }));
                            }}
                            className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs rounded-lg p-2"
                          />
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-cyan-400 font-bold">باليورو (€):</span>
                          <input
                            type="number"
                            value={item.prices.EUR}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              const updated = [...systemSettings.enterprisePrices];
                              updated[index].prices.EUR = val;
                              setSystemSettings(prev => ({ ...prev, enterprisePrices: updated }));
                            }}
                            className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs rounded-lg p-2"
                          />
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-emerald-400 font-bold">بالدولار ($):</span>
                          <input
                            type="number"
                            value={item.prices.USD}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              const updated = [...systemSettings.enterprisePrices];
                              updated[index].prices.USD = val;
                              setSystemSettings(prev => ({ ...prev, enterprisePrices: updated }));
                            }}
                            className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs rounded-lg p-2"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. بيانات التواصل لطلب الاشتراكات */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-black text-cyan-300 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-cyan-400" />
                  <span>بيانات الاتصال والتواصل الموضحة للعملاء في التطبيق:</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold">رقم الواتساب الرسمي (مع الرمز الدولي):</label>
                    <input
                      type="text"
                      value={systemSettings.contactWhatsApp}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, contactWhatsApp: e.target.value }))}
                      placeholder="+213555000000"
                      className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-xs rounded-lg p-2.5"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold">رقم الهاتف للاتصال المباشر:</label>
                    <input
                      type="text"
                      value={systemSettings.contactPhone}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, contactPhone: e.target.value }))}
                      placeholder="+213 (0) 555 00 00 00"
                      className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-xs rounded-lg p-2.5"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold">البريد الإلكتروني للإدارة:</label>
                    <input
                      type="email"
                      value={systemSettings.contactEmail}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, contactEmail: e.target.value }))}
                      placeholder="contact@aquacore.dz"
                      className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-xs rounded-lg p-2.5"
                    />
                  </div>
                </div>
              </div>

              {/* أزرار الحفظ والإعادة */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('هل تريد استعادة الأسعار والإعدادات الافتراضية للنظام؟')) {
                      pricingService.resetSettings();
                      setSystemSettings(pricingService.settings);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  استعادة الافتراضيات
                </button>

                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                  <span>حفظ جميع الإعدادات فورياً 💾</span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* نوافذ منظومة العدائين والأندية */}
      <AthletesDatabaseModal
        isOpen={isAthletesModalOpen}
        onClose={() => setIsAthletesModalOpen(false)}
      />

      <ClubsDatabaseModal
        isOpen={isClubsModalOpen}
        onClose={() => setIsClubsModalOpen(false)}
      />
    </div>
  );
};

export default AdminPortal;
