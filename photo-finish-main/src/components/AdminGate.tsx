import React, { useState } from 'react';
import { Crown, Lock, ArrowRight, LogOut } from 'lucide-react';
import { AdminPortal } from '../admin/AdminPortal';

// ═══ بوابة الدخول إلى ADMIN SUITE (لوحة مدير المنظومة) ═══
// الوصول: أضف ?admin إلى رابط التطبيق ثم أدخل كلمة مرور المدير المعتمدة في البيئة (ADMIN_PORTAL_PASSWORD).
// المصادقة تتم عبر الخادم حصراً (لا توجد أي كلمات مرور في الواجهة الأمامية)
// مع فحص معدل المحاولات (Rate Limiting) ومقارنة ثابتة التوقيت وتوقيع Ed25519.
// NOTE أمني: يُمنع منعاً باتاً إضافة أي كلمة مرور افتراضية أو Fallback محلي هنا —
// أي كلمة مرور داخل حزمة الواجهة تعتبر مفتشاة عملاً (Zero Backdoors Policy).

const SESSION_KEY = 'pf_admin_portal_unlocked_v1';

export const AdminGate: React.FC = () => {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
  });
  const [input, setInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [shake, setShake] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = input.trim();
    if (!entered || loading) return;

    setLoading(true);
    setError('');

    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: entered })
      });

      const data = await resp.json().catch(() => ({}));
      const authToken = data.token || data.adminToken;

      if (resp.status === 429) {
        setError(data.error || 'تم تجاوز الحد الأقصى للمحاولات (5 محاولات). يرجى الانتظار 15 دقيقة.');
        setShake(true);
        setTimeout(() => setShake(false), 450);
        return;
      }

      if (resp.ok && (data.success || data.ok) && authToken) {
        try { 
          sessionStorage.setItem(SESSION_KEY, '1');
          sessionStorage.setItem('pf_admin_token', authToken);
        } catch { /* تخزين غير متاح */ }
        setUnlocked(true);
      } else {
        setError(data.error || 'رمز الدخول غير صحيح. يرجى استخدام كلمة مرور المدير المعتمدة في إعدادات الخادم (ADMIN_PORTAL_PASSWORD).');
        setShake(true);
        setTimeout(() => setShake(false), 450);
      }
    } catch (err) {
      setError('تعذر الوصول إلى خادم المصادقة. تأكد من تشغيل الخادم المحلي (run.bat أو relay-server) ثم أعد المحاولة.');
      setShake(true);
      setTimeout(() => setShake(false), 450);
    } finally {
      setLoading(false);
    }
  };

  const exitPortal = () => {
    try { 
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem('pf_admin_token');
    } catch { /* تخزين غير متاح */ }
    window.location.href = '/';
  };

  if (unlocked) {
    return (
      <div className="relative">
        <AdminPortal />
        <button
          onClick={exitPortal}
          className="fixed bottom-4 end-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold shadow-xl backdrop-blur transition-all active:scale-95"
          title="الخروج من لوحة الإدارة والعودة للتطبيق"
        >
          <LogOut className="w-4 h-4" />
          عودة للتطبيق
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className={`w-full max-w-sm bg-slate-900/80 border border-slate-800 rounded-3xl p-7 shadow-2xl ${shake ? 'animate-[pfShake_0.4s_ease]' : ''}`}>
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Crown className="w-8 h-8 text-slate-950" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">ADMIN SUITE</h1>
            <p className="text-xs text-slate-400 mt-1">لوحة إدارة التراخيص والاشتراكات — Photo Finish Pro</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <Lock className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="password"
              dir="ltr"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(''); }}
              placeholder="••••••••••••"
              autoFocus
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-2xl py-3 ps-10 pe-4 text-sm font-bold tracking-widest outline-none transition-colors"
              aria-label="رمز الدخول للمدير"
            />
          </div>
          {error && (
            <p className="text-xs text-red-400 font-bold flex items-center gap-1.5" role="alert">
              <Lock className="w-3.5 h-3.5" /> {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            {loading ? 'جاري التحقق الآمن...' : 'دخول لوحة الإدارة'}
          </button>
        </form>

        <a
          href="/"
          className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 font-bold transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          العودة إلى التطبيق
        </a>
      </div>

      <style>{`@keyframes pfShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }`}</style>
    </div>
  );
};

export default AdminGate;
