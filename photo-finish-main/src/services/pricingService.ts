/**
 * خدمة إدارة أسعار الاشتراكات والعملات والفترة التجريبية (Pricing & Subscription Service)
 * 
 * الميزات:
 * 1. دعم العملات المتعددة مع جعل الدينار الجزائري (DZD) هو الافتراضي.
 * 2. حفظ واسترجاع الأسعار وقنوات التواصل في التخزين المحلي.
 * 3. إدارة الفترة التجريبية (7 أيام كاملة الميزات 1*4 افتراضياً).
 */

export type CurrencyCode = 'DZD' | 'EUR' | 'USD';

export interface PlanPriceItem {
  months: number;
  label: string;
  prices: {
    DZD: number;
    EUR: number;
    USD: number;
  };
}

export interface CustomPackage {
  id: string;
  name: string;
  description: string;
  laneCount: number;
  durationMonths: number;
  durationLabel: string;
  priceDZD: number;
  priceEUR: number;
  priceUSD: number;
  features: string[];
  badge?: string;
  tierCode: 'CLB8' | 'ENTX';
  isQuadPool: boolean;
  createdAt: string;
}

export interface SubscriptionSettings {
  displayCurrency: CurrencyCode; // العملة الوحيدة المحددة للظهور في التطبيق (DZD افتراضياً)
  defaultCurrency: CurrencyCode;
  trialDurationDays: number;
  contactWhatsApp: string;
  contactPhone: string;
  contactEmail: string;
  clubProPrices: PlanPriceItem[];
  enterprisePrices: PlanPriceItem[];
  customPackages: CustomPackage[]; // قائمة الباقات الخاصة المخصصة
}

export const DEFAULT_CUSTOM_PACKAGES: CustomPackage[] = [
  {
    id: 'pkg-schools-2026',
    name: 'باقة المدارس والناشئين (School & Youth)',
    description: 'باقة مخصصة للمنافسات المدرسية والجامعية وأكاديميات الفئات الصغرى',
    laneCount: 6,
    durationMonths: 12,
    durationLabel: 'سنة كاملة (موسم دراسي)',
    priceDZD: 15000,
    priceEUR: 95,
    priceUSD: 105,
    features: [
      'تحكيم حتى 6 مسارات (أروقة) كاملة',
      'تفعيل شبكي 1*4: هاتف واحد يفعل الصلاحيات لـ 4 هواتف',
      'حساسات بصرية دقيقة 1/1000 ثانية للمسافات القصيرة',
      'تصدير استمارات التحكيم وقوائم العدائين IAAF',
      'إمكانية تحويل الترخيص لهاتف آخر'
    ],
    badge: 'باقة خاصة 🌟',
    tierCode: 'CLB8',
    isQuadPool: true,
    createdAt: '2026-09-30'
  },
  {
    id: 'pkg-wilaya-2026',
    name: 'باقة الرابطات الولائية (State League)',
    description: 'مصممة لتغطية بطولات الرابطات الولائية وأندية النخبة طوال الموسم',
    laneCount: 8,
    durationMonths: 12,
    durationLabel: 'سنة كاملة (موسم رياضي)',
    priceDZD: 36000,
    priceEUR: 220,
    priceUSD: 240,
    features: [
      'تحكيم حتى 8 أروقة أولمبية معتمدة',
      'تفعيل شبكي متقدم 1*4 لكافة محطات المضمار',
      'تقارير نتائج رقمية معتمدة وفق لوائح الاتحاد الدولي IAAF/WA',
      'تصدير أشرطة Photo Finish بدقة عالية جداً',
      'دعم فني وتدريب طواقم التحكيم الولائي'
    ],
    badge: 'رابطات ولائية 🏆',
    tierCode: 'CLB8',
    isQuadPool: true,
    createdAt: '2026-09-30'
  }
];

export const DEFAULT_SUBSCRIPTION_SETTINGS: SubscriptionSettings = {
  displayCurrency: 'DZD', // العملة الوحيدة المحددة للظهور (الدينار الجزائري د.ج)
  defaultCurrency: 'DZD',
  trialDurationDays: 7, // 7 أيام كتجريب للتطبيق بكامل خصائصه 1*4
  contactWhatsApp: '+213555000000',
  contactPhone: '+213 (0) 555 00 00 00',
  contactEmail: 'contact@aquacore.dz',
  clubProPrices: [
    {
      months: 3,
      label: '3 أشهر',
      prices: { DZD: 8000, EUR: 50, USD: 55 }
    },
    {
      months: 6,
      label: '6 أشهر',
      prices: { DZD: 14000, EUR: 85, USD: 95 }
    },
    {
      months: 12,
      label: 'سنة كاملة (اشتراك سنوي)',
      prices: { DZD: 24000, EUR: 150, USD: 165 }
    }
  ],
  enterprisePrices: [
    {
      months: 12,
      label: 'سنة كاملة (رسمي)',
      prices: { DZD: 55000, EUR: 350, USD: 390 }
    },
    {
      months: 24,
      label: 'سنتين (بطولات واتحادات)',
      prices: { DZD: 95000, EUR: 600, USD: 660 }
    }
  ],
  customPackages: DEFAULT_CUSTOM_PACKAGES
};

const STORAGE_SETTINGS_KEY = 'pf_subscription_settings_v3';
const STORAGE_INSTALL_DATE_KEY = 'pf_app_first_installed_at_v3';

class PricingService {
  private _settings: SubscriptionSettings = DEFAULT_SUBSCRIPTION_SETTINGS;
  private _installDate: number = 0;
  private _listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  public load() {
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this._settings = { 
          ...DEFAULT_SUBSCRIPTION_SETTINGS, 
          ...parsed,
          displayCurrency: parsed.displayCurrency || parsed.defaultCurrency || 'DZD',
          customPackages: parsed.customPackages && parsed.customPackages.length > 0
            ? parsed.customPackages 
            : DEFAULT_CUSTOM_PACKAGES
        };
      }
    } catch (e) {
      console.warn('Failed to load subscription settings', e);
    }

    try {
      const savedDate = localStorage.getItem(STORAGE_INSTALL_DATE_KEY);
      if (savedDate) {
        this._installDate = parseInt(savedDate, 10);
      } else {
        this._installDate = Date.now();
        localStorage.setItem(STORAGE_INSTALL_DATE_KEY, this._installDate.toString());
      }
    } catch {
      this._installDate = Date.now();
    }
  }

  public get settings(): SubscriptionSettings {
    return this._settings;
  }

  public get displayCurrency(): CurrencyCode {
    return this._settings.displayCurrency || this._settings.defaultCurrency || 'DZD';
  }

  public saveSettings(newSettings: SubscriptionSettings) {
    this._settings = {
      ...newSettings,
      displayCurrency: newSettings.displayCurrency || newSettings.defaultCurrency || 'DZD'
    };
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(this._settings));
    this.notify();
  }

  public setDisplayCurrency(currency: CurrencyCode) {
    this._settings.displayCurrency = currency;
    this._settings.defaultCurrency = currency;
    this.saveSettings(this._settings);
  }

  // إدارة الباقات الخاصة المخصصة
  public addCustomPackage(pkg: Omit<CustomPackage, 'id' | 'createdAt'>): CustomPackage {
    const newPkg: CustomPackage = {
      ...pkg,
      id: `pkg-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updated = [newPkg, ...(this._settings.customPackages || [])];
    this.saveSettings({ ...this._settings, customPackages: updated });
    return newPkg;
  }

  public updateCustomPackage(id: string, updates: Partial<CustomPackage>) {
    const updated = (this._settings.customPackages || []).map(p => p.id === id ? { ...p, ...updates } : p);
    this.saveSettings({ ...this._settings, customPackages: updated });
  }

  public deleteCustomPackage(id: string) {
    const updated = (this._settings.customPackages || []).filter(p => p.id !== id);
    this.saveSettings({ ...this._settings, customPackages: updated });
  }

  public getPackagePrice(pkg: CustomPackage, currency?: CurrencyCode): number {
    const cur = currency || this.displayCurrency;
    if (cur === 'EUR') return pkg.priceEUR;
    if (cur === 'USD') return pkg.priceUSD;
    return pkg.priceDZD;
  }

  public resetSettings() {
    this._settings = DEFAULT_SUBSCRIPTION_SETTINGS;
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(DEFAULT_SUBSCRIPTION_SETTINGS));
    this.notify();
  }

  public get installDate(): number {
    return this._installDate;
  }

  /// مدة التجربة بالمللي ثانية
  public get trialDurationMs(): number {
    return this._settings.trialDurationDays * 24 * 60 * 60 * 1000;
  }

  /// تاريخ انتهاء التجربة
  public get trialExpiryDate(): Date {
    return new Date(this._installDate + this.trialDurationMs);
  }

  /// هل انتهت فترة الـ 7 أيام التجريبية؟
  public isTrialExpired(): boolean {
    return Date.now() > this.trialExpiryDate.getTime();
  }

  /// عدد الساعات أو الأيام المتبقية في التجربة
  public getRemainingTrialText(): string {
    const diffMs = this.trialExpiryDate.getTime() - Date.now();
    if (diffMs <= 0) return 'انتهت الفترة التجريبية (0 يوم)';

    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 0) {
      return `متبقي ${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومان' : 'أيام'} تجريبية`;
    }
    return `متبقي ${hours} ساعة تجريبية`;
  }

  public formatPrice(amount: number, currency?: CurrencyCode): string {
    const cur = currency || this.displayCurrency;
    switch (cur) {
      case 'DZD':
        return `${amount.toLocaleString('ar-DZ')} د.ج`;
      case 'EUR':
        return `${amount.toLocaleString('fr-FR')} €`;
      case 'USD':
        return `$${amount.toLocaleString('en-US')}`;
    }
  }

  public subscribe(fn: () => void) {
    this._listeners.add(fn);
    return () => { this._listeners.delete(fn); };
  }

  private notify() {
    this._listeners.forEach(fn => fn());
  }
}

export const pricingService = new PricingService();
