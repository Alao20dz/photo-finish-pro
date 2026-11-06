import React, { useEffect, useState } from 'react';
import { Download, Smartphone, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * زر تثبيت التطبيق كـ PWA على الهاتف/الحاسوب
 * يظهر فقط عندما يكون التطبيق قابلاً للتثبيت ولم يكن مثبتاً بعد
 */
export const PwaInstallButton: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    // هل التطبيق يعمل بالفعل كتطبيق مثبت؟
    try {
      if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
        setIsInstalled(true);
      }
    } catch (e) {}

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (isInstalled || !installPrompt) return null;

  const handleInstall = async () => {
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null);
      }
    } catch (e) {
      console.warn('[PWA] Install failed:', e);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleInstall}
        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[10px] sm:text-xs shadow-sm active:scale-95 transition-all border border-emerald-400/40 shrink-0 cursor-pointer"
        title="ثبّت التطبيق على جهازك ليعمل بدون إنترنت في الملعب"
      >
        <Download className="w-3 h-3" />
        <span>تثبيت</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleInstall}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-500 text-white font-black text-xs sm:text-sm shadow-lg active:scale-[0.98] transition-all border border-emerald-400/40 cursor-pointer"
      title="ثبّت Photo Finish Pro على هذا الجهاز — يعمل بلا إنترنت"
    >
      <Smartphone className="w-4 h-4" />
      <span>ثبّت التطبيق على هذا الجهاز (يعمل بدون إنترنت 📶)</span>
      <Check className="w-4 h-4 opacity-80" />
    </button>
  );
};
