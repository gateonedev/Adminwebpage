'use client';

import { DotsThree, PencilSimple, Trash } from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Badge } from '@/components/ui/Badge';
import type { Barrier } from '@/lib/types';

interface Props {
  barriers: Barrier[];
  /** Silme super_admin-only (delete_barrier RPC'si de sunucuda zorlar). */
  canDelete: boolean;
  onEdit: (b: Barrier) => void;
  onDelete: (b: Barrier) => void;
}

function formatRelay(ms: number): string {
  if (ms >= 1000) {
    const s = ms / 1000;
    return `${ms % 1000 === 0 ? s.toFixed(0) : s.toFixed(1)}s`;
  }
  return `${ms}ms`;
}

export function BarriersTable({ barriers, canDelete, onEdit, onDelete }: Props) {
  return (
    <div className="border-t border-sep divide-y divide-sep">
      <div className="grid grid-cols-[1.4fr_1.6fr_auto_auto_auto_auto] gap-4 px-3 py-3 text-[11px] uppercase tracking-wider text-textMuted">
        <div>Ad</div>
        <div>BLE kimliği</div>
        <div>Röle</div>
        <div>RSSI</div>
        <div>Mod</div>
        <div className="w-8" />
      </div>
      {barriers.map((b) => (
        <div
          key={b.id}
          className="grid grid-cols-[1.4fr_1.6fr_auto_auto_auto_auto] gap-4 px-3 py-4 items-center hover:bg-surface/40 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: b.is_active ? 'var(--success)' : 'var(--text-muted)' }}
              aria-hidden
            />
            <span className="font-medium truncate">{b.name}</span>
          </div>
          <div className="text-sm text-textSec font-mono truncate">{b.ble_identifier}</div>
          <div className="text-sm text-textSec font-mono">{formatRelay(b.relay_duration_ms)}</div>
          <div className="text-sm text-textSec font-mono">{b.rssi_threshold} dBm</div>
          <div className="flex items-center gap-1.5">
            {!b.is_active && <Badge tone="warn">Pasif</Badge>}
            {b.hands_free_enabled && <Badge tone="accent">Elsiz</Badge>}
          </div>
          <RowMenu canDelete={canDelete} onEdit={() => onEdit(b)} onDelete={() => onDelete(b)} />
        </div>
      ))}
    </div>
  );
}

function RowMenu({
  canDelete,
  onEdit,
  onDelete,
}: {
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
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
          {canDelete && (
            <>
              <DropdownMenu.Separator className="h-px bg-sep my-1" />
              <DropdownMenu.Item
                onSelect={onDelete}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none text-danger data-[highlighted]:bg-dangerDim"
              >
                <Trash size={15} />
                Sil
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
