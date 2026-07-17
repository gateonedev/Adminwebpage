import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { PageHeader } from '@/components/PageHeader';
import { AuditPageClient, type AuditRow } from './AuditPageClient';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  // Site admini de görebilir; RLS (site_admin_read_audit) onu kendi sitesinin
  // kayıtlarıyla sınırlar, site_id'siz satırlar (site-üstü işlemler) gizli kalır.
  const me = await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('id, action, target_type, target_id, target_label, site_id, metadata, created_at, users:actor_id(full_name, email, role), sites:site_id(name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return (
      <>
        <PageHeader title="Denetim" description="Yönetici aksiyon geçmişi." />
        <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-4 py-3 text-sm text-danger">
          Kayıtlar yüklenemedi: {error.message}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Denetim"
        description={
          me.role === 'super_admin'
            ? 'Yönetici hesaplarının panelde gerçekleştirdiği son 200 aksiyon.'
            : 'Sitenizde gerçekleştirilen son 200 yönetici aksiyonu.'
        }
      />
      <AuditPageClient
        viewerRole={me.role}
        rows={(data ?? []) as unknown as AuditRow[]}
      />
    </>
  );
}
