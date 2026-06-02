'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const COOKIE_NAME = 'go_active_site';

/**
 * Persist the super_admin's active site selection. site_admins should not
 * call this — they're auto-scoped to their own site_id — but the action
 * still rejects them defensively.
 */
export async function setActiveSite(siteId: string): Promise<void> {
  const me = await requireAdmin();
  if (me.role !== 'super_admin') return;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, siteId, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/', 'layout');
}
