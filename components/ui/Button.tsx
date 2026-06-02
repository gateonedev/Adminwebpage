'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle';
type Size = 'md' | 'sm';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-[transform,background-color,border-color,opacity] duration-150 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-[#2563eb] border border-transparent',
  ghost:
    'bg-transparent text-text hover:bg-surfaceUp border border-transparent',
  danger:
    'bg-danger text-white hover:bg-[#dc2626] border border-transparent',
  subtle:
    'bg-surface text-text hover:bg-surfaceUp border border-sep',
};

const sizeClasses: Record<Size, string> = {
  md: 'h-11 px-4 text-[15px]',
  sm: 'h-9 px-3 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(base, variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        children
      )}
    </button>
  );
});
