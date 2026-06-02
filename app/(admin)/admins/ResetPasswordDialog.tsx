'use client';

import { useEffect, useState, useTransition } from 'react';
import { Eye, EyeSlash, Shuffle } from '@phosphor-icons/react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import type { AdminUserRow } from '@/lib/types';
import { resetAdminPassword } from './actions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admin: AdminUserRow | null;
  onDone: () => void;
}

export function ResetPasswordDialog({ open, onOpenChange, admin, onDone }: Props) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setPassword('');
      setShow(true);
      setError(null);
    }
  }, [open]);

  if (!admin) return null;

  function generate() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) out += alphabet[arr[i] % alphabet.length];
    setPassword(out);
    setShow(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await resetAdminPassword({ id: admin!.id, password });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onDone();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Şifre sıfırla"
      description={admin.email ?? undefined}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Vazgeç
          </Button>
          <Button onClick={onSubmit} loading={pending} disabled={password.length < 8}>
            Sıfırla
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label="Yeni şifre" htmlFor="rp-password" hint="En az 8 karakter. Yöneticiyle paylaşın.">
          <div className="relative">
            <Input
              id="rp-password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              className="pr-24 font-mono"
            />
            <div className="absolute inset-y-0 right-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-textMuted hover:text-text hover:bg-surfaceUp transition-colors"
                aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {show ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={generate}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-textMuted hover:text-text hover:bg-surfaceUp transition-colors"
                aria-label="Rastgele şifre üret"
              >
                <Shuffle size={16} />
              </button>
            </div>
          </div>
        </Field>

        {error && (
          <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
