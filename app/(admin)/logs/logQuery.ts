/**
 * Sunucu (page.tsx) ve istemci (LogsPageClient) tarafından paylaşılan log
 * sorgu sözleşmesi. Ayrı bir modülde olmalı: 'use client' işaretli bir
 * dosyadan server component'e import edilen runtime değerleri gerçek değer
 * değil, client-reference proxy'si olur ve supabase select() içinde patlar.
 */

export const PAGE_SIZE = 200;

// barriers!inner: access_logs'ta site_id olmadığı için site kapsaması join
// filtresiyle (.eq('barriers.site_id', siteId)) yapılır — bariyer id'lerini
// önceden çeken ara sorguya gerek kalmaz.
export const LOG_SELECT =
  'id, barrier_id, user_id, method, timestamp, users(full_name), guests(guest_name), barriers!inner(name, site_id)';
