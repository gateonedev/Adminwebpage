import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AuditInput } from '@/lib/audit';

/**
 * Server-action / RSC variant of logAudit. Uses the cookie-bound Supabase
 * client so the row is inserted under the calling super_admin's identity
 * (RLS will reject it otherwise). Accepts the actor id explicitly to avoid
 * an auth round-trip — callers already have it from requireSuperAdmin().
 */
export async function logAuditServer(actorId: string, input: AuditInput): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('admin_audit_log').insert({
      actor_id: actorId,
      action: input.action,
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      target_label: input.target_label ?? null,
      site_id: input.site_id ?? null,
      metadata: input.metadata ?? {},
    });
    if (error && process.env.NODE_ENV !== 'production') {
      console.warn('[audit-server] insert failed:', error.message);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[audit-server] logAuditServer threw:', err);
    }
  }
}
