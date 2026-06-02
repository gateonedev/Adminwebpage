'use client';

import { DotsThree, PencilSimple, Trash } from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { Site } from '@/lib/types';

interface Props {
  sites: Site[];
  onEdit: (s: Site) => void;
  onDelete: (s: Site) => void;
}

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function SitesTable({ sites, onEdit, onDelete }: Props) {
  return (
    <div className="border-t border-sep divide-y divide-sep">
      <div className="grid grid-cols-[1fr_1.5fr_auto_auto] gap-4 px-3 py-3 text-[11px] uppercase tracking-wider text-textMuted">
        <div>Ad</div>
        <div>Adres</div>
        <div>Eklendi</div>
        <div className="w-8" />
      </div>
      {sites.map((s) => (
        <div
          key={s.id}
          className="grid grid-cols-[1fr_1.5fr_auto_auto] gap-4 px-3 py-4 items-center hover:bg-surface/40 transition-colors"
        >
          <div className="font-medium">{s.name}</div>
          <div className="text-sm text-textSec truncate">
            {s.address || <span className="text-textMuted">—</span>}
          </div>
          <div className="text-sm text-textMuted font-mono">
            {dateFormatter.format(new Date(s.created_at))}
          </div>
          <RowMenu onEdit={() => onEdit(s)} onDelete={() => onDelete(s)} />
        </div>
      ))}
    </div>
  );
}

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-textMuted hover:text-text hover:bg-surfaceUp transition-colors"
          aria-label="İşlemler"
        >
          <DotsThree size={20} weight="bold" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="min-w-[160px] rounded-[10px] border border-sep bg-surface p-1 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.6)] z-50"
        >
          <DropdownMenu.Item
            onSelect={onEdit}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none data-[highlighted]:bg-surfaceUp"
          >
            <PencilSimple size={15} />
            Düzenle
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onDelete}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none text-danger data-[highlighted]:bg-dangerDim"
          >
            <Trash size={15} />
            Sil
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
