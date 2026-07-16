'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Checks } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { cx } from '@/lib/cx';
import { createClient } from '@/lib/supabase/client';

export interface NotificationRow {
  id: string;
  event_type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

// Mobil (admin)/notifications.tsx ile aynı olay türleri ve hedef ekranlar.
const EVENT_DEF: Record<string, { label: string; tone: 'accent' | 'warn' | 'danger'; route: string }> = {
  'guest.created':    { label: 'Misafir',      tone: 'warn',   route: '/guests' },
  'resident.pending': { label: 'Yeni kayıt',   tone: 'accent', route: '/users' },
  'device.changed':   { label: 'Cihaz değişti', tone: 'danger', route: '/users' },
};

const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

interface Props {
  userId: string;
  initialNotifications: NotificationRow[];
}

export function NotificationsPageClient({ userId, initialNotifications }: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications],
  );

  async function open(n: NotificationRow) {
    if (!n.read_at) {
      const supabase = createClient();
      const readAt = new Date().toISOString();
      const { error } = await supabase
        .from('admin_notifications')
        .update({ read_at: readAt })
        .eq('id', n.id);
      if (!error) {
        setNotifications((prev) =>
          prev.map((row) => (row.id === n.id ? { ...row, read_at: readAt } : row)),
        );
      }
    }
    const route = EVENT_DEF[n.event_type]?.route;
    if (route) router.push(route);
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    const supabase = createClient();
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('admin_notifications')
      .update({ read_at: readAt })
      .eq('recipient_user_id', userId)
      .is('read_at', null);
    setMarkingAll(false);
    if (error) {
      toast(`İşaretlenemedi: ${error.message}`, 'error');
      return;
    }
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: readAt })));
    toast('Tüm bildirimler okundu olarak işaretlendi.', 'success');
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 text-xs text-textMuted">
        <span>{unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : 'Tümü okundu'}</span>
        <Button
          variant="subtle"
          size="sm"
          onClick={markAllRead}
          loading={markingAll}
          disabled={unreadCount === 0}
        >
          <Checks size={14} />
          Hepsini okundu işaretle
        </Button>
      </div>

      {notifications.length === 0 ? (
        <div className="border-t border-sep py-16 text-center">
          <p className="text-text font-medium">Bildirim yok.</p>
          <p className="mt-1 text-sm text-textSec">
            Yeni kayıt, misafir daveti veya cihaz değişikliği olduğunda burada görünür.
          </p>
        </div>
      ) : (
        <div className="border-t border-sep divide-y divide-sep">
          {notifications.map((n) => {
            const def = EVENT_DEF[n.event_type];
            const unread = !n.read_at;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => open(n)}
                className={cx(
                  'w-full text-left grid grid-cols-[auto_1fr_auto] gap-4 px-3 py-3 items-start transition-colors hover:bg-surfaceUp',
                  unread ? 'bg-accentDim/20' : 'opacity-75',
                )}
              >
                <span
                  className={cx(
                    'mt-1.5 h-2 w-2 rounded-full shrink-0',
                    unread ? 'bg-accent' : 'bg-transparent',
                  )}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cx('text-sm truncate', unread ? 'text-text font-medium' : 'text-textSec')}>
                      {n.title}
                    </span>
                    {def && <Badge tone={def.tone}>{def.label}</Badge>}
                  </span>
                  {n.body && (
                    <span className="block mt-0.5 text-xs text-textSec truncate">{n.body}</span>
                  )}
                </span>
                <span className="text-xs text-textMuted font-mono whitespace-nowrap mt-0.5">
                  {dateTimeFormatter.format(new Date(n.created_at))}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
