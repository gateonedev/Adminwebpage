'use server';

import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Called from LoginForm right after a successful signInWithPassword.
 * Verifies the just-authenticated user is a site_admin or super_admin
 * with status='active'. Otherwise signs them out and returns a Turkish
 * error message for the form to display.
 */
export async function assertAdminOrSignOut(): Promise<Result> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Oturum bulunamadı.' };

  const { data: row, error } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (error || !row) {
    await supabase.auth.signOut();
    return { ok: false, message: 'Hesap bilgisi okunamadı.' };
  }

  if (row.role !== 'super_admin' && row.role !== 'site_admin') {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: 'Bu panel yalnızca yönetici hesapları içindir.',
    };
  }

  if (row.status === 'suspended') {
    await supabase.auth.signOut();
    return { ok: false, message: 'Hesabınız askıya alındı. Yöneticinizle iletişime geçin.' };
  }
  if (row.status === 'pending') {
    await supabase.auth.signOut();
    return { ok: false, message: 'Hesabınız henüz onaylanmadı.' };
  }
  if (row.status === 'rejected') {
    await supabase.auth.signOut();
    return { ok: false, message: 'Hesabınız reddedilmiş.' };
  }

  return { ok: true };
}
