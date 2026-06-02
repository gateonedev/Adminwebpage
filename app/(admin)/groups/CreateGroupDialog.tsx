'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  onCreated: () => void;
}

export function CreateGroupDialog({ open, onOpenChange, siteId, onCreated }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
      setSaving(false);
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Grup adı boş olamaz.');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: dbErr } = await supabase
      .from('groups')
      .insert({ site_id: siteId, name: trimmed });
    setSaving(false);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    onCreated();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Yeni grup"
      description="Bir gruba sakin ekleyip bariyer yetkisi atayabilirsiniz."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={onSubmit} loading={saving}>
            Oluştur
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <Field label="Grup adı" htmlFor="g-name" error={error ?? undefined}>
          <Input
            id="g-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="A blok sakinleri"
            autoFocus
          />
        </Field>
      </form>
    </Dialog>
  );
}
