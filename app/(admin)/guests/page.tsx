import { createClient } from '@/lib/supabase/server';
import { getSiteContext } from '@/lib/site-context';
import { PageHeader } from '@/components/PageHeader';
import { SitePicker } from '@/components/chrome/SitePicker';
import { GuestsPageClient, type GuestRow } from './GuestsPageClient';

export const dynamic = 'force-dynamic';

export default async function GuestsPage() {
  const ctx = await getSiteContext();
  const supabase = await createClient();

  if (!ctx.siteId) {
    return (
      <>
        <PageHeader
          title="Misafirler"
          right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={null} />}
        />
        <div className="border-t border-sep py-16 text-center">
          <p className="text-text font-medium">Yönetilecek site yok.</p>
        </div>
      </>
    );
  }

  // Site kapsaması barriers!inner join filtresiyle — bariyer id'lerini
  // önceden çeken ara sorguya (1 RT) gerek yok.
  const { data } = await supabase
    .from('guests')
    .select('id, guest_name, guest_phone, access_type, expires_at, max_uses, current_uses, is_active, approval_status, user_id, created_at, barriers!inner(name, site_id), users(full_name), guest_barriers(barriers(name))')
    .eq('barriers.site_id', ctx.siteId)
    .order('created_at', { ascending: false });
  const guests = (data ?? []) as unknown as GuestRow[];

  return (
    <>
      <PageHeader
        title="Misafirler"
        description="Sakinlerin oluşturduğu davetler. Bekleyenleri onaylayın, gerekirse iptal edin."
        right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={ctx.siteId} />}
      />
      <GuestsPageClient initialGuests={guests} />
    </>
  );
}
