'use client';

import { useEffect, useState, useTransition } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import type { AdminUserRow } from '@/lib/types';
import { deleteAdmin } from './actions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admin: AdminUserRow | null;
  onDeleted: () => void;
}

export function DeleteAdminDialog({ open, onOpenChange, admin, onDeleted }: Props) {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setConfirm('');
      setError(null);
    }
  }, [open]);

  if (!admin) return null;

  const matchAgainst = admin.email ?? admin.full_name ?? '';
  const matches = confirm.trim() === matchAgainst;

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await deleteAdmin({ id: admin!.id });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onDeleted();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Yöneticiyi sil"
      description="Bu işlem geri alınamaz. Hesap ve tüm oturum geçmişi silinir."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Vazgeç
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={pending} disabled={!matches}>
            Sil
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-textSec leading-relaxed">
          Onaylamak için yazın:{' '}
          <span className="font-mono text-text">{matchAgainst}</span>
        </p>
        <Field label="Doğrulama" htmlFor="da-confirm" error={error ?? undefined}>
          <Input
            id="da-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={matchAgainst}
            autoFocus
          />
        </Field>
      </div>
    </Dialog>
  );
}
