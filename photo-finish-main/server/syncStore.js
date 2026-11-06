/**
 * Photo Finish Pro — مخزن المزامنة الخلفي (Server Sync Store)
 * ==============================================================================
 * طبقة التخزين لمحرك المزامنة offline-first:
 * 1. دفتر إلغاء التكرار (Idempotency Ledger): كل رسالة تُقبل مرة واحدة حسب
 *    المعرف الفريد (_msgId) — إعادة الإرسال بعد انقطاع الشبكة لا تُنشئ تكراراً.
 * 2. سجل زمني قابل للاسترجاع (Replayable Journal): يمكن لأي جهاز أن يستعيد
 *    ما فاته عبر /api/sync/replay?since=<seq> — صفر فقدان بعد العودة من الانقطاع.
 * 3. سجل تدقيق خادمي (Server Audit) + لقطات نسخ احتياطي (Backup Snapshots).
 *
 * التخزين: node:sqlite (مدمج في Node 22.5+ بلا أي حزم خارجية).
 * إذا لم يتوفر node:sqlite (Node أقدم) يعمل بمخزن ذاكرة مؤقت بنفس الواجهة
 * حتى لا يتوقف خادم الترحيل أبداً (يُسجَّل تحذير في الطرفية).
 */

let DatabaseSync = null;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} catch (e) {
  DatabaseSync = null;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sync_messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  msg_id TEXT NOT NULL,
  room TEXT NOT NULL,
  sender_id TEXT,
  sender_role TEXT,
  msg_type TEXT,
  received_at INTEGER NOT NULL,
  payload TEXT NOT NULL,
  UNIQUE(room, msg_id)
);
CREATE INDEX IF NOT EXISTS idx_sync_messages_room_seq ON sync_messages(room, seq);
CREATE INDEX IF NOT EXISTS idx_sync_messages_type ON sync_messages(msg_type);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  room TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_room_time ON audit_log(room, created_at);

CREATE TABLE IF NOT EXISTS backup_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  message_count INTEGER DEFAULT 0,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_room ON backup_snapshots(room, created_at);
`;

export class SyncStore {
  constructor({ dbPath = ':memory:' } = {}) {
    this.usingSqlite = !!DatabaseSync;
    this.memoryMessages = [];           // fallback
    this.memoryMessageKeys = new Set(); // room|msg_id
    this.memoryAudit = [];
    this.memorySnapshots = [];
    this.seqCounter = 0;

    if (this.usingSqlite) {
      try {
        this.db = new DatabaseSync(dbPath);
        this.db.exec(SCHEMA_SQL);
        this._prepare();
      } catch (e) {
        console.warn('[SyncStore] تعذر فتح SQLite، التحويل إلى الذاكرة:', e?.message || e);
        this.usingSqlite = false;
      }
    }
  }

  _prepare() {
    this.stIngest = this.db.prepare(
      `INSERT INTO sync_messages (msg_id, room, sender_id, sender_role, msg_type, received_at, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    this.stReplay = this.db.prepare(
      `SELECT seq, msg_id, room, sender_id, sender_role, msg_type AS type, received_at, payload
       FROM sync_messages WHERE room = ? AND seq > ? ORDER BY seq ASC LIMIT ?`
    );
    this.stLatestSeq = this.db.prepare(
      `SELECT MAX(seq) AS maxSeq FROM sync_messages WHERE room = ?`
    );
    this.stCount = this.db.prepare(
      `SELECT COUNT(*) AS n FROM sync_messages WHERE room = ?`
    );
    this.stAuditInsert = this.db.prepare(
      `INSERT OR IGNORE INTO audit_log (id, room, actor_role, action, target, old_value, new_value, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.stAuditList = this.db.prepare(
      `SELECT id, room, actor_role, action, target, old_value, new_value, reason, created_at
       FROM audit_log WHERE room = ? ORDER BY created_at DESC LIMIT ?`
    );
    this.stSnapshotInsert = this.db.prepare(
      `INSERT INTO backup_snapshots (room, kind, created_at, message_count, data) VALUES (?, ?, ?, ?, ?)`
    );
    this.stSnapshotList = this.db.prepare(
      `SELECT id, room, kind, created_at, message_count FROM backup_snapshots WHERE room = ? ORDER BY created_at DESC LIMIT 50`
    );
    this.stSnapshotGet = this.db.prepare(
      `SELECT * FROM backup_snapshots WHERE id = ?`
    );
  }

  /**
   * إدخال دفعة رسائل مع إلغاء التكرار حسب (room, _msgId).
   * @returns {{accepted: string[], duplicates: string[]}}
   */
  ingest(room, messages) {
    const accepted = [];
    const duplicates = [];
    const now = Date.now();

    for (const msg of (Array.isArray(messages) ? messages : [])) {
      const msgId = String(msg?._msgId || msg?.id || '').trim();
      if (!msgId) continue; // رسالة بلا معرف لا يمكن ضمان عدم تكرارها — تُرفض

      const payload = JSON.stringify(msg);
      const senderId = msg?._senderId ? String(msg._senderId) : null;
      const senderRole = msg?._senderRole ? String(msg._senderRole) : null;
      const msgType = msg?.type ? String(msg.type) : null;
      const receivedAt = Number(msg?.timestamp) || now;

      if (this.usingSqlite) {
        try {
          this.stIngest.run(msgId, room, senderId, senderRole, msgType, receivedAt, payload);
          accepted.push(msgId);
        } catch (e) {
          // قيد UNIQUE = مكرر (سبق قبولها) — هذا هو السلوك المطلوب تحديداً
          duplicates.push(msgId);
        }
      } else {
        const key = `${room}|${msgId}`;
        if (this.memoryMessageKeys.has(key)) {
          duplicates.push(msgId);
        } else {
          this.memoryMessageKeys.add(key);
          this.memoryMessages.push({
            seq: ++this.seqCounter,
            msg_id: msgId, room, sender_id: senderId, sender_role: senderRole,
            type: msgType, received_at: receivedAt, payload
          });
          accepted.push(msgId);
        }
      }
    }

    return { accepted, duplicates };
  }

  /** استرجاع الرسائل بعد تسلسل معين (لتعويض فجوة الانقطاع) */
  replay(room, sinceSeq = 0, limit = 500) {
    const cap = Math.min(Math.max(1, limit), 2000);
    if (this.usingSqlite) {
      return this.stReplay.all(String(room), Number(sinceSeq) || 0, cap)
        .map(row => ({ ...row, payload: safeParse(row.payload) }));
    }
    return this.memoryMessages
      .filter(m => m.room === String(room) && m.seq > (Number(sinceSeq) || 0))
      .sort((a, b) => a.seq - b.seq)
      .slice(0, cap)
      .map(m => ({
        seq: m.seq, msg_id: m.msg_id, room: m.room,
        sender_id: m.sender_id, sender_role: m.sender_role,
        type: m.type, received_at: m.received_at,
        payload: safeParse(m.payload)
      }));
  }

  latestSeq(room) {
    if (this.usingSqlite) {
      const row = this.stLatestSeq.get(String(room));
      return row?.maxSeq || 0;
    }
    let max = 0;
    for (const m of this.memoryMessages) {
      if (m.room === String(room) && m.seq > max) max = m.seq;
    }
    return max;
  }

  messageCount(room) {
    if (this.usingSqlite) {
      const row = this.stCount.get(String(room));
      return row?.n || 0;
    }
    return this.memoryMessages.filter(m => m.room === String(room)).length;
  }

  /** توثيق سجل تدقيق خادمي (يدعم الدفعات) */
  appendAudit(room, entries) {
    const now = Date.now();
    for (const e of (Array.isArray(entries) ? entries : [])) {
      const id = String(e?.id || `srv_${now}_${Math.random().toString(36).slice(2, 8)}`);
      if (this.usingSqlite) {
        this.stAuditInsert.run(
          id, room || null,
          e?.actorRole || null, String(e?.action || 'UNKNOWN'),
          e?.target ? String(e.target) : null,
          e?.oldValue != null ? JSON.stringify(e.oldValue) : null,
          e?.newValue != null ? JSON.stringify(e.newValue) : null,
          e?.reason ? String(e.reason) : null,
          Number(e?.timestamp) || now
        );
      } else {
        this.memoryAudit.push({
          id, room: room || null, actor_role: e?.actorRole || null,
          action: String(e?.action || 'UNKNOWN'),
          target: e?.target || null, old_value: e?.oldValue ?? null, new_value: e?.newValue ?? null,
          reason: e?.reason || null, created_at: Number(e?.timestamp) || now
        });
      }
    }
  }

  listAudit(room, limit = 100) {
    const cap = Math.min(Math.max(1, limit), 1000);
    if (this.usingSqlite) {
      return this.stAuditList.all(String(room), cap);
    }
    return this.memoryAudit
      .filter(a => a.room === String(room))
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, cap);
  }

  /** لقطة نسخة احتياطية (JSON كامل) */
  saveSnapshot(room, kind, dataObj, messageCount) {
    const createdAt = Date.now();
    const data = JSON.stringify(dataObj);
    if (this.usingSqlite) {
      const res = this.stSnapshotInsert.run(String(room), String(kind), createdAt, messageCount || 0, data);
      return { id: Number(res.lastInsertRowid), createdAt };
    }
    const id = ++this.seqCounter + 100000;
    this.memorySnapshots.unshift({ id, room: String(room), kind: String(kind), created_at: createdAt, message_count: messageCount || 0, data });
    return { id, createdAt };
  }

  listSnapshots(room) {
    if (this.usingSqlite) return this.stSnapshotList.all(String(room));
    return this.memorySnapshots
      .filter(s => s.room === String(room))
      .slice(0, 50)
      .map(({ data, ...meta }) => meta);
  }

  getSnapshot(id) {
    if (this.usingSqlite) {
      const row = this.stSnapshotGet.get(Number(id));
      return row ? { ...row, data: safeParse(row.data) } : null;
    }
    const found = this.memorySnapshots.find(s => s.id === Number(id));
    return found ? { ...found, data: safeParse(found.data) } : null;
  }

  stats() {
    return {
      engine: this.usingSqlite ? 'node:sqlite' : 'memory-fallback',
      rooms: this._knownRooms().map(room => ({
        room,
        messages: this.messageCount(room),
        latestSeq: this.latestSeq(room)
      }))
    };
  }

  _knownRooms() {
    if (this.usingSqlite) {
      const rows = this.db.prepare(`SELECT DISTINCT room FROM sync_messages LIMIT 200`).all();
      return rows.map(r => r.room);
    }
    return [...new Set(this.memoryMessages.map(m => m.room))];
  }

  close() {
    if (this.usingSqlite && this.db) {
      try { this.db.close(); } catch { /* */ }
    }
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

/** مصنع افتراضي: ملف على القرص في الإنتاج، ذاكرة في الاختبارات */
export function createSyncStore({ dbPath } = {}) {
  const resolved = dbPath
    || process.env.PFP_DB_PATH
    || (process.env.PFP_SYNC_MEMORY === '1' ? ':memory:' : null);
  return new SyncStore({ dbPath: resolved || undefined });
}
