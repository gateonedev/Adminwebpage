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
  // Hint'ler zorunlu (PGRST201): guest_barriers bağlantı tablosu (migration 53)
  // guests↔barriers arasında ikinci bir m2m ilişki yolu, invited_by + user_id
  // FK'ları da guests↔users arasında iki yol oluşturur — mobil de aynı
  // hint'lerle sorguluyor.
  const { data, error } = await supabase
    .from('guests')
    .select('id, guest_name, guest_phone, access_type, expires_at, max_uses, current_uses, first_used_at, is_active, approval_status, user_id, created_at, barriers!barrier_id!inner(name, site_id), users!invited_by(full_name), guest_barriers(uses_count, barriers(name))')
    .eq('barriers.site_id', ctx.siteId)
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <>
        <PageHeader
          title="Misafirler"
          right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={ctx.siteId} />}
        />
        <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-4 py-3 text-sm text-danger">
          Misafirler yüklenemedi: {error.message}
        </div>
      </>
    );
  }

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
