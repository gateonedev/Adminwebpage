/**
 * Sunucu (page.tsx) ve istemci (AuditPageClient) tarafından paylaşılan denetim
 * sorgu sözleşmesi. Ayrı bir modülde olmalı: 'use client' işaretli bir dosyadan
 * server component'e import edilen runtime değerleri client-reference proxy'si
 * olur ve supabase select() içinde patlar (logQuery.ts ile aynı gerekçe).
 */

// Mobil 50 kullanır; web'de daha büyük sayfa sorun değil (spec'e uygun).
export const AUDIT_PAGE_SIZE = 100;

// Aktör ve site join'leri LEFT embed KALMALI (asla !inner): site_admin RLS
// gereği super_admin'in users satırını okuyamaz; inner join o kayıtları
// düşürürdü. Keyset sıralama (created_at desc, id desc) migration 57'deki
// kompozit indekse oturur.
export const AUDIT_SELECT =
  'id, action, target_type, target_id, target_label, site_id, metadata, created_at, ' +
  'users:actor_id(full_name, email), sites:site_id(name)';
