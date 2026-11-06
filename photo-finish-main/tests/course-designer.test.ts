import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { CourseDesignerService } from '../src/services/courseDesignerService';
import { setTrustedPublicKeyBase64 } from '../src/services/securityService';
import { Checkpoint } from '../src/types/athletics';
import { signCheckpointQr, getPublicKeyBase64 } from '../server/security.js';

describe('Stage C4: Course Designer, Offline Maps & Secured QR Packs', () => {
  let service: CourseDesignerService;

  beforeEach(() => {
    service = new CourseDesignerService();
    service.clearAll();
  });

  describe('Haversine Distance & Path Calculation', () => {
    it('calculates surface distance accurately between two coordinates', () => {
      // 5th July Stadium Algiers (Track finish line: 36.7533, 3.0180) to nearby point (~100m away)
      const lat1 = 36.7533;
      const lon1 = 3.0180;
      const lat2 = 36.7542;
      const lon2 = 3.0180;

      const dist = service.calculateDistanceMeters(lat1, lon1, lat2, lon2);
      expect(dist).toBeGreaterThan(95);
      expect(dist).toBeLessThan(105);
    });

    it('computes cumulative metrics and elevation gain/loss', () => {
      const waypoints = [
        { lat: 36.750, lng: 3.010, elevation: 100 },
        { lat: 36.751, lng: 3.011, elevation: 125 }, // +25m gain
        { lat: 36.752, lng: 3.012, elevation: 110 }, // -15m loss
        { lat: 36.753, lng: 3.013, elevation: 140 }, // +30m gain
      ];

      const metrics = service.computeCourseMetrics(waypoints);

      expect(metrics.waypoints.length).toBe(4);
      expect(metrics.waypoints[0].type).toBe('start');
      expect(metrics.waypoints[3].type).toBe('finish');
      expect(metrics.totalDistanceMeters).toBeGreaterThan(300);
      expect(metrics.elevationGainMeters).toBe(55); // 25 + 30
      expect(metrics.elevationLossMeters).toBe(15);
      expect(metrics.elevationProfile.length).toBe(4);
    });
  });

  describe('GeoJSON Import & Export', () => {
    it('exports a course to standard GeoJSON and imports it back losslessly', async () => {
      const rawPoints = [
        { lat: 36.750, lng: 3.010, elevation: 50 },
        { lat: 36.755, lng: 3.015, elevation: 65 },
        { lat: 36.760, lng: 3.020, elevation: 60 }
      ];

      const course = await service.createCourse({
        competitionId: 'comp_cross_2026',
        name: 'مسار البطولة الوطنية للعدو الريفي',
        discipline: 'cross_country',
        lapCount: 3,
        rawWaypoints: rawPoints
      });

      expect(course.totalDistanceMeters).toBeGreaterThan(1000);
      expect(course.geoJsonData).toBeDefined();

      // استيراد من الـ GeoJSON المُصدّر
      const imported = service.importFromGeoJson(course.geoJsonData!, 'المسار المستورد');
      expect(imported.name).toBe('مسار البطولة الوطنية للعدو الريفي');
      expect(imported.waypoints.length).toBe(3);
      expect(imported.totalDistanceMeters).toBe(course.totalDistanceMeters);
      expect(imported.elevationGainMeters).toBe(course.elevationGainMeters);
    });

    it('rejects invalid GeoJSON with fewer than 2 coordinates', () => {
      const invalidJson = JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [[3.0, 36.0]] // Single point
            }
          }
        ]
      });

      expect(() => service.importFromGeoJson(invalidJson)).toThrow();
    });
  });

  describe('Checkpoint Binding', () => {
    it('snaps checkpoints along the course path by distanceKm', async () => {
      const rawPoints = [
        { lat: 36.750, lng: 3.010 }, // 0m
        { lat: 36.759, lng: 3.010 }, // ~1000m
        { lat: 36.768, lng: 3.010 }, // ~2000m
        { lat: 36.777, lng: 3.010 }  // ~3000m
      ];

      const checkpoints: Checkpoint[] = [
        {
          id: 'cp_1km',
          code: 'CP01',
          name: 'نقطة الكيلومتر الأول',
          distanceKm: 1.0,
          type: 'intermediate',
          requiredLaps: [1],
          order: 1,
          assignedJudgeIds: []
        },
        {
          id: 'cp_finish',
          code: 'FINISH',
          name: 'خط الوصول',
          distanceKm: 3.0,
          type: 'finish',
          requiredLaps: [1],
          order: 2,
          assignedJudgeIds: []
        }
      ];

      const course = await service.createCourse({
        competitionId: 'comp_road_10k',
        name: 'سباق 3 كم تجريبي',
        discipline: 'road_race',
        rawWaypoints: rawPoints,
        checkpoints
      });

      // التحقق من أن نقاط المراقبة رُبطت بالـ waypoints
      const boundWps = course.waypoints.filter(wp => wp.checkpointId);
      expect(boundWps.length).toBe(2);
      expect(boundWps[0].checkpointId).toBe('cp_1km');
      expect(boundWps[0].type).toBe('checkpoint');
    });
  });

  describe('Secured Offline QR Packs', () => {
    // محاكاة نقطة النهاية الخادمية /api/checkpoint/sign (توقيع Ed25519 على الخادم حصراً)
    const serverSignFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      if (typeof url === 'string' && url.includes('/api/checkpoint/sign')) {
        const body = JSON.parse(String(init?.body || '{}'));
        const signature = signCheckpointQr(body);
        return new Response(JSON.stringify({ ok: true, signature }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404 });
    };

    beforeAll(() => {
      setTrustedPublicKeyBase64(getPublicKeyBase64());
    });

    let originalFetch: typeof globalThis.fetch;
    beforeEach(() => {
      originalFetch = globalThis.fetch;
      globalThis.fetch = serverSignFetch as typeof fetch;
    });
    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    const mockCheckpoint: Checkpoint = {
      id: 'cp_lake_turn',
      code: 'CP03',
      name: 'منعطف بحيرة الرغاية',
      distanceKm: 4.5,
      type: 'turnaround',
      requiredLaps: [1, 2],
      order: 3,
      assignedJudgeIds: []
    };

    it('generates a cryptographically signed QR pack for a physical checkpoint', async () => {
      const compId = 'comp_algiers_half_2026';
      const qrPack = await service.generateSecuredQrPack(compId, mockCheckpoint);

      expect(qrPack.id).toBeDefined();
      expect(qrPack.checkpointId).toBe(mockCheckpoint.id);
      expect(qrPack.checkpointCode).toBe('CP03');
      expect(qrPack.signature.length).toBeGreaterThanOrEqual(80); // توقيع Ed25519 كامل (64 بايت)
      expect(qrPack.token).toContain('PFP_CP:CP03:cp_lake_turn:');
      expect(qrPack.encryptedPayload).toBeDefined();
    });

    it('successfully verifies a genuine secured QR token', async () => {
      const compId = 'comp_algiers_half_2026';
      const qrPack = await service.generateSecuredQrPack(compId, mockCheckpoint);

      // فحص باستخدام الـ token
      const resToken = await service.verifySecuredQrToken(qrPack.token, compId);
      expect(resToken.valid).toBe(true);
      expect(resToken.checkpointId).toBe('cp_lake_turn');
      expect(resToken.checkpointCode).toBe('CP03');

      // فحص باستخدام الـ Base64 payload
      const resPayload = await service.verifySecuredQrToken(qrPack.encryptedPayload, compId);
      expect(resPayload.valid).toBe(true);
      expect(resPayload.checkpointId).toBe('cp_lake_turn');
      expect(resPayload.distanceKm).toBe(4.5);
    });

    it('rejects an expired QR token', async () => {
      const compId = 'comp_algiers_half_2026';
      // كود صلاحيته سالب (منتهي الصلاحية)
      const qrPack = await service.generateSecuredQrPack(compId, mockCheckpoint, -1000);

      const res = await service.verifySecuredQrToken(qrPack.encryptedPayload, compId);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('انتهت صلاحية');
    });

    it('rejects a token scanned in the wrong competition', async () => {
      const compId = 'comp_algiers_half_2026';
      const wrongCompId = 'comp_oran_10k_2026';
      const qrPack = await service.generateSecuredQrPack(compId, mockCheckpoint);

      const res = await service.verifySecuredQrToken(qrPack.encryptedPayload, wrongCompId);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('أخرى');
    });

    it('rejects tampered QR payload with invalid signature', async () => {
      const compId = 'comp_algiers_half_2026';
      const qrPack = await service.generateSecuredQrPack(compId, mockCheckpoint);

      // تزوير الـ distanceKm داخل الـ payload دون توقيع سليم
      const decoded = JSON.parse(decodeURIComponent(escape(atob(qrPack.encryptedPayload))));
      decoded.km = 99.9; // تلاعب بالمسافة
      const forgedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(decoded))));

      const res = await service.verifySecuredQrToken(forgedPayload, compId);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('التوقيع');
    });
  });

  describe('Storage & Persistence', () => {
    it('creates, lists and deletes courses from storage', async () => {
      const rawPoints = [
        { lat: 36.75, lng: 3.01 },
        { lat: 36.76, lng: 3.02 }
      ];

      const c1 = await service.createCourse({
        competitionId: 'comp_1',
        name: 'مسار 1',
        rawWaypoints: rawPoints
      });

      const c2 = await service.createCourse({
        competitionId: 'comp_2',
        name: 'مسار 2',
        rawWaypoints: rawPoints
      });

      const all = await service.listCourses();
      expect(all.length).toBe(2);

      const filtered = await service.listCourses('comp_1');
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(c1.id);

      await service.deleteCourse(c2.id);
      const afterDel = await service.listCourses();
      expect(afterDel.length).toBe(1);
    });
  });
});
