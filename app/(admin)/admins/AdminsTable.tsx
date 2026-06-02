'use client';

import { useTransition } from 'react';
import { DotsThree, PencilSimple, Key, Trash, PauseCircle, PlayCircle } from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Badge } from '@/components/ui/Badge';
import type { AdminUserRow } from '@/lib/types';
import { setAdminStatus } from './actions';

interface Props {
  admins: AdminUserRow[];
  currentUserId: string;
  onEdit: (a: AdminUserRow) => void;
  onReset: (a: AdminUserRow) => void;
  onDelete: (a: AdminUserRow) => void;
  onStatusChanged: (message: string) => void;
  onError: (message: string) => void;
}

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function AdminsTable({
  admins,
  currentUserId,
  onEdit,
  onReset,
  onDelete,
  onStatusChanged,
  onError,
}: Props) {
  return (
    <div className="border-t border-sep divide-y divide-sep">
      <div className="grid grid-cols-[1.4fr_1.6fr_auto_1fr_auto_auto] gap-4 px-3 py-3 text-[11px] uppercase tracking-wider text-textMuted">
        <div>Ad</div>
        <div>E-posta</div>
        <div>Rol</div>
        <div>Site</div>
        <div>Durum</div>
        <div className="w-8" />
      </div>
      {admins.map((a) => (
        <div
          key={a.id}
          className="grid grid-cols-[1.4fr_1.6fr_auto_1fr_auto_auto] gap-4 px-3 py-4 items-center hover:bg-surface/40 transition-colors"
        >
          <div className="flex flex-col min-w-0">
            <span className="font-medium truncate">{a.full_name || '—'}</span>
            <span className="text-[11px] text-textMuted font-mono">
              {dateFormatter.format(new Date(a.created_at))}
            </span>
          </div>
          <div className="text-sm text-textSec font-mono truncate">
            {a.email || <span className="text-textMuted">—</span>}
          </div>
          <div>
            <Badge tone={a.role === 'super_admin' ? 'accent' : 'muted'}>
              {a.role === 'super_admin' ? 'Süper' : 'Site'}
            </Badge>
          </div>
          <div className="text-sm text-textSec truncate">
            {a.role === 'super_admin' ? <span className="text-textMuted">—</span> : (a.sites?.name ?? <span className="text-textMuted">Atanmamış</span>)}
          </div>
          <div>
            <Badge tone={a.status === 'active' ? 'success' : a.status === 'suspended' ? 'warn' : 'muted'}>
              {a.status === 'active' ? 'Aktif' : a.status === 'suspended' ? 'Askıda' : a.status}
            </Badge>
          </div>
          <RowMenu
            admin={a}
            isSelf={a.id === currentUserId}
            onEdit={() => onEdit(a)}
            onReset={() => onReset(a)}
            onDelete={() => onDelete(a)}
            onStatusChanged={onStatusChanged}
            onError={onError}
          />
        </div>
      ))}
    </div>
  );
}

function RowMenu({
  admin,
  isSelf,
  onEdit,
  onReset,
  onDelete,
  onStatusChanged,
  onError,
}: {
  admin: AdminUserRow;
  isSelf: boolean;
  onEdit: () => void;
  onReset: () => void;
  onDelete: () => void;
  onStatusChanged: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  function toggleStatus() {
    const next = admin.status === 'suspended' ? 'active' : 'suspended';
    startTransition(async () => {
      const res = await setAdminStatus({ id: admin.id, status: next });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      onStatusChanged(next === 'active' ? 'Yönetici aktifleştirildi.' : 'Yönetici askıya alındı.');
    });
  }

  const canSuspend = !isSelf && admin.status !== 'pending' && admin.status !== 'rejected';
  const canDelete = !isSelf;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-textMuted hover:text-text hover:bg-surfaceUp transition-colors disabled:opacity-50"
          disabled={pending}
          aria-label="İşlemler"
        >
          <DotsThree size={20} weight="bold" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="min-w-[200px] rounded-[10px] border border-sep bg-surface p-1 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.6)] z-50"
        >
          <DropdownMenu.Item
            onSelect={onEdit}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none data-[highlighted]:bg-surfaceUp"
          >
            <PencilSimple size={15} />
            Düzenle
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onReset}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none data-[highlighted]:bg-surfaceUp"
          >
            <Key size={15} />
            Şifre sıfırla
          </DropdownMenu.Item>
          {canSuspend && (
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                toggleStatus();
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none data-[highlighted]:bg-surfaceUp"
            >
              {admin.status === 'suspended' ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
              {admin.status === 'suspended' ? 'Aktifleştir' : 'Askıya al'}
            </DropdownMenu.Item>
          )}
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
