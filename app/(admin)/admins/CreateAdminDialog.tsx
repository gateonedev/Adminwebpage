'use client';

import { useEffect, useState, useTransition } from 'react';
import { Eye, EyeSlash, Shuffle } from '@phosphor-icons/react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import type { Site } from '@/lib/types';
import { createAdmin } from './actions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sites: Site[];
  onCreated: () => void;
}

export function CreateAdminDialog({ open, onOpenChange, sites, onCreated }: Props) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'site_admin' | 'super_admin'>('site_admin');
  const [siteId, setSiteId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setEmail('');
      setFullName('');
      setRole('site_admin');
      setSiteId(sites[0]?.id ?? '');
      setPassword('');
      setShowPassword(false);
      setError(null);
    }
  }, [open, sites]);

  function generatePassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) out += alphabet[arr[i] % alphabet.length];
    setPassword(out);
    setShowPassword(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createAdmin({
        email,
        password,
        full_name: fullName,
        role,
        site_id: role === 'super_admin' ? null : (siteId || null),
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onCreated();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Yeni yönetici"
      description="Yeni hesap oluşturulduktan sonra şifreyi yöneticiyle paylaşın."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Vazgeç
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            Oluştur
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label="Ad soyad" htmlFor="ca-name">
          <Input
            id="ca-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Defne Soylu"
            autoFocus
          />
        </Field>
        <Field label="E-posta" htmlFor="ca-email">
          <Input
            id="ca-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="defne@gateone.app"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rol" htmlFor="ca-role">
            <Select
              id="ca-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'site_admin' | 'super_admin')}
            >
              <option value="site_admin">Site yöneticisi</option>
              <option value="super_admin">Süper yönetici</option>
            </Select>
          </Field>
          <Field label="Site" htmlFor="ca-site" hint={role === 'super_admin' ? 'Süper yönetici için site gerekmez.' : undefined}>
            <Select
              id="ca-site"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              disabled={role === 'super_admin'}
            >
              <option value="">Seçiniz…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Geçici şifre" htmlFor="ca-password" hint="En az 8 karakter. Yöneticiyle paylaşılacak.">
          <div className="relative">
            <Input
              id="ca-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="pr-24 font-mono"
            />
            <div className="absolute inset-y-0 right-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-textMuted hover:text-text hover:bg-surfaceUp transition-colors"
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={generatePassword}
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
