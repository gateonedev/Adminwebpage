import { createClient } from '@/lib/supabase/server';
import { getSiteContext } from '@/lib/site-context';
import { PageHeader } from '@/components/PageHeader';
import { SitePicker } from '@/components/chrome/SitePicker';
import { USER_COLUMNS, type AppUser } from '@/lib/types';
import { UsersPageClient } from './UsersPageClient';

export const dynamic = 'force-dynamic';

interface BarrierLite { id: string; name: string }
interface GroupLite   { id: string; name: string }

export default async function UsersPage() {
  const ctx = await getSiteContext();
  const supabase = await createClient();

  if (!ctx.siteId) {
    return (
      <>
        <PageHeader
          title="Kullanıcılar"
          description="Henüz seçili bir site yok."
          right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={null} />}
        />
        <div className="border-t border-sep py-16 text-center">
          <p className="text-text font-medium">Yönetilecek site yok.</p>
          <p className="mt-1 text-sm text-textSec">
            &ldquo;Siteler&rdquo; sayfasından bir site ekleyin.
          </p>
        </div>
      </>
    );
  }

  const [usersResp, barriersResp, groupsResp] = await Promise.all([
    supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('site_id', ctx.siteId)
      .order('status', { ascending: true })
      .order('full_name', { ascending: true }),
    supabase
      .from('barriers')
      .select('id, name')
      .eq('site_id', ctx.siteId)
      .order('name', { ascending: true }),
    supabase
      .from('groups')
      .select('id, name')
      .eq('site_id', ctx.siteId)
      .order('name', { ascending: true }),
  ]);

  if (usersResp.error) {
    return (
      <>
        <PageHeader
          title="Kullanıcılar"
          right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={ctx.siteId} />}
        />
        <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-4 py-3 text-sm text-danger">
          Kullanıcılar yüklenemedi: {usersResp.error.message}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Kullanıcılar"
        description={
          ctx.me.role === 'super_admin'
            ? 'Seçili sitenin tüm kullanıcıları. Onay bekleyenler en üstte.'
            : 'Sitenizin tüm kullanıcıları. Onay bekleyenler en üstte.'
        }
        right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={ctx.siteId} />}
      />
      <UsersPageClient
        siteId={ctx.siteId}
        initialUsers={(usersResp.data ?? []) as unknown as AppUser[]}
        barriers={(barriersResp.data ?? []) as BarrierLite[]}
        groups={(groupsResp.data ?? []) as GroupLite[]}
      />
    </>
  );
}
