'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
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

    // site.create/site.update audit'ini DB trigger'ı (migration 58) sunucuda
    // ad/adres diff'iyle yazar; istemci taraflı insert çift kayıt olurdu.
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
      onUpserted(data as Site, 'update');
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
      onUpserted(data as Site, 'create');
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
