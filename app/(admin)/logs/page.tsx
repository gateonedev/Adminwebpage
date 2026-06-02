import { createClient } from '@/lib/supabase/server';
import { getSiteContext } from '@/lib/site-context';
import { PageHeader } from '@/components/PageHeader';
import { SitePicker } from '@/components/chrome/SitePicker';
import { LogsPageClient, type LogRow, type BarrierLite } from './LogsPageClient';

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

  const { data: barrierData } = await supabase
    .from('barriers')
    .select('id, name')
    .eq('site_id', ctx.siteId)
    .order('name', { ascending: true });
  const barriers = (barrierData ?? []) as BarrierLite[];
  const ids = barriers.map((b) => b.id);

  let logs: LogRow[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from('access_logs')
      .select('id, barrier_id, user_id, method, timestamp, users(full_name), barriers(name)')
      .in('barrier_id', ids)
      .order('timestamp', { ascending: false })
      .limit(200);
    logs = (data ?? []) as unknown as LogRow[];
  }

  return (
    <>
      <PageHeader
        title="Hareketler"
        description="Bu sitenin son 200 erişim kaydı, en yeni en üstte."
        right={ctx.sites && <SitePicker sites={ctx.sites} activeSiteId={ctx.siteId} />}
      />
      <LogsPageClient initialLogs={logs} barriers={barriers} siteId={ctx.siteId} />
    </>
  );
}
