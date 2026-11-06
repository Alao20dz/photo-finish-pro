import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Sliders, Volume2, Play, Sparkles, Crosshair, Plus, Smartphone, Gauge, Upload, Music, RotateCcw, CheckCircle, Video, AlertTriangle } from 'lucide-react';
import { RaceSettings, Runner } from '../types/race';
import { CAMERA_PLACEMENT_OPTIONS } from '../services/cameraPlacement';
import { athleticsAudio } from '../services/audioService';

interface RaceSettingsModalProps {
  settings: RaceSettings;
  runners: Runner[];
  onSave: (newSettings: RaceSettings, newRunners: Runner[]) => void;
  onClose: () => void;
}

const DEFAULT_DISTANCES = ['50m', '60m', '100m', '200m', '400m', '800m', '1500m', '4x100m'];

export const RaceSettingsModal: React.FC<RaceSettingsModalProps> = ({
  settings,
  runners,
  onSave,
  onClose
}) => {
  const [currentSettings, setCurrentSettings] = useState<RaceSettings>({
    ...settings,
    availableDistances: settings.availableDistances?.length ? settings.availableDistances : DEFAULT_DISTANCES,
    soundVolume: settings.soundVolume ?? 1.8,
    soundPitch: settings.soundPitch ?? 1.0,
    stadiumAcoustics: settings.stadiumAcoustics ?? true,
    stadiumReverbLevel: settings.stadiumReverbLevel ?? 0.65,
    stadiumAmbience: settings.stadiumAmbience ?? true,
    hapticFeedback: settings.hapticFeedback ?? true,
  });
  const [currentRunners, setCurrentRunners] = useState<Runner[]>([...runners]);
  const [newDistanceInput, setNewDistanceInput] = useState<string>('');
  const [showAddDistance, setShowAddDistance] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [audioFileName, setAudioFileName] = useState<string>(athleticsAudio.activeAudioName);
  const [audioDuration, setAudioDuration] = useState<number>(athleticsAudio.activeAudioDuration);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  useEffect(() => {
    setAudioFileName(athleticsAudio.activeAudioName);
    setAudioDuration(athleticsAudio.activeAudioDuration);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadSuccess(null);
    try {
      const res = await athleticsAudio.loadCustomAudioFromFile(file);
      setAudioFileName(res.name);
      setAudioDuration(res.duration);
      setUploadSuccess(`تم استيراد ${res.name} بنجاح!`);
      athleticsAudio.playStarterSound(currentSettings.soundVolume, currentSettings.soundPitch);
      setTimeout(() => setUploadSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to load audio file', err);
      alert('تعذر تحميل الملف الصوتي، يرجى التأكد من أنه ملف MP3 أو WAV صالح.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetDefault = async () => {
    setIsUploading(true);
    try {
      await athleticsAudio.resetToDefaultSound();
      setAudioFileName(athleticsAudio.activeAudioName);
      setAudioDuration(athleticsAudio.activeAudioDuration);
      setUploadSuccess('تمت استعادة صوت sond depart.mp3 الافتراضي');
      athleticsAudio.playStarterSound(currentSettings.soundVolume, currentSettings.soundPitch);
      setTimeout(() => setUploadSuccess(null), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLaneCountChange = (count: number) => {
    setCurrentSettings(prev => ({ ...prev, laneCount: count }));
    
    if (count > currentRunners.length) {
      const added: Runner[] = [];
      const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EAB308'];
      for (let i = currentRunners.length + 1; i <= count; i++) {
        added.push({
          id: i,
          bib: 100 + i,
          name: `عداء الرواق ${i}`,
          country: 'فريق محلي',
          lane: i,
          color: colors[(i - 1) % colors.length],
          finishTime: 0,
          status: 'OK'
        });
      }
      setCurrentRunners([...currentRunners, ...added]);
    } else {
      setCurrentRunners(currentRunners.slice(0, count));
    }
  };

  const handleUpdateRunner = (index: number, field: keyof Runner, val: any) => {
    const updated = [...currentRunners];
    updated[index] = { ...updated[index], [field]: val };
    setCurrentRunners(updated);
  };

  const previewGunSound = (vol?: number, pitch?: number) => {
    athleticsAudio.stadiumAcoustics = currentSettings.stadiumAcoustics;
    athleticsAudio.stadiumReverbLevel = currentSettings.stadiumReverbLevel;
    athleticsAudio.stadiumAmbience = currentSettings.stadiumAmbience;
    athleticsAudio.playStarterSound(
      vol ?? currentSettings.soundVolume,
      pitch ?? currentSettings.soundPitch
    );
  };

  const handleAddCustomDistance = () => {
    const trimmed = newDistanceInput.trim();
    if (!trimmed) return;
    const formatted = trimmed.endsWith('m') || trimmed.endsWith('M') ? trimmed : `${trimmed}m`;
    
    if (!currentSettings.availableDistances.includes(formatted)) {
      const updated = [...currentSettings.availableDistances, formatted];
      setCurrentSettings(prev => ({
        ...prev,
        availableDistances: updated,
        distance: formatted,
      }));
    } else {
      setCurrentSettings(prev => ({ ...prev, distance: formatted }));
    }
    setNewDistanceInput('');
    setShowAddDistance(false);
  };

  const handleSave = () => {
    // تحديث إعدادات الصوت العامة وأجواء الملعب
    athleticsAudio.globalVolume = currentSettings.soundVolume;
    athleticsAudio.globalPitch = currentSettings.soundPitch;
    athleticsAudio.stadiumAcoustics = currentSettings.stadiumAcoustics;
    athleticsAudio.stadiumReverbLevel = currentSettings.stadiumReverbLevel;
    athleticsAudio.stadiumAmbience = currentSettings.stadiumAmbience;
    athleticsAudio.hapticEnabled = currentSettings.hapticFeedback;

    onSave(currentSettings, currentRunners);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 text-white" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* رأس النافذة */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-sm text-white">إعدادات التحكيم، الحساسات، والمسدس</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* محتوى الإعدادات */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          
          {/* 1. تخصيص وإضافة صوت المسدس MP3 الأصلي */}
          <div className="space-y-3 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                <Volume2 className="w-4 h-4 text-amber-400" />
                صوت طلقة الانطلاق المعتمد (ملف MP3 الأصلي):
              </span>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                جاهز في الذاكرة (0ms)
              </span>
            </div>

            {/* بطاقة عرض الملف الصوتي الحالي وخيارات الاستيراد */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Music className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-white flex items-center gap-1.5">
                      <span className="truncate max-w-[210px] text-amber-300 font-mono">{audioFileName}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-300 font-mono border border-slate-700">
                        {audioDuration > 0 ? `${audioDuration.toFixed(2)}s` : 'MP3'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      تشغيل فوري نقي ومباشر من الذاكرة • محمي من برامج التحميل (IDM)
                    </div>
                  </div>
                </div>

                {/* زر استماع فوري للملف */}
                <button
                  type="button"
                  onClick={() => previewGunSound()}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all flex items-center gap-1.5 font-black text-xs shadow-md shadow-amber-500/20 cursor-pointer"
                  title="استماع فوري للصوت الأصلي"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>تشغيل</span>
                </button>
              </div>

              {/* أزرار رفع ملف جديد أو استعادة الافتراضي */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="audio/mp3,audio/wav,audio/mpeg,audio/*,.mp3,.wav"
                  className="hidden"
                />
                
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'جاري التحميل...' : '📁 رفع ملف MP3 مخصص'}</span>
                </button>

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={handleResetDefault}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>استعادة الصوت الأصلي</span>
                </button>
              </div>

              {uploadSuccess && (
                <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 animate-fadeIn">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{uploadSuccess}</span>
                </div>
              )}
            </div>

            {/* عناصر التحكم في هندسة صوت وتضخيم الملعب */}
            <div className="pt-2 border-t border-slate-800/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* مستوى الصوت ومضخم الاستوديو (حتى 300%) */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300 font-bold text-[11px]">
                    <span>تضخيم الصوت:</span>
                    <span className="text-amber-400 font-mono font-black">{Math.round(currentSettings.soundVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={currentSettings.soundVolume}
                    onChange={(e) => setCurrentSettings(prev => ({ ...prev, soundVolume: parseFloat(e.target.value) }))}
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <div className="text-[9px] text-slate-400">
                    {currentSettings.soundVolume > 1.2 ? '🔥 مضخم استوديو فائق نشط' : 'مستوى قياسي'}
                  </div>
                </div>

                {/* حدة وسرعة الصوت */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300 font-bold text-[11px]">
                    <span>سرعة/حدة الصوت:</span>
                    <span className="text-amber-400 font-mono">{currentSettings.soundPitch.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.02"
                    value={currentSettings.soundPitch}
                    onChange={(e) => setCurrentSettings(prev => ({ ...prev, soundPitch: parseFloat(e.target.value) }))}
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <div className="text-[9px] text-slate-400">طبيعي متوازن 1.0x</div>
                </div>

                {/* اهتزاز الهاتف (Haptic Feedback) */}
                <div className="flex items-center justify-between sm:justify-center gap-2 pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => setCurrentSettings(prev => ({ ...prev, hapticFeedback: !prev.hapticFeedback }))}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all w-full justify-center ${
                      currentSettings.hapticFeedback
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>اهتزاز الهاتف: {currentSettings.hapticFeedback ? 'مفعل' : 'معطل'}</span>
                  </button>
                </div>
              </div>

              {/* قسم هندسة وصدى الملعب الأولمبي */}
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                    🏟️ هندسة صوت مدرجات وأجواء الملعب الأولمبي:
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* تفعيل صدى مدرجات الملعب */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setCurrentSettings(prev => ({ ...prev, stadiumAcoustics: !prev.stadiumAcoustics }))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                          currentSettings.stadiumAcoustics
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        صدى مدرجات الملعب: {currentSettings.stadiumAcoustics ? 'مفعل' : 'معطل'}
                      </button>
                      <span className="text-[10px] text-amber-400 font-mono">
                        {Math.round(currentSettings.stadiumReverbLevel * 100)}%
                      </span>
                    </div>
                    {currentSettings.stadiumAcoustics && (
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={currentSettings.stadiumReverbLevel}
                        onChange={(e) => setCurrentSettings(prev => ({ ...prev, stadiumReverbLevel: parseFloat(e.target.value) }))}
                        className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                    )}
                  </div>

                  {/* تفعيل ضوضاء وأجواء المضمار المفتوح */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-slate-200">هواء وأجواء المضمار الخارجي</div>
                      <div className="text-[9px] text-slate-400">محاكاة واقعية لأجواء السباقات الرسمية</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentSettings(prev => ({ ...prev, stadiumAmbience: !prev.stadiumAmbience }))}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                        currentSettings.stadiumAmbience
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {currentSettings.stadiumAmbience ? 'مفعل' : 'معطل'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* زر اختبار الصوت الفوري بأجواء الملعب */}
            <button
              type="button"
              onClick={() => previewGunSound()}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 border border-amber-300 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>🔊 استماع فوري لصوت الطلقة بأجواء الملعب والتضخيم ({audioFileName})</span>
            </button>
          </div>

          {/* 2. إعدادات وقت وزر إطلاق المسدس (تلقائي أو يدوي) */}
          <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>نمط إطلاق المسدس (Starter Trigger Mode):</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCurrentSettings(prev => ({ ...prev, starterMode: 'auto_random' }))}
                className={`p-2.5 rounded-xl border text-right transition-all ${
                  currentSettings.starterMode === 'auto_random'
                    ? 'bg-cyan-500/15 border-cyan-400 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold text-xs text-white">⚡ تلقائي بتأخير عشوائي (رسمي)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">يطلق المسدس آلياً بعد "استعد" بمهلة مانعة للتوقع</div>
              </button>

              <button
                type="button"
                onClick={() => setCurrentSettings(prev => ({ ...prev, starterMode: 'manual' }))}
                className={`p-2.5 rounded-xl border text-right transition-all ${
                  currentSettings.starterMode === 'manual'
                    ? 'bg-cyan-500/15 border-cyan-400 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold text-xs text-white">🔘 إطلاق يدوي بالكامل</div>
                <div className="text-[10px] text-slate-500 mt-0.5">يضغط الحكم زر الطلقة بنفسه في اللحظة التي يقررها</div>
              </button>
            </div>

            {currentSettings.starterMode === 'auto_random' && (
              <div className="pt-2">
                <div className="flex justify-between font-bold text-slate-300">
                  <span>متوسط فترة الاستعداد قبل الطلقة:</span>
                  <span className="font-mono text-cyan-400">{currentSettings.autoDelayDuration} ثانية</span>
                </div>
                <input
                  type="range"
                  min="1.2"
                  max="3.0"
                  step="0.1"
                  value={currentSettings.autoDelayDuration}
                  onChange={(e) => setCurrentSettings(prev => ({ ...prev, autoDelayDuration: parseFloat(e.target.value) }))}
                  className="w-full accent-cyan-400 cursor-pointer mt-1"
                />
              </div>
            )}
          </div>

          {/* 3. مسافة السباق ورقم القائمة / السلسلة (Heats) */}
          <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            {/* رقم القائمة / السلسلة */}
            <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <div>
                <label className="text-slate-300 font-bold block mb-1">رقم القائمة / السلسلة (Heat #):</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={currentSettings.heatNumber ?? 1}
                  onChange={(e) => setCurrentSettings(prev => ({ 
                    ...prev, 
                    heatNumber: parseInt(e.target.value) || 1,
                    heatName: prev.heatName || `قائمة ${e.target.value}`
                  }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-400 font-mono font-bold text-xs outline-none focus:border-amber-400 text-center"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">اسم التصفية / القائمة:</label>
                <input
                  type="text"
                  placeholder="مثال: تصفية 1 أو النهائي"
                  value={currentSettings.heatName || `قائمة ${currentSettings.heatNumber ?? 1}`}
                  onChange={(e) => setCurrentSettings(prev => ({ ...prev, heatName: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between font-bold text-slate-300">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Gauge className="w-4 h-4" />
                مسافة السباق:
              </span>
              <button
                type="button"
                onClick={() => setShowAddDistance(!showAddDistance)}
                className="text-cyan-400 hover:text-cyan-300 font-bold text-[11px] flex items-center gap-1 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ إضافة مسافة سباق أخرى</span>
              </button>
            </div>

            {/* أزرار المسافات المتاحة */}
            <div className="flex flex-wrap gap-1.5">
              {currentSettings.availableDistances.map((dist) => (
                <button
                  key={dist}
                  type="button"
                  onClick={() => setCurrentSettings(prev => ({ ...prev, distance: dist }))}
                  className={`px-3 py-1.5 rounded-xl font-bold border text-xs transition-all ${
                    currentSettings.distance === dist
                      ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  {dist}
                </button>
              ))}
            </div>

            {/* حقل إدخال مسافة مخصصة جديدة */}
            {showAddDistance && (
              <div className="flex gap-2 p-2 bg-slate-900 border border-cyan-850 rounded-xl mt-2">
                <input
                  type="text"
                  value={newDistanceInput}
                  onChange={(e) => setNewDistanceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCustomDistance();
                  }}
                  placeholder="مثال: 50m أو 80m أو 1000m أو 4x400m"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomDistance}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs"
                >
                  إضافة
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddDistance(false)}
                  className="px-2 py-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>

          {/* 4. عدد الأروقة وإعدادات خط النهاية والحساس */}
          <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="font-bold text-emerald-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Crosshair className="w-4 h-4" />
                عدد أروقة المضمار (Lanes) والحساس الضوئي:
              </span>
              <div className="flex gap-1">
                {[2, 4, 6, 8].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handleLaneCountChange(count)}
                    className={`w-7 h-7 rounded-lg font-bold border text-xs ${
                      currentSettings.laneCount === count
                        ? 'bg-cyan-500 border-cyan-400 text-black'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* لون خط النهاية */}
              <div>
                <label className="text-slate-400 block mb-1">لون خط النهاية:</label>
                <div className="flex gap-2">
                  {[
                    { color: '#EF4444', label: 'أحمر' },
                    { color: '#FACC15', label: 'أصفر' },
                    { color: '#00F0FF', label: 'نيون' },
                    { color: '#FFFFFF', label: 'أبيض' },
                  ].map((item) => (
                    <button
                      key={item.color}
                      type="button"
                      onClick={() => setCurrentSettings(prev => ({ ...prev, finishLineColor: item.color }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        currentSettings.finishLineColor === item.color ? 'scale-110 border-white shadow-lg' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: item.color }}
                      title={item.label}
                    />
                  ))}
                </div>
              </div>

              {/* سُمك خط النهاية */}
              <div>
                <label className="text-slate-400 block mb-1">سُمك خط النهاية:</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((width) => (
                    <button
                      key={width}
                      type="button"
                      onClick={() => setCurrentSettings(prev => ({ ...prev, finishLineWidth: width }))}
                      className={`flex-1 py-1 rounded font-bold border ${
                        currentSettings.finishLineWidth === width
                          ? 'bg-emerald-500 border-emerald-400 text-black'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      {width}px
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* حساسية الحساس التلقائي */}
            <div className="pt-1">
              <div className="flex justify-between font-bold text-slate-300">
                <span>حساسية قطع شعاع خط النهاية (Motion Threshold):</span>
                <span className="font-mono text-emerald-400">{currentSettings.motionThreshold}</span>
              </div>
              <input
                type="range"
                min="10"
                max="55"
                value={currentSettings.motionThreshold}
                onChange={(e) => setCurrentSettings(prev => ({ ...prev, motionThreshold: parseInt(e.target.value) }))}
                className="w-full accent-emerald-400 cursor-pointer mt-1"
              />
            </div>
          </div>

          {/* 4.5 هندسة وضعية كاميرا خط النهاية (Camera Placement) */}
          <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5">
              <Video className="w-4 h-4" />
              <span>هندسة وضعية كاميرا خط النهاية (Camera Placement):</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed -mt-1.5">
              أهم عامل في دقة التوقيت على الإطلاق — الكاميرا يجب أن تنظر على طول خط النهاية نفسه لا بزاوية نحوه،
              لأن أي ميلان يولّد خطأ منظور (Parallax) لا يمكن لأي خوارزمية تصحيحه لاحقاً.
            </p>

            <div className="grid gap-2">
              {CAMERA_PLACEMENT_OPTIONS.map((opt) => {
                const selected = (currentSettings.cameraPlacement || 'side_classic') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCurrentSettings(prev => ({ ...prev, cameraPlacement: opt.id }))}
                    className={`text-right p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      selected ? 'bg-slate-900' : 'bg-slate-950/70 border-slate-800 hover:border-slate-600'
                    }`}
                    style={selected ? { borderColor: opt.accent } : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-xs" style={{ color: opt.accent }}>{opt.title}</span>
                        {opt.recommended && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-black px-1.5 py-0.5 rounded-full border border-emerald-500/40">
                            ⭐ موصى بها رسمياً
                          </span>
                        )}
                      </div>
                      {selected && <CheckCircle className="w-4 h-4 shrink-0" style={{ color: opt.accent }} />}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{opt.subtitle}</p>

                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[9px] text-slate-500 font-bold shrink-0">دقة التوقيت:</span>
                      <div className="flex gap-0.5 shrink-0">
                        {[1, 2, 3].map(lvl => (
                          <span key={lvl} className="w-4 h-1.5 rounded-full" style={{ backgroundColor: lvl <= opt.accuracyLevel ? opt.accent : '#1e293b' }} />
                        ))}
                      </div>
                      <span className="text-[9px] font-bold truncate" style={{ color: opt.accent }}>{opt.accuracy}</span>
                    </div>

                    {selected && (
                      <ul className="mt-2 space-y-1 bg-slate-950/80 rounded-lg p-2 border border-slate-800">
                        {opt.steps.map((step, i) => (
                          <li key={i} className="text-[10px] text-slate-300 flex items-start gap-1.5">
                            <span className="font-mono font-black shrink-0" style={{ color: opt.accent }}>{i + 1}.</span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {selected && opt.warning && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        <span className="leading-relaxed">{opt.warning}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. أسماء وأرقام العدائين حسب كل رواق */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="font-bold text-slate-300 flex items-center justify-between">
              <span>قائمة العدائين حسب الرواق:</span>
              <span className="text-[10px] text-slate-500">تُحفظ تلقائياً في السجلات</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {currentRunners.map((runner, idx) => (
                <div
                  key={runner.id}
                  className="flex items-center gap-2 bg-slate-950/70 p-2 rounded-xl border border-slate-800"
                >
                  <div
                    className="w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center text-white shrink-0 shadow"
                    style={{ backgroundColor: runner.color }}
                  >
                    L{runner.lane}
                  </div>
                  <input
                    type="text"
                    value={runner.name}
                    onChange={(e) => handleUpdateRunner(idx, 'name', e.target.value)}
                    placeholder="اسم العداء"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-amber-400"
                  />
                  <input
                    type="number"
                    value={runner.bib || ''}
                    onChange={(e) => handleUpdateRunner(idx, 'bib', parseInt(e.target.value) || 0)}
                    placeholder="الصدر"
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs text-center outline-none focus:border-amber-400"
                    title="رقم صدر العداء"
                  />
                  <input
                    type="text"
                    value={runner.country}
                    onChange={(e) => handleUpdateRunner(idx, 'country', e.target.value)}
                    placeholder="الدولة/النادي"
                    className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-amber-400"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* أزرار الحفظ والإغلاق */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
          >
            <Save className="w-4 h-4" />
            <span>حفظ الإعدادات واعتمادها</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
