'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { cx } from '@/lib/cx';
import { toast } from '@/components/ui/Toast';
import type { AppUser, UserStatus } from '@/lib/types';
import { UsersTable } from './UsersTable';
import { UserDetailDialog } from './UserDetailDialog';
import { BulkActionBar } from './BulkActionBar';

interface BarrierLite { id: string; name: string }
interface GroupLite   { id: string; name: string }

interface Props {
  siteId: string;
  initialUsers: AppUser[];
  barriers: BarrierLite[];
  groups: GroupLite[];
}

type Filter = 'all' | UserStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all',       label: 'Tümü' },
  { value: 'pending',   label: 'Beklemede' },
  { value: 'active',    label: 'Aktif' },
  { value: 'suspended', label: 'Askıda' },
  { value: 'rejected',  label: 'Reddedildi' },
  { value: 'archived',  label: 'Arşivlendi' },
];

function normalize(s: string | null | undefined): string {
  return (s ?? '').toLocaleLowerCase('tr');
}

export function UsersPageClient({ siteId, initialUsers, barriers, groups }: Props) {
  const router = useRouter();
  const users = initialUsers;
  const [filter, setFilter] = useState<Filter>(
    initialUsers.some((u) => u.status === 'pending') ? 'pending' : 'all',
  );
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<AppUser | null>(null);

  const counts = useMemo(() => {
    const c = { all: users.length, pending: 0, active: 0, suspended: 0, rejected: 0, archived: 0 } as Record<Filter, number>;
    for (const u of users) c[u.status as Filter]++;
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return users.filter((u) => {
      if (filter !== 'all' && u.status !== filter) return false;
      if (!q) return true;
      return (
        normalize(u.full_name).includes(q) ||
        normalize(u.email).includes(q) ||
        normalize(u.phone).includes(q) ||
        normalize(u.plate).includes(q) ||
        normalize(u.block_name).includes(q) ||
        normalize(u.apartment_no).includes(q)
      );
    });
  }, [users, filter, search]);

  // Drop selections that fall outside the current filter view so the bulk
  // bar can never act on something the admin can't see.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const visibleIds = new Set(filtered.map((u) => u.id));
    let changed = false;
    const next = new Set<string>();
    for (const id of selectedIds) {
      if (visibleIds.has(id)) next.add(id);
      else changed = true;
    }
    if (changed) setSelectedIds(next);
  }, [filtered, selectedIds]);

  function refresh() {
    setSelectedIds(new Set());
    router.refresh();
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((u) => prev.has(u.id));
      if (allSelected) {
        const next = new Set(prev);
        for (const u of filtered) next.delete(u.id);
        return next;
      }
      const next = new Set(prev);
      for (const u of filtered) next.add(u.id);
      return next;
    });
  }

  const selectedUsers = useMemo(
    () => users.filter((u) => selectedIds.has(u.id)),
    [users, selectedIds],
  );

  return (
    <>
      <div className="flex flex-col gap-4 mb-6">
        <div className="relative">
          <MagnifyingGlass
            size={16}
            weight="regular"
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara: ad, blok, daire, e-posta"
            className="w-full h-10 rounded-[10px] bg-surfaceUp border border-white/[0.06] pl-9 pr-9 text-sm text-text placeholder:text-textMuted outline-none focus:border-accent/40 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Temizle"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-textMuted hover:text-text hover:bg-surface transition-colors"
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cx(
                'h-8 px-3 inline-flex items-center gap-2 rounded-full border text-xs font-medium transition-colors',
                filter === f.value
                  ? 'bg-accentDim border-accent/40 text-accent'
                  : 'bg-surface border-sep text-textSec hover:text-text',
              )}
            >
              <span>{f.label}</span>
              <span className="font-mono text-textMuted">{counts[f.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <BulkActionBar
        siteId={siteId}
        selectedUsers={selectedUsers}
        onClear={() => setSelectedIds(new Set())}
        onSuccess={(message) => {
          toast(message, 'success');
          refresh();
        }}
        onError={(message) => toast(message, 'error')}
      />

      {filtered.length === 0 ? (
        <div className="border-t border-sep py-16 text-center">
          <p className="text-text font-medium">
            {search.trim() ? 'Aramaya uyan kullanıcı yok.' : 'Bu durumda kullanıcı yok.'}
          </p>
          <p className="mt-1 text-sm text-textSec">
            Filtreyi veya aramayı değiştirerek tüm kullanıcıları görüntüleyin.
          </p>
        </div>
      ) : (
        <UsersTable
          users={filtered}
          selectedIds={selectedIds}
          onToggleOne={toggleOne}
          onToggleAllVisible={toggleAllVisible}
          allVisibleSelected={filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id))}
          onSelect={setSelected}
        />
      )}

      <UserDetailDialog
        siteId={siteId}
        user={selected}
        onOpenChange={(o) => !o && setSelected(null)}
        barriers={barriers}
        groups={groups}
        onSuccess={(message) => {
          toast(message, 'success');
          setSelected(null);
          refresh();
        }}
        onError={(message) => toast(message, 'error')}
      />
    </>
  );
}
