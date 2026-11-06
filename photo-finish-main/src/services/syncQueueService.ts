/**
 * Photo Finish Pro — قائمة المزامنة الدائمة (Persistent Offline-First Sync Queue)
 * ==============================================================================
 * الضمانة الميدانية: "انقطاع 10 دقائق ثم العودة = صفر فقدان وصفر تكرار".
 *
 * 1. كل رسالة بيانات سباق تُخزَّن محلياً أولاً (IndexedDB — ذاكرة احتياطية في
 *    بيئات بلا IndexedDB) بمعرف فريد (_msgId) قبل أي إرسال شبكي.
 * 2. الدفعات تُرسل إلى /api/sync/ingest (نفس _msgId = مفتاح إلغاء التكرار في
 *    دفتر الخادم) — إعادة المحاولة بعد الانقطاع لا تُنشئ تكراراً أبداً.
 * 3. تراجع أسّي في إعادة المحاولة (1s → 60s) مع استئناف فوري عند العودة.
 * 4. تعويض الفجوة (Gap Replay): عند استعادة الاتصال يسحب الجهاز ما فاته من
 *    الخادم عبر /api/sync/replay?since=<lastSeq> فلا تضيع أي رسالة بعيدة المدى.
 */

import type { NetworkPeerMessage } from '../types/race';

// ═══ أنواع الرسائل التي تستحق التخزين الدائم (بيانات رسمية لا نبضات ضوضاء) ═══
export const SYNC_WORTHY_TYPES = new Set<string>([
  'START_GUN', 'RECALL_GUN', 'ON_MARKS', 'SET',
  'LANE_FINISH', 'RACE_COMPLETE',
  'JUDGE_UPDATE_RUNNER', 'SYNC_RESET_ALL',
  'HEAT_DISPATCH', 'HEAT_CANCEL_DISPATCH', 'HEAT_CHANGE', 'HEATS_SYNC', 'HEATS_REORDER', 'DELETE_HEAT',
  'SETTINGS_SYNC',
  'BELL_SIGNAL_START', 'BELL_SIGNAL_STOP', 'BELL_SIGNAL_ACK',
  'ATHLETICS_COMPETITION_SYNC', 'ATHLETICS_CORRECTION', 'ATHLETICS_PASSAGE_BATCH', 'ATHLETICS_VIOLATION',
  'ATHLETICS_JUDGE_HEARTBEAT', 'PASS_OVERRIDE', 'RESULTS_LOCK_PUBLISH',
  'CROSSING_RECORDED', 'CROSSING_SYNC_BATCH',
]);

export interface QueuedMessage {
  id: string;               // _msgId — مفتاح إلغاء التكرار على الخادم
  room: string;
  type: string;
  payload: unknown;         // الرسالة المُثراة كاملة (بالتوقيع والميتاداتا)
  enqueuedAt: number;
}

export interface SyncQueueStats {
  pending: number;
  sentTotal: number;
  duplicatesReported: number;
  flushAttempts: number;
  lastFlushAt: number | null;
  lastError: string | null;
  lastServerSeq: number;
  storage: 'indexeddb' | 'memory';
}

const DB_NAME = 'photo_finish_sync_v1';
const STORE_QUEUE = 'sync_queue';
const STORE_META = 'sync_meta';
const META_SEQ_KEY = 'lastServerSeq';

const FLUSH_BATCH_SIZE = 50;
const MAX_BACKOFF_MS = 60_000;
const FLUSH_DEBOUNCE_MS = 400;

class SyncQueueService {
  private memQueue: QueuedMessage[] = [];
  private queuedIds = new Set<string>();
  private usingIndexedDb = false;
  private db: IDBDatabase | null = null;

  private flushing = false;
  private flushTimer: any = null;
  private retryTimer: any = null;
  private backoffAttempt = 0;

  private sentTotal = 0;
  private duplicatesReported = 0;
  private flushAttempts = 0;
  private lastFlushAt: number | null = null;
  private lastError: string | null = null;
  private lastServerSeq = 0;

  private pullCallback: ((msg: NetworkPeerMessage) => void) | null = null;
  private listeners = new Set<() => void>();

  public roomCode = 'RACE-2026';
  public sessionToken = '';

  constructor() {
    this.initStorage();
  }

  // ═══ التخزين الدائم ═══

  private async initStorage(): Promise<void> {
    try {
      if (typeof indexedDB === 'undefined') throw new Error('no idb');
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains(STORE_QUEUE)) {
            d.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
          }
          if (!d.objectStoreNames.contains(STORE_META)) {
            d.createObjectStore(STORE_META, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      this.usingIndexedDb = true;
      // استرجاع الرصيد غير المُرسل من جلسة سابقة (إقلاع بارد بعد انقطاع)
      const persisted = await this.readAllPersisted();
      for (const item of persisted) {
        if (!this.queuedIds.has(item.id)) {
          this.memQueue.push(item);
          this.queuedIds.add(item.id);
        }
      }
      this.lastServerSeq = await this.readMeta(META_SEQ_KEY) || 0;
      if (persisted.length > 0) {
        // رصيد قديم — أطلق تدفقاً فورياً
        setTimeout(() => this.flush(), 1500);
      }
      this.notify();
    } catch {
      this.usingIndexedDb = false;
    }
  }

  private readAllPersisted(): Promise<QueuedMessage[]> {
    return new Promise((resolve) => {
      if (!this.db) return resolve([]);
      try {
        const tx = this.db.transaction(STORE_QUEUE, 'readonly');
        const req = tx.objectStore(STORE_QUEUE).getAll();
        req.onsuccess = () => resolve((req.result || []) as QueuedMessage[]);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  private persistItem(item: QueuedMessage): void {
    if (!this.usingIndexedDb || !this.db) return;
    try {
      const tx = this.db.transaction(STORE_QUEUE, 'readwrite');
      tx.objectStore(STORE_QUEUE).put(item);
    } catch { /* لا نُفشل السباق بسبب التخزين */ }
  }

  private deletePersisted(ids: string[]): void {
    if (!this.usingIndexedDb || !this.db) return;
    try {
      const tx = this.db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      ids.forEach(id => store.delete(id));
    } catch { /* */ }
  }

  private readMeta(key: string): Promise<number | null> {
    return new Promise((resolve) => {
      if (!this.db) return resolve(null);
      try {
        const tx = this.db.transaction(STORE_META, 'readonly');
        const req = tx.objectStore(STORE_META).get(key);
        req.onsuccess = () => resolve(req.result?.value ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private writeMeta(key: string, value: number): void {
    if (!this.usingIndexedDb || !this.db) return;
    try {
      const tx = this.db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key, value });
    } catch { /* */ }
  }

  // ═══ الطابور ═══

  /**
   * تخزين رسالة رسمية محلياً قبل الإرسال. الرسائل بلا معرف فريد تُتجاهل
   * لأن إلغاء التكرار الشامل يعتمد على _msgId.
   */
  public enqueue(msg: any): void {
    if (!msg) return;
    if (!SYNC_WORTHY_TYPES.has(msg.type)) return;
    const id = String(msg._msgId || '');
    if (!id) return;

    if (this.queuedIds.has(id)) return; // محلياً: لا تكرار في الطابور نفسه
    const item: QueuedMessage = {
      id,
      room: String(msg._room || this.roomCode),
      type: msg.type,
      payload: msg,
      enqueuedAt: Date.now(),
    };
    this.memQueue.push(item);
    this.queuedIds.add(id);
    this.persistItem(item);
    this.scheduleFlush();
    this.notify();
  }

  /** جدولة تدفق مكتوم التردد — تجميع رسائل الانفجار الزمني في دفعة واحدة */
  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, FLUSH_DEBOUNCE_MS);
  }

  public get pendingCount(): number {
    return this.memQueue.length;
  }

  public get apiBase(): string {
    try {
      return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SYNC_API_URL) || '';
    } catch {
      return '';
    }
  }

  // ═══ التدفق إلى الخادم (Idempotent Flush) ═══

  public async flush(force = false): Promise<{ ok: boolean; accepted: number; duplicates: number }> {
    if (this.flushing && !force) return { ok: false, accepted: 0, duplicates: 0 };
    if (this.memQueue.length === 0) return { ok: true, accepted: 0, duplicates: 0 };
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }

    this.flushing = true;
    let totalAccepted = 0;
    let totalDuplicates = 0;

    try {
      while (this.memQueue.length > 0) {
        const batch = this.memQueue.slice(0, FLUSH_BATCH_SIZE);
        const res = await this.postIngest(batch);
        if (!res.ok) throw new Error(res.error || 'sync ingest failed');

        // الدفتر الخادمي يقبل كل معرف مرة واحدة فقط؛ المكرر يُبلَّغ عنه ويُحذف من الطابور
        const doneIds = new Set([...res.accepted, ...res.duplicates]);
        this.removeBatch(batch.map(b => b.id), doneIds);

        totalAccepted += res.accepted.length;
        totalDuplicates += res.duplicates.length;
        this.sentTotal += res.accepted.length;
        this.duplicatesReported += res.duplicates.length;
        this.lastFlushAt = Date.now();
        this.lastError = null;
        this.backoffAttempt = 0;
        if (res.latestSeq && res.latestSeq > this.lastServerSeq) {
          this.lastServerSeq = res.latestSeq;
          this.writeMeta(META_SEQ_KEY, this.lastServerSeq);
        }
        this.notify();
      }
    } catch (e: any) {
      this.lastError = String(e?.message || e);
      this.backoffAttempt++;
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, Math.min(this.backoffAttempt, 6)));
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.flush();
      }, delay);
    } finally {
      this.flushing = false;
      this.flushAttempts++;
      this.notify();
    }

    return { ok: !this.lastError, accepted: totalAccepted, duplicates: totalDuplicates };
  }

  private removeBatch(batchIds: string[], doneIds: Set<string>): void {
    const removable = batchIds.filter(id => doneIds.has(id));
    if (!removable.length) return;
    const removeSet = new Set(removable);
    this.memQueue = this.memQueue.filter(q => !removeSet.has(q.id));
    removable.forEach(id => this.queuedIds.delete(id));
    this.deletePersisted(removable);
  }

  private async postIngest(batch: QueuedMessage[]): Promise<{
    ok: boolean; accepted: string[]; duplicates: string[]; latestSeq?: number; error?: string;
  }> {
    // في الاختبارات يمكن حقن ناقل بديل
    if (this.transportOverride) {
      return this.transportOverride(batch);
    }
    const base = this.apiBase;
    try {
      const res = await fetch(`${base}/api/sync/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: this.roomCode,
          sessionToken: this.sessionToken || undefined,
          messages: batch.map(b => b.payload),
        }),
      });
      if (res.status === 429 || res.status >= 500) {
        return { ok: false, accepted: [], duplicates: [], error: `server ${res.status}` };
      }
      return await res.json();
    } catch (e: any) {
      return { ok: false, accepted: [], duplicates: [], error: String(e?.message || e) };
    }
  }

  // ═══ تعويض الفجوة (Gap Replay) ═══

  /** تسجيل مستقبل رسائل الاسترجاع — يستدعيه networkService ليغذي البوابة الأمنية */
  public setPullCallback(cb: (msg: NetworkPeerMessage) => void): void {
    this.pullCallback = cb;
  }

  public async pullReplay(force = false): Promise<number> {
    if (!this.pullCallback) return 0;
    if (this.transportOverride && !force) {
      // في الاختبارات يُستدعى صراحة
    }
    try {
      let fetched = 0;
      let since = this.lastServerSeq;
      // حلقة استرجاع حتى بلوغ آخر تسلسل (صفحات حتى 500)
      for (let guard = 0; guard < 10; guard++) {
        const page = await this.fetchReplay(since);
        if (!page.ok || page.messages.length === 0) break;
        for (const row of page.messages) {
          if (row.payload) this.pullCallback(row.payload as NetworkPeerMessage);
          if (row.seq > since) since = row.seq;
          fetched++;
        }
        if (page.latestSeq != null && since >= page.latestSeq) break;
        if (page.messages.length < 500) break;
      }
      if (since > this.lastServerSeq) {
        this.lastServerSeq = since;
        this.writeMeta(META_SEQ_KEY, since);
        this.notify();
      }
      return fetched;
    } catch {
      return 0;
    }
  }

  private async fetchReplay(since: number): Promise<{ ok: boolean; messages: any[]; latestSeq?: number }> {
    if (this.replayOverride) {
      return this.replayOverride(since);
    }
    const base = this.apiBase;
    try {
      const params = new URLSearchParams({
        room: this.roomCode,
        since: String(since),
        limit: '500',
      });
      if (this.sessionToken) params.set('token', this.sessionToken);
      const res = await fetch(`${base}/api/sync/replay?${params.toString()}`);
      return await res.json();
    } catch {
      return { ok: false, messages: [] };
    }
  }

  // ═══ حقن النقل للاختبارات ═══
  public transportOverride: ((batch: QueuedMessage[]) => Promise<any>) | null = null;
  public replayOverride: ((since: number) => Promise<any>) | null = null;

  // ═══ دورة الحالة ═══

  public configure(room: string, sessionToken: string): void {
    this.roomCode = room;
    this.sessionToken = sessionToken;
  }

  public getStats(): SyncQueueStats {
    return {
      pending: this.memQueue.length,
      sentTotal: this.sentTotal,
      duplicatesReported: this.duplicatesReported,
      flushAttempts: this.flushAttempts,
      lastFlushAt: this.lastFlushAt,
      lastError: this.lastError,
      lastServerSeq: this.lastServerSeq,
      storage: this.usingIndexedDb ? 'indexeddb' : 'memory',
    };
  }

  /** تصفير الطابور دون حذف الرصيد الدائم (للاختبارات أساساً) */
  public resetForTest(): void {
    this.memQueue = [];
    this.queuedIds.clear();
    this.backoffAttempt = 0;
    this.flushing = false;
    this.sentTotal = 0;
    this.duplicatesReported = 0;
    this.flushAttempts = 0;
    this.lastError = null;
    this.lastServerSeq = 0;
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(fn => {
      try { fn(); } catch { /* */ }
    });
  }
}

export const syncQueueService = new SyncQueueService();
