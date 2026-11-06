/**
 * Photo Finish Pro — زر النظام الموحّد (Design Token Button)
 * =========================================================
 * - ألوان من متغيرات الثيم ‎--pf-*‎ (هوية الرابطة) مع سقوط آمن للافتراضي.
 * - خاصيات منطقية فقط (ms/me) — ينعكس تلقائياً بين RTL/LTR.
 * - بلا i18n ولا Supabase: النص والأيقونة يأتيان من المستدعي.
 */
import React from 'react';
import { cn } from '../../utils/cn';

export type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'outline' | 'danger' | 'success';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** يعرض دائرة تحميل ويعطل الزر */
  loading?: boolean;
  /** امتداد العرض الكامل داخل الحاوية */
  block?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  // الهوية الأساسية: تعتمد متغير الثيم مع ظل ناعم
  primary:
    'bg-[var(--pf-primary,#f59e0b)] text-slate-950 font-black hover:brightness-110 shadow-[0_4px_14px_var(--pf-primary-soft,rgba(245,158,11,0.35))] border border-transparent',
  accent:
    'bg-[var(--pf-accent,#06b6d4)] text-slate-950 font-black hover:brightness-110 shadow-[0_4px_14px_var(--pf-accent-soft,rgba(6,182,212,0.35))] border border-transparent',
  ghost:
    'bg-slate-800/70 hover:bg-slate-700/80 text-slate-200 border border-slate-700/70',
  outline:
    'bg-transparent hover:bg-slate-800/60 text-[var(--pf-primary,#f59e0b)] border border-[var(--pf-primary,#f59e0b)]/50',
  danger:
    'bg-red-600 hover:bg-red-500 text-white font-bold border border-red-400/40 shadow-[0_4px_14px_rgba(220,38,38,0.25)]',
  success:
    'bg-emerald-600 hover:bg-emerald-500 text-white font-bold border border-emerald-400/40 shadow-[0_4px_14px_rgba(5,150,105,0.25)]',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'text-[10px] px-2 py-1 gap-1 rounded-lg',
  sm: 'text-xs px-2.5 py-1.5 gap-1.5 rounded-xl',
  md: 'text-sm px-4 py-2 gap-2 rounded-xl',
  lg: 'text-base px-5 py-3 gap-2 rounded-2xl',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, block = false, className, disabled, children, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-bold transition-all active:scale-[0.97] cursor-pointer select-none',
        'disabled:opacity-50 disabled:pointer-events-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pf-accent,#06b6d4)]',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="inline-block w-3.5 h-3.5 me-1.5 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      )}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
