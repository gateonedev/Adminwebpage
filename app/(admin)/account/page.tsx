import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/PageHeader';
import { AccountClient } from './AccountClient';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const me = await requireAdmin();
  const supabase = await createClient();

  let siteName: string | null = null;
  if (me.site_id) {
    const { data } = await supabase
      .from('sites')
      .select('name')
      .eq('id', me.site_id)
      .single();
    siteName = (data as { name: string } | null)?.name ?? null;
  }

  return (
    <>
      <PageHeader
        title="Hesabım"
        description="Profilinizi düzenleyin ve şifrenizi değiştirin."
      />
      <AccountClient me={me} siteName={siteName} />
    </>
  );
}
