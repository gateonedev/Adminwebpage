import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/auth/requireSuperAdmin';
import { PageHeader } from '@/components/PageHeader';
import { AuditPageClient, type AuditRow } from './AuditPageClient';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  // Audit viewer is super_admin-only.
  await requireSuperAdmin();
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
        description="Yönetici hesaplarının panelde gerçekleştirdiği son 200 aksiyon."
      />
      <AuditPageClient rows={(data ?? []) as unknown as AuditRow[]} />
    </>
  );
}
