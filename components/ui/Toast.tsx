'use client';

import { useEffect, useState } from 'react';
import { cx } from '@/lib/cx';

type ToastTone = 'success' | 'error' | 'info';

interface ToastEvent {
  id: number;
  message: string;
  tone: ToastTone;
}

let nextId = 1;
let listeners: Array<(t: ToastEvent) => void> = [];

export function toast(message: string, tone: ToastTone = 'info') {
  const event: ToastEvent = { id: nextId++, message, tone };
  listeners.forEach((fn) => fn(event));
}

const toneClasses: Record<ToastTone, string> = {
  success: 'border-success/40 [--dot:var(--success)]',
  error:   'border-danger/40 [--dot:var(--danger)]',
  info:    'border-accent/40 [--dot:var(--accent)]',
};

export function ToastRoot() {
  const [items, setItems] = useState<ToastEvent[]>([]);

  useEffect(() => {
    const fn = (t: ToastEvent) => {
      setItems((prev) => [...prev, t]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((p) => p.id !== t.id));
      }, 4000);
    };
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex items-center gap-3 rounded-xl bg-surface border border-sep px-4 py-3 text-sm text-text shadow-[0_12px_32px_-16px_rgba(0,0,0,0.6)]',
            toneClasses[t.tone],
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[var(--dot)]" />
          <span className="flex-1 leading-snug">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
