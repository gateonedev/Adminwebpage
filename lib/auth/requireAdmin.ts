import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppUser } from '@/lib/types';

/**
 * Server-side guard for admin routes (super_admin OR site_admin).
 *
 * - No session → /login
 * - Resident or unknown user → sign out, /login?error=not_admin
 * - Suspended / pending / rejected admin → sign out, /login?error=<reason>
 *
 * Returns the caller's `users` row.
 */
export async function requireAdmin(): Promise<AppUser> {
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

  const me = row as AppUser;
  if (me.role !== 'super_admin' && me.role !== 'site_admin') {
    await supabase.auth.signOut();
    redirect('/login?error=not_admin');
  }
  if (me.status !== 'active') {
    await supabase.auth.signOut();
    redirect(`/login?error=status_${me.status}`);
  }
  return me;
}
