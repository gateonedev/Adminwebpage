import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/auth/requireSuperAdmin';
import type { AdminUserRow, Site } from '@/lib/types';
import { AdminsPageClient } from './AdminsPageClient';

export const dynamic = 'force-dynamic';

export default async function AdminsPage() {
  // requireSuperAdmin enforces super_admin-only access for this page.
  const me = await requireSuperAdmin();
  const supabase = await createClient();

  const [adminsResp, sitesResp] = await Promise.all([
    supabase
      .from('users')
      .select('*, sites(name)')
      .in('role', ['site_admin', 'super_admin'])
      .order('created_at', { ascending: false }),
    supabase
      .from('sites')
      .select('*')
      .order('name', { ascending: true }),
  ]);

  if (adminsResp.error) {
    return (
      <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-4 py-3 text-sm text-danger">
        Yöneticiler yüklenemedi: {adminsResp.error.message}
      </div>
    );
  }
  if (sitesResp.error) {
    return (
      <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-4 py-3 text-sm text-danger">
        Siteler yüklenemedi: {sitesResp.error.message}
      </div>
    );
  }

  return (
    <AdminsPageClient
      currentUserId={me.id}
      initialAdmins={(adminsResp.data ?? []) as AdminUserRow[]}
      sites={(sitesResp.data ?? []) as Site[]}
    />
  );
}
