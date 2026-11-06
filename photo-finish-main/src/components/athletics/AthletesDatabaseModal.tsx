import React, { useState, useMemo } from 'react';
import { 
  Users, Search, Plus, X, AlertTriangle, ShieldCheck, 
  Award, Edit2, Trash2
} from 'lucide-react';
import { useAthleteStore } from '../../stores/athleteStore';
import { Athlete, AgeCategory, PersonalRecord } from '../../types/athletics';
import { CategoryEngine, CATEGORY_NAMES_AR } from '../../services/categoryEngine';
import { AthleteDeduplicationService } from '../../services/athleteDeduplicationService';

interface AthletesDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AthletesDatabaseModal: React.FC<AthletesDatabaseModalProps> = ({ isOpen, onClose }) => {
  const { 
    athletes, 
    clubs, 
    saveAthlete, 
    deleteAthlete, 
    searchFilter, 
    setSearchFilter, 
    selectedClubFilter, 
    setSelectedClubFilter 
  } = useAthleteStore();

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingRecordsAthlete, setViewingRecordsAthlete] = useState<Athlete | null>(null);
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [newRecordType, setNewRecordType] = useState<'PB' | 'SB'>('PB');
  const [newRecordForm, setNewRecordForm] = useState<PersonalRecord>({
    eventCode: '100m',
    eventName: '100 متر',
    recordValue: '',
    numericValueMsOrCm: 0,
    date: new Date().toISOString().split('T')[0],
    venue: '',
  });

  // نموذج إضافة / تعديل العداء
  const [formData, setFormData] = useState<Partial<Athlete>>({
    firstName: '',
    lastName: '',
    arabicName: '',
    birthDate: '2000-01-01',
    gender: 'M',
    nationality: 'الجزائر',
    clubId: '',
    clubName: '',
    wilaya: 'الجزائر العاصمة',
    primaryDiscipline: 'sprints',
    eligibleEvents: ['100m'],
    licenseNumber: '',
    bibNumber: undefined,
    medicalClearance: true,
    medicalClearanceExpiry: '2026-12-31',
    personalBests: [],
    seasonBests: [],
    status: 'active',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [forceOverride, setForceOverride] = useState(false);

  // حساب الفئة التقديرية الحالية للنموذج
  const calculatedCategoryPreview = useMemo(() => {
    if (!formData.birthDate) return { category: 'OPEN' as AgeCategory, age: 0, categoryNameAr: 'مفتوح' };
    return CategoryEngine.calculateCategory(formData.birthDate);
  }, [formData.birthDate]);

  // فحص التكرار اللحظي أثناء الكتابة في النموذج
  const activeDuplicateMatches = useMemo(() => {
    if (!isFormOpen) return [];
    if (!formData.firstName && !formData.licenseNumber) return [];
    return AthleteDeduplicationService.findDuplicates(formData, athletes);
  }, [formData, athletes, isFormOpen]);

  const hasBlockingDuplicate = activeDuplicateMatches.some((m) => m.recommendedAction === 'block');

  // تصفية العدائين المعروضين
  const filteredAthletes = useMemo(() => {
    return athletes.filter((ath) => {
      // فلتر النادي
      if (selectedClubFilter && ath.clubId !== selectedClubFilter) {
        return false;
      }
      // فلتر الفئة
      if (selectedCategoryFilter !== 'ALL') {
        const cat = CategoryEngine.calculateCategory(ath.birthDate).category;
        if (cat !== selectedCategoryFilter) return false;
      }
      // فلتر البحث النصي
      if (searchFilter.trim()) {
        const q = searchFilter.trim().toLowerCase();
        const fullName = `${ath.firstName} ${ath.lastName} ${ath.arabicName || ''}`.toLowerCase();
        const bibStr = ath.bibNumber ? String(ath.bibNumber) : '';
        const licStr = ath.licenseNumber.toLowerCase();
        const clubStr = (ath.clubName || '').toLowerCase();
        if (!fullName.includes(q) && !bibStr.includes(q) && !licStr.includes(q) && !clubStr.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [athletes, searchFilter, selectedClubFilter, selectedCategoryFilter]);

  const handleOpenAddForm = () => {
    setEditingAthlete(null);
    setFormData({
      firstName: '',
      lastName: '',
      arabicName: '',
      birthDate: '2004-01-01',
      gender: 'M',
      nationality: 'الجزائر',
      clubId: clubs[0]?.id || '',
      clubName: clubs[0]?.name || '',
      wilaya: clubs[0]?.wilaya || 'الجزائر العاصمة',
      primaryDiscipline: 'sprints',
      eligibleEvents: ['100m'],
      licenseNumber: `DZ-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      bibNumber: Math.floor(100 + Math.random() * 900),
      medicalClearance: true,
      medicalClearanceExpiry: '2026-12-31',
      personalBests: [],
      seasonBests: [],
      status: 'active',
    });
    setFormError(null);
    setForceOverride(false);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (athlete: Athlete) => {
    setEditingAthlete(athlete);
    setFormData({ ...athlete });
    setFormError(null);
    setForceOverride(false);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.firstName || !formData.lastName || !formData.birthDate || !formData.licenseNumber) {
      setFormError('يرجى ملء جميع الحقول الإلزامية (الاسم، اللقب، تاريخ الميلاد، ورقم الرخصة).');
      return;
    }

    if (hasBlockingDuplicate && !forceOverride) {
      setFormError('تعذر الحفظ: يوجد تعارض وتكرار قطعي مع عداء مسجل مسبقاً. تحقق من التنبيهات أدناه.');
      return;
    }

    const athleteToSave: Athlete = {
      id: editingAthlete ? editingAthlete.id : `ath_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      bibNumber: formData.bibNumber ? Number(formData.bibNumber) : undefined,
      licenseNumber: formData.licenseNumber.trim().toUpperCase(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      arabicName: formData.arabicName?.trim() || `${formData.firstName} ${formData.lastName}`.trim(),
      birthDate: formData.birthDate,
      gender: formData.gender || 'M',
      nationality: formData.nationality || 'الجزائر',
      clubId: formData.clubId,
      clubName: formData.clubName,
      wilaya: formData.wilaya,
      primaryDiscipline: formData.primaryDiscipline || 'sprints',
      eligibleEvents: formData.eligibleEvents || ['100m'],
      personalBests: formData.personalBests || [],
      seasonBests: formData.seasonBests || [],
      medicalClearance: !!formData.medicalClearance,
      medicalClearanceExpiry: formData.medicalClearanceExpiry,
      status: formData.status || 'active',
      createdAt: editingAthlete ? editingAthlete.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    const res = await saveAthlete(athleteToSave, forceOverride);
    if (!res.success) {
      setFormError(res.error || 'فشلت عملية حفظ العداء.');
      return;
    }

    setIsFormOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف العداء (${name}) نهائياً من قاعدة البيانات؟`)) {
      await deleteAthlete(id);
    }
  };

  const handleAddRecord = async () => {
    if (!viewingRecordsAthlete || !newRecordForm.recordValue) return;

    const updated = { ...viewingRecordsAthlete };
    if (newRecordType === 'PB') {
      updated.personalBests = [...updated.personalBests, { ...newRecordForm }];
    } else {
      updated.seasonBests = [...updated.seasonBests, { ...newRecordForm }];
    }

    await saveAthlete(updated, true);
    setViewingRecordsAthlete(updated);
    setIsAddingRecord(false);
    setNewRecordForm({
      eventCode: '100m',
      eventName: '100 متر',
      recordValue: '',
      numericValueMsOrCm: 0,
      date: new Date().toISOString().split('T')[0],
      venue: '',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-4 text-white overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 bg-slate-800/80 border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">سجل العدائين الموحد</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  {athletes.length} عداء مسجل
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">الملف الرياضي الموحد، كشف التكرار، حساب الفئات، وتدقيق الشهادات الطبية</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAddForm}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-emerald-950/40 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة عداء جديد</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Filters */}
        <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث بالاسم، رقم الصدرية، رقم الرخصة، أو النادي..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-3 pr-10 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Club Filter */}
            <select
              value={selectedClubFilter}
              onChange={(e) => setSelectedClubFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">جميع الأندية ({clubs.length})</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">جميع الفئات العمرية</option>
              <option value="U14">{CATEGORY_NAMES_AR.U14}</option>
              <option value="U16">{CATEGORY_NAMES_AR.U16}</option>
              <option value="U18">{CATEGORY_NAMES_AR.U18}</option>
              <option value="U20">{CATEGORY_NAMES_AR.U20}</option>
              <option value="SENIOR">{CATEGORY_NAMES_AR.SENIOR}</option>
              <option value="MASTER">{CATEGORY_NAMES_AR.MASTER}</option>
            </select>
          </div>
        </div>

        {/* Athletes Table View */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredAthletes.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-base font-medium">لا يوجد أي عداء يطابق خيارات البحث الحالية.</p>
              <p className="text-xs text-slate-500 mt-1">جرّب تغيير كلمات البحث أو اختر "جميع الفئات".</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-800/90 text-slate-300 font-semibold uppercase tracking-wider border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-3">الصدرية</th>
                    <th className="py-3 px-3">الاسم واللقب</th>
                    <th className="py-3 px-3">الفئة العمرية</th>
                    <th className="py-3 px-3">النادي والولاية</th>
                    <th className="py-3 px-3">الاختصاص الأساسي</th>
                    <th className="py-3 px-3">رخصة الاتحاد</th>
                    <th className="py-3 px-3 text-center">الفحص الطبي</th>
                    <th className="py-3 px-3 text-center">السجلات</th>
                    <th className="py-3 px-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {filteredAthletes.map((ath) => {
                    const catInfo = CategoryEngine.calculateCategory(ath.birthDate);
                    return (
                      <tr key={ath.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300">
                            #{ath.bibNumber || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-white text-sm">{ath.firstName} {ath.lastName}</div>
                          {ath.arabicName && <div className="text-[11px] text-slate-400">{ath.arabicName}</div>}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-blue-300">{catInfo.categoryNameAr}</span>
                            <span className="text-[10px] text-slate-400 font-mono">سنة الميلاد: {ath.birthDate.split('-')[0]} ({catInfo.age} سنة)</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-200">{ath.clubName || 'حر / فردي'}</div>
                          <div className="text-[10px] text-slate-400">{ath.wilaya || '—'}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {ath.primaryDiscipline}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono text-slate-300 text-xs">{ath.licenseNumber}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {ath.medicalClearance ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <ShieldCheck className="w-3 h-3" />
                              <span>سارية</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 text-red-400 border border-red-500/30">
                              <AlertTriangle className="w-3 h-3" />
                              <span>غير سارية</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setViewingRecordsAthlete(ath)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition-colors"
                          >
                            <Award className="w-3 h-3" />
                            <span>PB ({ath.personalBests.length})</span>
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditForm(ath)}
                              className="p-1.5 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-lg transition-colors"
                              title="تعديل بيانات العداء"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(ath.id, `${ath.firstName} ${ath.lastName}`)}
                              className="p-1.5 hover:bg-red-950/60 text-red-400 hover:text-red-300 rounded-lg transition-colors"
                              title="حذف العداء"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <div>
            معتمد من الاتحاد الدولي لألعاب القوى (World Athletics Rules) • الفئات مجمدة بلقطات المنافسات
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* نافذة إضافة / تعديل العداء مع كشف التكرار اللحظي */}
      {/* ═══════════════════════════════════════════════════ */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl p-6 text-right max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2 font-bold text-lg text-white">
                <Users className="w-5 h-5 text-blue-400" />
                <span>{editingAthlete ? 'تعديل بيانات العداء' : 'إضافة عداء جديد إلى السجل الموحد'}</span>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 text-xs mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            {/* تنبيه كشف التكرار الذكي في الوقت الحقيقي */}
            {activeDuplicateMatches.length > 0 && (
              <div className={`p-4 rounded-xl border mb-5 ${
                hasBlockingDuplicate 
                  ? 'bg-red-950/40 border-red-500/50 text-red-200' 
                  : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
              }`}>
                <div className="flex items-center gap-2 font-bold text-sm mb-2">
                  <AlertTriangle className={`w-4 h-4 ${hasBlockingDuplicate ? 'text-red-400' : 'text-amber-400'}`} />
                  <span>
                    {hasBlockingDuplicate ? 'تحذير أمني: اشتباه تكرار عالي الخطورة' : 'تنبيه: اشتباه تشابه في البيانات'}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {activeDuplicateMatches.map((m, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-black/30 border border-white/5 flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{m.conflictDetails}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          نسبة التطابق: {(m.similarityScore * 100).toFixed(0)}% • نوع التطابق: {m.matchType}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase shrink-0 ${
                        m.recommendedAction === 'block' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {m.recommendedAction === 'block' ? 'حظر إلزامي' : 'تحذير'}
                      </span>
                    </div>
                  ))}
                </div>

                {hasBlockingDuplicate && (
                  <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="forceOverride"
                      checked={forceOverride}
                      onChange={(e) => setForceOverride(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
                    />
                    <label htmlFor="forceOverride" className="text-xs text-slate-300 font-medium cursor-pointer">
                      أقر بأن هذا عداء مختلف وأتحمل المسؤولية القانونية للتجاوز (Force Override)
                    </label>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">الاسم الأول (باللاتينية أو العربية) *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName || ''}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    placeholder="مثلاً: يوسف"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">اللقب *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName || ''}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    placeholder="مثلاً: العبدلي"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">تاريخ الميلاد *</label>
                  <input
                    type="date"
                    required
                    value={formData.birthDate || ''}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                  <div className="text-[11px] text-blue-400 mt-1 font-semibold">
                    الفئة المحسوبة: {calculatedCategoryPreview.categoryNameAr} ({calculatedCategoryPreview.age} سنة)
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">الجنس</label>
                  <select
                    value={formData.gender || 'M'}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'M' | 'F' })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="M">ذكر (M)</option>
                    <option value="F">أنثى (F)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">رقم الصدرية الافتراضي (Dossard)</label>
                  <input
                    type="number"
                    value={formData.bibNumber || ''}
                    onChange={(e) => setFormData({ ...formData, bibNumber: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                    placeholder="101"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">رقم رخصة الاتحاد الوطني *</label>
                  <input
                    type="text"
                    required
                    value={formData.licenseNumber || ''}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                    placeholder="DZ-2026-10492"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">النادي المنتمي إليه</label>
                  <select
                    value={formData.clubId || ''}
                    onChange={(e) => {
                      const c = clubs.find((club) => club.id === e.target.value);
                      setFormData({ 
                        ...formData, 
                        clubId: e.target.value, 
                        clubName: c ? c.name : '',
                        wilaya: c ? c.wilaya : formData.wilaya
                      });
                    }}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">بدون نادٍ (فردي / حر)</option>
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code}) - {c.wilaya}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">الاختصاص الأساسي</label>
                  <select
                    value={formData.primaryDiscipline || 'sprints'}
                    onChange={(e) => setFormData({ ...formData, primaryDiscipline: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="sprints">السرعة والحواجز (Sprints & Hurdles)</option>
                    <option value="middle_distance">المسافات المتوسطة (Middle Distance - 800m, 1500m)</option>
                    <option value="long_distance">المسافات الطويلة والعدو الريفي (Long Distance & Cross)</option>
                    <option value="jumps">الوثب (Jumps - عالي، طويل، ثلاثي، زانة)</option>
                    <option value="throws">الرمي (Throws - جلة، قرص، رمح، مطرقة)</option>
                    <option value="race_walking">المشي الرياضي (Race Walking)</option>
                    <option value="combined">المسابقات المركبة (Combined Events)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">الولاية / الرابطة الجهوية</label>
                  <input
                    type="text"
                    value={formData.wilaya || ''}
                    onChange={(e) => setFormData({ ...formData, wilaya: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    placeholder="الجزائر العاصمة"
                  />
                </div>
              </div>

              {/* الفحص الطبي */}
              <div className="p-3 bg-slate-800/60 border border-slate-700/80 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="medicalClearance"
                    checked={!!formData.medicalClearance}
                    onChange={(e) => setFormData({ ...formData, medicalClearance: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0"
                  />
                  <label htmlFor="medicalClearance" className="text-slate-200 font-semibold cursor-pointer">
                    شهادة الكفاءة الطبية سارية المفعول لموسم 2026
                  </label>
                </div>
                <input
                  type="date"
                  value={formData.medicalClearanceExpiry || '2026-12-31'}
                  onChange={(e) => setFormData({ ...formData, medicalClearanceExpiry: e.target.value })}
                  className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={hasBlockingDuplicate && !forceOverride}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-950/40"
                >
                  {editingAthlete ? 'تحديث البيانات' : 'حفظ العداء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* نافذة عرض وإضافة الأرقام القياسية الشخصية (PB / SB) */}
      {/* ═══════════════════════════════════════════════════ */}
      {viewingRecordsAthlete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl p-6 text-right max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">
                  السجلات القياسية: {viewingRecordsAthlete.firstName} {viewingRecordsAthlete.lastName}
                </h3>
              </div>
              <button onClick={() => setViewingRecordsAthlete(null)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* الأرقام القياسية الشخصية PB */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-amber-400 uppercase tracking-wider">
                  الأرقام القياسية الشخصية (Personal Bests - PB)
                </span>
                <span className="text-[10px] text-slate-400">{viewingRecordsAthlete.personalBests.length} أرقام</span>
              </div>
              {viewingRecordsAthlete.personalBests.length === 0 ? (
                <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl text-center text-slate-400 text-xs">
                  لا توجد أرقام قياسية مسجلة بعد.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {viewingRecordsAthlete.personalBests.map((r, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">{r.eventName} ({r.eventCode})</div>
                        <div className="text-[10px] text-slate-400">{r.date} • {r.venue || 'غير محدد'}</div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-amber-300">{r.recordValue}</span>
                        {r.wind && <div className="text-[10px] text-slate-400 font-mono">رياح: {r.wind}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* أرقام الموسم الحالي SB */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-blue-400 uppercase tracking-wider">
                  أفضل أرقام الموسم (Season Bests - SB)
                </span>
                <span className="text-[10px] text-slate-400">{viewingRecordsAthlete.seasonBests.length} أرقام</span>
              </div>
              {viewingRecordsAthlete.seasonBests.length === 0 ? (
                <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl text-center text-slate-400 text-xs">
                  لا توجد أرقام مسجلة للموسم الحالي.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {viewingRecordsAthlete.seasonBests.map((r, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">{r.eventName} ({r.eventCode})</div>
                        <div className="text-[10px] text-slate-400">{r.date} • {r.venue || 'غير محدد'}</div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-blue-300">{r.recordValue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* زر إضافة رقم جديد */}
            {!isAddingRecord ? (
              <button
                onClick={() => setIsAddingRecord(true)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة رقم قياسي جديد</span>
              </button>
            ) : (
              <div className="p-3 bg-slate-800/90 border border-slate-700 rounded-xl space-y-3 text-xs">
                <div className="font-bold text-white">إضافة توقيت / مسافة جديدة</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">نوع الرقم</label>
                    <select
                      value={newRecordType}
                      onChange={(e) => setNewRecordType(e.target.value as 'PB' | 'SB')}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    >
                      <option value="PB">رقم شخصي (Personal Best - PB)</option>
                      <option value="SB">أفضل رقم للموسم (Season Best - SB)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">النتيجة المسجلة (مثلاً 10.12s أو 28:40)</label>
                    <input
                      type="text"
                      value={newRecordForm.recordValue}
                      onChange={(e) => setNewRecordForm({ ...newRecordForm, recordValue: e.target.value })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                      placeholder="10.12s"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">اسم الاختصاص</label>
                    <input
                      type="text"
                      value={newRecordForm.eventName}
                      onChange={(e) => setNewRecordForm({ ...newRecordForm, eventName: e.target.value, eventCode: e.target.value })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                      placeholder="100 متر"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">مكان البطولة</label>
                    <input
                      type="text"
                      value={newRecordForm.venue || ''}
                      onChange={(e) => setNewRecordForm({ ...newRecordForm, venue: e.target.value })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                      placeholder="ملعب 5 جويلية"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsAddingRecord(false)}
                    className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleAddRecord}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold"
                  >
                    حفظ الرقم
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
