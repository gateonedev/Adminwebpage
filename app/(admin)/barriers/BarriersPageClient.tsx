'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import type { Barrier } from '@/lib/types';
import { BarriersTable } from './BarriersTable';
import { BarrierFormDialog } from './BarrierFormDialog';
import { DeleteBarrierDialog } from './DeleteBarrierDialog';

interface Props {
  siteId: string;
  isSuper: boolean;
  initialBarriers: Barrier[];
}

// Donanım parametreleri (BLE kimliği, röle, RSSI) kurulumcu alanıdır;
// site admini yalnız ad + aktiflik + elsiz modu yönetir (sunucu tarafında
// guard trigger + delete_barrier RPC'siyle de zorlanır).
export function BarriersPageClient({ siteId, isSuper, initialBarriers }: Props) {
  const router = useRouter();
  const barriers = initialBarriers;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Barrier | null>(null);
  const [deleting, setDeleting] = useState<Barrier | null>(null);

  function refresh() {
    router.refresh();
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(b: Barrier) {
    setEditing(b);
    setFormOpen(true);
  }

  return (
    <>
      {isSuper && (
        <div className="flex justify-end mb-6">
          <Button onClick={openCreate}>
            <Plus size={16} weight="bold" />
            Yeni bariyer
          </Button>
        </div>
      )}

      {barriers.length === 0 ? (
        <div className="border-t border-sep py-16 text-center">
          <p className="text-text font-medium">Henüz bariyer yok.</p>
          <p className="mt-1 text-sm text-textSec">
            {isSuper
              ? 'Bu siteye ilk bariyeri ekleyin.'
              : 'Bariyer kurulumu Gate One ekibi tarafından yapılır.'}
          </p>
          {isSuper && (
            <div className="mt-6">
              <Button onClick={openCreate}>
                <Plus size={16} weight="bold" />
                Yeni bariyer
              </Button>
            </div>
          )}
        </div>
      ) : (
        <BarriersTable
          barriers={barriers}
          canDelete={isSuper}
          onEdit={openEdit}
          onDelete={setDeleting}
        />
      )}

      <BarrierFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        siteId={siteId}
        isSuper={isSuper}
        barrier={editing}
        onSaved={(mode) => {
          toast(mode === 'create' ? 'Bariyer oluşturuldu.' : 'Bariyer güncellendi.', 'success');
          setFormOpen(false);
          refresh();
        }}
        onError={(message) => toast(message, 'error')}
      />
      <DeleteBarrierDialog
        barrier={deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onDeleted={() => {
          toast('Bariyer silindi.', 'success');
          setDeleting(null);
          refresh();
        }}
        onError={(message) => toast(message, 'error')}
      />
    </>
  );
}
