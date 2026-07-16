'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { logAudit } from '@/lib/audit';
import type { AppUser, UserRole } from '@/lib/types';

interface Props {
  me: AppUser;
  siteName: string | null;
}

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Süper yönetici',
  site_admin:  'Site yöneticisi',
  resident:    'Sakin',
  guest:       'Misafir',
};

export function ProfileForm({ me, siteName }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(me.full_name ?? '');
  const [phone, setPhone] = useState(me.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    fullName.trim() !== (me.full_name ?? '') ||
    (phone.trim() || '') !== (me.phone ?? '');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setError('Ad soyad en az 2 karakter olmalı.');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const newPhone = phone.trim() || null;
    const { error: dbErr } = await supabase
      .from('users')
      .update({ full_name: trimmedName, phone: newPhone })
      .eq('id', me.id);
    setSaving(false);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }

    void logAudit({
      action: 'admin.self_profile_update',
      target_type: 'admin',
      target_id: me.id,
      target_label: me.email ?? trimmedName,
      site_id: me.site_id ?? null,
      metadata: {
        from_full_name: me.full_name,
        to_full_name:   trimmedName,
        from_phone:     me.phone,
        to_phone:       newPhone,
      },
    });

    toast('Profil güncellendi.', 'success');
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-sep bg-surface p-6">
      <header className="mb-5">
        <h2 className="text-base font-semibold tracking-tight">Profil</h2>
        <p className="mt-1 text-xs text-textMuted">
          E-posta ve rol değiştirilemez. Ad ve telefon dilediğiniz zaman güncelleyebilirsiniz.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label="E-posta" htmlFor="ac-email">
          <Input id="ac-email" value={me.email ?? ''} disabled className="font-mono" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Rol" htmlFor="ac-role">
            <div className="h-11 px-4 rounded-[10px] bg-surfaceUp border border-sep flex items-center">
              <Badge tone={me.role === 'super_admin' ? 'accent' : 'muted'}>
                {ROLE_LABEL[me.role]}
              </Badge>
            </div>
          </Field>
          <Field label="Site" htmlFor="ac-site">
            <div className="h-11 px-4 rounded-[10px] bg-surfaceUp border border-sep flex items-center">
              <span className="text-sm text-textSec truncate">
                {siteName ?? <span className="text-textMuted">—</span>}
              </span>
            </div>
          </Field>
        </div>

        <Field label="Ad soyad" htmlFor="ac-name">
          <Input
            id="ac-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ad Soyad"
          />
        </Field>

        <Field label="Telefon" htmlFor="ac-phone" optional>
          <Input
            id="ac-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+90…"
          />
        </Field>

        {error && (
          <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!dirty}>
            Kaydet
          </Button>
        </div>
      </form>
    </section>
  );
}
