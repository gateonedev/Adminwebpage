'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { logAudit } from '@/lib/audit';
import type { Site } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: Site | null;
  onUpserted: (site: Site, mode: 'create' | 'update') => void;
}

export function SiteFormDialog({ open, onOpenChange, site, onUpserted }: Props) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(site?.name ?? '');
      setAddress(site?.address ?? '');
      setError(null);
      setSaving(false);
    }
  }, [open, site]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Site adı boş olamaz.');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = { name: trimmed, address: address.trim() || null };

    if (site) {
      const { data, error } = await supabase
        .from('sites')
        .update(payload)
        .eq('id', site.id)
        .select('*')
        .single();
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
      const updated = data as Site;
      void logAudit({
        action: 'site.update',
        target_type: 'site',
        target_id: updated.id,
        target_label: updated.name,
        site_id: updated.id,
        metadata: {
          from_name: site.name,
          to_name: updated.name,
        },
      });
      onUpserted(updated, 'update');
    } else {
      const { data, error } = await supabase
        .from('sites')
        .insert(payload)
        .select('*')
        .single();
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
      const created = data as Site;
      void logAudit({
        action: 'site.create',
        target_type: 'site',
        target_id: created.id,
        target_label: created.name,
        site_id: created.id,
      });
      onUpserted(created, 'create');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={site ? 'Siteyi düzenle' : 'Yeni site'}
      description={site ? undefined : 'Bir site ekleyin. Eklendikten sonra yönetici atayabilirsiniz.'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={onSubmit} loading={saving}>
            {site ? 'Kaydet' : 'Oluştur'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label="Ad" htmlFor="site-name" error={error ?? undefined}>
          <Input
            id="site-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Yıldız Konutları"
            autoFocus
            error={!!error && !name.trim()}
          />
        </Field>
        <Field label="Adres" htmlFor="site-address" optional>
          <Textarea
            id="site-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Örn. Kadıköy, İstanbul"
          />
        </Field>
      </form>
    </Dialog>
  );
}
