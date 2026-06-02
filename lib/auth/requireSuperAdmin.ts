import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppUser } from '@/lib/types';

/**
 * Must be called from server components, layouts, or server actions.
 * Returns the caller's `users` row when role = super_admin.
 * Otherwise: signs them out and redirects them to /login with an error.
 */
export async function requireSuperAdmin(): Promise<AppUser> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: row, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !row) {
    await supabase.auth.signOut();
    redirect('/login?error=unknown_user');
  }

  if ((row as AppUser).role !== 'super_admin') {
    await supabase.auth.signOut();
    redirect('/login?error=not_super_admin');
  }

  return row as AppUser;
}
