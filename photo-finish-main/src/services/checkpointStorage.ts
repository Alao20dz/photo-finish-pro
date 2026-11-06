/**
 * خزانة بيانات نقاط المراقبة والحكام الدائمة (IndexedDB Offline-First Storage)
 * 
 * المزايا:
 * - حفظ دائم محلي لجميع أحداث المرور والمنافسات دون حاجة للإنترنت
 * - سجل تدقيق غير قابل للحذف (Immutable Event Log)
 * - دعم طابور المزامنة (Sync Queue) لإعادة الإرسال التلقائي
 * - التوافق مع بنية المتصفح والهواتف المحمولة
 */

import { 
  AthleticsCompetition, 
  PassageEvent, 
  PassageCorrection, 
  AthleticsJudge 
} from '../types/athletics';

const DB_NAME = 'athletics_competition_db_v1';
const DB_VERSION = 1;

// أسماء مخازن الكائنات (Object Stores)
const STORE_COMPETITIONS = 'competitions';
const STORE_PASSAGES = 'passage_events';
const STORE_CORRECTIONS = 'passage_corrections';
const STORE_VIOLATIONS = 'course_violations';
const STORE_JUDGES = 'judges';
const STORE_SYNC_QUEUE = 'sync_queue';

class CheckpointStorageService {
  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;

  /** فتح قاعدة البيانات مع إنشاء المخطط والفهارس */
  private async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.openPromise) return this.openPromise;

    this.openPromise = new Promise((resolve, reject) => {
      try {
        if (typeof indexedDB === 'undefined') {
          reject(new Error('IndexedDB غير مدعوم في هذه البيئة'));
          return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;

          // 1. مخزن المنافسات
          if (!db.objectStoreNames.contains(STORE_COMPETITIONS)) {
            const compStore = db.createObjectStore(STORE_COMPETITIONS, { keyPath: 'id' });
            compStore.createIndex('date', 'date');
            compStore.createIndex('status', 'status');
          }

          // 2. مخزن أحداث المرور (مع فهارس للبحث السريع والتأكد من التكرار)
          if (!db.objectStoreNames.contains(STORE_PASSAGES)) {
            const passStore = db.createObjectStore(STORE_PASSAGES, { keyPath: 'id' });
            passStore.createIndex('competitionId', 'competitionId');
            passStore.createIndex('checkpointId', 'checkpointId');
            passStore.createIndex('bibNumber', 'bibNumber');
            passStore.createIndex('lapNumber', 'lapNumber');
            passStore.createIndex('timestamp', 'timestamp');
            passStore.createIndex('syncStatus', 'syncStatus');
            // فهرس مركب لمنع التكرار في نفس النقطة والحلقة
            passStore.createIndex('comp_cp_lap_bib', ['competitionId', 'checkpointId', 'lapNumber', 'bibNumber']);
          }

          // 3. مخزن طلبات التصحيح والمراجعة
          if (!db.objectStoreNames.contains(STORE_CORRECTIONS)) {
            const corrStore = db.createObjectStore(STORE_CORRECTIONS, { keyPath: 'id' });
            corrStore.createIndex('passageEventId', 'passageEventId');
            corrStore.createIndex('status', 'status');
          }

          // 4. مخزن المخالفات
          if (!db.objectStoreNames.contains(STORE_VIOLATIONS)) {
            const violStore = db.createObjectStore(STORE_VIOLATIONS, { keyPath: 'id' });
            violStore.createIndex('competitionId', 'competitionId');
            violStore.createIndex('bibNumber', 'bibNumber');
          }

          // 5. مخزن الحكام
          if (!db.objectStoreNames.contains(STORE_JUDGES)) {
            const judgeStore = db.createObjectStore(STORE_JUDGES, { keyPath: 'id' });
            judgeStore.createIndex('pinCode', 'pinCode');
            judgeStore.createIndex('assignedCompetitionId', 'assignedCompetitionId');
          }

          // 6. مخزن طابور المزامنة المحلي
          if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
            const syncStore = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id' });
            syncStore.createIndex('timestamp', 'timestamp');
          }
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };

        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });

    return this.openPromise;
  }

  // ═══════════════════════════════════════════════════
  // المنافسات (Competitions)
  // ═══════════════════════════════════════════════════

  public async saveCompetition(comp: AthleticsCompetition): Promise<string> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COMPETITIONS, 'readwrite');
      tx.objectStore(STORE_COMPETITIONS).put(comp);
      tx.oncomplete = () => resolve(comp.id);
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getCompetition(id: string): Promise<AthleticsCompetition | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COMPETITIONS, 'readonly');
      const req = tx.objectStore(STORE_COMPETITIONS).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async listCompetitions(): Promise<AthleticsCompetition[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COMPETITIONS, 'readonly');
      const req = tx.objectStore(STORE_COMPETITIONS).getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as AthleticsCompetition[];
        list.sort((a, b) => b.createdAt - a.createdAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ═══════════════════════════════════════════════════
  // أحداث المرور (Passage Events & Sync Queue)
  // ═══════════════════════════════════════════════════

  /**
   * حفظ حدث مرور في المخزن الدائم وطابور المزامنة
   * يمنع التكرار التام (Idempotent) عبر التحقق من معرّف الحدث ومن وجود تسجيل مسبق في نفس النقطة والحلقة
   */
  public async recordPassage(event: PassageEvent): Promise<{ success: boolean; duplicate?: boolean }> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PASSAGES, STORE_SYNC_QUEUE], 'readwrite');
      const passStore = tx.objectStore(STORE_PASSAGES);
      const syncStore = tx.objectStore(STORE_SYNC_QUEUE);

      // فحص وجود الحدث بالمعرف
      const checkReq = passStore.get(event.id);
      checkReq.onsuccess = () => {
        if (checkReq.result) {
          // الحدث مسجل مسبقاً بنفس الـ ID
          resolve({ success: true, duplicate: true });
          return;
        }

        passStore.put(event);
        if (event.syncStatus === 'pending') {
          syncStore.put({ id: event.id, event, timestamp: event.timestamp });
        }
      };

      tx.oncomplete = () => resolve({ success: true, duplicate: false });
      tx.onerror = () => reject(tx.error);
    });
  }

  /** جلب جميع أحداث المرور الخاصة بمنافسة معينة */
  public async getPassagesForCompetition(competitionId: string): Promise<PassageEvent[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PASSAGES, 'readonly');
      const index = tx.objectStore(STORE_PASSAGES).index('competitionId');
      const req = index.getAll(competitionId);
      req.onsuccess = () => {
        const passages = (req.result || []) as PassageEvent[];
        passages.sort((a, b) => a.timestamp - b.timestamp);
        resolve(passages);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /** التحقق مما إذا كان العداء قد سُجل في نفس النقطة والحلقة سابقاً لمنع التكرار العفوي */
  public async checkBibPassageExists(
    competitionId: string, 
    checkpointId: string, 
    lapNumber: number, 
    bibNumber: number
  ): Promise<PassageEvent | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PASSAGES, 'readonly');
      const index = tx.objectStore(STORE_PASSAGES).index('comp_cp_lap_bib');
      const req = index.get([competitionId, checkpointId, lapNumber, bibNumber]);
      req.onsuccess = () => resolve((req.result as PassageEvent) || null);
      req.onerror = () => reject(req.error);
    });
  }

  /** جلب طابور الأحداث المعلقة للمزامنة */
  public async getPendingSyncQueue(): Promise<PassageEvent[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_SYNC_QUEUE).getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        resolve(items.map((i: any) => i.event as PassageEvent));
      };
      req.onerror = () => reject(req.error);
    });
  }

  /** تعليم قائمة أحداث على أنها تمت مزامنتها بنجاح وحذفها من طابور الانتظار */
  public async markPassagesSynced(eventIds: string[]): Promise<void> {
    if (!eventIds.length) return;
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PASSAGES, STORE_SYNC_QUEUE], 'readwrite');
      const passStore = tx.objectStore(STORE_PASSAGES);
      const syncStore = tx.objectStore(STORE_SYNC_QUEUE);

      for (const id of eventIds) {
        syncStore.delete(id);
        const req = passStore.get(id);
        req.onsuccess = () => {
          if (req.result) {
            const updated: PassageEvent = { ...req.result, syncStatus: 'synced', syncedAt: Date.now() };
            passStore.put(updated);
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ═══════════════════════════════════════════════════
  // التصحيحات وسجل التدقيق (Audit Trail)
  // ═══════════════════════════════════════════════════

  public async recordCorrection(correction: PassageCorrection): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CORRECTIONS, STORE_PASSAGES], 'readwrite');
      tx.objectStore(STORE_CORRECTIONS).put(correction);

      // إذا تمت الموافقة، نحدث الحقل في الحدث الأصلي مع الإبقاء على السجل
      if (correction.status === 'approved') {
        const passStore = tx.objectStore(STORE_PASSAGES);
        const req = passStore.get(correction.passageEventId);
        req.onsuccess = () => {
          if (req.result) {
            const event = req.result as PassageEvent;
            event.bibNumber = correction.correctedBibNumber;
            event.isFlagged = true;
            event.flagReason = `تم التصحيح رسمياً من ${correction.originalBibNumber} إلى ${correction.correctedBibNumber}: ${correction.reason}`;
            passStore.put(event);
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async listCorrections(): Promise<PassageCorrection[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CORRECTIONS, 'readonly');
      const req = tx.objectStore(STORE_CORRECTIONS).getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as PassageCorrection[];
        list.sort((a, b) => b.requestedAt - a.requestedAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ═══════════════════════════════════════════════════
  // الحكام (Judges)
  // ═══════════════════════════════════════════════════

  public async saveJudge(judge: AthleticsJudge): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_JUDGES, 'readwrite');
      tx.objectStore(STORE_JUDGES).put(judge);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async listJudges(competitionId?: string): Promise<AthleticsJudge[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_JUDGES, 'readonly');
      const req = tx.objectStore(STORE_JUDGES).getAll();
      req.onsuccess = () => {
        let judges = (req.result || []) as AthleticsJudge[];
        if (competitionId) {
          judges = judges.filter(j => !j.assignedCompetitionId || j.assignedCompetitionId === competitionId);
        }
        resolve(judges);
      };
      req.onerror = () => reject(req.error);
    });
  }
}

export const checkpointStorage = new CheckpointStorageService();
