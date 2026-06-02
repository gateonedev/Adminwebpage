'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md' }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <RadixDialog.Content
          className={cx(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface border border-sep shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] focus:outline-none',
            sizeClasses[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-sep">
            <div>
              <RadixDialog.Title className="text-[17px] font-semibold text-text leading-tight">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-sm text-textSec leading-relaxed">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label="Kapat"
              className="text-textMuted hover:text-text transition-colors p-1 -m-1 rounded"
            >
              <X size={18} weight="regular" />
            </RadixDialog.Close>
          </div>

          <div className="px-6 py-5">{children}</div>

          {footer && (
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-sep">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
