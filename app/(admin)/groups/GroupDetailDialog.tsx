'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from '@phosphor-icons/react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { cx } from '@/lib/cx';
import type { GroupRow } from './GroupsPageClient';

interface UserLite    { id: string; full_name: string; status: string }
interface BarrierLite { id: string; name: string }

interface Props {
  group: GroupRow | null;
  onOpenChange: (open: boolean) => void;
  availableUsers: UserLite[];
  availableBarriers: BarrierLite[];
  onError: (message: string) => void;
  onChanged: () => void;
}

export function GroupDetailDialog({
  group,
  onOpenChange,
  availableUsers,
  availableBarriers,
  onError,
  onChanged,
}: Props) {
  const [members, setMembers] = useState<UserLite[]>([]);
  const [barriers, setBarriers] = useState<BarrierLite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showBarrierPicker, setShowBarrierPicker] = useState(false);

  useEffect(() => {
    let aborted = false;
    if (!group) return;

    setLoaded(false);
    setMembers([]);
    setBarriers([]);
    setShowMemberPicker(false);
    setShowBarrierPicker(false);

    const supabase = createClient();
    Promise.all([
      supabase
        .from('group_members')
        .select('user_id, users(id, full_name, status)')
        .eq('group_id', group.id),
      supabase
        .from('group_barrier_access')
        .select('barrier_id, barriers(id, name)')
        .eq('group_id', group.id),
    ]).then(([memRes, barRes]) => {
      if (aborted) return;
      const mem = (memRes.data ?? [])
        .map((r: any) => r.users as UserLite | null)
        .filter((u): u is UserLite => !!u);
      const bar = (barRes.data ?? [])
        .map((r: any) => r.barriers as BarrierLite | null)
        .filter((b): b is BarrierLite => !!b);
      setMembers(mem);
      setBarriers(bar);
      setLoaded(true);
    });

    return () => {
      aborted = true;
    };
  }, [group]);

  if (!group) return null;

  const memberIds = new Set(members.map((u) => u.id));
  const barrierIds = new Set(barriers.map((b) => b.id));
  const candidateUsers = availableUsers.filter((u) => !memberIds.has(u.id));
  const candidateBarriers = availableBarriers.filter((b) => !barrierIds.has(b.id));

  async function addMember(user: UserLite) {
    setBusy(`add-member:${user.id}`);
    const supabase = createClient();
    const { error } = await supabase
      .from('group_members')
      .insert({ group_id: group!.id, user_id: user.id });
    setBusy(null);
    if (error) {
      onError(`Eklenemedi: ${error.message}`);
      return;
    }
    setMembers((prev) => [...prev, user].sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr')));
    setShowMemberPicker(false);
    onChanged();
  }

  async function removeMember(user: UserLite) {
    setBusy(`rem-member:${user.id}`);
    const supabase = createClient();
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', group!.id)
      .eq('user_id', user.id);
    setBusy(null);
    if (error) {
      onError(`Kaldırılamadı: ${error.message}`);
      return;
    }
    setMembers((prev) => prev.filter((u) => u.id !== user.id));
    onChanged();
  }

  async function addBarrier(barrier: BarrierLite) {
    setBusy(`add-barrier:${barrier.id}`);
    const supabase = createClient();
    const { error } = await supabase
      .from('group_barrier_access')
      .insert({ group_id: group!.id, barrier_id: barrier.id });
    setBusy(null);
    if (error) {
      onError(`Eklenemedi: ${error.message}`);
      return;
    }
    setBarriers((prev) => [...prev, barrier].sort((a, b) => a.name.localeCompare(b.name, 'tr')));
    setShowBarrierPicker(false);
    onChanged();
  }

  async function removeBarrier(barrier: BarrierLite) {
    setBusy(`rem-barrier:${barrier.id}`);
    const supabase = createClient();
    const { error } = await supabase
      .from('group_barrier_access')
      .delete()
      .eq('group_id', group!.id)
      .eq('barrier_id', barrier.id);
    setBusy(null);
    if (error) {
      onError(`Kaldırılamadı: ${error.message}`);
      return;
    }
    setBarriers((prev) => prev.filter((b) => b.id !== barrier.id));
    onChanged();
  }

  return (
    <Dialog
      open={!!group}
      onOpenChange={onOpenChange}
      title={group.name}
      description="Üyeleri ve yetkili olduğu bariyerleri yönetin."
      size="lg"
    >
      {!loaded ? (
        <p className="text-sm text-textMuted">Yükleniyor…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Section
            title="Üyeler"
            count={members.length}
            onAdd={() => setShowMemberPicker((v) => !v)}
            picking={showMemberPicker}
          >
            {members.length === 0 && !showMemberPicker && (
              <EmptyHint label="Henüz üye yok." />
            )}
            {!showMemberPicker && members.map((u) => (
              <Row
                key={u.id}
                label={u.full_name}
                onRemove={() => removeMember(u)}
                disabled={busy === `rem-member:${u.id}`}
              />
            ))}
            {showMemberPicker && (
              candidateUsers.length === 0 ? (
                <EmptyHint label="Eklenecek aktif sakin yok." />
              ) : (
                candidateUsers.map((u) => (
                  <PickRow
                    key={u.id}
                    label={u.full_name}
                    onPick={() => addMember(u)}
                    disabled={busy === `add-member:${u.id}`}
                  />
                ))
              )
            )}
          </Section>

          <Section
            title="Bariyerler"
            count={barriers.length}
            onAdd={() => setShowBarrierPicker((v) => !v)}
            picking={showBarrierPicker}
          >
            {barriers.length === 0 && !showBarrierPicker && (
              <EmptyHint label="Henüz bariyer yetkisi yok." />
            )}
            {!showBarrierPicker && barriers.map((b) => (
              <Row
                key={b.id}
                label={b.name}
                onRemove={() => removeBarrier(b)}
                disabled={busy === `rem-barrier:${b.id}`}
              />
            ))}
            {showBarrierPicker && (
              candidateBarriers.length === 0 ? (
                <EmptyHint label="Eklenecek bariyer yok." />
              ) : (
                candidateBarriers.map((b) => (
                  <PickRow
                    key={b.id}
                    label={b.name}
                    onPick={() => addBarrier(b)}
                    disabled={busy === `add-barrier:${b.id}`}
                  />
                ))
              )
            )}
          </Section>
        </div>
      )}
    </Dialog>
  );
}

function Section({
  title,
  count,
  onAdd,
  picking,
  children,
}: {
  title: string;
  count: number;
  onAdd: () => void;
  picking: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs uppercase tracking-wider text-textMuted">
          {title} <span className="text-textMuted/70 font-mono">({count})</span>
        </h4>
        <Button variant="subtle" size="sm" onClick={onAdd}>
          {picking ? <X size={14} /> : <Plus size={14} weight="bold" />}
          {picking ? 'Kapat' : 'Ekle'}
        </Button>
      </div>
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  );
}

function Row({ label, onRemove, disabled }: { label: string; onRemove: () => void; disabled: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 h-10 rounded-[10px] border border-sep bg-surface text-sm text-text">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Kaldır"
        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-textMuted hover:text-danger hover:bg-dangerDim transition-colors disabled:opacity-50"
      >
        <X size={14} weight="bold" />
      </button>
    </li>
  );
}

function PickRow({ label, onPick, disabled }: { label: string; onPick: () => void; disabled: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className={cx(
          'w-full flex items-center justify-between gap-3 px-3 h-10 rounded-[10px] border border-sep bg-surface text-sm text-textSec hover:text-accent hover:bg-accentDim transition-colors text-left',
          disabled && 'opacity-50',
        )}
      >
        <span className="truncate">{label}</span>
        <Plus size={14} weight="bold" className="text-textMuted" />
      </button>
    </li>
  );
}

function EmptyHint({ label }: { label: string }) {
  return <li className="text-sm text-textMuted py-2">{label}</li>;
}
