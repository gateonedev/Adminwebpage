'use client';

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/lib/cx';

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, hint, optional, children, className }: FieldProps) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <div className="flex items-baseline gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-textSec">
          {label}
        </label>
        {optional && <span className="text-xs text-textMuted">isteğe bağlı</span>}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-danger ml-0.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-textMuted ml-0.5">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  'w-full rounded-[10px] bg-surfaceUp text-text px-4 py-3 text-[15px] border border-white/[0.06] outline-none transition-colors focus:border-accent/40 placeholder:text-textMuted disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { error?: boolean }>(function Input(
  { className, error, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cx(inputBase, error && 'border-danger/60 focus:border-danger', className)}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }>(function Textarea(
  { className, error, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cx(inputBase, 'min-h-[88px] resize-y', error && 'border-danger/60 focus:border-danger', className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }>(function Select(
  { className, error, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cx(inputBase, 'pr-10 appearance-none cursor-pointer', error && 'border-danger/60 focus:border-danger', className)}
      {...rest}
    >
      {children}
    </select>
  );
});
