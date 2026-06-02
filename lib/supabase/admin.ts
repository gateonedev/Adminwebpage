/**
 * Service-role Supabase client. SERVER-ONLY.
 *
 * Importing this file from a client component will throw at module load
 * because SUPABASE_SERVICE_ROLE_KEY is not exposed to the browser. Even so,
 * never `'use client'` a module that depends on this one.
 */

import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local',
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
