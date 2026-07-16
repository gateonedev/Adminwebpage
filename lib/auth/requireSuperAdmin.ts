import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { USER_COLUMNS, type AppUser } from '@/lib/types';

/**
 * Must be called from server components, layouts, or server actions.
 * Returns the caller's `users` row when role = super_admin.
 * Otherwise: signs them out and redirects them to /login with an error.
 *
 * React.cache(): istek başına tek getUser + users sorgusu (layout/sayfa dedupe).
 */
export const requireSuperAdmin = cache(async (): Promise<AppUser> => {
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

  if ((row as unknown as AppUser).role !== 'super_admin') {
    await supabase.auth.signOut();
    redirect('/login?error=not_super_admin');
  }

  return row as unknown as AppUser;
});
