'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export interface LoginState {
  message: string | null;
}

/**
 * Handles the complete login flow on the server so the auth cookies are set
 * before navigating to the admin area.
 */
export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { message: 'E-posta ve şifre zorunludur.' };
  }

  const supabase = await createClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    return { message: 'E-posta veya şifre hatalı.' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { message: 'Oturum bulunamadı.' };
  }

  const { data: row, error } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (error || !row) {
    // Note: a RESTRICTIVE RLS policy (device_session_gate) hides the row for
    // any non-active account, so suspended/pending admins also land here.
    await supabase.auth.signOut();
    return { message: 'Hesabınız pasif veya bulunamadı. Yöneticinizle iletişime geçin.' };
  }

  if (row.role !== 'super_admin' && row.role !== 'site_admin') {
    await supabase.auth.signOut();
    return { message: 'Bu panel yalnızca yönetici hesapları içindir.' };
  }

  if (row.status === 'suspended') {
    await supabase.auth.signOut();
    return { message: 'Hesabınız askıya alındı. Yöneticinizle iletişime geçin.' };
  }
  if (row.status === 'pending') {
    await supabase.auth.signOut();
    return { message: 'Hesabınız henüz onaylanmadı.' };
  }
  if (row.status === 'rejected') {
    await supabase.auth.signOut();
    return { message: 'Hesabınız reddedilmiş.' };
  }

  redirect('/dashboard');
}
