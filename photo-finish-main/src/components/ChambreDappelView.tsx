import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Shuffle, 
  Printer, 
  Share2, 
  Calendar, 
  Award, 
  MapPin, 
  Shield, 
  Hash, 
  CheckCircle2, 
  PlusCircle, 
  ArrowUp, 
  ArrowDown, 
  AlertCircle,
  Layers,
  Edit2,
  Check
} from 'lucide-react';
import { Runner, Heat, RaceSettings } from '../types/race';

interface ChambreDappelViewProps {
  heats: Heat[];
  currentHeatIndex: number;
  settings: RaceSettings;
  onSelectHeat: (index: number) => void;
  onAddNewHeat: (name?: string, distance?: string) => void;
  onDeleteHeat: (heatId: string) => void;
  onReorderHeats: (newHeats: Heat[]) => void;
  onUpdateRunnersList: (runners: Runner[]) => void;
  onUpdateHeatInfo?: (heatId: string, updates: Partial<Heat>) => void;
  onBroadcastHeats: () => void;
}

const ALGERIA_WILAYAS = [
  '01 أدرار', '02 الشلف', '03 الأغواط', '04 أم البواقي', '05 باتنة', '06 بجاية', '07 بسكرة', '08 بشار',
  '09 البليدة', '10 البويرة', '11 تمنراست', '12 تبسة', '13 تلمسان', '14 تيارت', '15 تيزي وزو', '16 الجزائر',
  '17 الجلفة', '18 جيجل', '19 سطيف', '20 سعيدة', '21 سكيكدة', '22 سيدي بلعباس', '23 عنابة', '24 قالمة',
  '25 قسنطينة', '26 المدية', '27 مستغانم', '28 المسيلة', '29 معسكر', '30 ورقلة', '31 وهران', '32 البيض',
  '33 إليزي', '34 برج بوعريريج', '35 بومرداس', '36 الطارف', '37 تندوف', '38 تيسمسيلت', '39 الوادي', '40 خنشلة',
  '41 سوق أهراس', '42 تيبازة', '43 ميلة', '44 عين الدفلى', '45 النعامة', '46 عين تموشنت', '47 غرداية', '48 غليزان',
  '49 تيميمون', '50 برج باجي مختار', '51 أولاد جلال', '52 بني عباس', '53 عين صالح', '54 عين قزام', '55 تقرت', '56 جانت', '57 المغير', '58 المنيعة'
];

export const ChambreDappelView: React.FC<ChambreDappelViewProps> = ({
  heats,
  currentHeatIndex,
  settings,
  onSelectHeat,
  onAddNewHeat,
  onDeleteHeat,
  onReorderHeats,
  onUpdateRunnersList,
  onBroadcastHeats
}) => {
  const currentHeat = heats[currentHeatIndex] || heats[0];

  // نموذج إضافة عداء جديد
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [bib, setBib] = useState<string>('');
  const [club, setClub] = useState('');
  const [wilaya, setWilaya] = useState('16 الجزائر');
  const [selectedLane, setSelectedLane] = useState<number>(1);
  const [isManualLane, setIsManualLane] = useState<boolean>(true);

  // تعديل عداء موجود
  const [editingRunnerId, setEditingRunnerId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editBib, setEditBib] = useState<string>('');
  const [editClub, setEditClub] = useState('');
  const [editWilaya, setEditWilaya] = useState('');
  const [editLane, setEditLane] = useState<number>(1);

  // نموذج إضافة سلسلة/قائمة جديدة
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesDistance, setNewSeriesDistance] = useState(settings.distance || '100m');
  const [showAddSeriesModal, setShowAddSeriesModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // إشعار نجاح البث
  const [broadcastNotification, setBroadcastNotification] = useState(false);
  // تبويب الشاشة للهواتف المحمولة: نموذج الإدخال أو قائمة الأروقة
  const [mobileTab, setMobileTab] = useState<'form' | 'table'>(() => 
    (currentHeat?.runners && currentHeat.runners.length > 0) ? 'table' : 'form'
  );

  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EAB308'];

  // اقتراح رواق حر تلقائياً
  const occupiedLanes = (currentHeat?.runners || []).map(r => r.lane);
  const findNextFreeLane = (): number => {
    for (let l = 1; l <= settings.laneCount; l++) {
      if (!occupiedLanes.includes(l)) return l;
    }
    return 1;
  };

  // إضافة عداء جديد للقائمة الحالية
  const handleAddRunner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const assignedLane = isManualLane ? selectedLane : findNextFreeLane();
    const runnerBib = bib ? parseInt(bib, 10) : (currentHeat.number * 100 + (currentHeat?.runners.length || 0) + 1);

    const newRunner: Runner = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      bib: runnerBib,
      name: name.trim(),
      birthDate: birthDate.trim() || undefined,
      club: club.trim() || 'فردي',
      country: club.trim() || 'فردي',
      wilaya: wilaya.trim(),
      lane: assignedLane,
      color: colors[(assignedLane - 1) % colors.length],
      finishTime: 0,
      status: 'OK'
    };

    // إزالة أي عداء كان يشغل نفس الرواق إن وجد
    const updated = (currentHeat?.runners || [])
      .filter(r => r.lane !== assignedLane)
      .concat(newRunner)
      .sort((a, b) => a.lane - b.lane);

    onUpdateRunnersList(updated);

    // تفريغ النموذج
    setName('');
    setBib('');
    setClub('');
    setBirthDate('');
    setSelectedLane(findNextFreeLane());
    setMobileTab('table');
  };

  // بدء تعديل عداء
  const handleStartEdit = (runner: Runner) => {
    setEditingRunnerId(runner.id);
    setEditName(runner.name);
    setEditBirthDate(runner.birthDate || '');
    setEditBib(runner.bib.toString());
    setEditClub(runner.club || runner.country || '');
    setEditWilaya(runner.wilaya || '16 الجزائر');
    setEditLane(runner.lane);
    setMobileTab('form');
  };

  // حفظ تعديل عداء
  const handleSaveEdit = (runnerId: number) => {
    const updated = (currentHeat?.runners || []).map(r => {
      if (r.id === runnerId) {
        return {
          ...r,
          name: editName.trim() || r.name,
          birthDate: editBirthDate.trim() || undefined,
          bib: editBib ? parseInt(editBib, 10) : r.bib,
          club: editClub.trim() || r.club,
          country: editClub.trim() || r.country,
          wilaya: editWilaya.trim() || r.wilaya,
          lane: editLane,
          color: colors[(editLane - 1) % colors.length]
        };
      }
      return r;
    }).sort((a, b) => a.lane - b.lane);

    onUpdateRunnersList(updated);
    setEditingRunnerId(null);
  };

  // حذف عداء من القائمة
  const handleDeleteRunner = (runnerId: number) => {
    const updated = (currentHeat?.runners || []).filter(r => r.id !== runnerId);
    onUpdateRunnersList(updated);
  };

  // إجراء قرعة الأروقة العشوائية (Tirage au sort aléatoire)
  const handleRandomLaneDraw = () => {
    if (!currentHeat || !currentHeat.runners.length) return;

    const availableLanes = Array.from({ length: settings.laneCount }, (_, i) => i + 1);
    // خلط الأروقة عشوائياً (Fisher-Yates shuffle)
    for (let i = availableLanes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableLanes[i], availableLanes[j]] = [availableLanes[j], availableLanes[i]];
    }

    const shuffledRunners = currentHeat.runners.map((runner, index) => {
      const assignedLane = availableLanes[index % availableLanes.length];
      return {
        ...runner,
        lane: assignedLane,
        color: colors[(assignedLane - 1) % colors.length]
      };
    }).sort((a, b) => a.lane - b.lane);

    onUpdateRunnersList(shuffledRunners);
  };

  // ترتيب القوائم يدوياً للأعلى
  const handleMoveHeatUp = (index: number) => {
    if (index <= 0) return;
    const newHeats = [...heats];
    [newHeats[index - 1], newHeats[index]] = [newHeats[index], newHeats[index - 1]];
    onReorderHeats(newHeats);
    onSelectHeat(index - 1);
  };

  // ترتيب القوائم يدوياً للأسفل
  const handleMoveHeatDown = (index: number) => {
    if (index >= heats.length - 1) return;
    const newHeats = [...heats];
    [newHeats[index], newHeats[index + 1]] = [newHeats[index + 1], newHeats[index]];
    onReorderHeats(newHeats);
    onSelectHeat(index + 1);
  };

  // ترتيب القوائم تلقائياً حسب رقم السلسلة
  const handleAutoSortHeats = () => {
    const sorted = [...heats].sort((a, b) => {
      if (a.distance !== b.distance) return a.distance.localeCompare(b.distance);
      return a.number - b.number;
    });
    onReorderHeats(sorted);
    onSelectHeat(0);
  };

  // بث التحديثات لجميع الهواتف
  const handleBroadcast = () => {
    onBroadcastHeats();
    setBroadcastNotification(true);
    setTimeout(() => setBroadcastNotification(false), 3000);
  };

  // طباعة استمارة غرفة النداء الرسمية (Feuille d'Appel)
  const handlePrintCallSheet = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-2 sm:p-4 space-y-4 text-slate-100" dir="rtl">
      {/* إشعار تأكيد البث اللحظي */}
      {broadcastNotification && (
        <div className="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl text-white font-bold text-xs flex items-center justify-between shadow-xl animate-fade-in border border-emerald-400/40">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-200" />
            <span>تم بث واعتماد جميع القوائم والعدائين فورياً لجميع الهواتف (البداية، النهاية، والتحكيم)! 🚀</span>
          </div>
          <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded-full">MQTT 4G Sync</span>
        </div>
      )}

      {/* بطاقة غرفة النداء الرئيسية */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/60 rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center shadow-inner shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  غرفة النداء وتسجيل القوائم (Chambre d'Appel)
                </h2>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-bold">
                  الهاتف 4 📋
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تسجيل الرياضيين، تحديد أرقام الصدريات والنوادي والولايات، وتوزيع الأروقة يدوياً أو بالقرعة العشوائية
              </p>
            </div>
          </div>

          {/* أزرار العمليات العلوية: بث لجميع الهواتف + طباعة استمارة النداء */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleBroadcast}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer border border-emerald-400/40"
              title="إرسال القوائم فورياً لهاتف البداية وهاتف النهاية وهاتف التحكيم"
            >
              <Share2 className="w-4 h-4" />
              <span>بث للقوائم (Sync) 🚀</span>
            </button>

            <button
              type="button"
              onClick={handlePrintCallSheet}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              title="طباعة استمارة النداء الرسمية (Feuille d'Appel)"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">طباعة الاستمارة 🖨️</span>
            </button>
          </div>
        </div>

        {/* شريط اختيار وإدارة القوائم والسلاسل (Heats / Series) */}
        <div className="mt-5 pt-4 border-t border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>قوائم وسلاسل السباق:</span>
              </span>
              <span className="text-[11px] text-slate-400">
                (إجمالي: {heats.length} قوائم)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* ترتيب تلقائي */}
              <button
                type="button"
                onClick={handleAutoSortHeats}
                className="px-2 py-1 rounded-lg bg-slate-850 hover:bg-slate-750 text-slate-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="ترتيب القوائم تلقائياً حسب المسافة والرقم"
              >
                <span>ترتيب تلقائي ⚡</span>
              </button>

              {/* زر إضافة سلسلة جديدة */}
              <button
                type="button"
                onClick={() => setShowAddSeriesModal(true)}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1 shadow transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>إضافة قائمة جديدة ➕</span>
              </button>
            </div>
          </div>

          {/* تبويبات القوائم مع إمكانية التقديم والتأخير والحذف */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {heats.map((heat, idx) => {
              const isSelected = idx === currentHeatIndex;
              return (
                <div
                  key={heat.id}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-2xl border transition-all shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectHeat(idx)}
                    className="font-bold text-xs flex items-center gap-1.5 cursor-pointer text-right"
                  >
                    <span>{heat.name || `قائمة ${heat.number}`}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isSelected ? 'bg-indigo-950/60 text-indigo-200' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {heat.distance}
                    </span>
                    <span className="text-[10px] opacity-75">
                      ({heat.runners.length})
                    </span>
                  </button>

                  {/* أزرار ترتيب القائمة يدوياً (Move Up / Move Down) */}
                  <div className="flex items-center gap-0.5 mr-1 border-r border-slate-700/60 pr-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveHeatUp(idx)}
                      className={`p-0.5 rounded hover:bg-black/30 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed`}
                      title="تحريك القائمة للأعلى / الأولوية"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === heats.length - 1}
                      onClick={() => handleMoveHeatDown(idx)}
                      className={`p-0.5 rounded hover:bg-black/30 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed`}
                      title="تحريك القائمة للأسفل"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>

                    {/* زر حذف القائمة إذا كانت أكثر من قائمة واحدة */}
                    {heats.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(heat.id)}
                        className="p-0.5 rounded hover:bg-rose-900/50 text-rose-300 hover:text-rose-100 transition-colors"
                        title="حذف هذه القائمة"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* نافذة تأكيد حذف قائمة */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-base text-white">تأكيد حذف قائمة السباق</h4>
              <p className="text-xs text-slate-300 mt-1">
                هل أنت متأكد من حذف هذه القائمة؟ سيتم مسح جميع العدائين المسجلين بها نهائياً.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onDeleteHeat(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
              >
                نعم، احذف القائمة
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إنشاء سلسلة / قائمة جديدة مع الاسم والمسافة */}
      {showAddSeriesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <h4 className="font-black text-base text-white">إنشاء قائمة / سلسلة سباق جديدة</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSeriesModal(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  مسافة السباق (Distance):
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['60m', '100m', '200m', '400m', '800m', '1500m', '4x100m'].map(dist => (
                    <button
                      key={dist}
                      type="button"
                      onClick={() => {
                        setNewSeriesDistance(dist);
                        if (!newSeriesName || newSeriesName.includes('m')) {
                          setNewSeriesName(`${dist} Série ${heats.length + 1}`);
                        }
                      }}
                      className={`py-1.5 px-2 rounded-xl font-bold font-mono transition-all ${
                        newSeriesDistance === dist
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                      }`}
                    >
                      {dist}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  اسم السلسلة / القائمة (مثل: 800m Série 1، 800m Série 2):
                </label>
                <input
                  type="text"
                  value={newSeriesName}
                  onChange={(e) => setNewSeriesName(e.target.value)}
                  placeholder={`مثال: ${newSeriesDistance} Série ${heats.length + 1}`}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-2.5 text-white font-bold outline-none"
                />
              </div>

              {/* اقتراحات سريعة لأسماء السلاسل */}
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">تسميات سريعة مقترحة:</span>
                <div className="flex flex-wrap gap-1">
                  {[
                    `${newSeriesDistance} Série 1`,
                    `${newSeriesDistance} Série 2`,
                    `${newSeriesDistance} Série 3`,
                    `${newSeriesDistance} Demi-Finale 1`,
                    `${newSeriesDistance} Demi-Finale 2`,
                    `${newSeriesDistance} Finale 🏆`
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewSeriesName(preset)}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-indigo-300 text-[10px] font-bold border border-indigo-500/20"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const finalName = newSeriesName.trim() || `${newSeriesDistance} Série ${heats.length + 1}`;
                  onAddNewHeat(finalName, newSeriesDistance);
                  setShowAddSeriesModal(false);
                  setNewSeriesName('');
                }}
                className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
              >
                إنشاء القائمة ➕
              </button>
              <button
                type="button"
                onClick={() => setShowAddSeriesModal(false)}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* شريط التبديل السريع للهواتف المحمولة (Mobile Tab Switcher) */}
      <div className="lg:hidden grid grid-cols-2 gap-2 bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800 shadow-md">
        <button
          type="button"
          onClick={() => setMobileTab('form')}
          className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'form'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>{editingRunnerId ? '✏️ تعديل العداء' : '➕ تسجيل عداء جديد'}</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('table')}
          className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'table'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>📋 قائمة الأروقة ({currentHeat?.runners.length || 0})</span>
        </button>
      </div>

      {/* قسم نموذج تسجيل الرياضي وقرعة الأروقة */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* عمود النموذج: إدخال معلومات العداء */}
        <div className={`lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4 ${
          mobileTab === 'form' ? 'block' : 'hidden lg:block'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                <UserPlus className="w-4 h-4" />
              </div>
              <h3 className="font-black text-sm text-white">تسجيل عداء في: {currentHeat?.name}</h3>
            </div>
            <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded-full">
              {currentHeat?.distance}
            </span>
          </div>

          <form onSubmit={handleAddRunner} className="space-y-3 text-xs">
            {/* الاسم واللقب */}
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                الاسم واللقب (Nom & Prénom): <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: يوسف العبدلي"
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-2.5 text-white font-bold outline-none"
              />
            </div>

            {/* رقم الصدرية وتاريخ الميلاد */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-amber-400" />
                  <span>رقم الصدرية (Dossard):</span>
                </label>
                <input
                  type="number"
                  value={bib}
                  onChange={(e) => setBib(e.target.value)}
                  placeholder={`مثال: ${currentHeat.number * 100 + (currentHeat?.runners.length || 0) + 1}`}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-2 text-white font-mono font-bold outline-none text-center"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-cyan-400" />
                  <span>تاريخ الميلاد:</span>
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-2 text-white font-mono outline-none text-center"
                />
              </div>
            </div>

            {/* النادي الرياضي والولاية */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span>النادي (Club):</span>
                </label>
                <input
                  type="text"
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                  placeholder="مثال: نادي ألعاب القوى"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-2 text-white font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-400" />
                  <span>الولاية / الرابطة:</span>
                </label>
                <select
                  value={wilaya}
                  onChange={(e) => setWilaya(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl p-2 text-white font-bold outline-none text-xs"
                >
                  {ALGERIA_WILAYAS.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* طريقة تحديد الرواق: يدوي أو تلقائي عشوائي */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">طريقة تخصيص الرواق (Couloir):</span>
                <div className="flex gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setIsManualLane(true)}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-colors ${
                      isManualLane ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    يدوياً (Manuel)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsManualLane(false)}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-colors ${
                      !isManualLane ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    تلقائي (Auto)
                  </button>
                </div>
              </div>

              {isManualLane && (
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1">
                  {Array.from({ length: settings.laneCount }, (_, i) => i + 1).map(lane => {
                    const isOccupied = occupiedLanes.includes(lane);
                    const isCurrent = selectedLane === lane;
                    return (
                      <button
                        key={lane}
                        type="button"
                        onClick={() => setSelectedLane(lane)}
                        className={`p-2 rounded-xl font-mono font-bold text-xs flex flex-col items-center justify-center transition-all ${
                          isCurrent
                            ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md scale-105'
                            : isOccupied
                            ? 'bg-slate-800/60 text-slate-400 border border-slate-700/50'
                            : 'bg-slate-950 text-slate-200 border border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        <span>رواق {lane}</span>
                        {isOccupied && <span className="text-[9px] text-amber-400">مشغول</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* زر إضافة العداء للقائمة */}
            <button
              type="submit"
              className="w-full mt-3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-98 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>تسجيل العداء في القائمة ➕</span>
            </button>
          </form>
        </div>

        {/* عمود جدول العدائين المسجلين في القائمة الحالية */}
        <div className={`lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3 flex flex-col ${
          mobileTab === 'table' ? 'flex' : 'hidden lg:flex'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-white">
                  عدائي: {currentHeat?.name || `قائمة ${currentHeat?.number}`}
                </h3>
                <span className="text-[11px] text-slate-400">
                  {currentHeat?.runners.length || 0} عداء مسجل في هذه القائمة
                </span>
              </div>
            </div>

            {/* زر القرعة العشوائية للأروقة (Tirage au sort aléatoire) */}
            <button
              type="button"
              onClick={handleRandomLaneDraw}
              disabled={!currentHeat?.runners.length}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="توزيع الأروقة تلقائياً وبشكل عشوائي بين العدائين المسجلين"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>قرعة الأروقة عشوائياً (Aléatoire) 🎲</span>
            </button>
          </div>

          {/* جدول العدائين */}
          <div className="flex-1 overflow-x-auto">
            {(!currentHeat?.runners || currentHeat.runners.length === 0) ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <Users className="w-8 h-8 opacity-40" />
                <span>لم يتم تسجيل أي عداء في هذه القائمة بعد.</span>
                <span className="text-[11px] text-slate-600">املأ النموذج على اليمين لتسجيل العدائين.</span>
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2 px-2 text-center">الرواق</th>
                    <th className="py-2 px-2 text-center">الصدرية</th>
                    <th className="py-2 px-2">الاسم واللقب</th>
                    <th className="py-2 px-2">الميلاد</th>
                    <th className="py-2 px-2">النادي</th>
                    <th className="py-2 px-2">الولاية</th>
                    <th className="py-2 px-2 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentHeat.runners.map(runner => {
                    const isEditing = editingRunnerId === runner.id;
                    return (
                      <tr key={runner.id} className="hover:bg-slate-800/40 transition-colors">
                        {isEditing ? (
                          // صف التعديل
                          <>
                            <td className="py-2 px-2 text-center">
                              <select
                                value={editLane}
                                onChange={(e) => setEditLane(parseInt(e.target.value, 10))}
                                className="bg-slate-950 border border-slate-700 text-white rounded p-1 font-mono text-center text-xs"
                              >
                                {Array.from({ length: settings.laneCount }, (_, i) => i + 1).map(l => (
                                  <option key={l} value={l}>رواق {l}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                value={editBib}
                                onChange={(e) => setEditBib(e.target.value)}
                                className="w-14 bg-slate-950 border border-slate-700 text-white rounded p-1 font-mono text-center text-xs"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 text-white rounded p-1 text-xs"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="date"
                                value={editBirthDate}
                                onChange={(e) => setEditBirthDate(e.target.value)}
                                className="bg-slate-950 border border-slate-700 text-white rounded p-1 text-xs font-mono"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={editClub}
                                onChange={(e) => setEditClub(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 text-white rounded p-1 text-xs"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <select
                                value={editWilaya}
                                onChange={(e) => setEditWilaya(e.target.value)}
                                className="bg-slate-950 border border-slate-700 text-white rounded p-1 text-xs"
                              >
                                {ALGERIA_WILAYAS.map(w => (
                                  <option key={w} value={w}>{w}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(runner.id)}
                                className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                                title="حفظ التعديل"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </>
                        ) : (
                          // صف العرض العادي
                          <>
                            <td className="py-2 px-2 text-center">
                              <span
                                className="inline-block px-2.5 py-0.5 rounded-full font-mono font-bold text-white text-[11px] shadow-sm"
                                style={{ backgroundColor: runner.color }}
                              >
                                {runner.lane}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center font-mono font-bold text-amber-300">
                              {runner.bib}
                            </td>
                            <td className="py-2 px-2 font-bold text-white">
                              {runner.name}
                            </td>
                            <td className="py-2 px-2 font-mono text-[11px] text-slate-400">
                              {runner.birthDate || '—'}
                            </td>
                            <td className="py-2 px-2 text-slate-300 text-[11px]">
                              {runner.club || runner.country || '—'}
                            </td>
                            <td className="py-2 px-2 text-slate-400 text-[11px]">
                              {runner.wilaya || '—'}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(runner)}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                  title="تعديل العداء"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRunner(runner.id)}
                                  className="p-1 rounded hover:bg-rose-900/50 text-rose-400 hover:text-rose-200"
                                  title="حذف العداء"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
