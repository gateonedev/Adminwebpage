import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/auth/requireSuperAdmin';
import type { Site } from '@/lib/types';
import { SitesPageClient } from './SitesPageClient';

export const dynamic = 'force-dynamic';

export default async function SitesPage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return (
      <div className="rounded-[10px] border border-danger/40 bg-dangerDim px-4 py-3 text-sm text-danger">
        Siteler yüklenemedi: {error.message}
      </div>
    );
  }

  return <SitesPageClient initialSites={(data ?? []) as Site[]} />;
}
