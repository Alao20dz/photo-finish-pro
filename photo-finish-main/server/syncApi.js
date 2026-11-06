/**
 * Photo Finish Pro — واجهة مزامنة REST موحدة (Sync API Handler)
 * ==============================================================================
 * نفس المعالج يعمل في بيئتين:
 *   - مدمجاً في خادم تطوير/عرض Vite (vite.config.ts)
 *   - داخل خادم الترحيل المستقل (relay-server) عبر import ديناميكي
 *
 * المسارات:
 *   POST /api/sync/ingest   { room, sessionToken?, messages: [...] }
 *                           → { ok, accepted, duplicates, latestSeq }
 *   GET  /api/sync/replay?room=&since=<seq>&limit=<n>
 *                           → { ok, room, since, latestSeq, messages: [...] }
 *   GET  /api/sync/status?room=
 *                           → { ok, room, messageCount, latestSeq }
 *   GET  /api/backup/export?room=&token=<ADMIN_TOKEN>
 *                           → لقطة JSON كاملة (رسائل + تدقيق) للتنزيل
 *   POST /api/backup/import { room, kind, data, token=<ADMIN_TOKEN> }
 *                           → حفظ اللقطة في سجل الخادم
 *   GET  /api/audit?room=&limit=&token=<ADMIN_TOKEN>
 *                           → سجل التدقيق الخادمي
 *
 * الأمان:
 *   - ingest/replay: يُرفض الطلب إذا وفَرَ sessionToken لا يطابق جلسة الغرفة
 *     (الأجهزة داخل الغرفة تعرف الرمز من رسالة الترحيب). الغرف بلا توكين مقبولة
 *     مع وسم unverified — التحقق النهائي يتم عند تطبيق الرسالة في التطبيق
 *     (بوابة HMAC + مصفوفة الصلاحيات).
 *   - النسخ الاحتياطي وسجل التدقيق: حصرياً برمز المدير (Ed25519 HMAC token).
 */

import { createSyncStore } from './syncStore.js';

let sharedStore = null;

export function getSyncStore() {
  if (!sharedStore) {
    sharedStore = createSyncStore();
    const engine = sharedStore.usingSqlite ? 'node:sqlite' : 'memory-fallback';
    console.log(`[SyncAPI] ✅ مخزن المزامنة جاهز (${engine})`);
  }
  return sharedStore;
}

/**
 * معالج موحد للطلب.
 * @param {object} p
 * @param {string} p.pathname
 * @param {URLSearchParams} p.searchParams
 * @param {string} p.method
 * @param {any} p.body جسم الطلب المفكوك (أو null)
 * @param {(room: string) => string} p.getOrCreateSession
 * @param {(token: string) => boolean} p.verifyAdminToken
 * @returns {{ status: number, json: object } | null} null إذا لم يكن المسار من المسارات المعالجة
 */
export function handleSyncRequest({ pathname, searchParams, method, body, getOrCreateSession, verifyAdminToken }) {
  const store = getSyncStore();

  // ── 1. إدخال دفعة رسائل (Idempotent Ingest) ──
  if (pathname === '/api/sync/ingest' && method === 'POST') {
    const room = String(body?.room || '').trim().toUpperCase();
    if (!room) return { status: 400, json: { ok: false, error: 'Missing room' } };

    // فحص رمز الجلسة إن وُفر — عدم التطابق يعني دخيلاً
    const providedToken = String(body?.sessionToken || '');
    if (providedToken) {
      const real = getOrCreateSession(room);
      if (providedToken !== real) {
        return { status: 403, json: { ok: false, error: 'Session token mismatch' } };
      }
    }

    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length > 500) {
      return { status: 413, json: { ok: false, error: 'Batch too large (max 500)' } };
    }

    const { accepted, duplicates } = store.ingest(room, messages);
    return {
      status: 200,
      json: {
        ok: true,
        room,
        acceptedCount: accepted.length,
        duplicatesCount: duplicates.length,
        duplicates,
        latestSeq: store.latestSeq(room),
        serverTime: Date.now()
      }
    };
  }

  // ── 2. استرجاع الفجوة (Gap Replay) ──
  if (pathname === '/api/sync/replay' && method === 'GET') {
    const room = String(searchParams.get('room') || '').trim().toUpperCase();
    if (!room) return { status: 400, json: { ok: false, error: 'Missing room' } };

    const providedToken = String(searchParams.get('token') || '');
    if (providedToken) {
      const real = getOrCreateSession(room);
      if (providedToken !== real) {
        return { status: 403, json: { ok: false, error: 'Session token mismatch' } };
      }
    }

    const since = Number(searchParams.get('since')) || 0;
    const limit = Number(searchParams.get('limit')) || 500;
    const messages = store.replay(room, since, limit);
    return {
      status: 200,
      json: {
        ok: true,
        room,
        since,
        latestSeq: store.latestSeq(room),
        count: messages.length,
        messages
      }
    };
  }

  // ── 3. حالة المزامنة ──
  if (pathname === '/api/sync/status' && method === 'GET') {
    const room = String(searchParams.get('room') || '').trim().toUpperCase();
    return {
      status: 200,
      json: {
        ok: true,
        room,
        messageCount: room ? store.messageCount(room) : 0,
        latestSeq: room ? store.latestSeq(room) : 0,
        stats: store.stats(),
        serverTime: Date.now()
      }
    };
  }

  // ── 4. تصدير نسخة احتياطية (مدير فقط) ──
  if (pathname === '/api/backup/export' && method === 'GET') {
    const token = String(searchParams.get('token') || '');
    if (!verifyAdminToken(token)) {
      return { status: 401, json: { ok: false, error: 'Unauthorized: Invalid admin token' } };
    }
    const room = String(searchParams.get('room') || '').trim().toUpperCase();
    const since = Number(searchParams.get('since')) || 0;
    const messages = room ? store.replay(room, since, 2000) : [];
    const audit = room ? store.listAudit(room, 1000) : [];
    return {
      status: 200,
      json: {
        ok: true,
        format: 'PFP_BACKUP_V1',
        room,
        exportedAt: new Date().toISOString(),
        latestSeq: room ? store.latestSeq(room) : 0,
        messageCount: messages.length,
        auditCount: audit.length,
        messages,
        audit
      }
    };
  }

  // ── 5. استيراد نسخة احتياطية (مدير فقط) ──
  if (pathname === '/api/backup/import' && method === 'POST') {
    const token = String(body?.token || '');
    if (!verifyAdminToken(token)) {
      return { status: 401, json: { ok: false, error: 'Unauthorized: Invalid admin token' } };
    }
    const room = String(body?.room || '').trim().toUpperCase();
    if (!room) return { status: 400, json: { ok: false, error: 'Missing room' } };

    // استرجاع الرسائل داخل اللقطة عبر الدفتر نفسه (إلغاء تكرار مضمون)
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const { accepted, duplicates } = store.ingest(room, messages);
    const audit = Array.isArray(body?.audit) ? body.audit : [];
    if (audit.length) store.appendAudit(room, audit);

    const snap = store.saveSnapshot(room, String(body?.kind || 'import'), {
      importedAt: new Date().toISOString(),
      accepted: accepted.length,
      duplicates: duplicates.length
    }, accepted.length);

    return {
      status: 200,
      json: { ok: true, room, acceptedCount: accepted.length, duplicatesCount: duplicates.length, snapshotId: snap.id }
    };
  }

  // ── 6. سجل تدقيق الخادم (مدير فقط) ──
  if (pathname === '/api/audit' && method === 'GET') {
    const token = String(searchParams.get('token') || '');
    if (!verifyAdminToken(token)) {
      return { status: 401, json: { ok: false, error: 'Unauthorized: Invalid admin token' } };
    }
    const room = String(searchParams.get('room') || '').trim().toUpperCase();
    const limit = Number(searchParams.get('limit')) || 100;
    return { status: 200, json: { ok: true, room, entries: room ? store.listAudit(room, limit) : [] } };
  }

  return null;
}
