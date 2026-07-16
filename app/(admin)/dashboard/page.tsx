import { Clock, UserCirclePlus, Users, Garage, ListChecks } from '@phosphor-icons/react/dist/ssr';
import { createClient } from '@/lib/supabase/server';
import { getSiteContext } from '@/lib/site-context';
import { PageHeader } from '@/components/PageHeader';
import { SitePicker } from '@/components/chrome/SitePicker';
import { Badge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

interface AccessLogRow {
  id: string;
  timestamp: string;
  method: string;
  users: { full_name: string | null } | null;
  guests: { guest_name: string | null } | null;
  barriers: { name: string | null } | null;
}

const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const METHOD_LABEL: Record<string, string> = {
  manual:     'Elle',
  hands_free: 'Elsiz',
  guest:      'Misafir',
};

export default async function DashboardPage() {
  const ctx = await getSiteContext();
  const supabase = await createClient();
  const { siteId, sites, me } = ctx;

  // No site available — only happens for a super_admin who hasn't created any sites yet.
  if (!siteId) {
    return (
      <>
        <PageHeader
          title="Genel bakış"
          description="Henüz bir site yok. Önce site oluşturun, sonra yönetici atayın."
          right={sites && <SitePicker sites={sites} activeSiteId={null} />}
        />
        <EmptyState />
      </>
    );
  }

  // Compute today's start in UTC (Postgres timestamps are UTC by default in this schema).
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // access_logs'ta site_id yok; site kapsaması barriers!inner join filtresiyle
  // yapılır. Böylece bariyer id'lerini önceden çeken ara sorgu (1 RT) kalkar
  // ve beş sorgu tek Promise.all'da paralel koşar.
  const [pendingResp, activeResp, barrierCountResp, todayLogsResp, recentLogsResp] = await Promise.all([
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'pending'),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'active')
      .eq('role', 'resident'),
    supabase
      .from('barriers')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId),
    supabase
      .from('access_logs')
      .select('id, barriers!inner(site_id)', { count: 'exact', head: true })
      .eq('barriers.site_id', siteId)
      .gte('timestamp', startOfDay.toISOString()),
    supabase
      .from('access_logs')
      .select('id, timestamp, method, users(full_name), guests(guest_name), barriers!inner(name, site_id)')
      .eq('barriers.site_id', siteId)
      .order('timestamp', { ascending: false })
      .limit(8),
  ]);

  const recentLogs = (recentLogsResp.data ?? []) as unknown as AccessLogRow[];
  const tiles = [
    { label: 'Onay bekleyen', value: pendingResp.count ?? 0, icon: UserCirclePlus, tone: pendingResp.count ? 'warn' : 'muted' },
    { label: 'Aktif sakin',   value: activeResp.count ?? 0,  icon: Users,           tone: 'accent' },
    { label: 'Bariyer',       value: barrierCountResp.count ?? 0, icon: Garage,     tone: 'muted' },
    { label: 'Bugünkü geçiş', value: todayLogsResp.count ?? 0, icon: ListChecks,    tone: 'muted' },
  ] as const;

  return (
    <>
      <PageHeader
        title="Genel bakış"
        description={
          me.role === 'super_admin'
            ? 'Seçili sitenin günlük durumu.'
            : 'Sitenizin günlük durumu.'
        }
        right={sites && <SitePicker sites={sites} activeSiteId={siteId} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Tile key={t.label} label={t.label} value={t.value} icon={t.icon} tone={t.tone} />
        ))}
      </div>

      <section className="mt-12">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm uppercase tracking-wider text-textMuted">Son hareketler</h2>
          {recentLogs.length > 0 && (
            <span className="text-xs text-textMuted font-mono">
              <Clock size={11} weight="regular" className="inline mr-1 -mt-0.5" />
              son {recentLogs.length}
            </span>
          )}
        </div>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-textMuted py-8 text-center border-t border-sep">
            Henüz kayıtlı bir hareket yok.
          </p>
        ) : (
          <div className="border-t border-sep divide-y divide-sep">
            {recentLogs.map((log) => (
              <div key={log.id} className="grid grid-cols-[1fr_auto_auto] gap-4 px-1 py-3 items-center">
                <div className="min-w-0">
                  <div className="text-sm text-text truncate">
                    {log.users?.full_name ?? log.guests?.guest_name ?? <span className="text-textMuted">Bilinmeyen</span>}
                    <span className="text-textMuted"> · </span>
                    <span className="text-textSec">{log.barriers?.name ?? '—'}</span>
                  </div>
                </div>
                <Badge tone={log.method === 'hands_free' ? 'accent' : log.method === 'guest' ? 'warn' : 'muted'}>
                  {METHOD_LABEL[log.method] ?? log.method}
                </Badge>
                <div className="text-xs text-textMuted font-mono w-20 text-right">
                  {dateTimeFormatter.format(new Date(log.timestamp))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Tile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Clock;
  tone: 'accent' | 'warn' | 'muted';
}) {
  const toneClass = tone === 'accent'
    ? 'text-accent'
    : tone === 'warn'
    ? 'text-warn'
    : 'text-textSec';
  return (
    <div className="rounded-2xl border border-sep bg-surface px-5 py-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-textMuted uppercase tracking-wider">{label}</span>
        <Icon size={16} weight="regular" className={toneClass} />
      </div>
      <div className="mt-3 font-mono text-3xl tabular-nums tracking-tight">
        {value.toLocaleString('tr-TR')}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-t border-sep py-16 text-center">
      <p className="text-text font-medium">Yönetilecek site yok.</p>
      <p className="mt-1 text-sm text-textSec">
        Sol menüden &ldquo;Siteler&rdquo; sayfasına gidip ilk siteyi ekleyin.
      </p>
    </div>
  );
}
