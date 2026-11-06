import { 
  Coach, 
  CompetitionRegistration, 
  RegistrationAuditEntry, 
  RegistrationStatus,
  Athlete,
  AthleticsCompetition
} from '../types/athletics';
import { CategoryEngine } from './categoryEngine';

const DB_NAME = 'athletics_competition_db_v1';
const DB_VERSION = 3; // ترقية قاعدة البيانات لدعم مخازن المدربين وطلبات المشاركة وسجل تدقيق التسجيلات

const STORE_COACHES = 'coaches';
const STORE_REGISTRATIONS = 'competition_registrations';
const STORE_REG_AUDIT = 'registration_audit';

export const INITIAL_COACHES: Coach[] = [
  {
    id: 'coach_mca_01',
    clubId: 'club_mca',
    clubName: 'نادي مولودية الجزائر لألعاب القوى',
    name: 'الكابتن عمار بوراس',
    pinCode: '1921',
    phone: '+213 550 11 22 33',
    email: 'bouras@mca.dz',
    licenseNumber: 'COACH-DZ-MCA-01',
    role: 'head_coach',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'coach_gsp_01',
    clubId: 'club_gsp',
    clubName: 'نادي المجمع الرياضي البترولي',
    name: 'الكابتن سفيان بن عيسى',
    pinCode: '2008',
    phone: '+213 551 22 33 44',
    email: 'benaissa@gsp.dz',
    licenseNumber: 'COACH-DZ-GSP-01',
    role: 'head_coach',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'coach_crb_01',
    clubId: 'club_crb',
    clubName: 'نادي شباب بلوزداد لألعاب القوى',
    name: 'الكابتن رشيد محجوب',
    pinCode: '1962',
    phone: '+213 552 33 44 55',
    email: 'mahjoub@crb.dz',
    licenseNumber: 'COACH-DZ-CRB-01',
    role: 'head_coach',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const INITIAL_REGISTRATIONS: CompetitionRegistration[] = [
  {
    id: 'reg_01_mca',
    competitionId: 'comp_algiers_cross_2026',
    competitionName: 'بطولة الجزائر العاصمة للعدو الريفي 2026',
    clubId: 'club_mca',
    clubName: 'مولودية الجزائر',
    coachId: 'coach_mca_01',
    coachName: 'الكابتن عمار بوراس',
    athleteId: 'ath_01',
    athleteName: 'يوسف العبدلي',
    licenseNumber: 'DZ-2026-10492',
    birthDate: '2001-04-12',
    calculatedCategory: 'SENIOR',
    targetEvents: ['100m', '200m'],
    medicalClearanceValid: true,
    status: 'approved',
    bibAssigned: 101,
    submittedAt: Date.now() - 3600000 * 24,
    reviewedAt: Date.now() - 3600000 * 12,
    reviewedByJudgeId: 'judge_chief_01',
    reviewedByName: 'الحكم العام',
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now() - 3600000 * 12,
  },
  {
    id: 'reg_02_gsp',
    competitionId: 'comp_algiers_cross_2026',
    competitionName: 'بطولة الجزائر العاصمة للعدو الريفي 2026',
    clubId: 'club_gsp',
    clubName: 'المجمع البترولي',
    coachId: 'coach_gsp_01',
    coachName: 'الكابتن سفيان بن عيسى',
    athleteId: 'ath_02',
    athleteName: 'سفيان البقالي',
    licenseNumber: 'DZ-2026-10518',
    birthDate: '1996-01-07',
    calculatedCategory: 'SENIOR',
    targetEvents: ['cross_country'],
    medicalClearanceValid: true,
    status: 'submitted',
    submittedAt: Date.now() - 3600000 * 6,
    createdAt: Date.now() - 3600000 * 6,
    updatedAt: Date.now() - 3600000 * 6,
  },
];

export class CoachWorkflowService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryCoaches: Map<string, Coach> = new Map();
  private memoryRegistrations: Map<string, CompetitionRegistration> = new Map();
  private memoryAudit: RegistrationAuditEntry[] = [];
  private auditCounter: number = 0;

  constructor() {
    INITIAL_COACHES.forEach((c) => this.memoryCoaches.set(c.id, { ...c }));
    INITIAL_REGISTRATIONS.forEach((r) => this.memoryRegistrations.set(r.id, { ...r }));
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

          if (!db.objectStoreNames.contains(STORE_COACHES)) {
            const coachStore = db.createObjectStore(STORE_COACHES, { keyPath: 'id' });
            coachStore.createIndex('clubId', 'clubId', { unique: false });
            coachStore.createIndex('pinCode', 'pinCode', { unique: false });
          }

          if (!db.objectStoreNames.contains(STORE_REGISTRATIONS)) {
            const regStore = db.createObjectStore(STORE_REGISTRATIONS, { keyPath: 'id' });
            regStore.createIndex('competitionId', 'competitionId', { unique: false });
            regStore.createIndex('clubId', 'clubId', { unique: false });
            regStore.createIndex('status', 'status', { unique: false });
            regStore.createIndex('athleteId', 'athleteId', { unique: false });
          }

          if (!db.objectStoreNames.contains(STORE_REG_AUDIT)) {
            const auditStore = db.createObjectStore(STORE_REG_AUDIT, { keyPath: 'id' });
            auditStore.createIndex('registrationId', 'registrationId', { unique: false });
          }
        };

        req.onsuccess = async () => {
          const db = req.result;
          await this.seedInitialData(db);
          resolve(db);
        };

        req.onerror = () => reject(req.error);
      });
    }

    return this.dbPromise;
  }

  private async seedInitialData(db: IDBDatabase): Promise<void> {
    try {
      const tx = db.transaction([STORE_COACHES, STORE_REGISTRATIONS], 'readwrite');
      const coachStore = tx.objectStore(STORE_COACHES);
      const regStore = tx.objectStore(STORE_REGISTRATIONS);

      const countReq = coachStore.count();
      countReq.onsuccess = () => {
        if (countReq.result === 0) {
          INITIAL_COACHES.forEach((c) => coachStore.put(c));
          INITIAL_REGISTRATIONS.forEach((r) => regStore.put(r));
        }
      };
    } catch (e) {
      console.warn('[CoachWorkflowService] Seed note:', e);
    }
  }

  // ═══════════════════════════════════════════════════
  // مصادقة وعزل المدربين (Coach Authentication & Scoping)
  // ═══════════════════════════════════════════════════

  /**
   * تسجيل دخول المدرب برمز الـ PIN مع العزل التام للنادي
   */
  public async authenticateCoach(pinCode: string, clubId?: string): Promise<Coach | null> {
    const cleanPin = pinCode.trim();
    if (!cleanPin) return null;

    const coaches = await this.listCoaches();
    const matched = coaches.find((c) => {
      if (c.pinCode !== cleanPin) return false;
      if (clubId && c.clubId !== clubId) return false;
      return c.isActive;
    });

    return matched || null;
  }

  public async listCoaches(clubId?: string): Promise<Coach[]> {
    const db = await this.getDb();
    let coaches: Coach[] = [];

    if (db) {
      coaches = await new Promise<Coach[]>((resolve, reject) => {
        const tx = db.transaction(STORE_COACHES, 'readonly');
        const req = tx.objectStore(STORE_COACHES).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } else {
      coaches = Array.from(this.memoryCoaches.values());
    }

    if (!coaches.length) {
      coaches = Array.from(this.memoryCoaches.values());
    }

    if (clubId) {
      return coaches.filter((c) => c.clubId === clubId);
    }
    return coaches;
  }

  public async saveCoach(coach: Coach): Promise<Coach> {
    const updated = { ...coach, updatedAt: Date.now() };
    this.memoryCoaches.set(updated.id, updated);

    const db = await this.getDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_COACHES, 'readwrite');
        const req = tx.objectStore(STORE_COACHES).put(updated);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    return updated;
  }

  // ═══════════════════════════════════════════════════
  // طلبات تسجيل العدائين وسير الموافقات (Workflow Engine)
  // ═══════════════════════════════════════════════════

  /**
   * استخراج قائمة الطلبات مع الفرز والفلاتر
   */
  public async getRegistrations(filter?: {
    competitionId?: string;
    clubId?: string;
    status?: RegistrationStatus;
    search?: string;
  }): Promise<CompetitionRegistration[]> {
    const db = await this.getDb();
    let regs: CompetitionRegistration[] = [];

    if (db) {
      regs = await new Promise<CompetitionRegistration[]>((resolve, reject) => {
        const tx = db.transaction(STORE_REGISTRATIONS, 'readonly');
        const req = tx.objectStore(STORE_REGISTRATIONS).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } else {
      regs = Array.from(this.memoryRegistrations.values());
    }

    if (!regs.length) {
      regs = Array.from(this.memoryRegistrations.values());
    }

    return regs.filter((r) => {
      if (filter?.competitionId && r.competitionId !== filter.competitionId) return false;
      if (filter?.clubId && r.clubId !== filter.clubId) return false;
      if (filter?.status && r.status !== filter.status) return false;
      if (filter?.search) {
        const q = filter.search.toLowerCase().trim();
        const text = `${r.athleteName} ${r.licenseNumber} ${r.clubName} ${r.bibAssigned || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.submittedAt || b.createdAt) - (a.submittedAt || a.createdAt));
  }

  /**
   * تقديم طلب تسجيل جديد من المدرب
   */
  public async submitAthleteRegistration(
    athlete: Athlete,
    competition: AthleticsCompetition,
    coach: Coach,
    targetEvents: string[],
    notes?: string
  ): Promise<{ success: boolean; registration?: CompetitionRegistration; error?: string }> {
    // 1. عزل النادي: التأكد من أن العداء ينتمي لنادي المدرب
    if (athlete.clubId && athlete.clubId !== coach.clubId) {
      return { success: false, error: 'غير مسموح: لا يمكنك تسجيل عداء ينتمي لنادٍ منافس.' };
    }

    // 2. التحقق من عدم وجود تسجيل مسبق في نفس المسابقة
    const existing = await this.getRegistrations({
      competitionId: competition.id,
      clubId: coach.clubId,
    });
    const alreadyRegistered = existing.find((r) => r.athleteId === athlete.id);
    if (alreadyRegistered) {
      return { 
        success: false, 
        error: `العداء (${athlete.firstName} ${athlete.lastName}) مسجل مسبقاً في هذه المنافسة بحالة (${alreadyRegistered.status}).` 
      };
    }

    // 3. حساب الفئة العمرية
    const refYear = competition.date ? parseInt(competition.date.split('-')[0], 10) : new Date().getFullYear();
    const { category } = CategoryEngine.calculateCategory(athlete.birthDate, refYear);

    const regId = `reg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newReg: CompetitionRegistration = {
      id: regId,
      competitionId: competition.id,
      competitionName: competition.name,
      clubId: coach.clubId,
      clubName: coach.clubName,
      coachId: coach.id,
      coachName: coach.name,
      athleteId: athlete.id,
      athleteName: `${athlete.firstName} ${athlete.lastName}`,
      licenseNumber: athlete.licenseNumber,
      birthDate: athlete.birthDate,
      calculatedCategory: category,
      targetEvents: targetEvents.length > 0 ? targetEvents : ['cross_country'],
      medicalClearanceValid: !!athlete.medicalClearance,
      status: 'submitted',
      submittedAt: Date.now(),
      notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.persistRegistration(newReg);

    await this.logAudit({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      registrationId: regId,
      action: 'submit',
      performedById: coach.id,
      performedByName: coach.name,
      role: 'coach',
      timestamp: Date.now(),
      details: `تقديم طلب تسجيل العداء (${newReg.athleteName}) للاختصاصات (${targetEvents.join(', ')}) بواسطة المدرب (${coach.name}).`,
    });

    return { success: true, registration: newReg };
  }

  /**
   * مراجعة واعتماد أو رفض طلب التسجيل من المدير الفني / الحكم العام
   */
  public async reviewRegistration(
    registrationId: string,
    status: 'approved' | 'rejected',
    options?: {
      rejectionReason?: string;
      bibAssigned?: number;
      reviewerId?: string;
      reviewerName?: string;
    }
  ): Promise<CompetitionRegistration | null> {
    const existing = await this.getRegistrationById(registrationId);
    if (!existing) return null;

    const updated: CompetitionRegistration = {
      ...existing,
      status,
      rejectionReason: status === 'rejected' ? options?.rejectionReason || 'لم يستوفِ الشروط الفنية' : undefined,
      bibAssigned: status === 'approved' ? (options?.bibAssigned || existing.bibAssigned) : undefined,
      reviewedAt: Date.now(),
      reviewedByJudgeId: options?.reviewerId || 'judge_admin',
      reviewedByName: options?.reviewerName || 'المدير الفني للبطولة',
      updatedAt: Date.now(),
    };

    await this.persistRegistration(updated);

    await this.logAudit({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      registrationId: updated.id,
      action: status === 'approved' ? 'approve' : 'reject',
      performedById: options?.reviewerId || 'judge_admin',
      performedByName: options?.reviewerName || 'المدير الفني للبطولة',
      role: 'technical_director',
      timestamp: Date.now(),
      details: status === 'approved' 
        ? `اعتماد مشاركة العداء (${updated.athleteName}) برقم صدرية (#${updated.bibAssigned || 'تلقائي'}).`
        : `رفض مشاركة العداء (${updated.athleteName})، السبب: (${updated.rejectionReason}).`,
    });

    return updated;
  }

  /**
   * اعتماد جماعي لجميع الطلبات المعلقة لنادٍ أو مسابقة
   */
  public async bulkApprove(
    registrationIds: string[],
    reviewer?: { id: string; name: string }
  ): Promise<number> {
    let approvedCount = 0;
    for (const id of registrationIds) {
      const res = await this.reviewRegistration(id, 'approved', {
        reviewerId: reviewer?.id,
        reviewerName: reviewer?.name,
      });
      if (res) approvedCount += 1;
    }
    return approvedCount;
  }

  public async getRegistrationById(id: string): Promise<CompetitionRegistration | null> {
    const db = await this.getDb();
    if (db) {
      return new Promise<CompetitionRegistration | null>((resolve, reject) => {
        const tx = db.transaction(STORE_REGISTRATIONS, 'readonly');
        const req = tx.objectStore(STORE_REGISTRATIONS).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }
    return this.memoryRegistrations.get(id) || null;
  }

  private async persistRegistration(reg: CompetitionRegistration): Promise<void> {
    this.memoryRegistrations.set(reg.id, reg);
    const db = await this.getDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_REGISTRATIONS, 'readwrite');
        const req = tx.objectStore(STORE_REGISTRATIONS).put(reg);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  }

  private async logAudit(entry: RegistrationAuditEntry): Promise<void> {
    this.auditCounter += 1;
    const finalEntry = {
      ...entry,
      order: this.auditCounter,
    };
    this.memoryAudit.push(finalEntry);
    const db = await this.getDb();
    if (db) {
      try {
        const tx = db.transaction(STORE_REG_AUDIT, 'readwrite');
        tx.objectStore(STORE_REG_AUDIT).put(finalEntry);
      } catch (e) {
        console.warn('[CoachWorkflowService] Audit log note:', e);
      }
    }
  }

  public async getAuditHistory(registrationId?: string): Promise<RegistrationAuditEntry[]> {
    const db = await this.getDb();
    let entries: RegistrationAuditEntry[] = [];

    if (db) {
      entries = await new Promise<RegistrationAuditEntry[]>((resolve) => {
        try {
          const tx = db.transaction(STORE_REG_AUDIT, 'readonly');
          const req = tx.objectStore(STORE_REG_AUDIT).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    } else {
      entries = [...this.memoryAudit];
    }

    if (!entries.length) {
      entries = [...this.memoryAudit];
    }

    const filtered = registrationId
      ? entries.filter((e) => e.registrationId === registrationId)
      : entries;

    return filtered.sort((a, b) => {
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return ((b as any).order || 0) - ((a as any).order || 0);
    });
  }

  /**
   * إعادة التعيين للاختبارات
   */
  public async clearAll(): Promise<void> {
    this.memoryCoaches.clear();
    this.memoryRegistrations.clear();
    this.memoryAudit = [];
    this.auditCounter = 0;

    INITIAL_COACHES.forEach((c) => this.memoryCoaches.set(c.id, { ...c }));
    INITIAL_REGISTRATIONS.forEach((r) => this.memoryRegistrations.set(r.id, { ...r }));

    const db = await this.getDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_COACHES, STORE_REGISTRATIONS, STORE_REG_AUDIT], 'readwrite');
        tx.objectStore(STORE_COACHES).clear();
        tx.objectStore(STORE_REGISTRATIONS).clear();
        tx.objectStore(STORE_REG_AUDIT).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      await this.seedInitialData(db);
    }
  }
}

export const coachWorkflowService = new CoachWorkflowService();
