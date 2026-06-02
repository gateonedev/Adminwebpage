'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import type { AdminUserRow, Site } from '@/lib/types';
import { AdminsTable } from './AdminsTable';
import { CreateAdminDialog } from './CreateAdminDialog';
import { EditAdminDialog } from './EditAdminDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import { DeleteAdminDialog } from './DeleteAdminDialog';

interface Props {
  currentUserId: string;
  initialAdmins: AdminUserRow[];
  sites: Site[];
}

export type ActiveDialog =
  | { type: 'create' }
  | { type: 'edit';   admin: AdminUserRow }
  | { type: 'reset';  admin: AdminUserRow }
  | { type: 'delete'; admin: AdminUserRow }
  | null;

export function AdminsPageClient({ currentUserId, initialAdmins, sites }: Props) {
  const router = useRouter();
  const [admins] = useState(initialAdmins);
  const [dialog, setDialog] = useState<ActiveDialog>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <>
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Yöneticiler</h1>
          <p className="mt-1 text-sm text-textSec">
            Site yöneticileri ve süper yöneticiler. Buradan hesap oluşturup yetkilerini ayarlayın.
          </p>
        </div>
        <Button onClick={() => setDialog({ type: 'create' })}>
          <Plus size={16} weight="bold" />
          Yeni yönetici
        </Button>
      </div>

      {admins.length === 0 ? (
        <div className="border-t border-sep py-16 text-center">
          <p className="text-text font-medium">Henüz yönetici yok.</p>
          <p className="mt-1 text-sm text-textSec">İlk yöneticiyi ekleyin.</p>
        </div>
      ) : (
        <AdminsTable
          admins={admins}
          currentUserId={currentUserId}
          onEdit={(a) => setDialog({ type: 'edit', admin: a })}
          onReset={(a) => setDialog({ type: 'reset', admin: a })}
          onDelete={(a) => setDialog({ type: 'delete', admin: a })}
          onStatusChanged={(message) => {
            toast(message, 'success');
            refresh();
          }}
          onError={(message) => toast(message, 'error')}
        />
      )}

      <CreateAdminDialog
        open={dialog?.type === 'create'}
        onOpenChange={(o) => !o && setDialog(null)}
        sites={sites}
        onCreated={() => {
          toast('Yönetici oluşturuldu.', 'success');
          setDialog(null);
          refresh();
        }}
      />
      <EditAdminDialog
        open={dialog?.type === 'edit'}
        onOpenChange={(o) => !o && setDialog(null)}
        admin={dialog?.type === 'edit' ? dialog.admin : null}
        sites={sites}
        onSaved={() => {
          toast('Yönetici güncellendi.', 'success');
          setDialog(null);
          refresh();
        }}
      />
      <ResetPasswordDialog
        open={dialog?.type === 'reset'}
        onOpenChange={(o) => !o && setDialog(null)}
        admin={dialog?.type === 'reset' ? dialog.admin : null}
        onDone={() => {
          toast('Şifre sıfırlandı.', 'success');
          setDialog(null);
        }}
      />
      <DeleteAdminDialog
        open={dialog?.type === 'delete'}
        onOpenChange={(o) => !o && setDialog(null)}
        admin={dialog?.type === 'delete' ? dialog.admin : null}
        onDeleted={() => {
          toast('Yönetici silindi.', 'success');
          setDialog(null);
          refresh();
        }}
      />
    </>
  );
}
