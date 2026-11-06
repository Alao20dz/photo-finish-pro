/**
 * Photo Finish Pro — شارة موحّدة (Design Token Badge)
 * ==================================================
 * شارات الحالة: محايدة/هوية/تمييز/نجاح/تحذير/خطر. نص من المستدعي (لا i18n).
 */
import React from 'react';
import { cn } from '../../utils/cn';

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** نقطة تنبيه نابضة أمام النص */
  pulse?: boolean;
}

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-800 text-slate-300 border-slate-700',
  primary:
    'bg-[var(--pf-primary-soft,rgba(245,158,11,0.35))] text-[var(--pf-primary,#f59e0b)] border-[var(--pf-primary,#f59e0b)]/40',
  accent:
    'bg-[var(--pf-accent-soft,rgba(6,182,212,0.35))] text-[var(--pf-accent,#06b6d4)] border-[var(--pf-accent,#06b6d4)]/40',
  success: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
  warning: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
  danger: 'bg-red-950/80 text-red-300 border-red-500/40',
};

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', pulse = false, className, children, ...rest }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap',
      TONES[tone],
      className
    )}
    {...rest}
  >
    {pulse && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
    {children}
  </span>
);
