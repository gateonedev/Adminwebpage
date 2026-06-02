'use client';

import { useEffect, useState, useTransition } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import type { AdminUserRow, Site } from '@/lib/types';
import { updateAdminRole } from './actions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admin: AdminUserRow | null;
  sites: Site[];
  onSaved: () => void;
}

export function EditAdminDialog({ open, onOpenChange, admin, sites, onSaved }: Props) {
  const [role, setRole] = useState<'site_admin' | 'super_admin'>('site_admin');
  const [siteId, setSiteId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open && admin) {
      setRole(admin.role === 'super_admin' ? 'super_admin' : 'site_admin');
      setSiteId(admin.site_id ?? sites[0]?.id ?? '');
      setError(null);
    }
  }, [open, admin, sites]);

  if (!admin) return null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateAdminRole({
        id: admin!.id,
        role,
        site_id: role === 'super_admin' ? null : (siteId || null),
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onSaved();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Yöneticiyi düzenle"
      description={admin.full_name || admin.email || undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Vazgeç
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rol" htmlFor="ea-role">
            <Select
              id="ea-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'site_admin' | 'super_admin')}
            >
              <option value="site_admin">Site yöneticisi</option>
              <option value="super_admin">Süper yönetici</option>
            </Select>
          </Field>
          <Field label="Site" htmlFor="ea-site" hint={role === 'super_admin' ? 'Süper yönetici için site gerekmez.' : undefined}>
            <Select
              id="ea-site"
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

        {error && (
          <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
