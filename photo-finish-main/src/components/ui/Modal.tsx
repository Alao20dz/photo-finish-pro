/**
 * Photo Finish Pro — نافذة منبثقة موحّدة (Design Token Modal)
 * ==========================================================
 * - غطاء داكن + لوحة مركزية قابلة للتمرير، إغلاق بـ Esc وبالنقر على الغطاء.
 * - يمنع تمرير الخلفية أثناء العرض، ويعيد التركيز عند الإغلاق.
 * - الاتجاه يورَّث من ‎<html>‎ (i18n) — لا dir ثابت هنا.
 */
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** عرض اللوحة بفئة Tailwind (max-w-*) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  hideClose?: boolean;
  /** تعطيل الإغلاق بالنقر على الغطاء (للنوافذ الحرجة) */
  dismissable?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  hideClose = false,
  dismissable = true,
  children,
  footer,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastFocused.current?.focus?.();
    };
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 overflow-y-auto"
      onMouseDown={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl',
          'outline-none my-auto',
          SIZES[size]
        )}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-1">
            <div className="min-w-0">
              {title && <h2 className="font-black text-base sm:text-lg text-slate-100">{title}</h2>}
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="close"
                className="shrink-0 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        <div className="px-5 pb-5 pt-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-800">{footer}</div>}
      </div>
    </div>
  );
};
