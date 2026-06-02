'use client';

import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import type { Site } from '@/lib/types';
import { SitesTable } from './SitesTable';
import { SiteFormDialog } from './SiteFormDialog';
import { DeleteSiteDialog } from './DeleteSiteDialog';

interface Props {
  initialSites: Site[];
}

export function SitesPageClient({ initialSites }: Props) {
  const [sites, setSites] = useState<Site[]>(initialSites);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [deleting, setDeleting] = useState<Site | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(site: Site) {
    setEditing(site);
    setFormOpen(true);
  }

  function onUpserted(updated: Site, mode: 'create' | 'update') {
    setSites((prev) => {
      if (mode === 'create') return [...prev, updated].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      return prev.map((s) => (s.id === updated.id ? updated : s));
    });
    toast(mode === 'create' ? 'Site oluşturuldu.' : 'Site güncellendi.', 'success');
    setFormOpen(false);
  }

  function onDeleted(id: string) {
    setSites((prev) => prev.filter((s) => s.id !== id));
    toast('Site silindi.', 'success');
    setDeleting(null);
  }

  return (
    <>
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Siteler</h1>
          <p className="mt-1 text-sm text-textSec">
            Gate One altında yönetilen tüm yerleşim siteleri.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} weight="bold" />
          Yeni site
        </Button>
      </div>

      {sites.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <SitesTable sites={sites} onEdit={openEdit} onDelete={setDeleting} />
      )}

      <SiteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        site={editing}
        onUpserted={onUpserted}
      />
      <DeleteSiteDialog
        site={deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onDeleted={onDeleted}
      />
    </>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="border-t border-sep py-16 text-center">
      <p className="text-text font-medium">Henüz site yok.</p>
      <p className="mt-1 text-sm text-textSec">
        İlk siteyi oluşturarak yönetime başlayın.
      </p>
      <div className="mt-6">
        <Button onClick={onCreate}>
          <Plus size={16} weight="bold" />
          Yeni site
        </Button>
      </div>
    </div>
  );
}
