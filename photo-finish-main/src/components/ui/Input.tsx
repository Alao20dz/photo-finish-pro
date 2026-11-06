/**
 * Photo Finish Pro — حقل إدخال موحّد (Design Token Input)
 * ======================================================
 * تسمية + حقل + رسالة خطأ/مساعدة. منطقي الاتجاه، يعمل RTL/LTR بلا تعديل.
 */
import React from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  error?: string | null;
  hint?: string | null;
  /** معرّف الحقل — يُشتق تلقائياً من name إن أهمل */
  id?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...rest }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? rest.name ?? autoId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-slate-300 mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          className={cn(
            'w-full bg-slate-950/70 text-slate-100 text-sm rounded-xl border px-3 py-2.5',
            'placeholder:text-slate-500 transition-colors',
            'focus:outline-2 focus:outline-offset-0 focus:outline-[var(--pf-accent,#06b6d4)]',
            error
              ? 'border-red-500/70 focus:outline-red-500'
              : 'border-slate-700/80 focus:border-[var(--pf-accent,#06b6d4)]/60',
            className
          )}
          {...rest}
        />
        {error ? (
          <p role="alert" className="text-[11px] font-bold text-red-400 mt-1">{error}</p>
        ) : hint ? (
          <p className="text-[11px] text-slate-500 mt-1">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
