import 'server-only';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import type { AppUser, Site } from '@/lib/types';

const COOKIE_NAME = 'go_active_site';

export interface SiteContext {
  me: AppUser;
  /** Site the page should scope to. null only for super_admin who hasn't picked a site yet. */
  siteId: string | null;
  /** All sites — only populated for super_admin (so the picker can render). */
  sites: Site[] | null;
}

/**
 * Resolve the active per-site context for the calling admin.
 *  - site_admin → siteId is their users.site_id (cookie ignored)
 *  - super_admin → siteId is from the cookie if present, else first site by name
 *
 * Use in any page that scopes to a single site (dashboard, users, barriers, …).
 */
export async function getSiteContext(): Promise<SiteContext> {
  const me = await requireAdmin();

  if (me.role === 'site_admin') {
    return { me, siteId: me.site_id, sites: null };
  }

  // super_admin: load all sites for the picker.
  const supabase = await createClient();
  const { data } = await supabase
    .from('sites')
    .select('*')
    .order('name', { ascending: true });
  const sites = (data ?? []) as Site[];

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(COOKIE_NAME)?.value;
  const cookieMatchesSite = cookieValue && sites.some((s) => s.id === cookieValue);

  const siteId = cookieMatchesSite
    ? cookieValue!
    : (sites[0]?.id ?? null);

  return { me, siteId, sites };
}
