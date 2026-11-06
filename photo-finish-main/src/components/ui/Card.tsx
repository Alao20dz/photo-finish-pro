/**
 * Photo Finish Pro — بطاقة النظام الموحّدة (Design Token Card)
 * ==========================================================
 * سطح داكن موحّد بحدود لون الرابطة اختيارياً. خاصيات منطقية حصراً.
 */
import React from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** إبراز بحد بلون الهوية (لل بطاقات المميزة) */
  highlighted?: boolean;
  /** نمط مبسّط بلا خلفية (للتجميع داخل بطاقة أم) */
  inset?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ highlighted = false, inset = false, className, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl',
        !inset && 'bg-slate-900/80 border border-slate-800 shadow-lg',
        inset && 'bg-slate-950/50 border border-slate-800/60',
        highlighted &&
          'border-[var(--pf-primary,#f59e0b)]/60 shadow-[0_0_24px_var(--pf-primary-soft,rgba(245,158,11,0.35))]',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
);
Card.displayName = 'Card';

/** رأس بطاقة موحّد: عنوان + إجراء اختياري */
export const CardHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, className }) => (
  <div className={cn('flex items-start justify-between gap-3 px-4 pt-4 pb-2', className)}>
    <div className="min-w-0">
      <h3 className="font-black text-sm sm:text-base text-slate-100 truncate">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const CardBody: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn('px-4 pb-4', className)}>{children}</div>
);
