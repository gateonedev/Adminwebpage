import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { PageHeader } from '@/components/PageHeader';
import {
  AuditPageClient,
  type ActorOption,
  type AuditRow,
  type SiteOption,
} from './AuditPageClient';
import { AUDIT_PAGE_SIZE, AUDIT_SELECT } from './auditQuery';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  // Site admini de görebilir; RLS (site_admin_read_audit) onu kendi sitesinin
  // kayıtlarıyla sınırlar, site_id'siz satırlar (site-üstü işlemler) gizli kalır.
  const me = await requireAdmin();
  const supabase = await createClient();

  // İlk sayfa + filtre seçenekleri paralel çekilir. İstemcideki buildQuery ile
  // aynı sözleşme: keyset sıralama + 1 fazla satır → hasMore.
  // YAPAN seçenekleri: RLS, görüleni role göre kırpar (site_admin: aynı-site
  // adminleri; super: hepsi). Askıdaki adminler bilinçli olarak dahil —
  // geçmiş işlemleri hâlâ önemli.
  const [auditResp, actorsResp, sitesResp] = await Promise.all([
    supabase
      .from('admin_audit_log')
      .select(AUDIT_SELECT)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(AUDIT_PAGE_SIZE + 1),
    supabase
      .from('users')
      .select('id, full_name, email')
      .in('role', ['site_admin', 'super_admin'])
      .order('full_name', { ascending: true }),
    me.role === 'super_admin'
      ? supabase.from('sites').select('id, name').order('name', { ascending: true })
      : Promise.resolve({ data: [] as SiteOption[], error: null }),
  ]);

  if (auditResp.error) {
    return (
      <>
        <PageHeader title="Denetim" description="Yönetici aksiyon geçmişi." />
        <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-4 py-3 text-sm text-danger">
          Kayıtlar yüklenemedi: {auditResp.error.message}
        </div>
      </>
    );
  }

  const list = (auditResp.data ?? []) as unknown as AuditRow[];
  const hasMore = list.length > AUDIT_PAGE_SIZE;
  const rows = list.slice(0, AUDIT_PAGE_SIZE);

  const actors: ActorOption[] = (
    (actorsResp.data ?? []) as { id: string; full_name: string | null; email: string | null }[]
  ).map((a) => ({ id: a.id, label: a.full_name?.trim() || a.email || a.id }));

  const sites = (sitesResp.data ?? []) as SiteOption[];

  return (
    <>
      <PageHeader
        title="Denetim"
        description={
          me.role === 'super_admin'
            ? 'Yönetici aksiyonları en yeniden eskiye; tarih, kategori, aksiyon, yapan ve site ile filtreleyin.'
            : 'Sitenizdeki yönetici aksiyonları en yeniden eskiye.'
        }
      />
      <AuditPageClient
        viewerRole={me.role}
        initialRows={rows}
        initialHasMore={hasMore}
        actors={actors}
        sites={sites}
      />
    </>
  );
}
