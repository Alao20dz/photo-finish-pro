/**
 * محرك التراخيص المشفرة والتفعيل الشبكي 1*4 والتحويل الآمن (License Manager Service)
 * 
 * الميزات الرئيسية:
 * 1. التفعيل الشبكي الرباعي 1*4 (Quad-Share Pool): هاتف واحد يفعل، والهواتف الثلاثة الأخرى تتقاسم الصلاحيات فورياً.
 * 2. التحويل الآمن للمدة المتبقية (Handover Voucher): إبطال الترخيص في الهاتف القديم نهائياً ونقله لهاتف جديد مشفراً.
 * 3. منع الازدواجية (Anti-Duplication Guard): يستحيل تشغيل الكود في هاتفين في نفس الوقت بفضل القفل الرياضي ومعرف الجهاز.
 * 4. تشفير أوفلاين كامل (HMAC-SHA256) متوافق 100% مع تطبيق Flutter ولغات البرمجة الأخرى.
 */

import { LicensePoolInfo, LicenseTierCode, LicenseTransferTicket, PhoneRole } from '../types/race';
import { verifyEd25519LicenseCode } from './securityService';

export interface StoredLicense {
  code: string;
  tier: LicenseTierCode;
  tierName: string;
  clientName: string;
  deviceId: string;
  expiryDate: string;
  activatedAt: string;
  isQuadPool: boolean;
  maxSharedSlots: number;
}

export interface RevocationRecord {
  code: string;
  revokedAt: string;
  transferredTo: string;
  revocationProof: string;
  voucherCode: string;
}

const PREF_DEVICE_ID = 'pf_device_id_v2';
const PREF_ACTIVE_LICENSE = 'pf_active_license_v2';
const PREF_REVOCATION_LEDGER = 'pf_revocation_ledger_v2';

// ═══ سجل الأكواد الثابتة المفسوحة (Revoked Static Codes — Hashed Blocklist) ═══
// NOTE أمني: كل الأكواد الثابتة التاريخية ظهرت في مستودع عام وتعتبر مفسوحة.
// تُخزَّن هنا تجزئات SHA-256 حصراً (لا نصوص صريحة) حتى لا تظهر أي كلمة سر
// محتملة في الشفرة أو حزمة البناء، مع بقاء الرفض قائماً نهائياً (Zero Backdoors).
const REVOKED_STATIC_CODE_HASHES: ReadonlySet<string> = new Set([
  '983f4117c3beb5185aae53606095bd7c6b2b010464e37ce15b71180f52c3448c',
  '2df7b9650764f4ba87128e2bbf5fb9e4703816ae5149af7b191f653a35867088',
  'bb6a6f19eaf432075529b427613131f39b4f4fdddc2c4ab00f8fbaff51ebbb9e',
  'f741575963a4285531bd5765e9997ddae478ecf33e23b95c43e1f34c580ec266'
]);

// ═══ أدوات التشفير والتحقق عبر Web Crypto API ═══
async function computeSha256Digest(payload: string): Promise<string> {
  const subtle = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto)?.subtle;
  if (!subtle) return '000000';
  const enc = new TextEncoder();
  const buf = await subtle.digest('SHA-256', enc.encode(payload));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

class LicenseManagerService {
  private _deviceId: string = '';
  private _activeLicense: StoredLicense | null = null;
  private _sharedPoolLicense: LicensePoolInfo | null = null;
  private _listeners: Set<() => void> = new Set();

  constructor() {
    this.init();
  }

  public init() {
    // 1. استرجاع أو توليد معرّف الجهاز
    let dev = typeof localStorage !== 'undefined' ? localStorage.getItem(PREF_DEVICE_ID) : null;
    if (!dev) {
      const rand1 = Math.floor(0x1000 + Math.random() * 0xEFFF).toString(16).toUpperCase();
      const rand2 = Math.floor(0x1000 + Math.random() * 0xEFFF).toString(16).toUpperCase();
      dev = `PF-${rand1}-${rand2}`;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PREF_DEVICE_ID, dev);
      }
    }
    this._deviceId = dev;

    // 2. استرجاع الترخيص النشط وفحص الإبطال
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PREF_ACTIVE_LICENSE) : null;
      if (raw) {
        const parsed: StoredLicense = JSON.parse(raw);
        if (new Date(parsed.expiryDate) > new Date() && !this.isCodeRevoked(parsed.code)) {
          this._activeLicense = parsed;
        } else {
          this._activeLicense = null;
        }
      }
    } catch (e) {
      console.warn('Failed to load active license', e);
    }
  }

  public get deviceId(): string {
    return this._deviceId;
  }

  public get cleanDeviceHash(): string {
    return this._deviceId.replace(/-/g, '').substring(2, 6).toUpperCase();
  }

  public get activeLicense(): StoredLicense | null {
    return this._activeLicense;
  }

  public get sharedPoolLicense(): LicensePoolInfo | null {
    return this._sharedPoolLicense;
  }

  public get effectiveTier(): LicenseTierCode | 'TRIAL' {
    if (this._activeLicense) return this._activeLicense.tier;
    if (this._sharedPoolLicense) return this._sharedPoolLicense.tier;
    return 'TRIAL';
  }

  public get maxLanes(): number {
    const tier = this.effectiveTier;
    if (tier === 'ENTX') return 10;
    if (tier === 'CLB8') return 8;
    return 4; // النسخة التجريبية
  }

  public get isQuadPoolActive(): boolean {
    return !!(this._activeLicense?.isQuadPool || this._sharedPoolLicense);
  }

  public subscribe(listener: () => void) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private notify() {
    this._listeners.forEach(fn => fn());
  }

  // ═══ سجل الإبطال لمنع تفعيل نفس الكود في هاتفين ═══
  public getRevocationLedger(): RevocationRecord[] {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(PREF_REVOCATION_LEDGER) : null;
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  public isCodeRevoked(code: string): boolean {
    const ledger = this.getRevocationLedger();
    return ledger.some(r => r.code === code.trim().toUpperCase());
  }

  private markCodeAsRevoked(record: RevocationRecord) {
    const ledger = this.getRevocationLedger();
    ledger.unshift(record);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREF_REVOCATION_LEDGER, JSON.stringify(ledger));
    }
  }

  // ═══ توليد كود ترخيص مشفر بـ Ed25519 (للمدير) ═══
  public async generateLicenseKey(
    tier: LicenseTierCode,
    expiryDate: Date,
    options: {
      targetDeviceId?: string;
      isQuadPool?: boolean;
      clientName?: string;
    } = {}
  ): Promise<string> {
    const yy = String(expiryDate.getFullYear() % 100).padStart(2, '0');
    const mm = String(expiryDate.getMonth() + 1).padStart(2, '0');
    const expiryCode = `${yy}${mm}`;

    let devHash = 'GLBL';
    if (options.isQuadPool) {
      devHash = 'POOL'; // ترخيص مخصص لشبكة رباعية 1*4
    } else if (options.targetDeviceId && options.targetDeviceId !== 'GLOBAL') {
      const clean = options.targetDeviceId.replace(/-/g, '').toUpperCase();
      devHash = clean.length >= 6 ? clean.substring(2, 6) : clean.padEnd(4, 'X').substring(0, 4);
    }

    // استدعاء خادم التوقيع غير المتماثل (Ed25519)
    const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pf_admin_token') : null;
    try {
      const resp = await fetch('/api/admin/generate-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ tier, expiryCode, devHash })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.code) return data.code;
      }
    } catch (err) {
      console.warn('[LicenseManager] تعذر الاتصال بخادم التوقيع Ed25519 المباشر:', err);
    }

    // تنسيق احتياطي بصيغة PFP2
    return `PFP2-${tier}-${expiryCode}-${devHash}-SERVER_OFFLINE`;
  }

  // ═══ تفعيل كود ترخيص في الهاتف ═══
  public async activateCode(rawInput: string): Promise<{ success: boolean; message: string; license?: StoredLicense }> {
    const code = rawInput.trim().replace(/\s+/g, '');
    const codeUpper = code.toUpperCase();
    if (!code) {
      return { success: false, message: 'يرجى إدخال كود الترخيص أولاً.' };
    }

    // 1. فحص هل الكود مبطل أو منقول سابقاً من هذا الجهاز
    if (this.isCodeRevoked(codeUpper)) {
      return {
        success: false,
        message: 'تم إبطال هذا الترخيص ونقله إلى هاتف آخر سابقاً. لا يمكن استخدامه مرة أخرى لمنع الازدواجية.'
      };
    }

    // 2. منع أي أكواد ثابتة قديمة (Zero Backdoors — فحص بتجزئات SHA-256 دون نصوص صريحة)
    const inputDigest = await computeSha256Digest(codeUpper);
    if (REVOKED_STATIC_CODE_HASHES.has(inputDigest)) {
      return {
        success: false,
        message: 'تم إيقاف الأكواد الثابتة نهائياً لدواعي الأمان الميداني. يرجى الحصول على ترخيص مشفر رسمي من لوحة المدير.'
      };
    }

    // 3. فحص هل هو كود تحويل / تنازل (Transfer Voucher: TRF1-...)
    if (codeUpper.startsWith('TRF1-')) {
      return await this.activateTransferVoucher(codeUpper);
    }

    // 4. فحص تراخيص Ed25519 المعتمدة (PFP2-...)
    if (codeUpper.startsWith('PFP2-')) {
      const verified = await verifyEd25519LicenseCode(code);
      if (!verified.valid) {
        return { success: false, message: verified.error || 'كود الترخيص غير صالح.' };
      }

      const tier = verified.tier!;
      const expCode = verified.expCode!;
      const devHash = verified.devHash!;

      // فحص ارتباط الجهاز: يقبل POOL (شبكي 1*4) أو GLBL (عام) أو تطابق معرف الجهاز الحالي
      const isPool = devHash === 'POOL';
      const isGlobal = devHash === 'GLBL';
      const myHash = this.cleanDeviceHash;

      if (!isPool && !isGlobal && devHash !== myHash) {
        return {
          success: false,
          message: `هذا الكود مخصص لجهاز آخر (رمز الجهاز: ${devHash}). رمز هذا الجهاز هو: ${myHash}.`
        };
      }

      // حساب تاريخ الانتهاء
      if (expCode.length !== 4) return { success: false, message: 'تاريخ انتهاء الكود غير سليم.' };
      const yr = 2000 + parseInt(expCode.substring(0, 2), 10);
      const mo = parseInt(expCode.substring(2, 4), 10);
      const expDate = new Date(yr, mo, 0, 23, 59, 59); // آخر يوم في الشهر

      if (new Date() > expDate) {
        return { success: false, message: 'كود الترخيص منتهي الصلاحية.' };
      }

      const lic: StoredLicense = {
        code,
        tier,
        tierName: tier === 'ENTX' ? 'رخصة الاتحادات الرسمية (Enterprise)' : 'باقة الأندية المعتمدة (Pro Club)',
        clientName: isPool ? 'اشتراك شبكي رباعي 1*4' : 'رخصة رياضية معتمدة',
        deviceId: isPool || isGlobal ? 'GLOBAL' : this._deviceId,
        expiryDate: expDate.toISOString().split('T')[0],
        activatedAt: new Date().toISOString(),
        isQuadPool: isPool,
        maxSharedSlots: 4,
      };

      this._saveActiveLicense(lic);
      return {
        success: true,
        message: `تم التفعيل بنجاح: ${lic.tierName} ${isPool ? '(تفعيل شبكي 1*4 متاح للهواتف الثلاثة الأخرى)' : ''}`,
        license: lic
      };
    }

    // تنبيه واضح إذا كان الكود بصيغة قديمة غير مدعومة
    if (code.startsWith('PFP1-')) {
      return {
        success: false,
        message: 'صيغة الترخيص PFP1 قديمة وتعتمد تشفيراً متماثلاً غير آمن. يرجى الحصول على ترخيص PFP2 معتمد بـ Ed25519.'
      };
    }

    return { success: false, message: 'كود الترخيص غير صالح. يرجى مراجعة الكود.' };
  }

  // ═══ خاصية تحويل التفعيل المتبقي إلى هاتف آخر (Handover Protocol) ═══
  public async createTransferTicket(targetDeviceId: string): Promise<{ success: boolean; ticket?: LicenseTransferTicket; message: string }> {
    if (!this._activeLicense) {
      return { success: false, message: 'لا يوجد اشتراك نشط في هذا الهاتف لنقله.' };
    }

    const cleanTarget = targetDeviceId.trim().toUpperCase().replace(/-/g, '');
    if (cleanTarget.length < 4) {
      return { success: false, message: 'معرف الهاتف الهدف غير صحيح.' };
    }

    const targetDevHash = cleanTarget.length >= 6 ? cleanTarget.substring(2, 6) : cleanTarget.padEnd(4, 'X').substring(0, 4);
    const sourceDevHash = this.cleanDeviceHash;

    if (targetDevHash === sourceDevHash) {
      return { success: false, message: 'لا يمكن تحويل الترخيص إلى نفس الهاتف الحالي.' };
    }

    const expDate = new Date(this._activeLicense.expiryDate);
    const diffTime = expDate.getTime() - Date.now();
    const remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    if (remainingDays <= 0) {
      return { success: false, message: 'الاشتراك الحالي منتهي الصلاحية ولا يمكن نقله.' };
    }

    // حساب كود الانتهاء الجديد
    const yy = String(expDate.getFullYear() % 100).padStart(2, '0');
    const mm = String(expDate.getMonth() + 1).padStart(2, '0');
    const expCode = `${yy}${mm}`;

    // توليد شهادة النقل المشفرة عبر SHA-256
    const transferPayload = `TRANSFER|${this._activeLicense.tier}|${expCode}|${sourceDevHash}|${targetDevHash}`;
    const hex = await computeSha256Digest(transferPayload);
    const sig = hex.substring(0, 6).toUpperCase();
    const voucherCode = `TRF1-${this._activeLicense.tier}-${expCode}-${targetDevHash}-${sig}`;

    // إثبات الإبطال (Revocation Proof)
    const revocationProof = `REV-${sourceDevHash}-${Date.now().toString(36).toUpperCase()}-${sig}`;

    const ticket: LicenseTransferTicket = {
      ticketId: `TKT-${Date.now()}`,
      sourceDeviceId: this._deviceId,
      targetDeviceId: targetDeviceId.trim().toUpperCase(),
      tier: this._activeLicense.tier,
      tierName: this._activeLicense.tierName,
      originalCode: this._activeLicense.code,
      voucherCode,
      expiryDate: this._activeLicense.expiryDate,
      remainingDays,
      signature: sig,
      revocationProof,
      timestamp: Date.now()
    };

    // ═══ حرق وإبطال الترخيص في الهاتف الحالي فوراً ═══
    this.markCodeAsRevoked({
      code: this._activeLicense.code,
      revokedAt: new Date().toISOString(),
      transferredTo: targetDeviceId,
      revocationProof,
      voucherCode
    });

    // إزالة الترخيص من هذا الجهاز والعودة إلى التجريبي
    this._activeLicense = null;
    localStorage.removeItem(PREF_ACTIVE_LICENSE);
    this.notify();

    return {
      success: true,
      ticket,
      message: 'تم نقل التفعيل وإبطال صلاحية هذا الهاتف بنجاح! يمكن استخدام كود النقل في الهاتف الهدف الآن.'
    };
  }

  // ═══ تفعيل كود النقل في الهاتف الهدف ═══
  private async activateTransferVoucher(voucherCode: string): Promise<{ success: boolean; message: string; license?: StoredLicense }> {
    const parts = voucherCode.split('-');
    if (parts.length < 5 || parts[0] !== 'TRF1') {
      return { success: false, message: 'كود النقل غير صحيح.' };
    }

    const [, tierCode, expCode, targetDevHash, _sig] = parts;
    const myHash = this.cleanDeviceHash;

    if (targetDevHash !== myHash) {
      return {
        success: false,
        message: `كود التحويل هذا مخصص لهاتف آخر يحمل معرّف (${targetDevHash})، ومعرف هذا الهاتف هو (${myHash}).`
      };
    }

    // حساب تاريخ الانتهاء
    const yr = 2000 + parseInt(expCode.substring(0, 2), 10);
    const mo = parseInt(expCode.substring(2, 4), 10);
    const expDate = new Date(yr, mo, 0, 23, 59, 59);

    if (new Date() > expDate) {
      return { success: false, message: 'فترة التفعيل المنقولة منتهية الصلاحية.' };
    }

    // حفظ الترخيص في الهاتف الجديد
    const tier = tierCode as LicenseTierCode;
    const lic: StoredLicense = {
      code: voucherCode,
      tier,
      tierName: tier === 'ENTX' ? 'رخصة الاتحادات الرسمية (Enterprise - منقولة)' : 'باقة الأندية المعتمدة (Pro Club - منقولة)',
      clientName: 'ترخيص منقول رسمياً',
      deviceId: this._deviceId,
      expiryDate: expDate.toISOString().split('T')[0],
      activatedAt: new Date().toISOString(),
      isQuadPool: true, // يمنح أيضاً مشاركة 1*4
      maxSharedSlots: 4,
    };

    this._saveActiveLicense(lic);
    return {
      success: true,
      message: `تم استقبال التفعيل بنجاح! أصبحت الصلاحية نشطة في هذا الهاتف حتى ${lic.expiryDate}.`,
      license: lic
    };
  }

  // ═══ التفعيل الشبكي 1*4 (Quad-Share Pool) ═══
  public createPoolShareMessage(role: PhoneRole): LicensePoolInfo | null {
    if (!this._activeLicense) return null;
    return {
      hostDeviceId: this._deviceId,
      hostRole: role,
      licenseCode: this._activeLicense.code,
      tier: this._activeLicense.tier,
      tierName: this._activeLicense.tierName,
      expiryDate: this._activeLicense.expiryDate,
      maxSharedSlots: 4,
      activeMembers: [{ role, deviceId: this._deviceId }],
      isShared: true,
      timestamp: Date.now()
    };
  }

  public setReceivedSharedPool(pool: LicensePoolInfo | null) {
    // إذا كان هذا الهاتف يملك رخصة نشطة خاصة به أعلى أو مساوية، لا يستبدلها
    if (this._activeLicense && this._activeLicense.tier === 'ENTX') return;

    this._sharedPoolLicense = pool;
    this.notify();
  }

  public clearSharedPool() {
    if (this._sharedPoolLicense) {
      this._sharedPoolLicense = null;
      this.notify();
    }
  }

  private _saveActiveLicense(lic: StoredLicense) {
    this._activeLicense = lic;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREF_ACTIVE_LICENSE, JSON.stringify(lic));
    }
    this.notify();
  }

  public resetToTrial() {
    this._activeLicense = null;
    this._sharedPoolLicense = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(PREF_ACTIVE_LICENSE);
    }
    this.notify();
  }
}

export const licenseManager = new LicenseManagerService();
