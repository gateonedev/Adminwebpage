/**
 * Domain types — kept in sync with mobile/lib/supabase.ts. If you change the
 * shape on one side, change the other.
 */

export type UserRole = 'resident' | 'site_admin' | 'super_admin';
export type UserStatus = 'pending' | 'active' | 'rejected' | 'suspended';
export type AccessMethod = 'manual' | 'hands_free' | 'guest';
export type GuestAccessType = 'time_limited' | 'count_limited' | 'one_time';

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
  auth_token: string;
  is_active: boolean;
  hands_free_enabled: boolean;
  relay_duration_ms: number;
  rssi_threshold: number | null;
  created_at: string;
}

export interface AppUser {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  site_id: string | null;
  role: UserRole;
  status: UserStatus;
  device_id: string | null;
  device_registered_at: string | null;
  last_device_change_at: string | null;
  hands_free_enabled: boolean;
  created_at: string;
}

export interface AdminUserRow extends AppUser {
  sites: { name: string } | null;
}
