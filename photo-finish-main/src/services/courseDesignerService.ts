/**
 * PHOTO FINISH PRO – Complete Athletics Management System
 * Course Designer, Offline Maps & Secured QR Packs Service (Stage C4 — Ed25519 Edition)
 * 
 * Features:
 * 1. Haversine distance, cumulative path metrics, elevation gain/loss.
 * 2. GeoJSON parsing and exporting with zero external dependencies.
 * 3. Automatic checkpoint snapping and binding to waypoints.
 * 4. Server-signed Ed25519 QR token packs for physical checkpoints —
 *    zero secrets in the frontend bundle; offline verification via public key.
 * 5. Full IndexedDB persistence with memory fallback.
 */

import { 
  Course, 
  CourseWaypoint, 
  ElevationPoint, 
  Checkpoint, 
  SecuredQrPack,
  AthleticsCompetitionType 
} from '../types/athletics';
import { verifyEd25519Signature } from './securityService';

const COURSES_STORAGE_KEY = 'pf_athletics_courses_v1';
const QR_PACKS_STORAGE_KEY = 'pf_athletics_qr_packs_v1';

// ═══ توقيع رموز نقاط المراقبة (Server-Signed Ed25519) ═══
// NOTE أمني: لا يوجد أي سر في الواجهة — الملح الثابت القديم لأكواد QR (متغير بيئة أُزيل نهائياً)
// أُزيل نهائياً لأنه كان ظاهراً في حزمة البناء ويمكن لأي جهاز تزوير الرموز به.
// الإصدار: الخادم يوقّع النص القياسي PFP_CP1|cid|cpid|code|km|iat|exp بـ Ed25519،
// والعميل يتحقق أوفلاين بالمفتاح العام فقط عبر securityService.verifyEd25519Signature.
// الحزم القديمة (توقيع HMAC قصير) تُرفض برسالة ترحيل واضحة لأن ملحها مُسرّب.

export class CourseDesignerService {
  private inMemoryCourses: Map<string, Course> = new Map();
  private inMemoryQrPacks: Map<string, SecuredQrPack> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const rawCourses = localStorage.getItem(COURSES_STORAGE_KEY);
        if (rawCourses) {
          const parsed = JSON.parse(rawCourses) as Course[];
          parsed.forEach(c => this.inMemoryCourses.set(c.id, c));
        }

        const rawQr = localStorage.getItem(QR_PACKS_STORAGE_KEY);
        if (rawQr) {
          const parsedQr = JSON.parse(rawQr) as SecuredQrPack[];
          parsedQr.forEach(q => this.inMemoryQrPacks.set(q.id, q));
        }
      }
    } catch (e) {
      console.warn('Failed to load courses from localStorage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const courses = Array.from(this.inMemoryCourses.values());
        localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(courses));

        const qrPacks = Array.from(this.inMemoryQrPacks.values());
        localStorage.setItem(QR_PACKS_STORAGE_KEY, JSON.stringify(qrPacks));
      }
    } catch (e) {
      console.warn('Failed to save courses to localStorage:', e);
    }
  }

  /**
   * حساب المسافة الجغرافية السطحية بين نقطتين عبر صيغة هافرسين (Haversine Formula)
   * النتيجة بالأمتار بدقة سنتيمترية
   */
  public calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // نصف قطر الأرض بالأمتار
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);

    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * حساب مقاييس المسار التراكمية (المسافات، الارتفاعات الإيجابية والسلبية، ملف الارتفاع)
   */
  public computeCourseMetrics(rawWaypoints: { lat: number; lng: number; elevation?: number; name?: string; type?: CourseWaypoint['type'] }[]): {
    totalDistanceMeters: number;
    elevationGainMeters: number;
    elevationLossMeters: number;
    waypoints: CourseWaypoint[];
    elevationProfile: ElevationPoint[];
  } {
    if (rawWaypoints.length === 0) {
      return {
        totalDistanceMeters: 0,
        elevationGainMeters: 0,
        elevationLossMeters: 0,
        waypoints: [],
        elevationProfile: []
      };
    }

    let cumulativeDistance = 0;
    let elevationGain = 0;
    let elevationLoss = 0;

    const waypoints: CourseWaypoint[] = [];
    const elevationProfile: ElevationPoint[] = [];

    rawWaypoints.forEach((raw, i) => {
      if (i > 0) {
        const prev = rawWaypoints[i - 1];
        const stepDist = this.calculateDistanceMeters(prev.lat, prev.lng, raw.lat, raw.lng);
        cumulativeDistance += stepDist;

        if (prev.elevation !== undefined && raw.elevation !== undefined) {
          const elevDiff = raw.elevation - prev.elevation;
          if (elevDiff > 0) {
            elevationGain += elevDiff;
          } else {
            elevationLoss += Math.abs(elevDiff);
          }
        }
      }

      let type = raw.type || 'track_point';
      if (i === 0) type = 'start';
      else if (i === rawWaypoints.length - 1 && rawWaypoints.length > 1) type = 'finish';

      const wp: CourseWaypoint = {
        id: `wp_${i + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        index: i,
        lat: raw.lat,
        lng: raw.lng,
        elevation: raw.elevation,
        name: raw.name || (i === 0 ? 'نقطة الانطلاق' : i === rawWaypoints.length - 1 ? 'خط النهاية' : `نقطة ${i + 1}`),
        type,
        distanceFromStartMeters: Math.round(cumulativeDistance * 10) / 10
      };

      waypoints.push(wp);

      if (raw.elevation !== undefined) {
        elevationProfile.push({
          distanceMeters: Math.round(cumulativeDistance * 10) / 10,
          elevationMeters: Math.round(raw.elevation * 10) / 10
        });
      }
    });

    return {
      totalDistanceMeters: Math.round(cumulativeDistance * 10) / 10,
      elevationGainMeters: Math.round(elevationGain * 10) / 10,
      elevationLossMeters: Math.round(elevationLoss * 10) / 10,
      waypoints,
      elevationProfile
    };
  }

  /**
   * إنشاء مسار جديد أو تحديث مسار حالي
   */
  public async createCourse(params: {
    competitionId: string;
    name: string;
    discipline?: AthleticsCompetitionType;
    lapCount?: number;
    rawWaypoints: { lat: number; lng: number; elevation?: number; name?: string; type?: CourseWaypoint['type'] }[];
    checkpoints?: Checkpoint[];
  }): Promise<Course> {
    const metrics = this.computeCourseMetrics(params.rawWaypoints);
    const id = `course_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const course: Course = {
      id,
      competitionId: params.competitionId,
      name: params.name,
      discipline: params.discipline || 'cross_country',
      totalDistanceMeters: metrics.totalDistanceMeters,
      elevationGainMeters: metrics.elevationGainMeters,
      elevationLossMeters: metrics.elevationLossMeters,
      lapCount: params.lapCount && params.lapCount > 0 ? params.lapCount : 1,
      waypoints: metrics.waypoints,
      elevationProfile: metrics.elevationProfile,
      checkpoints: params.checkpoints || [],
      createdAt: now,
      updatedAt: now
    };

    // ربط نقاط المراقبة بالمسار تلقائياً إن وجدت
    if (params.checkpoints && params.checkpoints.length > 0) {
      this.bindCheckpointsToWaypoints(course);
    }

    course.geoJsonData = this.exportToGeoJson(course);

    this.inMemoryCourses.set(course.id, course);
    this.saveToStorage();
    return course;
  }

  /**
   * ربط نقاط المراقبة بأقرب نقطة مسار جغرافياً أو حسب المسافة
   */
  public bindCheckpointsToWaypoints(course: Course): void {
    course.checkpoints.forEach(cp => {
      if (course.waypoints.length === 0) return;

      let bestWp: CourseWaypoint | null = null;

      // إن كان لنقطة المراقبة إحداثيات جغرافية
      if (cp.latitude !== undefined && cp.longitude !== undefined) {
        let minGeoDist = Infinity;
        course.waypoints.forEach(wp => {
          const d = this.calculateDistanceMeters(cp.latitude!, cp.longitude!, wp.lat, wp.lng);
          if (d < minGeoDist) {
            minGeoDist = d;
            bestWp = wp;
          }
        });
      } else {
        // الربط حسب المسافة من خط البداية (distanceKm)
        const targetMeters = cp.distanceKm * 1000;
        let minDiff = Infinity;
        course.waypoints.forEach(wp => {
          const diff = Math.abs(wp.distanceFromStartMeters - targetMeters);
          if (diff < minDiff) {
            minDiff = diff;
            bestWp = wp;
          }
        });
      }

      if (bestWp) {
        (bestWp as CourseWaypoint).checkpointId = cp.id;
        (bestWp as CourseWaypoint).type = 'checkpoint';
        if (!(bestWp as CourseWaypoint).name || (bestWp as CourseWaypoint).name?.startsWith('نقطة')) {
          (bestWp as CourseWaypoint).name = cp.name;
        }
      }
    });
  }

  /**
   * تصدير المسار إلى صيغة GeoJSON قياسية (FeatureCollection)
   */
  public exportToGeoJson(course: Course): string {
    const coordinates = course.waypoints.map(wp => 
      wp.elevation !== undefined ? [wp.lng, wp.lat, wp.elevation] : [wp.lng, wp.lat]
    );

    const trackFeature = {
      type: 'Feature',
      properties: {
        id: course.id,
        name: course.name,
        discipline: course.discipline,
        totalDistanceMeters: course.totalDistanceMeters,
        elevationGainMeters: course.elevationGainMeters,
        elevationLossMeters: course.elevationLossMeters,
        lapCount: course.lapCount
      },
      geometry: {
        type: 'LineString',
        coordinates
      }
    };

    const pointFeatures = course.waypoints
      .filter(wp => wp.type !== 'track_point' || wp.checkpointId)
      .map(wp => ({
        type: 'Feature',
        properties: {
          id: wp.id,
          name: wp.name,
          type: wp.type,
          distanceMeters: wp.distanceFromStartMeters,
          checkpointId: wp.checkpointId
        },
        geometry: {
          type: 'Point',
          coordinates: wp.elevation !== undefined ? [wp.lng, wp.lat, wp.elevation] : [wp.lng, wp.lat]
        }
      }));

    const geoJson = {
      type: 'FeatureCollection',
      features: [trackFeature, ...pointFeatures]
    };

    return JSON.stringify(geoJson, null, 2);
  }

  /**
   * استيراد مسار من ملف نصي بصيغة GeoJSON
   */
  public importFromGeoJson(geoJsonString: string, courseName?: string): {
    name: string;
    totalDistanceMeters: number;
    elevationGainMeters: number;
    elevationLossMeters: number;
    waypoints: CourseWaypoint[];
    elevationProfile: ElevationPoint[];
    geoJsonData: string;
  } {
    const data = JSON.parse(geoJsonString);
    const rawCoords: { lat: number; lng: number; elevation?: number; name?: string; type?: CourseWaypoint['type'] }[] = [];
    let detectedName = courseName || 'مسار مستورد';

    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      for (const feat of data.features) {
        if (feat.geometry?.type === 'LineString' && Array.isArray(feat.geometry.coordinates)) {
          if (feat.properties?.name) {
            detectedName = feat.properties.name;
          }
          feat.geometry.coordinates.forEach((c: number[]) => {
            rawCoords.push({
              lng: c[0],
              lat: c[1],
              elevation: c[2]
            });
          });
          break; // أخذ أول خط مسار
        }
      }
    } else if (data.type === 'Feature' && data.geometry?.type === 'LineString') {
      if (data.properties?.name) {
        detectedName = data.properties.name;
      }
      data.geometry.coordinates.forEach((c: number[]) => {
        rawCoords.push({
          lng: c[0],
          lat: c[1],
          elevation: c[2]
        });
      });
    } else if (data.type === 'LineString' && Array.isArray(data.coordinates)) {
      data.coordinates.forEach((c: number[]) => {
        rawCoords.push({
          lng: c[0],
          lat: c[1],
          elevation: c[2]
        });
      });
    }

    if (rawCoords.length < 2) {
      throw new Error('ملف GeoJSON لا يحتوي على خط مسار (LineString) صالح مع نقطتين على الأقل.');
    }

    const metrics = this.computeCourseMetrics(rawCoords);

    return {
      name: detectedName,
      totalDistanceMeters: metrics.totalDistanceMeters,
      elevationGainMeters: metrics.elevationGainMeters,
      elevationLossMeters: metrics.elevationLossMeters,
      waypoints: metrics.waypoints,
      elevationProfile: metrics.elevationProfile,
      geoJsonData: geoJsonString
    };
  }

  /**
   * بناء النص القياسي الموافق لخادم التوقيع (PFP_CP1|cid|cpid|code|km|iat|exp)
   */
  private buildCanonical(cid: string, cpid: string, code: string, km: number, iat: number, exp: number): string {
    return `PFP_CP1|${cid}|${cpid}|${code}|${km}|${iat}|${exp}`;
  }

  /**
   * طلب توقيع خادمي (Ed25519) لحمولة نقطة مراقبة
   */
  private async requestServerSignature(params: {
    cid: string; cpid: string; code: string; km: number; iat: number; exp: number;
  }): Promise<string> {
    const resp = await fetch('/api/checkpoint/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data?.error || `فشل توقيع رمز نقطة المراقبة (${resp.status})`);
    }
    const data = await resp.json();
    if (!data?.signature) throw new Error('استجابة توقيع غير صالحة من الخادم.');
    return data.signature as string;
  }

  /**
   * توليد حزمة باركود QR مؤمنة وموقعة خادمياً (Ed25519) لنقطة مراقبة ميدانية
   * تتطلب تشغيل خادم التوقيع (npm run dev أو relay-server) مرة واحدة عند الإصدار،
   * أما التحقق الميداني فيتم أوفلاين بالمفتاح العام.
   */
  public async generateSecuredQrPack(
    competitionId: string, 
    checkpoint: Checkpoint, 
    validDurationMs: number = 86400000 // صالح لمدة 24 ساعة افتراضياً
  ): Promise<SecuredQrPack> {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + validDurationMs;

    // توقيع Ed25519 من الخادم — لا يوجد أي سر في الواجهة
    const signature = await this.requestServerSignature({
      cid: competitionId,
      cpid: checkpoint.id,
      code: checkpoint.code,
      km: checkpoint.distanceKm,
      iat: issuedAt,
      exp: expiresAt
    });

    // الحمولة الموحدة: JSON + خوارزمية + التوقيع الكامل (يُقرأ بالكاميرا من الصورة المولدة)
    const payloadObj = {
      cid: competitionId,
      cpid: checkpoint.id,
      code: checkpoint.code,
      name: checkpoint.name,
      km: checkpoint.distanceKm,
      iat: issuedAt,
      exp: expiresAt,
      alg: 'ed25519' as const,
      sig: signature
    };

    const encryptedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(payloadObj))));
    const token = `PFP_CP:${checkpoint.code}:${checkpoint.id}:${signature.substring(0, 8).toUpperCase()}`;

    const qrPack: SecuredQrPack = {
      id: `qr_${checkpoint.id}_${issuedAt}`,
      competitionId,
      checkpointId: checkpoint.id,
      checkpointCode: checkpoint.code,
      checkpointName: checkpoint.name,
      token,
      encryptedPayload,
      issuedAt,
      expiresAt,
      signature
    };

    this.inMemoryQrPacks.set(qrPack.id, qrPack);
    this.saveToStorage();
    return qrPack;
  }

  /**
   * التحقق من صحة وصلاحية رمز QR الممسوح بنقطة المراقبة
   * التحقق Ed25519 محلي وأوفلاين بالمفتاح العام — الحزم القديمة تُرفض.
   */
  public async verifySecuredQrToken(
    scannedData: string, 
    expectedCompetitionId: string
  ): Promise<{ 
    valid: boolean; 
    checkpointId?: string; 
    checkpointCode?: string; 
    checkpointName?: string;
    distanceKm?: number;
    error?: string; 
  }> {
    try {
      let payload: any = null;

      // إذا كانت البيانات عبارة عن Base64 payload موقّع
      if (scannedData.startsWith('ey') || scannedData.length > 50) {
        try {
          const decoded = decodeURIComponent(escape(atob(scannedData)));
          payload = JSON.parse(decoded);
        } catch {}
      }

      // صيغة Token المباشرة PFP_CP:CODE:ID:PREFIX — تُقبل فقط إذا طابقت حزمة
      // موقعة مخزنة محلياً (كان يُقبل هنا أي رمز غير معروف — ثغرة أُغلقت)
      if (!payload && scannedData.startsWith('PFP_CP:')) {
        const parts = scannedData.split(':');
        if (parts.length >= 4) {
          const cpid = parts[2];

          const found = Array.from(this.inMemoryQrPacks.values()).find(q => q.checkpointId === cpid);
          if (!found) {
            return { valid: false, error: 'رمز نقطة غير معروف — لم يصدر من نظام Photo Finish Pro.' };
          }

          // إعادة التحقق الكامل من الحمولة الموقعة للحزمة المخزنة
          return await this.verifySecuredQrToken(found.encryptedPayload, expectedCompetitionId);
        }
      }

      if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'صيغة رمز QR غير معتمدة لنظام Photo Finish Pro.' };
      }

      // رفض صريح لحزم HMAC القديمة (ملحها مُسرّب — إلزامية إعادة الإصدار)
      if (payload.alg !== 'ed25519' || !payload.sig) {
        return { valid: false, error: 'رمز بنسخة توقيع قديمة غير آمنة (HMAC). أعد إصدار حزمة QR من مصمم المسار.' };
      }

      if (payload.cid !== expectedCompetitionId) {
        return { valid: false, error: 'رمز النقطة يتبع لمسابقة أخرى غير المنافسة الحالية.' };
      }

      if (Date.now() > payload.exp) {
        return { valid: false, error: 'انتهت صلاحية رمز النقطة الزمني.' };
      }

      // التحقق من توقيع Ed25519 بالمفتاح العام (أوفلاين بالكامل)
      const canonical = this.buildCanonical(payload.cid, payload.cpid, payload.code, payload.km, payload.iat, payload.exp);
      const signatureOk = await verifyEd25519Signature(canonical, payload.sig);
      if (!signatureOk) {
        return { valid: false, error: 'فشل التحقق من التوقيع الرقمي لنقطة المراقبة (رمز مزور أو تم تعديله).' };
      }

      return {
        valid: true,
        checkpointId: payload.cpid,
        checkpointCode: payload.code,
        checkpointName: payload.name,
        distanceKm: payload.km
      };
    } catch (e: any) {
      return { valid: false, error: e?.message || 'خطأ أثناء قراءة رمز QR.' };
    }
  }

  public async getCourse(id: string): Promise<Course | null> {
    return this.inMemoryCourses.get(id) || null;
  }

  public async listCourses(competitionId?: string): Promise<Course[]> {
    const all = Array.from(this.inMemoryCourses.values());
    if (competitionId) {
      return all.filter(c => c.competitionId === competitionId);
    }
    return all;
  }

  public async deleteCourse(id: string): Promise<void> {
    this.inMemoryCourses.delete(id);
    this.saveToStorage();
  }

  public clearAll(): void {
    this.inMemoryCourses.clear();
    this.inMemoryQrPacks.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(COURSES_STORAGE_KEY);
      localStorage.removeItem(QR_PACKS_STORAGE_KEY);
    }
  }
}

export const courseDesignerService = new CourseDesignerService();
