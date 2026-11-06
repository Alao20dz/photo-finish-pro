import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, Search, CheckCircle2, XCircle, Clock, 
  AlertTriangle, Check, X, History, Sparkles
} from 'lucide-react';
import { useAthleteStore } from '../../stores/athleteStore';
import { 
  CompetitionRegistration, 
  RegistrationAuditEntry 
} from '../../types/athletics';
import { coachWorkflowService } from '../../services/coachWorkflowService';

interface RegistrationApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RegistrationApprovalModal: React.FC<RegistrationApprovalModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { clubs } = useAthleteStore();

  const [registrations, setRegistrations] = useState<CompetitionRegistration[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedClubFilter, setSelectedClubFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // نماذج الاعتماد والرفض
  const [rejectingReg, setRejectingReg] = useState<CompetitionRegistration | null>(null);
  const [rejectionReason, setRejectionReason] = useState('شهادة الكفاءة الطبية غير سارية');
  const [bibAssignMap, setBibAssignMap] = useState<Record<string, number>>({});

  // سجل التدقيق المعروض
  const [viewingAuditRegId, setViewingAuditRegId] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<RegistrationAuditEntry[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    const list = await coachWorkflowService.getRegistrations();
    setRegistrations(list);

    // ملء مبدئي لأرقام الصدريات المقترحة
    const map: Record<string, number> = {};
    let nextBib = 101;
    list.forEach((r) => {
      map[r.id] = r.bibAssigned || nextBib++;
    });
    setBibAssignMap(map);
  };

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      if (selectedClubFilter !== 'ALL' && r.clubId !== selectedClubFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase().trim();
        const text = `${r.athleteName} ${r.licenseNumber} ${r.clubName} ${r.coachName}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [registrations, selectedClubFilter, statusFilter, searchFilter]);

  const stats = useMemo(() => {
    const total = registrations.length;
    const submitted = registrations.filter((r) => r.status === 'submitted').length;
    const approved = registrations.filter((r) => r.status === 'approved').length;
    const rejected = registrations.filter((r) => r.status === 'rejected').length;
    return { total, submitted, approved, rejected };
  }, [registrations]);

  const handleApprove = async (reg: CompetitionRegistration) => {
    const bib = bibAssignMap[reg.id] || reg.bibAssigned || Math.floor(100 + Math.random() * 900);
    await coachWorkflowService.reviewRegistration(reg.id, 'approved', {
      bibAssigned: bib,
      reviewerId: 'chief_judge',
      reviewerName: 'المدير الفني للبطولة',
    });
    loadData();
  };

  const handleOpenReject = (reg: CompetitionRegistration) => {
    setRejectingReg(reg);
    setRejectionReason('شهادة الكفاءة الطبية غير سارية لموسم 2026');
  };

  const handleConfirmReject = async () => {
    if (!rejectingReg) return;
    await coachWorkflowService.reviewRegistration(rejectingReg.id, 'rejected', {
      rejectionReason,
      reviewerId: 'chief_judge',
      reviewerName: 'المدير الفني للبطولة',
    });
    setRejectingReg(null);
    loadData();
  };

  const handleBulkApprove = async () => {
    const pendingIds = filteredRegistrations
      .filter((r) => r.status === 'submitted' && r.medicalClearanceValid)
      .map((r) => r.id);

    if (pendingIds.length === 0) {
      alert('لا توجد طلبات معلقة ومستوفية للشروط الطبية للاعتماد الجماعي.');
      return;
    }

    if (window.confirm(`هل تريد اعتماد جميع الطلبات المستوفية (${pendingIds.length} طلب) دفعة واحدة؟`)) {
      await coachWorkflowService.bulkApprove(pendingIds, {
        id: 'chief_judge',
        name: 'المدير الفني للبطولة',
      });
      loadData();
    }
  };

  const handleViewAudit = async (regId: string) => {
    setViewingAuditRegId(regId);
    const history = await coachWorkflowService.getAuditHistory(regId);
    setAuditEntries(history);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-4 text-white overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 bg-slate-800/80 border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">مركز اعتماد طلبات المشاركة والصدريات</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  TECHNICAL APPROVALS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">فحص طلبات الأندية، تدقيق الفحص الطبي، تخصيص أرقام الصدريات والاعتماد الرسمي</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {stats.submitted > 0 && (
              <button
                onClick={handleBulkApprove}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition shadow-lg shadow-emerald-950/40 active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>اعتماد جميع المستوفين ({stats.submitted})</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ملخص إحصائي وشريط تصفية */}
        <div className="p-4 bg-slate-900/60 border-b border-slate-800 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between">
              <span className="text-slate-400">إجمالي الطلبات</span>
              <span className="font-bold text-white text-base">{stats.total}</span>
            </div>
            <div className="p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-center justify-between">
              <span className="text-amber-300">قيد المراجعة</span>
              <span className="font-bold text-amber-400 text-base">{stats.submitted}</span>
            </div>
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between">
              <span className="text-emerald-300">معتمدة رسمياً</span>
              <span className="font-bold text-emerald-400 text-base">{stats.approved}</span>
            </div>
            <div className="p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-xl flex items-center justify-between">
              <span className="text-rose-300">مرفوضة</span>
              <span className="font-bold text-rose-400 text-base">{stats.rejected}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث بالاسم، رقم الرخصة، النادي، أو المدرب..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-3 pr-9 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedClubFilter}
                onChange={(e) => setSelectedClubFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">جميع الأندية ({clubs.length})</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="submitted">قيد المراجعة فقط</option>
                <option value="approved">معتمدة فقط</option>
                <option value="rejected">مرفوضة فقط</option>
              </select>
            </div>
          </div>
        </div>

        {/* جدول الطلبات */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredRegistrations.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <ShieldCheck className="w-12 h-12 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium">لا توجد طلبات مشاركة تطابق خيارات التصفية.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-3">العداء</th>
                    <th className="py-3 px-3">النادي والولاية</th>
                    <th className="py-3 px-3">الفئة المحسوبة</th>
                    <th className="py-3 px-3">الاختصاصات</th>
                    <th className="py-3 px-3 text-center">الفحص الطبي</th>
                    <th className="py-3 px-3">المدرب وتاريخ الطلب</th>
                    <th className="py-3 px-3 text-center">رقم الصدرية</th>
                    <th className="py-3 px-3 text-center">الحالة</th>
                    <th className="py-3 px-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {filteredRegistrations.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white text-sm">{reg.athleteName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{reg.licenseNumber}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-200">{reg.clubName}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-blue-300">{reg.calculatedCategory}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-purple-300 font-mono">
                          {reg.targetEvents.join(', ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {reg.medicalClearanceValid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>سارٍ</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            <span>غير سارٍ</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-300">{reg.coachName}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(reg.submittedAt || reg.createdAt).toLocaleDateString('ar-DZ')}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {reg.status === 'approved' ? (
                          <span className="font-mono font-bold text-amber-300 text-sm px-2.5 py-0.5 bg-amber-950/40 border border-amber-500/40 rounded-lg">
                            #{reg.bibAssigned}
                          </span>
                        ) : (
                          <input
                            type="number"
                            value={bibAssignMap[reg.id] || ''}
                            onChange={(e) => setBibAssignMap({ ...bibAssignMap, [reg.id]: Number(e.target.value) })}
                            className="w-16 p-1 text-center bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="صدرية"
                          />
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {reg.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>معتمد</span>
                          </span>
                        ) : reg.status === 'submitted' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>قيد الفحص</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            <XCircle className="w-3 h-3 text-rose-400" />
                            <span>مرفوض</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {reg.status !== 'approved' && (
                            <button
                              onClick={() => handleApprove(reg)}
                              className="px-2.5 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                              title="اعتماد المشاركة"
                            >
                              <Check className="w-3 h-3" />
                              <span>اعتماد</span>
                            </button>
                          )}
                          {reg.status !== 'rejected' && (
                            <button
                              onClick={() => handleOpenReject(reg)}
                              className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-bold transition flex items-center gap-1"
                              title="رفض المشاركة مع ذكر السبب"
                            >
                              <X className="w-3 h-3" />
                              <span>رفض</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleViewAudit(reg.id)}
                            className="p-1 hover:bg-slate-700/80 text-slate-400 hover:text-white rounded-lg transition"
                            title="عرض سجل تدقيق العمليات"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <div>
            اللجنة التقنية للمسابقات والتحكيم • القرارات موثقة دائماً في سجل التدقيق غير القابل للتلف
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
      {/* نافذة تحديد سبب الرفض */}
      {/* ═══════════════════════════════════════════════════ */}
      {rejectingReg && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 font-bold text-white text-base">
                <XCircle className="w-5 h-5 text-rose-400" />
                <span>رفض طلب مشاركة العداء ({rejectingReg.athleteName})</span>
              </div>
              <button onClick={() => setRejectingReg(null)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">سبب الرفض الرسمي (يظهر للمدرب والنادي) *</label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block mb-1">أسباب جاهزة سريعة:</span>
                {[
                  'شهادة الكفاءة الطبية غير سارية لموسم 2026',
                  'الفئة العمرية للعداء لا تطابق شروط مسابقة الأكابر',
                  'تجاوز العدد الأقصى المسموح به لممثلي النادي الواحد (4 عدائين)',
                  'رقم رخصة الاتحاد غير مطابق لسجلات المنظومة الوطنية',
                ].map((reason, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRejectionReason(reason)}
                    className="w-full p-1.5 text-right bg-slate-800/60 hover:bg-slate-800 rounded-lg text-[11px] text-slate-300 transition"
                  >
                    • {reason}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setRejectingReg(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleConfirmReject}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-rose-950/40"
                >
                  تأكيد الرفض الرسمي
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* نافذة سجل تدقيق الإجراءات */}
      {/* ═══════════════════════════════════════════════════ */}
      {viewingAuditRegId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 text-right max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 font-bold text-white text-base">
                <History className="w-5 h-5 text-blue-400" />
                <span>سجل تدقيق الطلب المعتمد (Audit Trail)</span>
              </div>
              <button onClick={() => setViewingAuditRegId(null)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {auditEntries.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">لا توجد عمليات مسجلة.</div>
              ) : (
                auditEntries.map((a) => (
                  <div key={a.id} className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        a.action === 'approve' 
                          ? 'bg-emerald-500/20 text-emerald-300' 
                          : a.action === 'reject' 
                          ? 'bg-rose-500/20 text-rose-300' 
                          : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {a.action === 'approve' ? 'اعتماد' : a.action === 'reject' ? 'رفض' : 'تقديم'}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(a.timestamp).toLocaleString('ar-DZ')}
                      </span>
                    </div>
                    <div className="font-semibold text-white">{a.details}</div>
                    <div className="text-[10px] text-slate-400">
                      القائم بالعملية: <strong className="text-slate-200">{a.performedByName}</strong> ({a.role})
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingAuditRegId(null)}
                className="px-4 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إغلاق السجل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
