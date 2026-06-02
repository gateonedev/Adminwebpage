import { createClient } from '@/lib/supabase/server';
import { getSiteContext } from '@/lib/site-context';
import { PageHeader } from '@/components/PageHeader';
import { SitePicker } from '@/components/chrome/SitePicker';
import { GroupsPageClient, type GroupRow } from './GroupsPageClient';

export const dynamic = 'force-dynamic';

interface UserLite { id: string; full_name: string; status: string }
interface BarrierLite { id: string; name: string }

export default async function GroupsPage() {
  const ctx = await getSiteContext();
  const supabase = await createClient();

  if (!ctx.siteId) {
    return (
      <>
        <PageHeader
          title="Gruplar"
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

  const [groupsResp, usersResp, barriersResp] = await Promise.all([
    supabase
      .from('groups')
      .select('id, name, created_at')
      .eq('site_id', ctx.siteId)
      .order('name', { ascending: true }),
    supabase
      .from('users')
      .select('id, full_name, status')
      .eq('site_id', ctx.siteId)
      .eq('status', 'active')
      .order('full_name', { ascending: true }),
    supabase
      .from('barriers')
      .select('id, name')
      .eq('site_id', ctx.siteId)
      .order('name', { ascending: true }),
  ]);

  if (groupsResp.error) {
    return (
      <>
        <PageHeader
          title="Gruplar"
          right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={ctx.siteId} />}
        />
        <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-4 py-3 text-sm text-danger">
          Gruplar yüklenemedi: {groupsResp.error.message}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Gruplar"
        description="Sakin gruplarına bariyer yetkisi atayın."
        right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={ctx.siteId} />}
      />
      <GroupsPageClient
        siteId={ctx.siteId}
        initialGroups={(groupsResp.data ?? []) as GroupRow[]}
        users={(usersResp.data ?? []) as UserLite[]}
        barriers={(barriersResp.data ?? []) as BarrierLite[]}
      />
    </>
  );
}
