import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { USER_COLUMNS, type AppUser } from '@/lib/types';

/**
 * Server-side guard for admin routes (super_admin OR site_admin).
 *
 * - No session → /login
 * - Resident or unknown user → sign out, /login?error=not_admin
 * - Suspended / pending / rejected admin → sign out, /login?error=<reason>
 *
 * Returns the caller's `users` row.
 *
 * React.cache(): layout ve sayfa aynı istekte bunu ayrı ayrı çağırır;
 * cache sayesinde getUser + users sorgusu istek başına 1 kez çalışır.
 */
export const requireAdmin = cache(async (): Promise<AppUser> => {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Column-level grants: select('*') fails with "permission denied" (mig. 42).
  const { data: row, error } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .eq('id', user.id)
    .single();

  if (error || !row) {
    await supabase.auth.signOut();
    redirect('/login?error=unknown_user');
  }

  const me = row as unknown as AppUser;
  if (me.role !== 'super_admin' && me.role !== 'site_admin') {
    await supabase.auth.signOut();
    redirect('/login?error=not_admin');
  }
  if (me.status !== 'active') {
    await supabase.auth.signOut();
    redirect(`/login?error=status_${me.status}`);
  }
  return me;
});
