/**
 * Admin audit log helper.
 *
 * Insert one row to admin_audit_log for any meaningful admin action.
 * RLS enforces actor_id = auth.uid(), so we don't need to pass it from
 * the caller. The audit row is immutable — there's no UPDATE/DELETE policy.
 *
 * The 'user.approve' action is recorded inside the approve_user RPC and
 * should NOT be logged here; the RPC's atomic transaction guarantees it.
 */

import { createClient } from '@/lib/supabase/client';

export type AuditAction =
  | 'admin.create'
  | 'admin.update_role'
  | 'admin.set_status'
  | 'admin.reset_password'
  | 'admin.delete'
  | 'admin.self_profile_update'
  | 'admin.self_password_change'
  | 'user.approve'        // written by approve_user RPC; do not call from app code
  | 'user.reject'
  | 'user.suspend'
  | 'user.unsuspend'
  | 'user.reset_device'
  | 'user.bulk_approve'
  | 'user.bulk_suspend'
  | 'user.bulk_unsuspend'
  | 'site.create'
  | 'site.update'
  | 'site.delete';

export type AuditTargetType = 'user' | 'admin' | 'site';

export interface AuditInput {
  action: AuditAction;
  target_type?: AuditTargetType;
  target_id?: string;
  target_label?: string;
  site_id?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort: failures are swallowed (the user-visible mutation already
 * succeeded). We log to console for dev visibility.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('admin_audit_log').insert({
      actor_id: user.id,
      action: input.action,
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      target_label: input.target_label ?? null,
      site_id: input.site_id ?? null,
      metadata: input.metadata ?? {},
    });
    if (error && process.env.NODE_ENV !== 'production') {
      console.warn('[audit] insert failed:', error.message);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[audit] logAudit threw:', err);
    }
  }
}
