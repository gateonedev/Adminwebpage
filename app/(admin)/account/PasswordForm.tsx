'use client';

import { useState } from 'react';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { logAudit } from '@/lib/audit';

interface Props {
  email: string;
  siteId: string | null;
}

export function PasswordForm({ email, siteId }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setCurrent('');
    setNext('');
    setConfirm('');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!current || !next || !confirm) {
      setError('Tüm alanları doldurun.');
      return;
    }
    if (next.length < 8) {
      setError('Yeni şifre en az 8 karakter olmalı.');
      return;
    }
    if (next !== confirm) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }
    if (next === current) {
      setError('Yeni şifre, mevcut şifreden farklı olmalı.');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    // 1. Re-verify the current password by attempting to sign in.
    //    On success, Supabase rotates the session — fine, we're going to
    //    update the password right after anyway.
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (verifyErr) {
      setSaving(false);
      setError('Mevcut şifre hatalı.');
      return;
    }

    // 2. Apply the new password.
    const { error: updateErr } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (updateErr) {
      setError(`Şifre güncellenemedi: ${updateErr.message}`);
      return;
    }

    void logAudit({
      action: 'admin.self_password_change',
      target_type: 'admin',
      target_label: email,
      site_id: siteId,
    });

    toast('Şifre güncellendi.', 'success');
    reset();
  }

  return (
    <section className="rounded-2xl border border-sep bg-surface p-6">
      <header className="mb-5">
        <h2 className="text-base font-semibold tracking-tight">Şifre</h2>
        <p className="mt-1 text-xs text-textMuted">
          Mevcut şifrenizi doğruladıktan sonra yeni bir şifre belirleyin.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label="Mevcut şifre" htmlFor="ac-pw-current">
          <Input
            id="ac-pw-current"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>

        <Field label="Yeni şifre" htmlFor="ac-pw-new" hint="En az 8 karakter.">
          <Input
            id="ac-pw-new"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        <Field label="Yeni şifre (tekrar)" htmlFor="ac-pw-confirm">
          <Input
            id="ac-pw-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        {error && (
          <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Şifreyi güncelle
          </Button>
        </div>
      </form>
    </section>
  );
}
