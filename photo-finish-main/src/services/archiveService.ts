/**
 * أرشيف السباقات الدائم (IndexedDB Archive Service)
 * 
 * يحفظ نتائج كل سباق مكتمل مع شريط الـ Photo Finish البانورامي محلياً على الجهاز،
 * فلا تُفقد النتائج الرسمية عند إغلاق المتصفح أو انقطاع الاتصال في الملعب.
 * 
 * المزايا:
 * - حفظ تلقائي عند اكتمال كل سباق (محلياً + عند استقبال RACE_COMPLETE)
 * - استعراض، تصدير JSON، حذف فردي أو مسح شامل
 * - يعمل بدون إنترنت بالكامل
 */

const DB_NAME = 'photo_finish_archive_v1';
const DB_VERSION = 1;
const STORE_RACES = 'races';

export interface ArchivedRace {
  id: string;                 // معرف فريد: غرفة-قائمة-وقت
  roomCode: string;           // كود الغرفة/اللقاء
  heatId: string;
  heatName: string;
  heatNumber: number;
  distance: string;
  windSpeed: string;
  laneCount: number;
  completedAt: number;        // تاريخ اكتمال السباق
  runners: Array<{
    bib: number;
    name: string;
    country: string;
    lane: number;
    finishTime: number;
    rank?: number;
    status: string;
  }>;
  fullPhotoFinishUrl?: string; // شريط المسح الشريطي (Data URL)
}

class AthleticsArchiveService {
  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;

  /** فتح قاعدة البيانات (بكسل) */
  private async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.openPromise) return this.openPromise;

    this.openPromise = new Promise((resolve, reject) => {
      try {
        if (typeof indexedDB === 'undefined') {
          reject(new Error('IndexedDB not supported'));
          return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_RACES)) {
            const store = db.createObjectStore(STORE_RACES, { keyPath: 'id' });
            store.createIndex('completedAt', 'completedAt');
            store.createIndex('roomCode', 'roomCode');
          }
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };
        request.onerror = () => reject(request.error);
      } catch (e) {
        reject(e);
      }
    });

    return this.openPromise;
  }

  /** حفظ سباق مكتمل في الأرشيف */
  public async saveRace(race: Omit<ArchivedRace, 'id'> & { id?: string }): Promise<string> {
    try {
      const db = await this.open();
      const record: ArchivedRace = {
        ...race,
        id: race.id || `${race.roomCode || 'RACE'}-${race.heatId || 'heat'}-${race.completedAt || Date.now()}`,
      };
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_RACES, 'readwrite');
        tx.objectStore(STORE_RACES).put(record);
        tx.oncomplete = () => resolve(record.id);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[Archive] حفظ فاشل:', e);
      throw e;
    }
  }

  /** جلب كل السباقات المؤرشفة (الأحدث أولاً) */
  public async listRaces(): Promise<ArchivedRace[]> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_RACES, 'readonly');
        const request = tx.objectStore(STORE_RACES).getAll();
        request.onsuccess = () => {
          const races = (request.result as ArchivedRace[]).sort((a, b) => b.completedAt - a.completedAt);
          resolve(races);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('[Archive] قراءة فاشلة:', e);
      return [];
    }
  }

  /** حذف سباق واحد */
  public async deleteRace(id: string): Promise<void> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_RACES, 'readwrite');
        tx.objectStore(STORE_RACES).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[Archive] حذف فاشل:', e);
    }
  }

  /** مسح الأرشيف بالكامل */
  public async clearAll(): Promise<void> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_RACES, 'readwrite');
        tx.objectStore(STORE_RACES).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[Archive] مسح فاشل:', e);
    }
  }

  /** تصدير سباق واحد كملف JSON */
  public exportRaceJson(race: ArchivedRace): void {
    try {
      const blob = new Blob([JSON.stringify(race, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `photo-finish_${race.roomCode}_${race.heatName.replace(/\s+/g, '-')}_${new Date(race.completedAt).toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('[Archive] تصدير فاشل:', e);
    }
  }

  /** تنسيق الزمن (mm:ss.cc أو mm:ss.mmm) */
  public static formatTime(ms: number, decimals: number = 2): string {
    if (!ms || ms <= 0) return '—';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const fraction = Math.floor(ms % 1000);
    const fracStr = decimals === 3
      ? fraction.toString().padStart(3, '0')
      : Math.floor(fraction / 10).toString().padStart(2, '0');
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${fracStr}`;
  }
}

export const athleticsArchive = new AthleticsArchiveService();
export const formatRaceTime = AthleticsArchiveService.formatTime;
