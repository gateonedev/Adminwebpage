'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import type { Site } from '@/lib/types';

interface Props {
  site: Site | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: string) => void;
}

export function DeleteSiteDialog({ site, onOpenChange, onDeleted }: Props) {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (site) {
      setConfirm('');
      setError(null);
      setDeleting(false);
    }
  }, [site]);

  if (!site) return null;
  const matches = confirm.trim() === site.name;

  async function onConfirm() {
    if (!matches) return;
    setDeleting(true);
    setError(null);
    const supabase = createClient();
    // Doğrudan DELETE grant'i kaldırıldı (migration 58); silme super_admin-only
    // delete_site RPC'sinde. Ad onayını sunucu da zorlar (confirm_name_mismatch)
    // ve site.delete audit'ini etki sayımlarıyla RPC yazar.
    const { error } = await supabase.rpc('delete_site', {
      p_site_id: site!.id,
      p_confirm_name: confirm.trim(),
    });
    setDeleting(false);
    if (error) {
      setError(
        error.message.includes('confirm_name_mismatch')
          ? 'Site adı birebir eşleşmiyor.'
          : error.message,
      );
      return;
    }
    onDeleted(site!.id);
  }

  return (
    <Dialog
      open={!!site}
      onOpenChange={onOpenChange}
      title="Siteyi sil"
      description="Bu işlem geri alınamaz. Siteye bağlı tüm bariyerler, gruplar ve geçiş kayıtları kalıcı olarak silinir; kullanıcı hesapları sitesiz kalır."
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
          Onaylamak için site adını yazın:{' '}
          <span className="font-mono text-text">{site.name}</span>
        </p>
        <Field label="Site adı" htmlFor="confirm-name" error={error ?? undefined}>
          <Input
            id="confirm-name"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={site.name}
            autoFocus
          />
        </Field>
      </div>
    </Dialog>
  );
}
