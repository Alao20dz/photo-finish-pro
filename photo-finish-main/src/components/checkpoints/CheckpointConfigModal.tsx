import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  MapPin, 
  Save, 
  Route 
} from 'lucide-react';
import { 
  AthleticsCompetition, 
  Checkpoint, 
  AthleticsCompetitionType, 
  AgeCategory, 
  GenderCategory,
  CheckpointType 
} from '../../types/athletics';
import { checkpointStorage } from '../../services/checkpointStorage';

interface CheckpointConfigModalProps {
  initialCompetition?: AthleticsCompetition;
  onSave: (comp: AthleticsCompetition) => void;
  onClose: () => void;
}

export const CheckpointConfigModal: React.FC<CheckpointConfigModalProps> = ({
  initialCompetition,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState<string>(initialCompetition?.name || 'سباق العدو الريفي 8 كم (أكابر)');
  const [type, setType] = useState<AthleticsCompetitionType>(initialCompetition?.type || 'cross_country');
  const [venue, setVenue] = useState<string>(initialCompetition?.venue || 'غابة بوشاوي');
  const [distanceKm, setDistanceKm] = useState<number>(initialCompetition?.distanceKm || 8);
  const [lapCount, setLapCount] = useState<number>(initialCompetition?.lapCount || 4);
  const [category, setCategory] = useState<AgeCategory>(initialCompetition?.category || 'SENIOR');
  const [gender, setGender] = useState<GenderCategory>(initialCompetition?.gender || 'M');
  const [scheduledStartTime, setScheduledStartTime] = useState<string>(initialCompetition?.scheduledStartTime || '10:00');

  const defaultCheckpoints: Checkpoint[] = initialCompetition?.checkpoints || [
    { id: 'cp_start', code: 'START', name: 'خط الانطلاق', distanceKm: 0, type: 'start', requiredLaps: [1], order: 0, assignedJudgeIds: [] },
    { id: 'cp_01', code: 'CP01', name: 'نقطة جسر الوادي', distanceKm: 1.0, type: 'intermediate', requiredLaps: [1, 2, 3, 4], order: 1, assignedJudgeIds: [] },
    { id: 'cp_02', code: 'CP02', name: 'منعرج الصنوبر', distanceKm: 2.0, type: 'intermediate', requiredLaps: [1, 2, 3, 4], order: 2, assignedJudgeIds: [] },
    { id: 'cp_finish', code: 'FINISH', name: 'خط الوصول النهائي', distanceKm: 8.0, type: 'finish', requiredLaps: [4], order: 3, assignedJudgeIds: [] },
  ];

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(defaultCheckpoints);

  const handleAddCheckpoint = () => {
    const nextOrder = checkpoints.length;
    const newCp: Checkpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: `CP0${nextOrder}`,
      name: `نقطة مراقبة ${nextOrder}`,
      distanceKm: Math.min(distanceKm, (checkpoints[checkpoints.length - 1]?.distanceKm || 0) + 1.5),
      type: 'intermediate',
      requiredLaps: Array.from({ length: lapCount }, (_, i) => i + 1),
      order: nextOrder,
      assignedJudgeIds: []
    };
    setCheckpoints([...checkpoints, newCp]);
  };

  const handleRemoveCheckpoint = (id: string) => {
    if (checkpoints.length <= 2) {
      alert('يجب أن تحتوي المنافسة على نقطتي بداية ونهاية على الأقل.');
      return;
    }
    setCheckpoints(checkpoints.filter(c => c.id !== id));
  };

  const handleUpdateCheckpoint = (id: string, updates: Partial<Checkpoint>) => {
    setCheckpoints(checkpoints.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('يرجى تحديد اسم المنافسة');
      return;
    }

    const competition: AthleticsCompetition = {
      id: initialCompetition?.id || `comp_${Date.now()}`,
      name,
      type,
      venue,
      date: initialCompetition?.date || new Date().toISOString().split('T')[0],
      distanceKm,
      lapCount,
      category,
      gender,
      checkpoints: checkpoints.map((c, i) => ({ ...c, order: i })),
      scheduledStartTime,
      status: initialCompetition?.status || 'ready',
      createdAt: initialCompetition?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    await checkpointStorage.saveCompetition(competition);
    onSave(competition);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-auto text-slate-100">
        {/* الرأس */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Route className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">إعداد المنافسة ونقاط المراقبة</h2>
              <p className="text-xs text-slate-400">تخصيص المسار، الحلقات، ونقاط تحكيم السباق</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* نموذج الإعدادات العامة للمنافسة */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-300 block mb-1">اسم المنافسة:</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100"
              placeholder="مثلاً: بطولة العدو الريفي - المرحلة الجهوية"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">نوع المسابقة:</label>
            <select 
              value={type} 
              onChange={e => setType(e.target.value as AthleticsCompetitionType)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100"
            >
              <option value="cross_country">عدو ريفي (Cross-Country)</option>
              <option value="road_race">سباق طريق (Road Race)</option>
              <option value="track_race">سباق مضمار (Track & Field)</option>
              <option value="race_walking">مشي رياضي (Race Walking)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">المكان / المضمار:</label>
            <input 
              type="text" 
              value={venue} 
              onChange={e => setVenue(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">المسافة الإجمالية (كم):</label>
            <input 
              type="number" 
              step="0.1"
              value={distanceKm} 
              onChange={e => setDistanceKm(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs font-mono text-emerald-400 font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">عدد الحلقات (Laps):</label>
            <input 
              type="number" 
              min="1"
              max="50"
              value={lapCount} 
              onChange={e => setLapCount(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs font-mono text-indigo-400 font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">الفئة العمرية والجنس:</label>
            <div className="flex gap-2">
              <select 
                value={category} 
                onChange={e => setCategory(e.target.value as AgeCategory)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100"
              >
                <option value="SENIOR">أكابر (Senior)</option>
                <option value="U20">أواسط (U20)</option>
                <option value="U18">أشبال (U18)</option>
                <option value="U16">أصاغر (U16)</option>
                <option value="MASTER">قدماء (Master)</option>
              </select>
              <select 
                value={gender} 
                onChange={e => setGender(e.target.value as GenderCategory)}
                className="w-20 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100"
              >
                <option value="M">ذكور</option>
                <option value="F">إناث</option>
                <option value="MIXED">مختلط</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">وقت الانطلاق المجدول:</label>
            <input 
              type="time" 
              value={scheduledStartTime} 
              onChange={e => setScheduledStartTime(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-amber-400 font-mono font-bold"
            />
          </div>
        </div>

        {/* قسم نقاط المراقبة (Checkpoints Configuration) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-200">نقاط المراقبة والتحكيم في المسار</h3>
            </div>
            <button
              onClick={handleAddCheckpoint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة نقطة مراقبة</span>
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {checkpoints.map((cp, idx) => (
              <div 
                key={cp.id}
                className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-3 justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 font-mono font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <input 
                      type="text"
                      value={cp.code}
                      onChange={e => handleUpdateCheckpoint(cp.id, { code: e.target.value.toUpperCase() })}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs font-mono font-black text-emerald-400 text-center"
                    />
                  </div>
                  <div>
                    <input 
                      type="text"
                      value={cp.name}
                      onChange={e => handleUpdateCheckpoint(cp.id, { name: e.target.value })}
                      className="w-44 sm:w-60 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200"
                      placeholder="اسم النقطة"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-400">المسافة:</span>
                    <input 
                      type="number"
                      step="0.1"
                      value={cp.distanceKm}
                      onChange={e => handleUpdateCheckpoint(cp.id, { distanceKm: parseFloat(e.target.value) || 0 })}
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg p-1 text-xs font-mono text-center text-slate-100"
                    />
                    <span className="text-[11px] text-slate-400">كم</span>
                  </div>

                  <select
                    value={cp.type}
                    onChange={e => handleUpdateCheckpoint(cp.id, { type: e.target.value as CheckpointType })}
                    className="bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-[11px] text-slate-300"
                  >
                    <option value="start">خط البداية</option>
                    <option value="intermediate">نقطة بينية</option>
                    <option value="turnaround">نقطة التفاف</option>
                    <option value="split">توقيت جزئي</option>
                    <option value="finish">خط النهاية</option>
                  </select>

                  <button
                    onClick={() => handleRemoveCheckpoint(cp.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition"
                    title="حذف النقطة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* أزرار الحفظ والإغلاق */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-900/40"
          >
            <Save className="w-4 h-4" />
            <span>حفظ واعتماد المسار</span>
          </button>
        </div>
      </div>
    </div>
  );
};
