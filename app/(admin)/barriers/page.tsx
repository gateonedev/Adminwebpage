import { createClient } from '@/lib/supabase/server';
import { getSiteContext } from '@/lib/site-context';
import { PageHeader } from '@/components/PageHeader';
import { SitePicker } from '@/components/chrome/SitePicker';
import { BARRIER_COLUMNS, type Barrier } from '@/lib/types';
import { BarriersPageClient } from './BarriersPageClient';

export const dynamic = 'force-dynamic';

export default async function BarriersPage() {
  const ctx = await getSiteContext();
  const supabase = await createClient();

  if (!ctx.siteId) {
    return (
      <>
        <PageHeader
          title="Bariyerler"
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

  // auth_token is privilege-hidden; select('*') would be "permission denied".
  const { data, error } = await supabase
    .from('barriers')
    .select(BARRIER_COLUMNS)
    .eq('site_id', ctx.siteId)
    .order('name', { ascending: true });

  if (error) {
    return (
      <>
        <PageHeader
          title="Bariyerler"
          right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={ctx.siteId} />}
        />
        <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-4 py-3 text-sm text-danger">
          Bariyerler yüklenemedi: {error.message}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Bariyerler"
        description="Bu siteye bağlı tüm BLE bariyerleri."
        right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={ctx.siteId} />}
      />
      <BarriersPageClient
        siteId={ctx.siteId}
        isSuper={ctx.me.role === 'super_admin'}
        initialBarriers={(data ?? []) as unknown as Barrier[]}
      />
    </>
  );
}
