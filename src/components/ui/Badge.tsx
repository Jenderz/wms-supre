import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
          {
            'bg-slate-100 text-slate-700 border-slate-200': variant === 'default',
            'bg-emerald-50 text-emerald-700 border-emerald-200': variant === 'success',
            'bg-amber-50 text-amber-700 border-amber-200': variant === 'warning',
            'bg-red-50 text-red-700 border-red-200': variant === 'danger',
            'bg-blue-50 text-blue-700 border-blue-200': variant === 'info',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
