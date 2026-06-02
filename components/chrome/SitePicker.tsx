'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CaretDown } from '@phosphor-icons/react';
import { setActiveSite } from '@/lib/site-context-action';
import type { Site } from '@/lib/types';

interface Props {
  sites: Site[];
  activeSiteId: string | null;
}

export function SitePicker({ sites, activeSiteId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const active = sites.find((s) => s.id === activeSiteId) ?? null;

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    startTransition(async () => {
      await setActiveSite(id);
      router.refresh();
    });
  }

  if (sites.length === 0) {
    return (
      <span className="text-xs text-textMuted">
        Henüz site yok.
      </span>
    );
  }

  return (
    <label className="relative inline-flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wider text-textMuted">Site</span>
      <span className="relative">
        <select
          value={active?.id ?? ''}
          onChange={onChange}
          disabled={pending}
          className="appearance-none h-9 rounded-[10px] border border-sep bg-surface text-text text-sm pl-3 pr-8 hover:bg-surfaceUp transition-colors cursor-pointer focus:border-accent/40 outline-none disabled:opacity-50"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <CaretDown
          size={14}
          weight="bold"
          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted"
        />
      </span>
    </label>
  );
}
