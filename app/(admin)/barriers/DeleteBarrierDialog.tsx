'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import type { Barrier } from '@/lib/types';

interface Props {
  barrier: Barrier | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  onError: (message: string) => void;
}

export function DeleteBarrierDialog({ barrier, onOpenChange, onDeleted, onError }: Props) {
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (barrier) {
      setConfirm('');
      setDeleting(false);
    }
  }, [barrier]);

  if (!barrier) return null;
  const matches = confirm.trim() === barrier.name;

  async function onConfirm() {
    if (!matches || !barrier) return;
    setDeleting(true);
    const supabase = createClient();
    // Doğrudan DELETE grant'i kaldırıldı; silme super_admin-only, audit'li
    // delete_barrier RPC'si üzerinden.
    const { error } = await supabase.rpc('delete_barrier', { p_barrier_id: barrier.id });
    setDeleting(false);
    if (error) {
      onError(`Silinemedi: ${error.message}`);
      return;
    }
    onDeleted();
  }

  return (
    <Dialog
      open={!!barrier}
      onOpenChange={onOpenChange}
      title="Bariyeri sil"
      description="Bu işlem geri alınamaz. Bariyere ait tüm geçiş kayıtları ve misafir davetleri de kalıcı olarak silinir."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={deleting}>
            Vazgeç
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={deleting} disabled={!matches}>
            Sil
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-textSec leading-relaxed">
          Onaylamak için bariyer adını yazın:{' '}
          <span className="font-mono text-text">{barrier.name}</span>
        </p>
        <Field label="Bariyer adı" htmlFor="db-name">
          <Input
            id="db-name"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={barrier.name}
            autoFocus
          />
        </Field>
      </div>
    </Dialog>
  );
}
