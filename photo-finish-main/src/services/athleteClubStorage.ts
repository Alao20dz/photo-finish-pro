import { Athlete, Club, CategorySnapshot } from '../types/athletics';

const DB_NAME = 'athletics_competition_db_v1';
const DB_VERSION = 2; // ترقية قاعدة البيانات لدعم مخازن العدائين والأندية واللقطات

const STORE_ATHLETES = 'athletes';
const STORE_CLUBS = 'clubs';
const STORE_SNAPSHOTS = 'category_snapshots';

export const INITIAL_CLUBS: Club[] = [
  {
    id: 'club_mca',
    code: 'MCA',
    name: 'نادي مولودية الجزائر لألعاب القوى',
    shortName: 'مولودية الجزائر',
    wilaya: 'الجزائر العاصمة',
    city: 'الجزائر',
    foundedYear: 1921,
    presidentName: 'حكيم حاج رجم',
    headCoachName: 'عمار بوراس',
    phone: '+213 21 00 01 00',
    email: 'athletics@mca.dz',
    colors: ['#10B981', '#EF4444'],
    activeAthletesCount: 38,
    medalsTally: { gold: 14, silver: 8, bronze: 6, total: 28 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'club_gsp',
    code: 'GSP',
    name: 'نادي المجمع الرياضي البترولي',
    shortName: 'المجمع البترولي',
    wilaya: 'الجزائر العاصمة',
    city: 'حيدرة',
    foundedYear: 2008,
    headCoachName: 'سفيان بن عيسى',
    colors: ['#F59E0B', '#1E3A8A'],
    activeAthletesCount: 45,
    medalsTally: { gold: 18, silver: 12, bronze: 9, total: 39 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'club_crb',
    code: 'CRB',
    name: 'نادي شباب بلوزداد لألعاب القوى',
    shortName: 'شباب بلوزداد',
    wilaya: 'الجزائر العاصمة',
    city: 'بلوزداد',
    foundedYear: 1962,
    headCoachName: 'رشيد محجوب',
    colors: ['#EF4444', '#FFFFFF'],
    activeAthletesCount: 26,
    medalsTally: { gold: 9, silver: 7, bronze: 4, total: 20 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'club_assn',
    code: 'ASSN',
    name: 'الجمعية الرياضية للأمن الوطني',
    shortName: 'الأمن الوطني',
    wilaya: 'الجزائر العاصمة',
    city: 'الجزائر',
    foundedYear: 1974,
    headCoachName: 'فوزي لحمر',
    colors: ['#3B82F6', '#1E293B'],
    activeAthletesCount: 30,
    medalsTally: { gold: 11, silver: 10, bronze: 5, total: 26 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'club_creps',
    code: 'CREPS',
    name: 'نادي الأمل الرياضي قسنطينة',
    shortName: 'أمل قسنطينة',
    wilaya: 'قسنطينة',
    city: 'قسنطينة',
    foundedYear: 1985,
    headCoachName: 'عبد الحميد شابي',
    colors: ['#10B981', '#064E3B'],
    activeAthletesCount: 22,
    medalsTally: { gold: 6, silver: 5, bronze: 7, total: 18 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const INITIAL_ATHLETES: Athlete[] = [
  {
    id: 'ath_01',
    bibNumber: 101,
    licenseNumber: 'DZ-2026-10492',
    firstName: 'يوسف',
    lastName: 'العبدلي',
    arabicName: 'يوسف العبدلي',
    birthDate: '2001-04-12',
    gender: 'M',
    nationality: 'الجزائر',
    clubId: 'club_mca',
    clubName: 'مولودية الجزائر',
    wilaya: 'الجزائر العاصمة',
    primaryDiscipline: 'sprints',
    eligibleEvents: ['100m', '200m', '4x100m'],
    personalBests: [
      { eventCode: '100m', eventName: '100 متر', recordValue: '10.12s', numericValueMsOrCm: 10120, date: '2025-06-18', venue: 'ملعب 5 جويلية' },
      { eventCode: '200m', eventName: '200 متر', recordValue: '20.45s', numericValueMsOrCm: 20450, date: '2025-07-02', venue: 'وهران' },
    ],
    seasonBests: [
      { eventCode: '100m', eventName: '100 متر', recordValue: '10.18s', numericValueMsOrCm: 10180, date: '2026-03-10', venue: 'الجزائر' },
    ],
    medicalClearance: true,
    medicalClearanceExpiry: '2026-12-31',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'ath_02',
    bibNumber: 102,
    licenseNumber: 'DZ-2026-10518',
    firstName: 'سفيان',
    lastName: 'البقالي',
    arabicName: 'سفيان البقالي',
    birthDate: '1996-01-07',
    gender: 'M',
    nationality: 'الجزائر',
    clubId: 'club_gsp',
    clubName: 'المجمع البترولي',
    wilaya: 'الجزائر العاصمة',
    primaryDiscipline: 'long_distance',
    eligibleEvents: ['3000m_sc', '5000m', 'cross_country'],
    personalBests: [
      { eventCode: '3000m_sc', eventName: '3000م موانع', recordValue: '7:58.28', numericValueMsOrCm: 478280, date: '2024-08-07', venue: 'باريس' },
      { eventCode: 'cross_country', eventName: 'العدو الريفي 10كم', recordValue: '28:40', numericValueMsOrCm: 1720000, date: '2025-01-15', venue: 'غابة بوشاوي' },
    ],
    seasonBests: [
      { eventCode: 'cross_country', eventName: 'العدو الريفي 8كم', recordValue: '23:15', numericValueMsOrCm: 1395000, date: '2026-02-20', venue: 'البليدة' },
    ],
    medicalClearance: true,
    medicalClearanceExpiry: '2026-12-31',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'ath_03',
    bibNumber: 103,
    licenseNumber: 'DZ-2026-10884',
    firstName: 'توفيق',
    lastName: 'مخلوفي',
    arabicName: 'توفيق مخلوفي',
    birthDate: '1988-04-29',
    gender: 'M',
    nationality: 'الجزائر',
    clubId: 'club_crb',
    clubName: 'شباب بلوزداد',
    wilaya: 'الجزائر العاصمة',
    primaryDiscipline: 'middle_distance',
    eligibleEvents: ['800m', '1500m'],
    personalBests: [
      { eventCode: '1500m', eventName: '1500 متر', recordValue: '3:28.75', numericValueMsOrCm: 208750, date: '2015-07-17', venue: 'موناكو' },
      { eventCode: '800m', eventName: '800 متر', recordValue: '1:42.61', numericValueMsOrCm: 102610, date: '2016-08-15', venue: 'ريو دي جانيرو' },
    ],
    seasonBests: [],
    medicalClearance: true,
    medicalClearanceExpiry: '2026-12-31',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'ath_04',
    bibNumber: 104,
    licenseNumber: 'DZ-2026-11204',
    firstName: 'جمال',
    lastName: 'سجاتي',
    arabicName: 'جمال سجاتي',
    birthDate: '1999-05-03',
    gender: 'M',
    nationality: 'الجزائر',
    clubId: 'club_creps',
    clubName: 'أمل قسنطينة',
    wilaya: 'قسنطينة',
    primaryDiscipline: 'middle_distance',
    eligibleEvents: ['800m', '400m', '4x400m'],
    personalBests: [
      { eventCode: '800m', eventName: '800 متر', recordValue: '1:41.46', numericValueMsOrCm: 101460, date: '2024-07-12', venue: 'موناكو' },
    ],
    seasonBests: [
      { eventCode: '800m', eventName: '800 متر', recordValue: '1:42.10', numericValueMsOrCm: 102100, date: '2026-03-05', venue: 'الجزائر' },
    ],
    medicalClearance: true,
    medicalClearanceExpiry: '2026-12-31',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

class AthleteClubStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryAthletes: Map<string, Athlete> = new Map();
  private memoryClubs: Map<string, Club> = new Map();
  private memorySnapshots: Map<string, CategorySnapshot> = new Map();

  constructor() {
    // تحميل البيانات التأسيسية في الذاكرة مباشرة كاحتياط أوفلاين
    INITIAL_CLUBS.forEach((c) => this.memoryClubs.set(c.id, { ...c }));
    INITIAL_ATHLETES.forEach((a) => this.memoryAthletes.set(a.id, { ...a }));
  }

  private async getDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return null;
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;

          // 1. مخزن العدائين
          if (!db.objectStoreNames.contains(STORE_ATHLETES)) {
            const athleteStore = db.createObjectStore(STORE_ATHLETES, { keyPath: 'id' });
            athleteStore.createIndex('licenseNumber', 'licenseNumber', { unique: true });
            athleteStore.createIndex('clubId', 'clubId', { unique: false });
            athleteStore.createIndex('lastName', 'lastName', { unique: false });
          }

          // 2. مخزن الأندية
          if (!db.objectStoreNames.contains(STORE_CLUBS)) {
            const clubStore = db.createObjectStore(STORE_CLUBS, { keyPath: 'id' });
            clubStore.createIndex('code', 'code', { unique: true });
            clubStore.createIndex('wilaya', 'wilaya', { unique: false });
          }

          // 3. مخزن لقطات الفئات المجمدة
          if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
            db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'competitionId' });
          }
        };

        req.onsuccess = async () => {
          const db = req.result;
          // تفعيل البذور التأسيسية إذا كانت القاعدة فارغة
          await this.seedInitialData(db);
          resolve(db);
        };

        req.onerror = () => {
          reject(req.error);
        };
      });
    }

    return this.dbPromise;
  }

  private async seedInitialData(db: IDBDatabase): Promise<void> {
    try {
      const tx = db.transaction([STORE_CLUBS, STORE_ATHLETES], 'readwrite');
      const clubStore = tx.objectStore(STORE_CLUBS);
      const athStore = tx.objectStore(STORE_ATHLETES);

      const countReq = clubStore.count();
      countReq.onsuccess = () => {
        if (countReq.result === 0) {
          INITIAL_CLUBS.forEach((c) => clubStore.put(c));
          INITIAL_ATHLETES.forEach((a) => athStore.put(a));
        }
      };
    } catch (e) {
      console.warn('[AthleteClubStorage] Seed note:', e);
    }
  }

  // ═══════════════════════════════════════════════════
  // إدارة العدائين (Athletes CRUD)
  // ═══════════════════════════════════════════════════

  public async getAllAthletes(): Promise<Athlete[]> {
    return this.listAthletes();
  }

  public async listAthletes(filter?: { clubId?: string; search?: string }): Promise<Athlete[]> {
    const db = await this.getDb();
    let athletes: Athlete[] = [];

    if (db) {
      athletes = await new Promise<Athlete[]>((resolve, reject) => {
        const tx = db.transaction(STORE_ATHLETES, 'readonly');
        const store = tx.objectStore(STORE_ATHLETES);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } else {
      athletes = Array.from(this.memoryAthletes.values());
    }

    // إذا كانت القاعدة فارغة بعد الفحص، نستخدم بيانات الذاكرة التأسيسية
    if (!athletes.length) {
      athletes = Array.from(this.memoryAthletes.values());
    }

    // تطبيق الفلاتر والبحث
    return athletes.filter((ath) => {
      if (filter?.clubId && ath.clubId !== filter.clubId) {
        return false;
      }
      if (filter?.search) {
        const q = filter.search.trim().toLowerCase();
        const fullName = `${ath.firstName} ${ath.lastName} ${ath.arabicName || ''}`.toLowerCase();
        const matchesName = fullName.includes(q);
        const matchesLicense = ath.licenseNumber.toLowerCase().includes(q);
        const matchesBib = ath.bibNumber ? String(ath.bibNumber).includes(q) : false;
        const matchesClub = ath.clubName ? ath.clubName.toLowerCase().includes(q) : false;
        return matchesName || matchesLicense || matchesBib || matchesClub;
      }
      return true;
    });
  }

  public async getAthleteById(id: string): Promise<Athlete | null> {
    const db = await this.getDb();
    if (db) {
      return new Promise<Athlete | null>((resolve, reject) => {
        const tx = db.transaction(STORE_ATHLETES, 'readonly');
        const req = tx.objectStore(STORE_ATHLETES).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }
    return this.memoryAthletes.get(id) || null;
  }

  public async saveAthlete(athlete: Athlete): Promise<Athlete> {
    const updated: Athlete = {
      ...athlete,
      updatedAt: Date.now(),
      createdAt: athlete.createdAt || Date.now(),
    };

    this.memoryAthletes.set(updated.id, updated);

    const db = await this.getDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_ATHLETES, 'readwrite');
        const req = tx.objectStore(STORE_ATHLETES).put(updated);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    return updated;
  }

  public async deleteAthlete(id: string): Promise<boolean> {
    this.memoryAthletes.delete(id);
    const db = await this.getDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_ATHLETES, 'readwrite');
        const req = tx.objectStore(STORE_ATHLETES).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    return true;
  }

  // ═══════════════════════════════════════════════════
  // إدارة الأندية الرياضية (Clubs CRUD)
  // ═══════════════════════════════════════════════════

  public async getAllClubs(): Promise<Club[]> {
    return this.listClubs();
  }

  public async listClubs(): Promise<Club[]> {
    const db = await this.getDb();
    let clubs: Club[] = [];

    if (db) {
      clubs = await new Promise<Club[]>((resolve, reject) => {
        const tx = db.transaction(STORE_CLUBS, 'readonly');
        const req = tx.objectStore(STORE_CLUBS).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } else {
      clubs = Array.from(this.memoryClubs.values());
    }

    if (!clubs.length) {
      clubs = Array.from(this.memoryClubs.values());
    }

    return clubs.sort((a, b) => b.medalsTally.gold - a.medalsTally.gold);
  }

  public async getClubById(id: string): Promise<Club | null> {
    const db = await this.getDb();
    if (db) {
      return new Promise<Club | null>((resolve, reject) => {
        const tx = db.transaction(STORE_CLUBS, 'readonly');
        const req = tx.objectStore(STORE_CLUBS).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }
    return this.memoryClubs.get(id) || null;
  }

  public async saveClub(club: Club): Promise<Club> {
    const updated: Club = {
      ...club,
      updatedAt: Date.now(),
      createdAt: club.createdAt || Date.now(),
    };

    this.memoryClubs.set(updated.id, updated);

    const db = await this.getDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_CLUBS, 'readwrite');
        const req = tx.objectStore(STORE_CLUBS).put(updated);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    return updated;
  }

  public async deleteClub(id: string): Promise<boolean> {
    this.memoryClubs.delete(id);
    const db = await this.getDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_CLUBS, 'readwrite');
        const req = tx.objectStore(STORE_CLUBS).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    return true;
  }

  // ═══════════════════════════════════════════════════
  // لقطات الفئات العمرية المجمدة (Category Snapshots)
  // ═══════════════════════════════════════════════════

  public async saveCategorySnapshot(snapshot: CategorySnapshot): Promise<void> {
    this.memorySnapshots.set(snapshot.competitionId, snapshot);
    const db = await this.getDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
        const req = tx.objectStore(STORE_SNAPSHOTS).put(snapshot);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  }

  public async getCategorySnapshot(competitionId: string): Promise<CategorySnapshot | null> {
    const db = await this.getDb();
    if (db) {
      return new Promise<CategorySnapshot | null>((resolve, reject) => {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
        const req = tx.objectStore(STORE_SNAPSHOTS).get(competitionId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }
    return this.memorySnapshots.get(competitionId) || null;
  }

  /**
   * مسح وإعادة تعيين البيانات للقيم التأسيسية (مفيد للاختبارات ولإعادة التهيئة)
   */
  public async clearAll(): Promise<void> {
    this.memoryAthletes.clear();
    this.memoryClubs.clear();
    this.memorySnapshots.clear();

    INITIAL_CLUBS.forEach((c) => this.memoryClubs.set(c.id, { ...c }));
    INITIAL_ATHLETES.forEach((a) => this.memoryAthletes.set(a.id, { ...a }));

    const db = await this.getDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_ATHLETES, STORE_CLUBS, STORE_SNAPSHOTS], 'readwrite');
        tx.objectStore(STORE_ATHLETES).clear();
        tx.objectStore(STORE_CLUBS).clear();
        tx.objectStore(STORE_SNAPSHOTS).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      await this.seedInitialData(db);
    }
  }
}

export const athleteClubStorage = new AthleteClubStorage();
