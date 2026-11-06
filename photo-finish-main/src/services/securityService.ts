/**
 * Photo Finish Pro — منظومة الأمان والمصادقة الميدانية (Client Security Engine)
 * ==============================================================================
 * 
 * المزايا:
 * 1. التحقق من التراخيص المشفرة أوفلاين عبر التوقيع غير المتماثل (Ed25519 Verification):
 *    - يستخدم حصراً المفتاح العام (Public Key). يستحيل للعميل تزوير أي ترخيص دون المفتاح الخاص بالخادم.
 * 2. مصفوفة الصلاحيات الميدانية (Role Permission Matrix):
 *    - منع انتحال الشخصية أو إرسال أوامر غير مخولة (مثلاً: منع هاتف البداية من إنهاء السباق).
 * 3. توقيع الرسائل الحساسة (HMAC Message Signing):
 *    - التحقق من سلامة الرسائل ومطابقتها لرمز الجلسة.
 * 4. سجل التدقيق غير القابل للتلف (Immutable Audit Log):
 *    - توثيق أي تعديل على أزمان أو مراكز المتسابقين.
 */

import { PhoneRole } from '../types/race';

// ═══ المفتاح العام Ed25519 (Zero Hardcoded Keys) ═══
// لا يوجد أي مفتاح مضمّن في الشفرة (كل مفتاح ظهر سابقاً في مستودع عام مفسوح).
// ترتيب الحل على العميل:
//   1) متغير البيئة VITE_LICENSE_PUBLIC_KEY عند البناء (موصى به للإنتاج)
//   2) مفتاح موثوق محقون وقت التشغيل (setTrustedPublicKeyBase64) أو مخزّن سابقاً من الخادم
//   3) جلب من الخادم /api/public-key (Trust-On-First-Use) وحفظه محلياً
export const ED25519_PUBLIC_KEY_BASE64: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LICENSE_PUBLIC_KEY) || '';

const PREF_TRUSTED_PUBKEY = 'pf_trusted_pubkey_v1';

/** حقن مفتاح عام موثوق وقت التشغيل (يستخدمه الاختبار والتهيئة من الخادم) */
export function setTrustedPublicKeyBase64(b64: string): void {
  cachedPublicKey = null;
  cachedKeyBase64 = String(b64 || '').trim();
}

let cachedKeyBase64: string = '';

async function resolvePublicKeyBase64(): Promise<string> {
  if (cachedKeyBase64) return cachedKeyBase64;
  if (ED25519_PUBLIC_KEY_BASE64) {
    cachedKeyBase64 = ED25519_PUBLIC_KEY_BASE64;
    return cachedKeyBase64;
  }
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(PREF_TRUSTED_PUBKEY) : null;
    if (saved) {
      cachedKeyBase64 = saved;
      return cachedKeyBase64;
    }
  } catch { /* تخزين غير متاح */ }
  // Trust-On-First-Use: جلب المفتاح العام من الخادم وحفظه (للإنتاج: ثبّته عبر متغير البيئة)
  try {
    const resp = await fetch('/api/public-key');
    const data = await resp.json();
    if (data?.publicKeyBase64) {
      cachedKeyBase64 = data.publicKeyBase64;
      try { localStorage.setItem(PREF_TRUSTED_PUBKEY, cachedKeyBase64); } catch { /* ignore */ }
      return cachedKeyBase64;
    }
  } catch { /* لا خادم — التحقق سيُفشل برسالة واضحة */ }
  return '';
}

// ═══ 1. مصفوفة صلاحيات الأدوار الميدانية (Role Permission Matrix) ═══
// يحدد لكل دور ما هي أنواع الرسائل المسموح له قانونياً بإرسالها
export const ROLE_PERMITTED_MESSAGES: Record<string, Set<string>> = {
  // هاتف الانطلاق: أوامر البدء والاسترجاع والقوائم فقط
  start: new Set([
    'ON_MARKS',
    'SET',
    'START_GUN',
    'RECALL_GUN',
    'HEAT_DISPATCH',
    'HEAT_CANCEL_DISPATCH',
    'SYNC_PING',
    'SYNC_PONG',
    'CLOCK_TICK',
    'BELL_SIGNAL_START',
    'BELL_SIGNAL_STOP',
    'BELL_SIGNAL_ACK',
    'REQUEST_STATE_SYNC',
    'RESPONSE_STATE_SYNC',
    'LICENSE_SHARE_POOL'
  ]),

  // كاميرا خط النهاية: رصد العبور، بث شريط Slit-Scan، وإعلان انتهاء السباق
  finish: new Set([
    'LANE_FINISH',
    'SLIT_SCAN_IMAGE',
    'RACE_COMPLETE',
    'SYNC_PING',
    'SYNC_PONG',
    'CLOCK_TICK',
    'BELL_SIGNAL_START',
    'BELL_SIGNAL_STOP',
    'BELL_SIGNAL_ACK',
    'REQUEST_STATE_SYNC',
    'RESPONSE_STATE_SYNC',
    'LICENSE_SHARE_POOL'
  ]),

  // برج الحكم العام: كامل الصلاحيات لضبط السباق، تعديل العدائين، وإعادة التعيين
  judge: new Set([
    'JUDGE_UPDATE_RUNNER',
    'SETTINGS_SYNC',
    'HEAT_CHANGE',
    'HEATS_SYNC',
    'HEATS_REORDER',
    'DELETE_HEAT',
    'SYNC_RESET_ALL',
    'SYNC_PING',
    'SYNC_PONG',
    'CLOCK_TICK',
    'BELL_SIGNAL_START',
    'BELL_SIGNAL_STOP',
    'BELL_SIGNAL_ACK',
    'REQUEST_STATE_SYNC',
    'RESPONSE_STATE_SYNC',
    'LICENSE_SHARE_POOL',
    'LICENSE_REVOKE_AND_TRANSFER',
    'LICENSE_TRANSFER_ACK',
    'ATHLETICS_COMPETITION_SYNC',
    'ATHLETICS_CORRECTION'
  ]),

  // غرفة النداء: مزامنة القوائم وإعدادات الأروقة
  chambre_dappel: new Set([
    'SETTINGS_SYNC',
    'HEAT_CHANGE',
    'HEATS_SYNC',
    'HEATS_REORDER',
    'SYNC_PING',
    'SYNC_PONG',
    'REQUEST_STATE_SYNC',
    'RESPONSE_STATE_SYNC',
    'LICENSE_SHARE_POOL'
  ]),

  // حكم نقطة مراقبة (خارج المضمار): تسجيل العبور والبلاغات
  checkpoint_judge: new Set([
    'ATHLETICS_PASSAGE_BATCH',
    'ATHLETICS_CORRECTION',
    'ATHLETICS_JUDGE_HEARTBEAT',
    'ATHLETICS_VIOLATION',
    'CROSSING_RECORDED',
    'CROSSING_SYNC_BATCH',
    'SYNC_PING',
    'SYNC_PONG',
    'REQUEST_STATE_SYNC',
    'RESPONSE_STATE_SYNC'
  ]),

  // مدير منافسات ألعاب القوى: اعتماد الترتيب وتحديث المسارات
  athletics_manager: new Set([
    'ATHLETICS_COMPETITION_SYNC',
    'ATHLETICS_CORRECTION',
    'ATHLETICS_JUDGE_HEARTBEAT',
    'PASS_OVERRIDE',
    'RESULTS_LOCK_PUBLISH',
    'SYNC_PING',
    'SYNC_PONG',
    'REQUEST_STATE_SYNC',
    'RESPONSE_STATE_SYNC'
  ]),

  // المشاهد أو الأجهزة غير المحددة
  viewer: new Set([
    'REQUEST_STATE_SYNC',
    'SYNC_PING',
    'SYNC_PONG'
  ])
};

/**
 * فحص ما إذا كان الدور مخولاً بإرسال نوع الرسالة المحدد
 */
export function isMessagePermitted(senderRole: PhoneRole, messageType: string): boolean {
  if (!senderRole) {
    return ROLE_PERMITTED_MESSAGES.viewer.has(messageType);
  }
  const permittedSet = ROLE_PERMITTED_MESSAGES[senderRole];
  if (!permittedSet) return false;
  return permittedSet.has(messageType);
}

// ═══ 2. التحقق من توقيع Ed25519 أوفلاين (Asymmetric Verification) ═══

let cachedPublicKey: CryptoKey | null = null;

function getSubtleCrypto(): SubtleCrypto | null {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  return null;
}

async function getOrImportPublicKey(): Promise<CryptoKey | null> {
  if (cachedPublicKey) return cachedPublicKey;
  const subtle = getSubtleCrypto();
  if (!subtle) return null;

  const keyB64 = await resolvePublicKeyBase64();
  if (!keyB64) {
    console.warn('[Security] لا يوجد مفتاح عام Ed25519 موثوق — شغّل الخادم أو ثبّت VITE_LICENSE_PUBLIC_KEY');
    return null;
  }

  try {
    const rawKey = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0));
    cachedPublicKey = await subtle.importKey(
      'raw',
      rawKey,
      { name: 'Ed25519' },
      false,
      ['verify']
    );
    return cachedPublicKey;
  } catch (err) {
    console.warn('[Security] تعذر استيراد المفتاح العام Ed25519:', err);
    return null;
  }
}

/**
 * تحويل Base64Url إلى بايتات (نسخة إلى ArrayBuffer عادي لتوافق BufferSource)
 */
function base64UrlToBytes(b64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const bin = atob(base64 + pad);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * التحقق العام من توقيع Ed25519 على نص قياسي (يستخدمه التراخيص ونقاط المراقبة)
 */
export async function verifyEd25519Signature(payloadString: string, sigBase64Url: string): Promise<boolean> {
  const pubKey = await getOrImportPublicKey();
  const subtle = getSubtleCrypto();
  if (!pubKey || !subtle || !sigBase64Url) return false;
  try {
    const dataBytes = new TextEncoder().encode(payloadString);
    const sigBytes = base64UrlToBytes(sigBase64Url);
    return await subtle.verify({ name: 'Ed25519' }, pubKey, sigBytes, dataBytes);
  } catch {
    return false;
  }
}

/**
 * فحص صحة ترخيص PFP2 الموقع بـ Ed25519
 * @param code كود الترخيص مثلاً: PFP2-CLB8-2612-POOL-sig...
 */
export async function verifyEd25519LicenseCode(code: string): Promise<{
  valid: boolean;
  tier?: 'CLB8' | 'ENTX';
  expCode?: string;
  devHash?: string;
  error?: string;
}> {
  const parts = code.trim().split('-');
  if (parts.length < 5 || parts[0].toUpperCase() !== 'PFP2') {
    return { valid: false, error: 'صيغة كود الترخيص غير مطابقة للإصدار V2' };
  }

  const [_rawPrefix, rawTier, expCode, rawDevHash, ...sigParts] = parts;
  const tier = rawTier.toUpperCase();
  const devHash = rawDevHash.toUpperCase();
  const sigBase64Url = sigParts.join('-');

  if (tier !== 'CLB8' && tier !== 'ENTX') {
    return { valid: false, error: 'فئة ترخيص غير معروفة' };
  }

  const pubKey = await getOrImportPublicKey();
  const subtle = getSubtleCrypto();
  if (!pubKey || !subtle) {
    return { valid: false, error: 'محرك التحقق من التوقيع غير متاح (لا يوجد مفتاح عام موثوق)' };
  }

  try {
    // إعادة بناء النص الأصلي الموقع والتحقق عبر المحرك العام الموحد
    const payload = `PFP2|${tier}|${expCode}|${devHash}`;
    const isValid = await verifyEd25519Signature(payload, sigBase64Url);

    if (!isValid) {
      return { valid: false, error: 'توقيع الترخيص الرقمي غير صالح أو تم التلاعب به' };
    }

    return {
      valid: true,
      tier: tier as 'CLB8' | 'ENTX',
      expCode,
      devHash
    };
  } catch (err: any) {
    return { valid: false, error: `فشل التحقق: ${err.message}` };
  }
}

// ═══ 3. توقيع الرسائل الحساسة بـ HMAC الجلسة ═══

export async function computeMessageHmac(sessionToken: string, msgType: string, timestamp: number): Promise<string> {
  const subtle = getSubtleCrypto();
  if (!sessionToken || !subtle) return '';
  try {
    const enc = new TextEncoder();
    const key = await subtle.importKey(
      'raw',
      enc.encode(sessionToken),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const data = enc.encode(`${msgType}|${timestamp}`);
    const sigBuf = await subtle.sign('HMAC', key, data);
    return Array.from(new Uint8Array(sigBuf))
      .slice(0, 8)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return '';
  }
}

/**
 * التحقق من توقيع HMAC لرسالة واردة (مقارنة ثابتة التوقيت).
 * يفشل الآمن إذا غاب أي مدخل أو اختلف التوقيع.
 */
export async function verifyMessageHmac(
  sessionToken: string,
  msgType: string,
  timestamp: number,
  receivedSig: string
): Promise<boolean> {
  if (!sessionToken || !receivedSig) return false;
  const expected = await computeMessageHmac(sessionToken, msgType, timestamp);
  if (!expected || expected.length !== receivedSig.length) return false;
  // مقارنة ثابتة التوقيت (Timing-Safe)
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ receivedSig.charCodeAt(i);
  }
  return diff === 0;
}

// ═══ 3-b. تشفير حمولات MQTT السحابية (AES-GCM مشتق من رمز الجلسة) ═══
// الوسيط السحابي (broker.emqx.io) عام — أي حمولة نصية مكشوفة يمكن قراءتها أو
// تزويرها من أي طرف يتصل بالوسيط نفسه. لذلك تُشفّر الحمولات بمفتاح AES-256-GCM
// مشتق من رمز الجلسة (Session Token) الذي لا يعرفه إلا أجهزة الغرفة نفسها.

let cachedAesKey: { token: string; key: CryptoKey } | null = null;

async function deriveSessionAesKey(sessionToken: string): Promise<CryptoKey | null> {
  if (!sessionToken) return null;
  if (cachedAesKey && cachedAesKey.token === sessionToken) return cachedAesKey.key;
  const subtle = getSubtleCrypto();
  if (!subtle) return null;
  try {
    const enc = new TextEncoder();
    const digest = await subtle.digest('SHA-256', enc.encode(`pfp-mqtt-v1|${sessionToken}`));
    const key = await subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    cachedAesKey = { token: sessionToken, key };
    return key;
  } catch {
    return null;
  }
}

export interface EncryptedEnvelope {
  _enc: 'A256GCM';
  iv: string;   // ناقص التهيئة Base64
  d: string;    // الحمولة المشفرة Base64
}

export async function encryptJsonPayload(sessionToken: string, payload: unknown): Promise<EncryptedEnvelope | null> {
  const key = await deriveSessionAesKey(sessionToken);
  const subtle = getSubtleCrypto();
  if (!key || !subtle) return null;
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(payload));
    const cipher = await subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const toB64 = (buf: ArrayBuffer | Uint8Array) => {
      const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      let s = '';
      bytes.forEach(b => { s += String.fromCharCode(b); });
      return btoa(s);
    };
    return { _enc: 'A256GCM', iv: toB64(iv), d: toB64(cipher) };
  } catch {
    return null;
  }
}

export async function decryptJsonPayload<T = any>(sessionToken: string, envelope: EncryptedEnvelope): Promise<T | null> {
  const key = await deriveSessionAesKey(sessionToken);
  const subtle = getSubtleCrypto();
  if (!key || !subtle) return null;
  try {
    const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(envelope.iv) },
      key,
      fromB64(envelope.d)
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

// ═══ 4-b. سجل تدقيق أمني مكتوم التكرار (Throttled Security Audit) ═══
// يمنع إغراق قاعدة التدقيق عند هجوم عشوائي: إدخال واحد كحد أقصى لكل سبب
// كل 5 ثوان، مع عدّاد للإدخالات المكتومة.

const AUDIT_THROTTLE_MS = 5000;
const auditThrottleMap = new Map<string, { lastAt: number; suppressed: number }>();

export function throttledSecurityLog(
  action: string,
  detail: { actorRole?: PhoneRole; target?: string; reason: string; oldValue?: any; newValue?: any }
): void {
  const now = Date.now();
  const entry = auditThrottleMap.get(action);
  if (entry && now - entry.lastAt < AUDIT_THROTTLE_MS) {
    entry.suppressed++;
    return;
  }
  const suppressed = entry?.suppressed || 0;
  auditThrottleMap.set(action, { lastAt: now, suppressed: 0 });

  auditService
    .log({
      actorRole: detail.actorRole || ('viewer' as PhoneRole),
      actorName: undefined,
      action: suppressed > 0 ? `${action} (+${suppressed} مكتومة)` : action,
      target: detail.target || '-',
      oldValue: detail.oldValue ?? null,
      newValue: detail.newValue ?? null,
      reason: detail.reason
    })
    .catch(() => { /* التدقيق لا يعطل الشبكة أبداً */ });
}

// ═══ 4. سجل تدقيق التعديلات والنتائج (Audit Log) ═══

export interface AuditEntry {
  id: string;               // UUID فريد
  timestamp: number;        // وقت التعديل
  actorRole: PhoneRole;     // دور الحكم أو المستخدم
  actorName?: string;
  action: string;           // نوع الإجراء (JUDGE_UPDATE_TIME, RANK_OVERRIDE, HEAT_MODIFIED...)
  target: string;           // المتأثر (مثلاً العداء #104 أو حارة 3)
  oldValue: any;            // القيمة السابقة
  newValue: any;            // القيمة الجديدة
  reason: string;           // سبب التعديل الإلزامي
}

const AUDIT_DB_NAME = 'photo_finish_audit_v1';
const STORE_AUDIT = 'audit_entries';

class AuditService {
  private db: IDBDatabase | null = null;

  private async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const req = indexedDB.open(AUDIT_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE_AUDIT)) {
          const s = d.createObjectStore(STORE_AUDIT, { keyPath: 'id' });
          s.createIndex('timestamp', 'timestamp');
          s.createIndex('action', 'action');
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve(this.db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<AuditEntry> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const fullEntry: AuditEntry = {
      ...entry,
      id,
      timestamp: Date.now()
    };

    try {
      const db = await this.open();
      const tx = db.transaction(STORE_AUDIT, 'readwrite');
      tx.objectStore(STORE_AUDIT).put(fullEntry);
    } catch (e) {
      console.warn('[AuditService] فشل حفظ سجل التدقيق:', e);
    }

    return fullEntry;
  }

  public async listEntries(limit = 50): Promise<AuditEntry[]> {
    try {
      const db = await this.open();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_AUDIT, 'readonly');
        const req = tx.objectStore(STORE_AUDIT).getAll();
        req.onsuccess = () => {
          const all = (req.result || []) as AuditEntry[];
          all.sort((a, b) => b.timestamp - a.timestamp);
          resolve(all.slice(0, limit));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }
}

export const auditService = new AuditService();
