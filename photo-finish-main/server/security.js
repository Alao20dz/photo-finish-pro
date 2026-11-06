/**
 * Photo Finish Pro — وحدة الأمان وإصدار التراخيص الخادمية (Server Security Engine)
 * ==============================================================================
 * 
 * المزايا:
 * 1. التوقيع غير المتماثل (Ed25519 Asymmetric Cryptography):
 *    - المفتاح الخاص محفوظ حصراً على الخادم ولا يُرسل أبداً للواجهة الأمامية.
 *    - التطبيق يحمل المفتاح العام فقط ويتحقق من التوقيع محلياً وأوفلاين.
 * 2. بوابة الإدارة الآمنة (Rate-Limited Admin Gate):
 *    - حماية ضد التخمين (Brute-Force Protection): بحد أقصى 5 محاولات فاشلة لكل 15 دقيقة لكل عنوان IP.
 *    - مقارنة ثابتة التوقيت (Timing-Safe Equality) لمنع هجمات التوقيت (Timing Attacks).
 *    - جلسات إدارية مشفرة ومحددة المدة.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ═══ مفاتيح التوقيع Ed25519 (Zero Default Keys Policy) ═══
// NOTE أمني: لا توجد أي مفاتيح افتراضية في المستودع — كل مفتاح ورد سابقاً في
// مستودع عام يُعتبر مفسوحاً ويجب تدويره. ترتيب الحل:
//   1) متغيرات البيئة LICENSE_PRIVATE_KEY_BASE64 + LICENSE_PUBLIC_KEY_BASE64
//   2) ملف مفاتيح محلي gitignored (data/license-keys.json) يُولّد عند أول إقلاع
// المفتاح الخاص لا يغادر الخادم أبداً، والعميل يتوصل بالعام فقط عبر /api/public-key.
function loadOrCreateKeys() {
  const envPriv = String(process.env.LICENSE_PRIVATE_KEY_BASE64 || '').trim();
  const envPub = String(process.env.LICENSE_PUBLIC_KEY_BASE64 || '').trim();
  if (envPriv && envPub) {
    return { priv: Buffer.from(envPriv, 'base64'), pub: Buffer.from(envPub, 'base64'), source: 'env' };
  }

  const dataDir = process.env.PFP_DATA_DIR || path.join(process.cwd(), 'data');
  const keysFile = path.join(dataDir, 'license-keys.json');
  try {
    if (fs.existsSync(keysFile)) {
      const saved = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
      if (saved.priv && saved.pub) {
        return { priv: Buffer.from(saved.priv, 'base64'), pub: Buffer.from(saved.pub, 'base64'), source: 'file' };
      }
    }
  } catch (e) { /* إعادة التوليد عند التلف */ }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const priv = privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(16);
  const pub = publicKey.export({ type: 'spki', format: 'der' }).subarray(12);
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(keysFile, JSON.stringify({
      priv: priv.toString('base64'),
      pub: pub.toString('base64'),
      createdAt: new Date().toISOString()
    }, null, 2), { mode: 0o600 });
    console.warn('╔══════════════════════════════════════════════════════════════╗');
    console.warn('║ تم توليد زوج مفاتيح Ed25519 جديد وحفظه في (gitignored):      ║');
    console.warn(`║   ${keysFile}`);
    console.warn(`║ المفتاح العام للعملاء: ${pub.toString('base64')}`);
    console.warn('║ ثبّت LICENSE_PUBLIC_KEY_BASE64 في بناء الواجهة للإنتاج.      ║');
    console.warn('╚══════════════════════════════════════════════════════════════╝');
  } catch (e) {
    console.warn('[Security] تعذر حفظ ملف المفاتيح — ستُولّد مفاتيح جديدة في كل إقلاع:', e?.message);
  }
  return { priv, pub, source: 'generated' };
}

const KEYS = loadOrCreateKeys();
export const PRIV_KEY_RAW = KEYS.priv;
export const PUB_KEY_RAW = KEYS.pub;

// بناء مفتاح خاص Ed25519 بصيغة PKCS8
const PKCS8_HEADER = Buffer.from('302e020100300506032b657004220420', 'hex');
const privateKeyObject = crypto.createPrivateKey({
  key: Buffer.concat([PKCS8_HEADER, PRIV_KEY_RAW]),
  format: 'der',
  type: 'pkcs8'
});

// كلمة مرور المدير: تأخذ حصراً من متغير البيئة ADMIN_PORTAL_PASSWORD.
// NOTE أمني (Zero Backdoors Policy): لا توجد أي كلمات مرور افتراضية في المستودع —
// أي كلمة مرور داخل الكود تعتبر مفاتيح مفتشاة. إذا لم تُضبط عبر البيئة،
// يولّد الخادم كلمة عشوائية قوية عند الإقلاع ويطبعها مرة واحدة في الطرفية فقط.
function resolveAdminPassword() {
  const fromEnv = String(process.env.ADMIN_PORTAL_PASSWORD || '').trim();
  if (fromEnv) return fromEnv;
  const generated = crypto.randomBytes(12).toString('base64url').toUpperCase();
  console.warn('╔══════════════════════════════════════════════════════════════╗');
  console.warn('║ تنبيه أمني: لم يتم ضبط ADMIN_PORTAL_PASSWORD في البيئة.       ║');
  console.warn(`║ كلمة مرور المدير المولّدة عشوائياً لهذه الجلسة: ${generated}  ║`);
  console.warn('║ اطبعها أو استخدمها الآن، واضبط المتغير رسمياً في الإنتاج.     ║');
  console.warn('╚══════════════════════════════════════════════════════════════╝');
  return generated;
}
const ADMIN_PASSWORD = resolveAdminPassword();

// ═══ حماية محاولات تسجيل الدخول (Rate Limiting) ═══
const loginAttempts = new Map(); // ip -> { count: number, resetAt: number }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 دقيقة

function cleanExpiredAttempts() {
  const now = Date.now();
  for (const [ip, record] of loginAttempts.entries()) {
    if (now > record.resetAt) {
      loginAttempts.delete(ip);
    }
  }
}

// تنظيف دوري للذاكرة
// NOTE: unref() حتى لا يمنع هذا المؤقت عملية vite build (التي تستورد هذا الملف
// عبر vite.config.ts) من الإنهاء بعد اكتمال إخراج dist/.
const _attemptsCleanupTimer = setInterval(cleanExpiredAttempts, 5 * 60 * 1000);
if (typeof _attemptsCleanupTimer.unref === 'function') _attemptsCleanupTimer.unref();

/**
 * التحقق من كلمة مرور المدير مع تحديد المعدل وحماية التوقيت
 */
export function verifyAdminLogin(password, clientIp = '127.0.0.1') {
  cleanExpiredAttempts();
  const now = Date.now();
  const record = loginAttempts.get(clientIp) || { count: 0, resetAt: now + LOCKOUT_MS };

  if (record.count >= MAX_ATTEMPTS && now < record.resetAt) {
    const remainingMin = Math.ceil((record.resetAt - now) / 60000);
    return {
      success: false,
      status: 429,
      error: `تم تجاوز الحد المسموح به من المحاولات الفاشلة. يرجى الانتظار ${remainingMin} دقيقة.`
    };
  }

  // مقارنة آمنة ضد هجمات التوقيت مع كلمة مرور المدير الوحيدة (من البيئة أو مولّدة)
  const cleanInput = String(password || '').trim();
  const inputBuffer = Buffer.from(cleanInput);
  const targetBuffer = Buffer.from(ADMIN_PASSWORD);
  const isMatch = inputBuffer.length === targetBuffer.length && crypto.timingSafeEqual(inputBuffer, targetBuffer);

  if (!isMatch) {
    record.count++;
    record.resetAt = now + LOCKOUT_MS;
    loginAttempts.set(clientIp, record);
    return {
      success: false,
      status: 401,
      error: 'كلمة المرور غير صحيحة.',
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - record.count)
    };
  }

  // تسجيل دخول ناجح - مسح المحاولات الفاشلة
  loginAttempts.delete(clientIp);

  // توليد رمز جلسة إداري مشفر ومحدد بـ 8 ساعات
  const sessionPayload = `${clientIp}|${Date.now() + 8 * 3600 * 1000}`;
  const sessionHmac = crypto.createHmac('sha256', PRIV_KEY_RAW).update(sessionPayload).digest('hex');
  const adminToken = Buffer.from(`${sessionPayload}|${sessionHmac}`).toString('base64');

  return {
    success: true,
    status: 200,
    adminToken,
    token: adminToken
  };
}

/**
 * التحقق من صلاحية الرمز الإداري
 */
export function verifyAdminToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 3) return false;
    const [ip, expiryStr, receivedHmac] = parts;
    const expiry = parseInt(expiryStr, 10);
    if (Date.now() > expiry) return false;

    const expectedHmac = crypto.createHmac('sha256', PRIV_KEY_RAW).update(`${ip}|${expiryStr}`).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(receivedHmac), Buffer.from(expectedHmac));
  } catch (e) {
    return false;
  }
}

/**
 * توليد كود ترخيص موقع رسمياً بـ Ed25519
 * @param {object} params
 * @param {'CLB8' | 'ENTX'} params.tier فئة الترخيص
 * @param {string} params.expiryCode رمز انتهاء الصلاحية (مثلاً 2612)
 * @param {string} [params.devHash] كود الجهاز (أو POOL / GLBL)
 */
export function generateEd25519License({ tier, expiryCode, devHash = 'POOL' }) {
  const payload = `PFP2|${tier}|${expiryCode}|${devHash}`;
  const signatureBuffer = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKeyObject);
  // ترميز التوقيع بصيغة Base64Url لتكون صالحة في كود نصي
  const sigBase64Url = signatureBuffer.toString('base64url');
  // كود الترخيص الرسمي V2
  return `PFP2-${tier}-${expiryCode}-${devHash}-${sigBase64Url}`;
}

/**
 * التحقق من توقيع كود Ed25519 على الخادم (اختياري للفحص والتحقق)
 */
export function verifyEd25519Signature(payload, signatureBuffer) {
  const SPKI_HEADER = Buffer.from('302a300506032b6570032100', 'hex');
  const publicKeyObject = crypto.createPublicKey({
    key: Buffer.concat([SPKI_HEADER, PUB_KEY_RAW]),
    format: 'der',
    type: 'spki'
  });
  return crypto.verify(null, Buffer.from(payload, 'utf8'), publicKeyObject, signatureBuffer);
}

/**
 * جلب المفتاح العام بصيغة Base64 للواجهة الأمامية
 */
export function getPublicKeyBase64() {
  return PUB_KEY_RAW.toString('base64');
}

// ═══ توقيع رموز نقاط المراقبة (Checkpoint QR Signing) ═══
// النص القياسي الموقع: PFP_CP1|cid|cpid|code|km|iat|exp
// التوقيع Ed25519 يتحقق على العميل أوفلاين بالمفتاح العام — لا يوجد أي سر في الواجهة.

/**
 * بناء النص القياسي (Canonical String) لحمولة نقطة مراقبة
 */
export function buildCheckpointCanonical({ cid, cpid, code, km, iat, exp }) {
  return `PFP_CP1|${cid}|${cpid}|${code}|${km}|${iat}|${exp}`;
}

/**
 * توقيع حمولة نقطة مراقبة بـ Ed25519 من الخادم
 * @returns توقيع Base64Url (64 بايت)
 */
export function signCheckpointQr({ cid, cpid, code, km, iat, exp }) {
  const canonical = buildCheckpointCanonical({ cid, cpid, code, km, iat, exp });
  const signatureBuffer = crypto.sign(null, Buffer.from(canonical, 'utf8'), privateKeyObject);
  return signatureBuffer.toString('base64url');
}

/**
 * التحقق من توقيع نقطة مراقبة (للاختبار والفحص الخادمي)
 */
export function verifyCheckpointQrSignature({ cid, cpid, code, km, iat, exp }, sigBase64Url) {
  const canonical = buildCheckpointCanonical({ cid, cpid, code, km, iat, exp });
  const SPKI_HEADER = Buffer.from('302a300506032b6570032100', 'hex');
  const publicKeyObject = crypto.createPublicKey({
    key: Buffer.concat([SPKI_HEADER, PUB_KEY_RAW]),
    format: 'der',
    type: 'spki'
  });
  const sigBytes = Buffer.from(String(sigBase64Url || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return crypto.verify(null, Buffer.from(canonical, 'utf8'), publicKeyObject, sigBytes);
}

export default {
  verifyAdminLogin,
  verifyAdminToken,
  generateEd25519License,
  verifyEd25519Signature,
  getPublicKeyBase64,
  PUB_KEY_RAW,
  PRIV_KEY_RAW
};
