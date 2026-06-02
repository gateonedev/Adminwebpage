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

  const { data: barrierData } = await supabase
    .from('barriers')
    .select('id')
    .eq('site_id', ctx.siteId);
  const ids = (barrierData ?? []).map((b: { id: string }) => b.id);

  let guests: GuestRow[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from('guests')
      .select('id, guest_name, guest_phone, access_type, expires_at, max_uses, current_uses, is_active, created_at, barriers(name), users(full_name)')
      .in('barrier_id', ids)
      .order('created_at', { ascending: false });
    guests = (data ?? []) as unknown as GuestRow[];
  }

  return (
    <>
      <PageHeader
        title="Misafirler"
        description="Sakinlerin oluşturduğu misafir geçişleri."
        right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={ctx.siteId} />}
      />
      <GuestsPageClient initialGuests={guests} />
    </>
  );
}
