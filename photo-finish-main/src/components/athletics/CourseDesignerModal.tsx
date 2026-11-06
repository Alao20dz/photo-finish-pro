import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, Route, Download, Upload, Plus, Trash2, 
  RefreshCw, QrCode, Flag, CheckCircle2,
  TrendingUp, Mountain, Copy, Check
} from 'lucide-react';
import { Course, CourseWaypoint, Checkpoint, SecuredQrPack } from '../../types/athletics';
import { courseDesignerService } from '../../services/courseDesignerService';
import { checkpointStorage } from '../../services/checkpointStorage';

interface CourseDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitionId?: string;
  onCourseSelect?: (course: Course) => void;
}

export const CourseDesignerModal: React.FC<CourseDesignerModalProps> = ({
  isOpen,
  onClose,
  competitionId = 'comp_default_2026',
  onCourseSelect,
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'elevation' | 'qr_packs' | 'presets'>('editor');
  const [qrPacks, setQrPacks] = useState<SecuredQrPack[]>([]);
  const [_isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<string>('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // حقول إضافة نقطة مسار يدوياً
  const [newLat, setNewLat] = useState<string>('36.7533');
  const [newLng, setNewLng] = useState<string>('3.0180');
  const [newElev, setNewElev] = useState<string>('50');
  const [newName, setNewName] = useState<string>('');
  const [newType, setNewType] = useState<CourseWaypoint['type']>('track_point');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const all = await courseDesignerService.listCourses();
      setCourses(all);
      if (all.length > 0 && !activeCourse) {
        setActiveCourse(all[0]);
      } else if (all.length === 0) {
        // إنشاء مسار افتراضي (حلقة ريفية)
        await loadPresetCourse('cross_country_2k');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // تحديث حزم الـ QR عند اختيار المسار أو فتح تبويب الـ QR
  useEffect(() => {
    if (activeCourse && activeCourse.checkpoints.length > 0) {
      generateQrPacksForCheckpoints(activeCourse);
    }
  }, [activeCourse]);

  const generateQrPacksForCheckpoints = async (course: Course) => {
    const packs: SecuredQrPack[] = [];
    for (const cp of course.checkpoints) {
      const pack = await courseDesignerService.generateSecuredQrPack(course.competitionId, cp);
      packs.push(pack);
    }
    setQrPacks(packs);
  };

  // تحميل مسار مسبق الإعداد (Presets)
  const loadPresetCourse = async (type: 'track_400m' | 'cross_country_2k' | 'road_5k') => {
    let name = 'حلقة عدو ريفي 2000م (Cross Country)';
    let rawWaypoints: { lat: number; lng: number; elevation?: number; name?: string; type?: CourseWaypoint['type'] }[] = [];
    let checkpoints: Checkpoint[] = [];
    let lapCount = 1;

    if (type === 'track_400m') {
      name = 'مضمار 400م قياسي (Standard 400m Oval)';
      lapCount = 1;
      rawWaypoints = [
        { lat: 36.7530, lng: 3.0180, elevation: 25, name: 'خط النهاية والانطلاق', type: 'start' },
        { lat: 36.7538, lng: 3.0180, elevation: 25, name: 'مستقيم البداية' },
        { lat: 36.7544, lng: 3.0184, elevation: 25, name: 'منعطف 1' },
        { lat: 36.7544, lng: 3.0192, elevation: 25, name: 'منعطف 2' },
        { lat: 36.7538, lng: 3.0196, elevation: 25, name: 'مستقيم المقابل' },
        { lat: 36.7530, lng: 3.0196, elevation: 25, name: 'منعطف 3' },
        { lat: 36.7524, lng: 3.0192, elevation: 25, name: 'منعطف 4' },
        { lat: 36.7524, lng: 3.0184, elevation: 25, name: 'المنعرج الأخير' },
        { lat: 36.7530, lng: 3.0180, elevation: 25, name: 'خط الوصول', type: 'finish' }
      ];
      checkpoints = [
        { id: 'cp_trk_start', code: 'START', name: 'خط الانطلاق 400م', distanceKm: 0, type: 'start', requiredLaps: [1], order: 0, assignedJudgeIds: [] },
        { id: 'cp_trk_200m', code: 'CP200', name: 'علامة 200م', distanceKm: 0.2, type: 'split', requiredLaps: [1], order: 1, assignedJudgeIds: [] },
        { id: 'cp_trk_finish', code: 'FINISH', name: 'خط الوصول', distanceKm: 0.4, type: 'finish', requiredLaps: [1], order: 2, assignedJudgeIds: [] }
      ];
    } else if (type === 'cross_country_2k') {
      name = 'حلقة ريفية 2000م (منتزه الصنوبر)';
      lapCount = 4;
      rawWaypoints = [
        { lat: 36.7500, lng: 3.0100, elevation: 80, name: 'بوابة الانطلاق', type: 'start' },
        { lat: 36.7520, lng: 3.0130, elevation: 95, name: 'صعود تل الصنوبر' },
        { lat: 36.7550, lng: 3.0150, elevation: 120, name: 'قمة الهضبة' },
        { lat: 36.7580, lng: 3.0120, elevation: 105, name: 'نقطة جسر الوادي' },
        { lat: 36.7560, lng: 3.0080, elevation: 85, name: 'منعرج الغابة' },
        { lat: 36.7530, lng: 3.0070, elevation: 80, name: 'الممر الرملي' },
        { lat: 36.7500, lng: 3.0100, elevation: 80, name: 'بوابة الوصول والحلقة', type: 'finish' }
      ];
      checkpoints = [
        { id: 'cp_xc_start', code: 'START', name: 'بوابة الانطلاق', distanceKm: 0, type: 'start', requiredLaps: [1], order: 0, assignedJudgeIds: [] },
        { id: 'cp_xc_bridge', code: 'CP01', name: 'نقطة جسر الوادي', distanceKm: 1.1, type: 'intermediate', requiredLaps: [1, 2, 3, 4], order: 1, assignedJudgeIds: [] },
        { id: 'cp_xc_forest', code: 'CP02', name: 'منعرج الغابة', distanceKm: 1.6, type: 'intermediate', requiredLaps: [1, 2, 3, 4], order: 2, assignedJudgeIds: [] },
        { id: 'cp_xc_finish', code: 'FINISH', name: 'خط الوصول والحلقة', distanceKm: 2.0, type: 'finish', requiredLaps: [1, 2, 3, 4], order: 3, assignedJudgeIds: [] }
      ];
    } else {
      name = 'سباق 5 كم على الطريق (كورنيش الصابلات)';
      lapCount = 1;
      rawWaypoints = [
        { lat: 36.7450, lng: 3.0500, elevation: 5, name: 'نقطة البداية - ميناء الصابلات', type: 'start' },
        { lat: 36.7490, lng: 3.0600, elevation: 6, name: 'الواجهة البحرية' },
        { lat: 36.7530, lng: 3.0720, elevation: 5, name: 'نقطة الكيلومتر الثاني' },
        { lat: 36.7580, lng: 3.0850, elevation: 7, name: 'نقطة الالتفاف U-Turn' },
        { lat: 36.7520, lng: 3.0700, elevation: 6, name: 'مسار العودة' },
        { lat: 36.7450, lng: 3.0500, elevation: 5, name: 'خط الوصول النهائي', type: 'finish' }
      ];
      checkpoints = [
        { id: 'cp_rd_start', code: 'START', name: 'خط البداية', distanceKm: 0, type: 'start', requiredLaps: [1], order: 0, assignedJudgeIds: [] },
        { id: 'cp_rd_turn', code: 'CP01', name: 'نقطة الالتفاف 2.5 كم', distanceKm: 2.5, type: 'turnaround', requiredLaps: [1], order: 1, assignedJudgeIds: [] },
        { id: 'cp_rd_finish', code: 'FINISH', name: 'خط الوصول 5 كم', distanceKm: 5.0, type: 'finish', requiredLaps: [1], order: 2, assignedJudgeIds: [] }
      ];
    }

    const created = await courseDesignerService.createCourse({
      competitionId,
      name,
      discipline: type === 'road_5k' ? 'road_race' : type === 'track_400m' ? 'track_race' : 'cross_country',
      lapCount,
      rawWaypoints,
      checkpoints
    });

    setCourses(prev => [created, ...prev]);
    setActiveCourse(created);
    setActiveTab('editor');
    showNotification(`تم تحميل (${created.name}) بنجاح!`);
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3500);
  };

  // إضافة نقطة مسار يدوياً
  const handleAddWaypoint = async () => {
    if (!activeCourse) return;
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    const elev = parseFloat(newElev) || 0;

    if (isNaN(lat) || isNaN(lng)) {
      alert('يرجى إدخال إحداثيات صحيحة (خط العرض وخط الطول).');
      return;
    }

    const updatedRaw = activeCourse.waypoints.map(w => ({
      lat: w.lat,
      lng: w.lng,
      elevation: w.elevation,
      name: w.name,
      type: w.type
    }));

    updatedRaw.push({
      lat,
      lng,
      elevation: elev,
      name: newName.trim() || undefined,
      type: newType
    });

    const metrics = courseDesignerService.computeCourseMetrics(updatedRaw);
    const updated: Course = {
      ...activeCourse,
      totalDistanceMeters: metrics.totalDistanceMeters,
      elevationGainMeters: metrics.elevationGainMeters,
      elevationLossMeters: metrics.elevationLossMeters,
      waypoints: metrics.waypoints,
      elevationProfile: metrics.elevationProfile,
      updatedAt: Date.now()
    };

    courseDesignerService.bindCheckpointsToWaypoints(updated);
    updated.geoJsonData = courseDesignerService.exportToGeoJson(updated);

    await courseDesignerService.createCourse({
      competitionId: updated.competitionId,
      name: updated.name,
      discipline: updated.discipline,
      lapCount: updated.lapCount,
      rawWaypoints: updated.waypoints,
      checkpoints: updated.checkpoints
    });

    setActiveCourse(updated);
    setNewName('');
    showNotification('تمت إضافة النقطة إلى المسار بنجاح!');
  };

  // حذف نقطة من المسار
  const handleDeleteWaypoint = async (index: number) => {
    if (!activeCourse || activeCourse.waypoints.length <= 2) {
      alert('يجب أن يحتوي المسار على نقطتين على الأقل (البداية والنهاية).');
      return;
    }

    const filtered = activeCourse.waypoints.filter((_, i) => i !== index);
    const metrics = courseDesignerService.computeCourseMetrics(filtered);

    const updated: Course = {
      ...activeCourse,
      totalDistanceMeters: metrics.totalDistanceMeters,
      elevationGainMeters: metrics.elevationGainMeters,
      elevationLossMeters: metrics.elevationLossMeters,
      waypoints: metrics.waypoints,
      elevationProfile: metrics.elevationProfile,
      updatedAt: Date.now()
    };

    courseDesignerService.bindCheckpointsToWaypoints(updated);
    updated.geoJsonData = courseDesignerService.exportToGeoJson(updated);

    setActiveCourse(updated);
    showNotification('تم حذف النقطة وتحديث المسافات.');
  };

  // تصدير ملف GeoJSON
  const handleExportGeoJson = () => {
    if (!activeCourse) return;
    const jsonStr = courseDesignerService.exportToGeoJson(activeCourse);
    const blob = new Blob([jsonStr], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCourse.name.replace(/\s+/g, '_')}_course.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('تم تصدير ملف GeoJSON بنجاح.');
  };

  // استيراد ملف GeoJSON
  const handleImportGeoJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const imported = courseDesignerService.importFromGeoJson(text);

        const newCourse = await courseDesignerService.createCourse({
          competitionId,
          name: imported.name,
          rawWaypoints: imported.waypoints
        });

        setCourses(prev => [newCourse, ...prev]);
        setActiveCourse(newCourse);
        showNotification(`تم استيراد المسار (${imported.name}) بنجاح!`);
      } catch (err: any) {
        alert(err?.message || 'فشل استيراد ملف GeoJSON.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ربط نقاط المراقبة المسجلة للمنافسة بالمسار
  const handleSyncCompetitionCheckpoints = async () => {
    if (!activeCourse) return;
    try {
      const allComps = await checkpointStorage.listCompetitions();
      const currentComp = allComps.find(c => c.id === activeCourse.competitionId) || allComps[0];

      if (currentComp && currentComp.checkpoints.length > 0) {
        const updatedCourse: Course = {
          ...activeCourse,
          checkpoints: currentComp.checkpoints
        };
        courseDesignerService.bindCheckpointsToWaypoints(updatedCourse);
        updatedCourse.geoJsonData = courseDesignerService.exportToGeoJson(updatedCourse);

        setActiveCourse(updatedCourse);
        await generateQrPacksForCheckpoints(updatedCourse);
        showNotification(`تم ربط ${currentComp.checkpoints.length} نقطة مراقبة وتوليد حزم الباركود المؤمنة!`);
      } else {
        alert('لا توجد نقاط مراقبة مسجلة لهذه المنافسة بعد.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // نسخ رمز الـ QR المؤمن
  const copyQrToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  // حساب إحداثيات رسم الـ SVG للمسار بدقة ذاتية (Auto Bounding Box)
  const svgPathData = useMemo(() => {
    if (!activeCourse || activeCourse.waypoints.length < 2) return null;

    const lats = activeCourse.waypoints.map(w => w.lat);
    const lngs = activeCourse.waypoints.map(w => w.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = maxLat - minLat || 0.0001;
    const lngSpan = maxLng - minLng || 0.0001;

    // مقاس لوحة الرسم 600 × 380 مع هوامش 40px
    const width = 600;
    const height = 380;
    const padding = 40;

    const scaleX = (width - padding * 2) / lngSpan;
    const scaleY = (height - padding * 2) / latSpan;

    const points = activeCourse.waypoints.map((w, index) => {
      // عكس المحور الصادي لأن خطوط العرض تزيد للأعلى والشاشات للأسفل
      const x = padding + (w.lng - minLng) * scaleX;
      const y = height - (padding + (w.lat - minLat) * scaleY);
      return { x, y, waypoint: w, index };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    return { points, pathD, width, height };
  }, [activeCourse]);

  // حساب مخطط الارتفاع (Elevation Profile SVG)
  const elevationSvg = useMemo(() => {
    if (!activeCourse || activeCourse.elevationProfile.length < 2) return null;

    const prof = activeCourse.elevationProfile;
    const maxDist = prof[prof.length - 1].distanceMeters || 1;
    const elevs = prof.map(p => p.elevationMeters);
    const minElev = Math.min(...elevs);
    const maxElev = Math.max(...elevs);
    const elevSpan = maxElev - minElev || 1;

    const width = 600;
    const height = 180;
    const padding = 30;

    const points = prof.map(p => {
      const x = padding + (p.distanceMeters / maxDist) * (width - padding * 2);
      const y = height - padding - ((p.elevationMeters - minElev) / elevSpan) * (height - padding * 2);
      return { x, y, dist: p.distanceMeters, elev: p.elevationMeters };
    });

    const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaD = `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${points[0].x.toFixed(1)} ${height - padding} Z`;

    return { points, lineD, areaD, minElev, maxElev, width, height };
  }, [activeCourse]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* شريط العنوان العلوي */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-slate-950 font-black shadow-lg shrink-0">
              <Route className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">مصمم المسارات والخرائط المحلية</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Offline Engine 🗺️
                </span>
              </div>
              <p className="text-xs text-slate-400">
                تصميم مسارات العدو الريفي والطريق، حساب الارتفاعات، وتوليد باركود النقاط الميدانية
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* إشعار التنبيه اللحظي */}
        {notification && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* التبويبات والشريط الإجرائي */}
        <div className="px-4 py-2.5 bg-slate-950/30 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'editor' ? 'bg-cyan-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Route className="w-3.5 h-3.5" />
              <span>المسار التفاعلي (2D)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('elevation')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'elevation' ? 'bg-cyan-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Mountain className="w-3.5 h-3.5" />
              <span>ملف الارتفاعات (+D)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('qr_packs')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'qr_packs' ? 'bg-cyan-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>حزم الباركود المؤمنة 📲</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'presets' ? 'bg-cyan-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>نماذج جاهزة 🏆</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportGeoJson}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1 cursor-pointer transition"
              title="تصدير كملف GeoJSON"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>GeoJSON</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1 cursor-pointer transition"
              title="استيراد ملف GeoJSON"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>استيراد</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".geojson,.json"
              className="hidden"
              onChange={handleImportGeoJson}
            />

            <button
              type="button"
              onClick={handleSyncCompetitionCheckpoints}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-500/40 text-indigo-300 font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>ربط نقاط المراقبة</span>
            </button>
          </div>
        </div>

        {/* محتوى التبويبات */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          
          {/* معلومات المسار النشط والبطاقات الإحصائية */}
          {activeCourse && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                <span className="text-[11px] text-slate-400 block mb-0.5">اسم المسار</span>
                <span className="font-bold text-white text-sm truncate block">{activeCourse.name}</span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                <span className="text-[11px] text-slate-400 block mb-0.5">المسافة الإجمالية</span>
                <span className="font-bold text-cyan-400 text-sm">
                  {(activeCourse.totalDistanceMeters / 1000).toFixed(2)} كم ({activeCourse.totalDistanceMeters}م)
                </span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                <span className="text-[11px] text-slate-400 block mb-0.5">فارق الارتفاع (+D / -D)</span>
                <span className="font-bold text-emerald-400 text-sm">
                  +{activeCourse.elevationGainMeters}م / -{activeCourse.elevationLossMeters}م
                </span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                <span className="text-[11px] text-slate-400 block mb-0.5">عدد النقاط والحلقات</span>
                <span className="font-bold text-amber-400 text-sm">
                  {activeCourse.waypoints.length} نقطة • {activeCourse.lapCount} حلقات
                </span>
              </div>
            </div>
          )}

          {/* ══════════ تبويب المسار التفاعلي 2D ══════════ */}
          {activeTab === 'editor' && (
            <div className="space-y-4">
              {/* لوحة رسم المسار بالـ SVG المستقل محلياً */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-2 overflow-hidden relative shadow-inner">
                <div className="absolute top-3 start-3 z-10 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-[10px] text-slate-300 flex items-center gap-2">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> البداية
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> الوصول
                  </span>
                  <span className="flex items-center gap-1 text-cyan-400">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"></span> نقطة مراقبة
                  </span>
                </div>

                {svgPathData ? (
                  <svg
                    viewBox={`0 0 ${svgPathData.width} ${svgPathData.height}`}
                    className="w-full h-64 sm:h-80 select-none"
                  >
                    {/* شبكة خلفية خفيفة */}
                    <defs>
                      <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* خط المسار */}
                    <path
                      d={svgPathData.pathD}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="filter drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                    />

                    {/* نقاط المسار */}
                    {svgPathData.points.map((p, idx) => {
                      const isStart = p.waypoint.type === 'start';
                      const isFinish = p.waypoint.type === 'finish';
                      const isCp = p.waypoint.checkpointId || p.waypoint.type === 'checkpoint';

                      const fillColor = isStart ? '#10b981' : isFinish ? '#ef4444' : isCp ? '#38bdf8' : '#94a3b8';
                      const radius = isStart || isFinish || isCp ? 6.5 : 3.5;

                      return (
                        <g key={p.waypoint.id} className="cursor-pointer">
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={radius}
                            fill={fillColor}
                            stroke="#0f172a"
                            strokeWidth="2"
                          />
                          {(isStart || isFinish || isCp) && (
                            <text
                              x={p.x}
                              y={p.y - 10}
                              fill="#f8fafc"
                              fontSize="10"
                              fontWeight="bold"
                              textAnchor="middle"
                              className="pointer-events-none"
                            >
                              {p.waypoint.name || `#${idx + 1}`}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
                    لا توجد نقاط كافية لرسم المسار. أضف نقطتين على الأقل.
                  </div>
                )}
              </div>

              {/* نموذج إضافة نقطة مسار يدوياً */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-cyan-400" />
                  <span>إضافة نقطة إحداثية جديدة إلى المسار</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">خط العرض (Lat)</label>
                    <input
                      type="text"
                      value={newLat}
                      onChange={e => setNewLat(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                      placeholder="36.7533"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">خط الطول (Lng)</label>
                    <input
                      type="text"
                      value={newLng}
                      onChange={e => setNewLng(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                      placeholder="3.0180"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">الارتفاع (متر)</label>
                    <input
                      type="number"
                      value={newElev}
                      onChange={e => setNewElev(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                      placeholder="50"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">اسم النقطة</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100"
                      placeholder="اختياري (مثل: جسر 1)"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">نوع النقطة</label>
                    <select
                      value={newType}
                      onChange={e => setNewType(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-slate-100"
                    >
                      <option value="track_point">نقطة مسار عادية</option>
                      <option value="checkpoint">نقطة مراقبة</option>
                      <option value="turn">منعطف حاد</option>
                      <option value="aid_station">نقطة إسعاف</option>
                      <option value="hazard">منطقة وعرة</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddWaypoint}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إدراج في نهاية المسار</span>
                  </button>
                </div>
              </div>

              {/* قائمة نقاط المسار الحالية */}
              {activeCourse && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-300">قائمة النقاط الإحداثية للمسار ({activeCourse.waypoints.length})</h3>
                  <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                    <table className="w-full text-start text-xs">
                      <thead className="bg-slate-900 text-slate-400 text-[11px] border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">الاسم والنوع</th>
                          <th className="p-2.5">المسافة التراكمية</th>
                          <th className="p-2.5">الإحداثيات والارتفاع</th>
                          <th className="p-2.5 text-center">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {activeCourse.waypoints.map((wp, i) => (
                          <tr key={wp.id} className="hover:bg-slate-850/50 transition">
                            <td className="p-2.5 text-slate-400 font-bold">{i + 1}</td>
                            <td className="p-2.5 font-sans font-bold text-white flex items-center gap-2">
                              {wp.type === 'start' && <span className="text-emerald-400">🚩 انطلاق</span>}
                              {wp.type === 'finish' && <span className="text-red-400">🏁 وصول</span>}
                              {wp.type === 'checkpoint' && <span className="text-cyan-400">⏱️ مراقبة</span>}
                              {wp.type === 'track_point' && <span className="text-slate-400">📍 مسار</span>}
                              <span>{wp.name}</span>
                            </td>
                            <td className="p-2.5 text-cyan-300">
                              {(wp.distanceFromStartMeters / 1000).toFixed(2)} كم ({wp.distanceFromStartMeters}م)
                            </td>
                            <td className="p-2.5 text-slate-300 text-[11px]">
                              {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)} • {wp.elevation ? `${wp.elevation}م` : '-'}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteWaypoint(i)}
                                className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                                title="حذف النقطة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ تبويب ملف الارتفاعات ══════════ */}
          {activeTab === 'elevation' && (
            <div className="space-y-4">
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-xs">
                  <h3 className="font-bold text-white flex items-center gap-1.5">
                    <Mountain className="w-4 h-4 text-emerald-400" />
                    <span>مخطط المظهر الجانبي للارتفاعات (Elevation Profile)</span>
                  </h3>
                  {elevationSvg && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>أعلى نقطة: <strong className="text-emerald-300">{elevationSvg.maxElev}م</strong></span>
                      <span>أدنى نقطة: <strong className="text-cyan-300">{elevationSvg.minElev}م</strong></span>
                    </div>
                  )}
                </div>

                {elevationSvg ? (
                  <svg
                    viewBox={`0 0 ${elevationSvg.width} ${elevationSvg.height}`}
                    className="w-full h-48 sm:h-64 select-none"
                  >
                    <defs>
                      <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* المساحة المظللة */}
                    <path d={elevationSvg.areaD} fill="url(#elevGrad)" />

                    {/* خط المظهر الجانبي */}
                    <path
                      d={elevationSvg.lineD}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    {/* نقاط العينات */}
                    {elevationSvg.points.map((p, idx) => (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r="3.5"
                        fill="#34d399"
                        stroke="#0f172a"
                        strokeWidth="1.5"
                      />
                    ))}
                  </svg>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-500 text-xs">
                    لا تتوفر بيانات ارتفاع للنقاط الإحداثية الحالية.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════ تبويب حزم الباركود المؤمنة ══════════ */}
          {activeTab === 'qr_packs' && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-cyan-400" />
                  <span>حزم رموز QR المؤمنة لنقاط المراقبة الميدانية</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  تُطبع هذه الأكواد أو تُعرض على هواتف حكام النقاط. تحتوي على توقيع رقمي مشفر (HMAC/SHA-256) يمنع التزييف والتلاعب بأوقات المرور ويعمل 100% دون اتصال بالإنترنت.
                </p>
              </div>

              {qrPacks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {qrPacks.map(pack => (
                    <div
                      key={pack.id}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-cyan-500/40 transition shadow-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-black text-xs border border-cyan-500/30">
                            {pack.checkpointCode}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-xs">{pack.checkpointName}</h4>
                            <span className="text-[10px] text-slate-400">توقيع: {pack.signature}</span>
                          </div>
                        </div>

                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          صالح 24 ساعة
                        </span>
                      </div>

                      {/* كود النص المشفر */}
                      <div className="bg-slate-900 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between gap-2">
                        <code className="text-[10px] font-mono text-cyan-400 truncate select-all">
                          {pack.token}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyQrToken(pack.token)}
                          className="shrink-0 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                          title="نسخ الكود"
                        >
                          {copiedToken === pack.token ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center justify-between">
                        <span>معرّف النقطة: {pack.checkpointId}</span>
                        <span>مؤمّن محلياً</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  لا توجد نقاط مراقبة مربوطة بهذا المسار حالياً. اضغط على "ربط نقاط المراقبة" بالأعلى لتوليد الحزم.
                </div>
              )}
            </div>
          )}

          {/* ══════════ تبويب النماذج الجاهزة Presets ══════════ */}
          {activeTab === 'presets' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-cyan-500/40 transition">
                <div className="space-y-1">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold mb-2">
                    <Flag className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-sm">مضمار 400م أولمبي</h4>
                  <p className="text-xs text-slate-400">
                    مضمار بيضاوي قياسي مع خط النهاية، علامة 200م، والمنعطفات الأربعة الرسمية.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadPresetCourse('track_400m')}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs transition cursor-pointer"
                >
                  تحميل النموذج 🏃
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-emerald-500/40 transition">
                <div className="space-y-1">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold mb-2">
                    <Mountain className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-sm">حلقة ريفية 2000م</h4>
                  <p className="text-xs text-slate-400">
                    مسار عدو ريفي طبيعي يتضمن تضاريس متغيرة (هضبة، جسر، منعرج غابة) بنظام 4 حلقات.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadPresetCourse('cross_country_2k')}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs transition cursor-pointer"
                >
                  تحميل النموذج 🌲
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition">
                <div className="space-y-1">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold mb-2">
                    <Route className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-sm">سباق طريق 5 كم</h4>
                  <p className="text-xs text-slate-400">
                    مسار سباق طريق على الواجهة البحرية مع نقطة التواء (U-Turn) عند منتصف المسافة (2.5 كم).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadPresetCourse('road_5k')}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs transition cursor-pointer"
                >
                  تحميل النموذج 🌊
                </button>
              </div>
            </div>
          )}

        </div>

        {/* الشريط السفلي للإغلاق والتأكيد */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
          <div className="text-slate-400">
            {courses.length} مسارات محفوظة محلياً • خادم الخرائط الذاتي نشط 100% دون اتصال
          </div>

          <div className="flex items-center gap-2">
            {onCourseSelect && activeCourse && (
              <button
                type="button"
                onClick={() => {
                  onCourseSelect(activeCourse);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer shadow"
              >
                اعتماد هذا المسار للمنافسة 🏁
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CourseDesignerModal;
