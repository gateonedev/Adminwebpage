/**
 * Domain types — kept in sync with mobile/lib/supabase.ts. If you change the
 * shape on one side, change the other.
 */

export type UserRole = 'resident' | 'site_admin' | 'super_admin' | 'guest';
export type UserStatus = 'pending' | 'active' | 'rejected' | 'suspended' | 'archived';

/**
 * Safe column projections — the DB uses column-level grants (migration 42,
 * secure_device_binding_v2), so `select('*')` fails with "permission denied".
 * Keep these lists in sync with the GRANT SELECT lists in the backend repo.
 */
// Typed as plain `string` so supabase-js skips type-level query parsing and
// the existing `as AppUser` / `as Barrier[]` casts keep working.
export const USER_COLUMNS: string =
  'id, full_name, phone, plate, block_name, apartment_no, email, site_id, ' +
  'role, status, hands_free_enabled, archived_at, archived_by, created_at';

export const BARRIER_COLUMNS: string =
  'id, site_id, name, ble_identifier, is_active, relay_duration_ms, ' +
  'rssi_threshold, created_at, hands_free_enabled';
export type AccessMethod = 'manual' | 'hands_free' | 'guest';
export type GuestAccessType = 'time_limited' | 'count_limited' | 'one_time';
export type GuestApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Site {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
}

export interface Barrier {
  id: string;
  site_id: string;
  name: string;
  ble_identifier: string;
  is_active: boolean;
  hands_free_enabled: boolean;
  relay_duration_ms: number;
  // NOT NULL since migration 0024 (default -65, CHECK -100..-30).
  rssi_threshold: number;
  created_at: string;
}

export interface AppUser {
  id: string;
  full_name: string;
  phone: string | null;
  plate: string | null;
  block_name: string | null;
  apartment_no: string | null;
  email: string | null;
  site_id: string | null;
  role: UserRole;
  status: UserStatus;
  hands_free_enabled: boolean;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
}

export interface AdminUserRow extends AppUser {
  sites: { name: string } | null;
}
