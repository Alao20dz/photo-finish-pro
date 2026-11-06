import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserPlus, 
  Shield, 
  QrCode, 
  Copy, 
  Check, 
  ExternalLink 
} from 'lucide-react';
import { AthleticsJudge, AthleticsCompetition, JudgeRole } from '../../types/athletics';
import { checkpointStorage } from '../../services/checkpointStorage';
import { passageSyncEngine } from '../../services/passageSyncEngine';

interface JudgeManagementModalProps {
  competition: AthleticsCompetition;
  roomCode: string;
  onClose: () => void;
}

export const JudgeManagementModal: React.FC<JudgeManagementModalProps> = ({
  competition,
  roomCode,
  onClose,
}) => {
  const [judges, setJudges] = useState<AthleticsJudge[]>([]);
  const [newJudgeName, setNewJudgeName] = useState<string>('');
  const [newJudgeRole] = useState<JudgeRole>('checkpoint_judge');
  const [selectedCpId, setSelectedCpId] = useState<string>(competition.checkpoints[0]?.id || '');
  const [copiedJudgeId, setCopiedJudgeId] = useState<string | null>(null);
  const [selectedJudgeForQr, setSelectedJudgeForQr] = useState<AthleticsJudge | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const loadJudges = async () => {
    const list = await checkpointStorage.listJudges(competition.id);
    if (list.length === 0) {
      // إعداد حكام افتراضيين للنقاط
      const defaultJudges: AthleticsJudge[] = competition.checkpoints.map((cp, idx) => ({
        id: `judge_${idx + 1}`,
        name: `حكم ${cp.name}`,
        pinCode: String(1000 + idx + 1),
        role: cp.type === 'start' ? 'course_marshal' : 'checkpoint_judge',
        assignedCheckpointId: cp.id,
        assignedCompetitionId: competition.id,
        isOnline: false,
      }));
      for (const j of defaultJudges) {
        await checkpointStorage.saveJudge(j);
      }
      setJudges(defaultJudges);
    } else {
      setJudges(list);
    }
  };

  useEffect(() => {
    loadJudges();

    // الاستماع لنبضات حياة الحكام الميدانية
    const unsub = passageSyncEngine.onJudgeHeartbeat((heartbeatJudge) => {
      setJudges(prev => prev.map(j => {
        if (j.id === heartbeatJudge.id || j.deviceId === heartbeatJudge.deviceId) {
          return { ...j, ...heartbeatJudge, isOnline: true, lastSeen: Date.now() };
        }
        return j;
      }));
    });

    return () => unsub();
  }, [competition.id]);

  const handleAddJudge = async () => {
    if (!newJudgeName.trim()) return;

    const newJudge: AthleticsJudge = {
      id: `judge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newJudgeName.trim(),
      pinCode: String(Math.floor(1000 + Math.random() * 9000)),
      role: newJudgeRole,
      assignedCheckpointId: selectedCpId,
      assignedCompetitionId: competition.id,
      isOnline: false,
    };

    await checkpointStorage.saveJudge(newJudge);
    setJudges([...judges, newJudge]);
    setNewJudgeName('');
  };

  const getJudgeDirectLink = (judge: AthleticsJudge) => {
    const cp = competition.checkpoints.find(c => c.id === judge.assignedCheckpointId);
    return `${origin}/?role=checkpoint_judge&room=${roomCode}&comp=${competition.id}&cp=${cp?.id || ''}&judge=${judge.id}`;
  };

  const copyJudgeLink = (judge: AthleticsJudge) => {
    const url = getJudgeDirectLink(judge);
    navigator.clipboard.writeText(url);
    setCopiedJudgeId(judge.id);
    setTimeout(() => setCopiedJudgeId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-auto text-slate-100">
        {/* رأس النافذة */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">إدارة الحكام ونقاط التكليف</h2>
              <p className="text-xs text-slate-400">تعيين الحكام على نقاط المراقبة وتوليد روابط الدخول المباشر</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* نموذج إضافة حكم جديد */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>إضافة وتكليف حكم جديد</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <input 
                type="text" 
                placeholder="اسم الحكم الكامل" 
                value={newJudgeName} 
                onChange={e => setNewJudgeName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100"
              />
            </div>

            <div className="sm:col-span-4">
              <select 
                value={selectedCpId} 
                onChange={e => setSelectedCpId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100"
              >
                {competition.checkpoints.map(cp => (
                  <option key={cp.id} value={cp.id}>
                    {cp.code} - {cp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <button
                onClick={handleAddJudge}
                className="w-full h-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl transition shadow"
              >
                تكليف الحكم
              </button>
            </div>
          </div>
        </div>

        {/* جدول الحكام الحاليين وحالة الاتصال */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300">قائمة الحكام المكلفين ({judges.length})</h3>
            <span className="text-[11px] text-slate-400">يتم تحديث حالة الاتصال لحظياً عبر الشبكة المحلية</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto ps-1">
            {judges.map(judge => {
              const assignedCp = competition.checkpoints.find(c => c.id === judge.assignedCheckpointId);
              const isRecent = judge.lastSeen && (Date.now() - judge.lastSeen < 15000);

              return (
                <div 
                  key={judge.id}
                  className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isRecent ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
                    <div>
                      <h4 className="font-bold text-xs text-slate-100">{judge.name}</h4>
                      <p className="text-[11px] text-slate-400">
                        مكلف بـ: <span className="font-bold text-emerald-400">{assignedCp?.code || 'نقطة عامة'}</span> - {assignedCp?.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedJudgeForQr(judge)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-400 border border-slate-800 text-xs font-bold flex items-center gap-1 transition"
                      title="عرض رمز QR للدخول السريع من هاتف الحكم"
                    >
                      <QrCode className="w-4 h-4" />
                      <span className="hidden sm:inline">رمز الدخول</span>
                    </button>

                    <button
                      onClick={() => copyJudgeLink(judge)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs flex items-center gap-1 transition"
                      title="نسخ رابط الهاتف المباشر"
                    >
                      {copiedJudgeId === judge.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span className="hidden sm:inline">{copiedJudgeId === judge.id ? 'تم النسخ' : 'نسخ الرابط'}</span>
                    </button>

                    <a
                      href={getJudgeDirectLink(judge)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 transition"
                      title="فتح شاشة الحكم مباشرة في نافذة جديدة"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* نافذة عرض رمز الـ QR للحكم لتسهيل توزيعه في الميدان */}
        {selectedJudgeForQr && (
          <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
              <h3 className="font-bold text-base text-slate-100">رمز الدخول السريع للحكم</h3>
              <p className="text-xs text-emerald-400 font-bold">{selectedJudgeForQr.name}</p>
              
              <div className="p-4 bg-white rounded-2xl inline-block shadow-inner">
                {/* استخدام خدمة QR آمنة أو محلية */}
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getJudgeDirectLink(selectedJudgeForQr))}`}
                  alt="QR Code"
                  className="w-48 h-48 mx-auto"
                />
              </div>

              <p className="text-xs text-slate-400">
                امسح هذا الرمز بكاميرا هاتف الحكم للدخول الفوري لنقطة المراقبة الخاصة به دون أي إعداد يدوي.
              </p>

              <button
                onClick={() => setSelectedJudgeForQr(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
