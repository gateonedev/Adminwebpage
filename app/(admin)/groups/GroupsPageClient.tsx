'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { GroupDetailDialog } from './GroupDetailDialog';
import { CreateGroupDialog } from './CreateGroupDialog';

export interface GroupRow {
  id: string;
  name: string;
  created_at: string;
}

interface UserLite { id: string; full_name: string; status: string }
interface BarrierLite { id: string; name: string }

interface Props {
  siteId: string;
  initialGroups: GroupRow[];
  users: UserLite[];
  barriers: BarrierLite[];
}

export function GroupsPageClient({ siteId, initialGroups, users, barriers }: Props) {
  const router = useRouter();
  const [groups] = useState(initialGroups);
  const [createOpen, setCreateOpen] = useState(false);
  const [active, setActive] = useState<GroupRow | null>(null);
  const [deleting, setDeleting] = useState<GroupRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingId(deleting.id);
    const supabase = createClient();
    const { error } = await supabase.from('groups').delete().eq('id', deleting.id);
    setDeletingId(null);
    if (error) {
      toast(`Silinemedi: ${error.message}`, 'error');
      return;
    }
    toast('Grup silindi.', 'success');
    setDeleting(null);
    refresh();
  }

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} weight="bold" />
          Yeni grup
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="border-t border-sep py-16 text-center">
          <p className="text-text font-medium">Henüz grup yok.</p>
          <p className="mt-1 text-sm text-textSec">İlk grubu oluşturun.</p>
        </div>
      ) : (
        <div className="border-t border-sep divide-y divide-sep">
          {groups.map((g) => (
            <div
              key={g.id}
              className="grid grid-cols-[1fr_auto_auto] gap-4 px-3 py-4 items-center hover:bg-surface/40 transition-colors"
            >
              <button
                type="button"
                onClick={() => setActive(g)}
                className="text-left font-medium hover:text-accent transition-colors"
              >
                {g.name}
              </button>
              <span className="text-xs text-textMuted font-mono">
                {new Date(g.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <button
                type="button"
                onClick={() => setDeleting(g)}
                disabled={deletingId === g.id}
                aria-label="Sil"
                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-textMuted hover:text-danger hover:bg-dangerDim transition-colors disabled:opacity-50"
              >
                <Trash size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        siteId={siteId}
        onCreated={() => {
          toast('Grup oluşturuldu.', 'success');
          setCreateOpen(false);
          refresh();
        }}
      />

      <GroupDetailDialog
        group={active}
        onOpenChange={(o) => !o && setActive(null)}
        availableUsers={users}
        availableBarriers={barriers}
        onError={(message) => toast(message, 'error')}
        onChanged={refresh}
      />

      {deleting && (
        <CreateGroupDeleteConfirm
          name={deleting.name}
          loading={deletingId === deleting.id}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}

function CreateGroupDeleteConfirm({
  name,
  loading,
  onCancel,
  onConfirm,
}: {
  name: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Tiny inline confirmer — keeping symmetry with sites/barriers but minimal UI.
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-[calc(100vw-32px)] max-w-md rounded-2xl bg-surface border border-sep p-6">
        <h3 className="text-[17px] font-semibold">Grubu sil</h3>
        <p className="mt-2 text-sm text-textSec leading-relaxed">
          <span className="font-mono text-text">{name}</span> grubunu kalıcı olarak silmek istiyor musun? Üyelik ve bariyer yetkileri kaldırılır.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Vazgeç
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Sil
          </Button>
        </div>
      </div>
    </div>
  );
}
