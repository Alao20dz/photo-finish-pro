import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMessagePermitted, verifyEd25519LicenseCode, verifyEd25519Signature, computeMessageHmac, verifyMessageHmac, encryptJsonPayload, decryptJsonPayload, setTrustedPublicKeyBase64 } from '../src/services/securityService';
import { licenseManager } from '../src/services/licenseManager';
import { courseDesignerService } from '../src/services/courseDesignerService';
import {
  generateEd25519License,
  getPublicKeyBase64,
  signCheckpointQr,
  buildCheckpointCanonical,
  verifyCheckpointQrSignature,
  verifyAdminLogin
} from '../server/security.js';

describe('Stage A: Security Architecture & Asymmetric Licensing', () => {
  it('enforces Role Permission Matrix correctly', () => {
    // Start phone permissions
    expect(isMessagePermitted('start', 'START_GUN')).toBe(true);
    expect(isMessagePermitted('start', 'RECALL_GUN')).toBe(true);
    expect(isMessagePermitted('start', 'ON_MARKS')).toBe(true);
    expect(isMessagePermitted('start', 'LANE_FINISH')).toBe(false);
    expect(isMessagePermitted('start', 'JUDGE_UPDATE_RUNNER')).toBe(false);

    // Finish phone permissions
    expect(isMessagePermitted('finish', 'LANE_FINISH')).toBe(true);
    expect(isMessagePermitted('finish', 'SLIT_SCAN_IMAGE')).toBe(true);
    expect(isMessagePermitted('finish', 'RACE_COMPLETE')).toBe(true);
    expect(isMessagePermitted('finish', 'START_GUN')).toBe(false);
    expect(isMessagePermitted('finish', 'JUDGE_UPDATE_RUNNER')).toBe(false);

    // Judge phone permissions
    expect(isMessagePermitted('judge', 'JUDGE_UPDATE_RUNNER')).toBe(true);
    expect(isMessagePermitted('judge', 'SETTINGS_SYNC')).toBe(true);
    expect(isMessagePermitted('judge', 'SYNC_RESET_ALL')).toBe(true);

    // Viewer permissions
    expect(isMessagePermitted('viewer', 'START_GUN')).toBe(false);
    expect(isMessagePermitted('viewer', 'LANE_FINISH')).toBe(false);
    expect(isMessagePermitted('viewer', 'REQUEST_STATE_SYNC')).toBe(true);

    // حكم نقطة مراقبة لا يمكنه إطلاق السباق أو تعديل النتائج النهائية
    expect(isMessagePermitted('checkpoint_judge', 'START_GUN')).toBe(false);
    expect(isMessagePermitted('checkpoint_judge', 'RESULTS_LOCK_PUBLISH')).toBe(false);
    expect(isMessagePermitted('checkpoint_judge', 'ATHLETICS_PASSAGE_BATCH')).toBe(true);

    // دور غير معروف → رفض افتراضي
    expect(isMessagePermitted('hacker_role' as any, 'REQUEST_STATE_SYNC')).toBe(false);
  });

  it('rejects all legacy hardcoded master codes via hashed blocklist (Zero Backdoors)', async () => {
    const backdoors = [
      'ALADINE-VIP-2026',
      'AQUACORE-ADMIN-KEY',
      'PRO-ATHLETICS-2026',
      'COACH-CLUB-PRO',
      'aladine-vip-2026' // حتى بأحرف صغيرة
    ];

    for (const code of backdoors) {
      const res = await licenseManager.activateCode(code);
      expect(res.success).toBe(false);
      expect(res.message).toContain('تم إيقاف الأكواد الثابتة نهائياً');
    }
  });

  it('generates and verifies Ed25519 asymmetric licenses without secret salts', async () => {
    // ضبط المفتاح العام الموثوق من الخادم (كما يحدث عبر /api/public-key أو متغير البناء)
    setTrustedPublicKeyBase64(getPublicKeyBase64());

    const serverPubKey = getPublicKeyBase64();
    expect(serverPubKey).toBeDefined();
    expect(serverPubKey.length).toBeGreaterThan(30);

    // توليد ترخيص رسمي من الخادم
    const licCode = generateEd25519License({
      tier: 'ENTX',
      expiryCode: '2812',
      devHash: 'POOL'
    });

    expect(licCode.startsWith('PFP2-ENTX-2812-POOL-')).toBe(true);

    // التحقق من صحة الترخيص بواسطة العميل عبر Web Crypto
    const clientVerify = await verifyEd25519LicenseCode(licCode);
    expect(clientVerify.valid).toBe(true);
    expect(clientVerify.tier).toBe('ENTX');
    expect(clientVerify.expCode).toBe('2812');
    expect(clientVerify.devHash).toBe('POOL');

    // كشف التلاعب بالترخيص: تغيير الحرف الأول من التوقيع
    const tamperedCode = licCode.slice(0, -3) + 'XYZ';
    const tamperedVerify = await verifyEd25519LicenseCode(tamperedCode);
    expect(tamperedVerify.valid).toBe(false);
  });

  it('rate-limits admin login brute-force attempts (5 failures → 429)', () => {
    const ip = `test-brute-${Date.now()}`;

    // خمس محاولات خاطئة متتالية
    for (let i = 0; i < 5; i++) {
      const res = verifyAdminLogin('totally-wrong-password', ip);
      expect(res.success).toBe(false);
      expect(res.status).toBe(401);
    }

    // المحاولة السادسة (أي كلمة مرور حتى الصحيحة) تُرفض بـ 429
    const blocked = verifyAdminLogin('anything', ip);
    expect(blocked.success).toBe(false);
    expect(blocked.status).toBe(429);
  });

  it('verifies session HMAC message signing', async () => {
    const sessionToken = 'secret-field-session-token-12345';
    const msgType = 'START_GUN';
    const timestamp = 1730000000000;

    const sig1 = await computeMessageHmac(sessionToken, msgType, timestamp);
    const sig2 = await computeMessageHmac(sessionToken, msgType, timestamp);
    expect(sig1).toBeTruthy();
    expect(sig1).toBe(sig2);

    // تغيير نوع الرسالة يغير التوقيع
    const sigDifferent = await computeMessageHmac(sessionToken, 'LANE_FINISH', timestamp);
    expect(sigDifferent).not.toBe(sig1);
  });

  it('rejects tampered HMAC signatures on incoming messages', async () => {
    const sessionToken = 'room-session-token-XYZ';
    const timestamp = 1730000000123;

    const validSig = await computeMessageHmac(sessionToken, 'START_GUN', timestamp);
    expect(await verifyMessageHmac(sessionToken, 'START_GUN', timestamp, validSig)).toBe(true);

    // توقيع خاطئ (مفتاح جلسة مختلف)
    expect(await verifyMessageHmac('other-token', 'START_GUN', timestamp, validSig)).toBe(false);

    // رسالة تم التلاعب بنوعها بعد التوقيع
    expect(await verifyMessageHmac(sessionToken, 'RECALL_GUN', timestamp, validSig)).toBe(false);

    // رسالة تم التلاعب بطابعها الزمني
    expect(await verifyMessageHmac(sessionToken, 'START_GUN', timestamp + 1, validSig)).toBe(false);

    // توقيع مفقود
    expect(await verifyMessageHmac(sessionToken, 'START_GUN', timestamp, '')).toBe(false);
  });

  it('encrypts MQTT payloads with AES-GCM and refuses foreign/tampered envelopes', async () => {
    const roomToken = 'pf-session-ABC-123';
    const payload = { type: 'LANE_FINISH', lane: 4, ms: 10234, _senderRole: 'finish' };

    const envelope = await encryptJsonPayload(roomToken, payload);
    expect(envelope).not.toBeNull();
    expect(envelope!._enc).toBe('A256GCM');

    // الحمولة المشفرة لا تكشف أي كلمات مفتاحية من الرسالة الأصلية
    const raw = JSON.stringify(envelope);
    expect(raw).not.toContain('LANE_FINISH');
    expect(raw).not.toContain('finish');

    // فك التشفير بنفس رمز الجلسة يعيد الرسالة كاملة
    const decrypted = await decryptJsonPayload<typeof payload>(roomToken, envelope!);
    expect(decrypted).toEqual(payload);

    // جهاز من غرفة أخرى (رمز جلسة مختلف) يفشل في فك التشفير
    const foreign = await decryptJsonPayload(roomToken + 'X', envelope!);
    expect(foreign).toBeNull();

    // التلاعب بحرف واحد في النص المشفر يفشل فك التشفير (توعية GCM)
    const tampered = { ...envelope!, d: flipChar(envelope!.d) };
    const tamperedResult = await decryptJsonPayload(roomToken, tampered);
    expect(tamperedResult).toBeNull();
  });
});

describe('Stage A-bis: Server-Signed Checkpoint QR (Ed25519, zero frontend secrets)', () => {
  // محاكاة نقطة النهاية /api/checkpoint/sign (نفس منطق vite.config.ts وrelay-server)
  beforeAll(() => {
    setTrustedPublicKeyBase64(getPublicKeyBase64());
  });

  const serverSignFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    if (typeof url === 'string' && url.includes('/api/checkpoint/sign')) {
      const body = JSON.parse(String(init?.body || '{}'));
      const signature = signCheckpointQr(body);
      return new Response(JSON.stringify({ ok: true, signature }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404 });
  };

  it('issues a signed QR pack via server and verifies it offline with the public key', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = serverSignFetch as typeof fetch;
    try {
      const pack = await courseDesignerService.generateSecuredQrPack('comp-demo-1', {
        id: 'cp-1',
        code: 'CP-A',
        name: 'نقطة كيلو 5',
        distanceKm: 5.2
      } as any);

      expect(pack.signature.length).toBeGreaterThan(80); // توقيع Ed25519 كامل (64 بايت)

      const result = await courseDesignerService.verifySecuredQrToken(pack.encryptedPayload, 'comp-demo-1');
      expect(result.valid).toBe(true);
      expect(result.checkpointId).toBe('cp-1');
      expect(result.checkpointCode).toBe('CP-A');
      expect(result.distanceKm).toBe(5.2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects tampered checkpoint payloads', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = serverSignFetch as typeof fetch;
    try {
      const pack = await courseDesignerService.generateSecuredQrPack('comp-demo-1', {
        id: 'cp-2', code: 'CP-B', name: 'نقطة 2', distanceKm: 12
      } as any);

      // التلاعب بالمسافة داخل الحمولة يكسر التوقيع
      const payloadObj = JSON.parse(decodeURIComponent(escape(atob(pack.encryptedPayload))));
      payloadObj.km = 1; // تزوير
      const tamperedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(payloadObj))));

      const result = await courseDesignerService.verifySecuredQrToken(tamperedPayload, 'comp-demo-1');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('مزور');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects legacy HMAC-era checkpoint tokens with a clear migration message', async () => {
    // حزمة بصيغة قديمة (توقيع قصير بدون alg) — ملحها كان مُسرّباً في المستودع
    const legacyPayload = {
      cid: 'comp-demo-1', cpid: 'cp-old', code: 'CP-Z', name: 'قديمة', km: 3,
      iat: Date.now(), exp: Date.now() + 86400000, sig: 'DEADBEEF01234567'
    };
    const legacyB64 = btoa(unescape(encodeURIComponent(JSON.stringify(legacyPayload))));

    const result = await courseDesignerService.verifySecuredQrToken(legacyB64, 'comp-demo-1');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('قديمة');
  });

  it('closes the unknown PFP_CP token hole (was accepted blindly)', async () => {
    const result = await courseDesignerService.verifySecuredQrToken('PFP_CP:FAKE:cp-fake:ABCD1234', 'comp-demo-1');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('غير معروف');
  });

  it('rejects expired signed checkpoint tokens', async () => {
    const iat = Date.now() - 2 * 86400000;
    const exp = iat + 86400000; // منتهية
    const sig = signCheckpointQr({ cid: 'comp-demo-1', cpid: 'cp-exp', code: 'CP-E', km: 7, iat, exp });
    const payloadObj = { cid: 'comp-demo-1', cpid: 'cp-exp', code: 'CP-E', name: 'منتهية', km: 7, iat, exp, alg: 'ed25519', sig };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payloadObj))));

    const result = await courseDesignerService.verifySecuredQrToken(b64, 'comp-demo-1');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('انتهت صلاحية');
  });

  it('server-side verify agrees with client-side verification (same canonical string)', async () => {
    const iat = Date.now();
    const exp = iat + 3600000;
    const sig = signCheckpointQr({ cid: 'C', cpid: 'cp', code: 'X', km: 1, iat, exp });
    const canonical = buildCheckpointCanonical({ cid: 'C', cpid: 'cp', code: 'X', km: 1, iat, exp });
    setTrustedPublicKeyBase64(getPublicKeyBase64());
    const ok = await verifyEd25519Signature(canonical, sig);
    const serverOk = verifyCheckpointQrSignature({ cid: 'C', cpid: 'cp', code: 'X', km: 1, iat, exp }, sig);
    expect(ok).toBe(true);
    expect(serverOk).toBe(true);
  });
});

describe('Stage A-ter: Zero Secrets in Repository & Built Bundle', () => {
  it('contains zero backdoor literals or leaked key material in any source', () => {
    const root = resolve(__dirname, '..');

    // 1) كل النصوص المسرّبة تاريخياً (أكواد، مفاتيح، أملاح)
    const compromised = [
      'PFP-ADMIN-2026',
      'PFP-SecureAdmin-2026',
      'PFP-SECUREADMIN-2026',
      'PFP_ATHLETICS_OFFLINE_SECRET_2026_SECURE',
      'PFP_ATHLETICS_QR_V2_SEASON_SALT',
      'gW5tU3jF63FHmofys6AdKy9340A34SErmp', // مفتاح Ed25519 الخاص المسرّب سابقاً
      'hbH1fBBC+kL3K6u7pWufQqHoKRjM0iS',    // المفتاح العام للزوج المفسوح
      'AQUACORE_PHOTOFINISH_SECRET_SALT_2026_ATHLETICS_MASTER'
    ];

    // 2) الأكواد/الكلمات المفسوحة: يُمنع ذكرها في الشفرة (src/server/relay-server/vite/index.html)
    //    ويُسمح بذكرها في التوثيق (README.md) بوصفها أكواداً مفسوحة إدارياً فقط.
    const legacyLicenseCodes = ['ALADINE-VIP-2026', 'AQUACORE-ADMIN-KEY', 'PRO-ATHLETICS-2026', 'COACH-CLUB-PRO'];

    const codeTargets = ['src', 'server', 'relay-server', 'vite.config.ts', 'index.html', '.env.example'];

    const checkContent = (abs: string, withLegacy: boolean) => {
      const content = readFileSync(abs, 'utf8');
      for (const secret of compromised) {
        expect(content.includes(secret), `${abs} must not contain compromised secret "${secret}"`).toBe(false);
      }
      if (withLegacy) {
        for (const code of legacyLicenseCodes) {
          expect(content.includes(code), `${abs} must not mention legacy license code "${code}" (hash-based blocklist only)`).toBe(false);
        }
      }
    };

    const walkAndCheck = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = resolve(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) {
          if (name === 'node_modules' || name === 'dist') continue;
          walkAndCheck(p);
        } else if (/\.(ts|tsx|js|mjs|cjs|html|md|example)$/.test(name)) {
          checkContent(p, true);
        }
      }
    };

    for (const rel of codeTargets) {
      const abs = resolve(root, rel);
      if (!existsSync(abs)) continue;
      if (statSync(abs).isDirectory()) walkAndCheck(abs);
      else checkContent(abs, true);
    }
    // التوثيق: مادة المفاتيح ممنوعة، ذكر الأكواد المفسوحة للتوثيق مقبول
    const readme = resolve(root, 'README.md');
    if (existsSync(readme)) checkContent(readme, false);
  });

  it('scans the built frontend bundle for secret patterns (runs when dist/ exists)', () => {
    const distDir = resolve(__dirname, '..', 'dist');
    if (!existsSync(distDir)) {
      // في CI: npm run build يسبق npm test — محلياً نتخطى إن لم تُبنَ الحزمة بعد
      return;
    }

    const patterns = [
      'ALADINE-VIP-2026', 'AQUACORE-ADMIN-KEY', 'PRO-ATHLETICS-2026', 'COACH-CLUB-PRO',
      'PFP-ADMIN-2026', 'PFP-SECUREADMIN-2026',
      'PFP_ATHLETICS_OFFLINE_SECRET_2026_SECURE',
      'PFP_ATHLETICS_QR_V2_SEASON_SALT',
      'gW5tU3jF63FHmofys6AdKy9340A34SErmp',
      'hbH1fBBC+kL3K6u7pWufQqHoKRjM0iS'
    ];

    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = resolve(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else if (/\.(js|mjs|html|css|json)$/.test(name)) {
          const content = readFileSync(p, 'utf8');
          for (const secret of patterns) {
            expect(content.includes(secret), `built bundle ${p} contains secret pattern "${secret}"`).toBe(false);
          }
        }
      }
    };
    walk(distDir);
  });
});

/** قلب أول حرف في نص Base64 لإحداث تلاعب حتمي دون كسر الترميز دائماً */
function flipChar(b64: string): string {
  const chars = b64.split('');
  for (let i = 0; i < chars.length; i++) {
    if (/[A-Za-z]/.test(chars[i])) {
      chars[i] = chars[i] === 'A' ? 'B' : 'A';
      return chars.join('');
    }
  }
  return b64;
}
