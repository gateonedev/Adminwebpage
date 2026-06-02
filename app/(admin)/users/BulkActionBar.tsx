'use client';

import { useState } from 'react';
import { CheckCircle, PauseCircle, PlayCircle, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { logAudit } from '@/lib/audit';
import type { AppUser } from '@/lib/types';

interface Props {
  siteId: string;
  selectedUsers: AppUser[];
  onClear: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

type BulkAction = 'approve' | 'suspend' | 'unsuspend' | null;

export function BulkActionBar({ siteId, selectedUsers, onClear, onSuccess, onError }: Props) {
  const [busy, setBusy] = useState<BulkAction>(null);
  if (selectedUsers.length === 0) return null;

  const count = selectedUsers.length;
  const allPending    = selectedUsers.every((u) => u.status === 'pending');
  const allActive     = selectedUsers.every((u) => u.status === 'active' && u.role === 'resident');
  const allSuspended  = selectedUsers.every((u) => u.status === 'suspended' && u.role === 'resident');

  async function handleApprove() {
    setBusy('approve');
    const supabase = createClient();
    const ids = selectedUsers.map((u) => u.id);

    // Each call writes its own user.approve audit row inside the RPC.
    const results = await Promise.allSettled(
      ids.map((uid) =>
        supabase.rpc('approve_user', {
          p_user_id: uid,
          p_barrier_ids: [],
          p_group_ids: [],
        }),
      ),
    );

    const failures = results
      .map((r, i) => ({ r, id: ids[i] }))
      .filter(({ r }) =>
        r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as { error?: unknown }).error),
      );

    // Summary audit row for super_admin's accountability view.
    void logAudit({
      action: 'user.bulk_approve',
      site_id: siteId,
      metadata: {
        count,
        succeeded: count - failures.length,
        failed:    failures.length,
        user_ids:  ids,
      },
    });

    setBusy(null);
    if (failures.length === 0) {
      onSuccess(`${count} sakin onaylandı.`);
    } else if (failures.length === count) {
      onError('Hiçbir sakin onaylanamadı.');
    } else {
      onSuccess(`${count - failures.length} sakin onaylandı, ${failures.length} hata oluştu.`);
    }
  }

  async function handleSetStatus(next: 'suspended' | 'active') {
    setBusy(next === 'suspended' ? 'suspend' : 'unsuspend');
    const supabase = createClient();
    const ids = selectedUsers.map((u) => u.id);

    const { error } = await supabase
      .from('users')
      .update({ status: next })
      .in('id', ids);

    if (error) {
      setBusy(null);
      onError(`Güncellenemedi: ${error.message}`);
      return;
    }

    void logAudit({
      action: next === 'suspended' ? 'user.bulk_suspend' : 'user.bulk_unsuspend',
      site_id: siteId,
      metadata: { count, user_ids: ids },
    });

    setBusy(null);
    onSuccess(
      next === 'suspended'
        ? `${count} sakin askıya alındı.`
        : `${count} sakin tekrar aktif edildi.`,
    );
  }

  return (
    <div className="sticky top-16 z-20 mb-4 rounded-2xl border border-accent/40 bg-surface/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-sm">
          <span className="font-mono text-accent">{count}</span>
          <span className="text-textSec"> seçildi</span>
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {allPending && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleApprove}
            loading={busy === 'approve'}
            disabled={!!busy}
          >
            <CheckCircle size={14} weight="fill" />
            Onayla ({count})
          </Button>
        )}
        {allActive && (
          <Button
            variant="subtle"
            size="sm"
            onClick={() => handleSetStatus('suspended')}
            loading={busy === 'suspend'}
            disabled={!!busy}
          >
            <PauseCircle size={14} />
            Askıya al ({count})
          </Button>
        )}
        {allSuspended && (
          <Button
            variant="subtle"
            size="sm"
            onClick={() => handleSetStatus('active')}
            loading={busy === 'unsuspend'}
            disabled={!!busy}
          >
            <PlayCircle size={14} />
            Aktifleştir ({count})
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClear} disabled={!!busy}>
          <X size={14} weight="bold" />
          Temizle
        </Button>
      </div>
    </div>
  );
}
