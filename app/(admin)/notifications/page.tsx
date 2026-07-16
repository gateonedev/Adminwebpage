import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { PageHeader } from '@/components/PageHeader';
import { NotificationsPageClient, type NotificationRow } from './NotificationsPageClient';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  // Feed alıcıya özeldir (RLS: recipient_user_id = auth.uid()); site picker gerekmez.
  const me = await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from('admin_notifications')
    .select('id, event_type, title, body, data, read_at, created_at')
    .eq('recipient_user_id', me.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const notifications = (data ?? []) as unknown as NotificationRow[];

  return (
    <>
      <PageHeader
        title="Bildirimler"
        description="Yeni kayıtlar, misafir davetleri ve cihaz değişiklikleri. Son 100 bildirim."
      />
      <NotificationsPageClient userId={me.id} initialNotifications={notifications} />
    </>
  );
}
