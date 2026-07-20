import { createClient } from '@/lib/supabase/server';
import { getSiteContext } from '@/lib/site-context';
import { PageHeader } from '@/components/PageHeader';
import { SitePicker } from '@/components/chrome/SitePicker';
import { LogsPageClient, type LogRow, type BarrierLite } from './LogsPageClient';
import { LOG_SELECT, PAGE_SIZE } from './logQuery';

export const dynamic = 'force-dynamic';

export default async function LogsPage() {
  const ctx = await getSiteContext();
  const supabase = await createClient();

  if (!ctx.siteId) {
    return (
      <>
        <PageHeader
          title="Hareketler"
          right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={null} />}
        />
        <div className="border-t border-sep py-16 text-center">
          <p className="text-text font-medium">Yönetilecek site yok.</p>
        </div>
      </>
    );
  }

  // Bariyer listesi (filtre pill'leri için) ve ilk log sayfası paralel çekilir;
  // loglar site'a barriers!inner join filtresiyle kapsanır. İstemcideki
  // buildQuery ile aynı sözleşme: keyset sıralama + 1 fazla satır → hasMore.
  const [barriersResp, logsResp] = await Promise.all([
    supabase
      .from('barriers')
      .select('id, name')
      .eq('site_id', ctx.siteId)
      .order('name', { ascending: true }),
    supabase
      .from('access_logs')
      .select(LOG_SELECT)
      .eq('barriers.site_id', ctx.siteId)
      .eq('event_type', 'open')
      .order('timestamp', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1),
  ]);
  const barriers = (barriersResp.data ?? []) as BarrierLite[];
  const rows = (logsResp.data ?? []) as unknown as LogRow[];
  const hasMore = rows.length > PAGE_SIZE;
  const logs = rows.slice(0, PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Hareketler"
        description="Bu sitenin erişim kayıtları, en yeni en üstte. Tarih, bariyer ve yöntem ile filtreleyin."
        right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={ctx.siteId} />}
      />
      <LogsPageClient key={ctx.siteId} initialLogs={logs} initialHasMore={hasMore} barriers={barriers} siteId={ctx.siteId} />
    </>
  );
}
