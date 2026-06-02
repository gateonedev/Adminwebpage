'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/auth/requireSuperAdmin';
import { logAuditServer } from '@/lib/audit-server';

const RoleEnum = z.enum(['site_admin', 'super_admin']);
const StatusEnum = z.enum(['active', 'suspended']);

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

const createSchema = z.object({
  email: z.string().trim().email('Geçerli bir e-posta girin.'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı.'),
  full_name: z.string().trim().min(2, 'Ad soyad en az 2 karakter olmalı.'),
  role: RoleEnum,
  site_id: z.string().uuid().nullable(),
}).superRefine((val, ctx) => {
  if (val.role === 'site_admin' && !val.site_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['site_id'], message: 'Site yöneticisi için site seçin.' });
  }
});

export type CreateAdminInput = z.infer<typeof createSchema>;

export async function createAdmin(input: CreateAdminInput): Promise<Result<{ id: string }>> {
  const me = await requireSuperAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Geçersiz veri.' };
  }
  const { email, password, full_name, role, site_id } = parsed.data;
  const target_site_id = role === 'super_admin' ? null : site_id;

  const admin = createAdminClient();

  // 1. Create the auth.users row.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name,
      site_id: target_site_id,
    },
  });
  if (createErr || !created?.user) {
    return { ok: false, message: createErr?.message ?? 'Kullanıcı oluşturulamadı.' };
  }
  const newId = created.user.id;

  // 2. Promote via the SECURITY DEFINER RPC, called as the super_admin caller
  //    (NOT the service-role identity) so its auth_user_role() check passes.
  const supabase = await createClient();
  const { error: rpcErr } = await supabase.rpc('set_user_role', {
    p_user_id: newId,
    p_role: role,
    p_site_id: target_site_id,
  });
  if (rpcErr) {
    // Roll back the auth user so we don't leave an orphaned account.
    await admin.auth.admin.deleteUser(newId);
    return { ok: false, message: `Rol atanamadı: ${rpcErr.message}` };
  }

  // 3. Sync full_name and audit-log the action.
  await admin.from('users').update({ full_name }).eq('id', newId);

  await logAuditServer(me.id, {
    action: 'admin.create',
    target_type: 'admin',
    target_id: newId,
    target_label: email,
    site_id: target_site_id,
    metadata: { role, full_name },
  });

  revalidatePath('/admins');
  return { ok: true, data: { id: newId } };
}

const updateRoleSchema = z.object({
  id: z.string().uuid(),
  role: RoleEnum,
  site_id: z.string().uuid().nullable(),
}).superRefine((val, ctx) => {
  if (val.role === 'site_admin' && !val.site_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['site_id'], message: 'Site yöneticisi için site seçin.' });
  }
});

export async function updateAdminRole(input: z.infer<typeof updateRoleSchema>): Promise<Result> {
  const me = await requireSuperAdmin();
  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Geçersiz veri.' };
  }
  const { id, role, site_id } = parsed.data;
  if (id === me.id) {
    return { ok: false, message: 'Kendi rolünüzü değiştiremezsiniz.' };
  }
  const target_site_id = role === 'super_admin' ? null : site_id;

  const supabase = await createClient();

  // Read the prior state for the audit metadata.
  const { data: prior } = await supabase
    .from('users')
    .select('email, full_name, role, site_id')
    .eq('id', id)
    .single();

  const { error } = await supabase.rpc('set_user_role', {
    p_user_id: id,
    p_role: role,
    p_site_id: target_site_id,
  });
  if (error) return { ok: false, message: error.message };

  await logAuditServer(me.id, {
    action: 'admin.update_role',
    target_type: 'admin',
    target_id: id,
    target_label: prior?.email ?? prior?.full_name ?? undefined,
    site_id: target_site_id,
    metadata: {
      from_role:    prior?.role ?? null,
      to_role:      role,
      from_site_id: prior?.site_id ?? null,
      to_site_id:   target_site_id,
    },
  });

  revalidatePath('/admins');
  return { ok: true };
}

export async function setAdminStatus(input: { id: string; status: 'active' | 'suspended' }): Promise<Result> {
  const me = await requireSuperAdmin();
  const parsed = z.object({ id: z.string().uuid(), status: StatusEnum }).safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Geçersiz veri.' };
  const { id, status } = parsed.data;
  if (id === me.id) {
    return { ok: false, message: 'Kendi hesabınızı askıya alamazsınız.' };
  }

  const admin = createAdminClient();

  // Snapshot for audit before flipping.
  const { data: prior } = await admin
    .from('users')
    .select('email, full_name, status, site_id')
    .eq('id', id)
    .single();

  const { error } = await admin.from('users').update({ status }).eq('id', id);
  if (error) return { ok: false, message: error.message };

  await logAuditServer(me.id, {
    action: 'admin.set_status',
    target_type: 'admin',
    target_id: id,
    target_label: prior?.email ?? prior?.full_name ?? undefined,
    site_id: prior?.site_id ?? null,
    metadata: {
      from_status: prior?.status ?? null,
      to_status:   status,
    },
  });

  revalidatePath('/admins');
  return { ok: true };
}

const resetPasswordSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı.'),
});

export async function resetAdminPassword(input: z.infer<typeof resetPasswordSchema>): Promise<Result> {
  const me = await requireSuperAdmin();
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Geçersiz veri.' };
  }
  const admin = createAdminClient();

  const { data: prior } = await admin
    .from('users')
    .select('email, full_name, site_id')
    .eq('id', parsed.data.id)
    .single();

  const { error } = await admin.auth.admin.updateUserById(parsed.data.id, {
    password: parsed.data.password,
  });
  if (error) return { ok: false, message: error.message };

  await logAuditServer(me.id, {
    action: 'admin.reset_password',
    target_type: 'admin',
    target_id: parsed.data.id,
    target_label: prior?.email ?? prior?.full_name ?? undefined,
    site_id: prior?.site_id ?? null,
  });

  return { ok: true };
}

export async function deleteAdmin(input: { id: string }): Promise<Result> {
  const me = await requireSuperAdmin();
  if (input.id === me.id) {
    return { ok: false, message: 'Kendi hesabınızı silemezsiniz.' };
  }
  const admin = createAdminClient();

  // Snapshot before deletion since the cascade will wipe public.users.
  const { data: prior } = await admin
    .from('users')
    .select('email, full_name, role, site_id')
    .eq('id', input.id)
    .single();

  const { error } = await admin.auth.admin.deleteUser(input.id);
  if (error) return { ok: false, message: error.message };

  await logAuditServer(me.id, {
    action: 'admin.delete',
    target_type: 'admin',
    target_id: input.id,
    target_label: prior?.email ?? prior?.full_name ?? undefined,
    site_id: prior?.site_id ?? null,
    metadata: {
      role:      prior?.role ?? null,
      full_name: prior?.full_name ?? null,
    },
  });

  revalidatePath('/admins');
  return { ok: true };
}
