import React, { useState, useMemo } from 'react';
import { 
  Building2, Search, Plus, X, Edit2, Trash2, 
  MapPin, User, Shield, Trophy
} from 'lucide-react';
import { useAthleteStore } from '../../stores/athleteStore';
import { Club } from '../../types/athletics';

interface ClubsDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClubsDatabaseModal: React.FC<ClubsDatabaseModalProps> = ({ isOpen, onClose }) => {
  const { clubs, athletes, saveClub, deleteClub } = useAthleteStore();

  const [searchFilter, setSearchFilter] = useState('');
  const [selectedWilayaFilter, setSelectedWilayaFilter] = useState('ALL');
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Club>>({
    code: '',
    name: '',
    shortName: '',
    wilaya: 'الجزائر العاصمة',
    city: '',
    foundedYear: 2000,
    presidentName: '',
    headCoachName: '',
    phone: '',
    email: '',
    colors: ['#10B981', '#EF4444'],
    medalsTally: { gold: 0, silver: 0, bronze: 0, total: 0 },
  });

  // استخراج قائمة الولايات المتوفرة للتصفية
  const wilayas = useMemo(() => {
    const set = new Set<string>();
    clubs.forEach((c) => {
      if (c.wilaya) set.add(c.wilaya);
    });
    return Array.from(set).sort();
  }, [clubs]);

  // تصفية الأندية المعروضة
  const filteredClubs = useMemo(() => {
    return clubs.filter((c) => {
      if (selectedWilayaFilter !== 'ALL' && c.wilaya !== selectedWilayaFilter) {
        return false;
      }
      if (searchFilter.trim()) {
        const q = searchFilter.trim().toLowerCase();
        const code = c.code.toLowerCase();
        const name = c.name.toLowerCase();
        const shortName = (c.shortName || '').toLowerCase();
        const wilaya = (c.wilaya || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !shortName.includes(q) && !wilaya.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [clubs, searchFilter, selectedWilayaFilter]);

  const handleOpenAddForm = () => {
    setEditingClub(null);
    setFormData({
      code: '',
      name: '',
      shortName: '',
      wilaya: 'الجزائر العاصمة',
      city: 'الجزائر',
      foundedYear: 2020,
      presidentName: '',
      headCoachName: '',
      phone: '',
      email: '',
      colors: ['#10B981', '#3B82F6'],
      medalsTally: { gold: 0, silver: 0, bronze: 0, total: 0 },
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (club: Club) => {
    setEditingClub(club);
    setFormData({ ...club });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.code || !formData.name || !formData.wilaya) {
      setFormError('يرجى ملء الحقول الإلزامية (رمز النادي، الاسم الرسمي، والولاية).');
      return;
    }

    const cleanCode = formData.code.trim().toUpperCase();
    // التحقق من عدم تكرار كود النادي
    const duplicate = clubs.find(
      (c) => c.code.toUpperCase() === cleanCode && (!editingClub || c.id !== editingClub.id)
    );
    if (duplicate) {
      setFormError(`رمز النادي (${cleanCode}) مسجل مسبقاً لنادي (${duplicate.name}).`);
      return;
    }

    const totalMedals = 
      (Number(formData.medalsTally?.gold) || 0) +
      (Number(formData.medalsTally?.silver) || 0) +
      (Number(formData.medalsTally?.bronze) || 0);

    const clubToSave: Club = {
      id: editingClub ? editingClub.id : `club_${cleanCode.toLowerCase()}`,
      code: cleanCode,
      name: formData.name.trim(),
      shortName: formData.shortName?.trim() || formData.name.trim(),
      wilaya: formData.wilaya.trim(),
      city: formData.city?.trim() || '',
      foundedYear: formData.foundedYear ? Number(formData.foundedYear) : undefined,
      presidentName: formData.presidentName?.trim(),
      headCoachName: formData.headCoachName?.trim(),
      phone: formData.phone?.trim(),
      email: formData.email?.trim(),
      colors: formData.colors || ['#10B981', '#EF4444'],
      activeAthletesCount: athletes.filter((a) => a.clubId === (editingClub?.id || `club_${cleanCode.toLowerCase()}`)).length,
      medalsTally: {
        gold: Number(formData.medalsTally?.gold) || 0,
        silver: Number(formData.medalsTally?.silver) || 0,
        bronze: Number(formData.medalsTally?.bronze) || 0,
        total: totalMedals,
      },
      createdAt: editingClub ? editingClub.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    await saveClub(clubToSave);
    setIsFormOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    const clubAthletes = athletes.filter((a) => a.clubId === id);
    if (clubAthletes.length > 0) {
      alert(`لا يمكن حذف النادي (${name}) لوجود (${clubAthletes.length}) عداء مسجل تحت لوائه. يرجى نقل العدائين أولاً.`);
      return;
    }

    if (window.confirm(`هل أنت متأكد من حذف بطاقة النادي (${name}) نهائياً؟`)) {
      await deleteClub(id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-4 text-white overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 bg-slate-800/80 border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">دليل الأندية والجمعيات الرياضية</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {clubs.length} نادٍ مسجل
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">سجل الهيئات الرياضية، الطاقم الفني، حصيلة الميداليات، والربط بالعدائين</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAddForm}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-emerald-950/40 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة نادٍ جديد</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث برمز النادي، الاسم، أو الولاية..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-3 pr-10 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedWilayaFilter}
              onChange={(e) => setSelectedWilayaFilter(e.target.value)}
              className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">جميع الولايات ({wilayas.length})</option>
              {wilayas.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Clubs Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {filteredClubs.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Building2 className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-base font-medium">لا توجد أندية تطابق خيارات البحث الحالية.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClubs.map((club) => {
                const count = athletes.filter((a) => a.clubId === club.id).length;
                return (
                  <div
                    key={club.id}
                    className="p-5 bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 rounded-2xl flex flex-col justify-between transition-all group shadow-md"
                  >
                    <div>
                      {/* Top Bar: Code and Badges */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-extrabold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            {club.code}
                          </span>
                          {club.foundedYear && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              تأسس {club.foundedYear}
                            </span>
                          )}
                        </div>

                        {/* Club Colors indicator */}
                        {club.colors && club.colors.length > 0 && (
                          <div className="flex items-center -space-x-1 space-x-reverse">
                            {club.colors.map((color, idx) => (
                              <div
                                key={idx}
                                className="w-4 h-4 rounded-full border-2 border-slate-800 shadow"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Club Name */}
                      <h3 className="font-bold text-white text-base group-hover:text-emerald-300 transition-colors mb-1">
                        {club.name}
                      </h3>
                      {club.shortName && club.shortName !== club.name && (
                        <div className="text-xs text-slate-400 mb-3 font-medium">{club.shortName}</div>
                      )}

                      {/* Details list */}
                      <div className="space-y-1.5 text-xs text-slate-300 mb-4">
                        <div className="flex items-center gap-2 text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{club.wilaya} {club.city ? `(${club.city})` : ''}</span>
                        </div>
                        {club.headCoachName && (
                          <div className="flex items-center gap-2 text-slate-400">
                            <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>المدرب: <strong className="text-slate-200">{club.headCoachName}</strong></span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-slate-400">
                          <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>العداؤون المسجلون: <strong className="text-blue-300">{count} عداء</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Medals Tally Bar */}
                    <div className="pt-3 border-t border-slate-700/60 mt-2">
                      <div className="flex items-center justify-between text-xs mb-3 bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-1 text-amber-400 font-bold" title="ميداليات ذهبية">
                          <span>🥇</span>
                          <span>{club.medalsTally.gold}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-300 font-bold" title="ميداليات فضية">
                          <span>🥈</span>
                          <span>{club.medalsTally.silver}</span>
                        </div>
                        <div className="flex items-center gap-1 text-amber-600 font-bold" title="ميداليات برونزية">
                          <span>🥉</span>
                          <span>{club.medalsTally.bronze}</span>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-400 font-extrabold pr-2 border-r border-slate-700" title="إجمالي الميداليات">
                          <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{club.medalsTally.total}</span>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditForm(club)}
                          className="flex items-center gap-1 px-3 py-1 bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>تعديل</span>
                        </button>
                        <button
                          onClick={() => handleDelete(club.id, club.name)}
                          className="p-1 hover:bg-red-950/60 text-red-400 rounded-lg transition-colors"
                          title="حذف النادي"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <div>منظومة الأندية والجمعيات الرياضية الوطنية • الاتحاد الجزائري لألعاب القوى</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* نافذة إضافة / تعديل النادي */}
      {/* ═══════════════════════════════════════════════════ */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl p-6 text-right max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2 font-bold text-lg text-white">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <span>{editingClub ? 'تعديل بيانات النادي' : 'إضافة نادٍ رياضي جديد'}</span>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 text-xs mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">رمز النادي (Code) *</label>
                  <input
                    type="text"
                    required
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold uppercase focus:outline-none focus:border-emerald-500"
                    placeholder="MCA"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 mb-1">الاسم الرسمي الكامل للنادي *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="نادي مولودية الجزائر لألعاب القوى"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">الاسم المختصر</label>
                  <input
                    type="text"
                    value={formData.shortName || ''}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="مولودية الجزائر"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">الولاية *</label>
                  <input
                    type="text"
                    required
                    value={formData.wilaya || ''}
                    onChange={(e) => setFormData({ ...formData, wilaya: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="الجزائر العاصمة"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">المدرب الرئيسي</label>
                  <input
                    type="text"
                    value={formData.headCoachName || ''}
                    onChange={(e) => setFormData({ ...formData, headCoachName: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="الكابتن عمار بوراس"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">سنة التأسيس</label>
                  <input
                    type="number"
                    value={formData.foundedYear || ''}
                    onChange={(e) => setFormData({ ...formData, foundedYear: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="1921"
                  />
                </div>
              </div>

              {/* Medals Tally Inputs */}
              <div className="p-3 bg-slate-800/60 border border-slate-700/80 rounded-xl">
                <div className="font-bold text-slate-200 mb-2">سجل الميداليات التاريخية</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-amber-400 text-[10px] mb-1">🥇 ذهب</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.medalsTally?.gold || 0}
                      onChange={(e) => setFormData({
                        ...formData,
                        medalsTally: {
                          gold: Number(e.target.value),
                          silver: formData.medalsTally?.silver || 0,
                          bronze: formData.medalsTally?.bronze || 0,
                          total: Number(e.target.value) + (formData.medalsTally?.silver || 0) + (formData.medalsTally?.bronze || 0),
                        }
                      })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-[10px] mb-1">🥈 فضة</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.medalsTally?.silver || 0}
                      onChange={(e) => setFormData({
                        ...formData,
                        medalsTally: {
                          gold: formData.medalsTally?.gold || 0,
                          silver: Number(e.target.value),
                          bronze: formData.medalsTally?.bronze || 0,
                          total: (formData.medalsTally?.gold || 0) + Number(e.target.value) + (formData.medalsTally?.bronze || 0),
                        }
                      })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-amber-600 text-[10px] mb-1">🥉 برونز</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.medalsTally?.bronze || 0}
                      onChange={(e) => setFormData({
                        ...formData,
                        medalsTally: {
                          gold: formData.medalsTally?.gold || 0,
                          silver: formData.medalsTally?.silver || 0,
                          bronze: Number(e.target.value),
                          total: (formData.medalsTally?.gold || 0) + (formData.medalsTally?.silver || 0) + Number(e.target.value),
                        }
                      })}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center"
                    />
                  </div>
                </div>
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-950/40"
                >
                  {editingClub ? 'تحديث النادي' : 'حفظ النادي'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
