/**
 * إدارة وتخزين الملفات الصوتية MP3 المخصصة محلياً في المتصفح عبر IndexedDB
 * يتيح حفظ ملفات MP3 بحجم كامل مع بقائها مخزنة حتى بعد إعادة تحميل الصفحة أو إعادة تشغيل الجهاز.
 */

const DB_NAME = 'PhotoFinishAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'customAudio';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface StoredAudio {
  id: string;
  name: string;
  data: ArrayBuffer;
  duration: number;
  size: number;
  updatedAt: number;
}

export async function saveCustomAudioFile(
  name: string,
  arrayBuffer: ArrayBuffer,
  duration: number
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record: StoredAudio = {
      id: 'active_starter_sound',
      name,
      data: arrayBuffer,
      duration,
      size: arrayBuffer.byteLength,
      updatedAt: Date.now(),
    };

    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getCustomAudioFile(): Promise<StoredAudio | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('active_starter_sound');

      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to retrieve custom audio from IndexedDB', e);
    return null;
  }
}

export async function deleteCustomAudioFile(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete('active_starter_sound');

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to delete custom audio from IndexedDB', e);
  }
}
