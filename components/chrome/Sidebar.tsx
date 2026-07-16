'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Buildings, ShieldCheck, House, Users, Garage, UsersThree, ClockCounterClockwise, UserPlus, Bell, ShieldStar, UserCircle } from '@phosphor-icons/react';
import { cx } from '@/lib/cx';
import { Logo } from '@/components/Logo';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: typeof House;
  superOnly?: boolean;
}

const items: NavItem[] = [
  { href: '/dashboard',     label: 'Genel bakış',  icon: House },
  { href: '/users',         label: 'Kullanıcılar', icon: Users },
  { href: '/barriers',      label: 'Bariyerler',   icon: Garage },
  { href: '/groups',        label: 'Gruplar',      icon: UsersThree },
  { href: '/logs',          label: 'Hareketler',   icon: ClockCounterClockwise },
  { href: '/guests',        label: 'Misafirler',   icon: UserPlus },
  { href: '/notifications', label: 'Bildirimler',  icon: Bell },
  { href: '/sites',         label: 'Siteler',      icon: Buildings,   superOnly: true },
  { href: '/admins',        label: 'Yöneticiler',  icon: ShieldCheck, superOnly: true },
  { href: '/audit',         label: 'Denetim',      icon: ShieldStar,  superOnly: true },
  { href: '/account',       label: 'Hesabım',      icon: UserCircle },
];

interface Props {
  role: UserRole;
}

export function Sidebar({ role }: Props) {
  const pathname = usePathname();
  const visible = items.filter((i) => !i.superOnly || role === 'super_admin');
  const unread = useUnreadNotificationCount(pathname);

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-surface border-r border-sep">
      <div className="px-6 pt-6 pb-8">
        <Logo size="small" />
      </div>
      <nav className="flex-1 px-3 flex flex-col gap-1">
        {visible.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cx(
                'flex items-center gap-3 px-3 h-10 rounded-[10px] text-sm transition-colors',
                active
                  ? 'bg-accentDim text-accent'
                  : 'text-textSec hover:text-text hover:bg-surfaceUp',
              )}
            >
              <Icon size={18} weight={active ? 'fill' : 'regular'} />
              <span className="font-medium">{label}</span>
              {href === '/notifications' && unread > 0 && (
                <span className="ml-auto min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-accent text-white text-[11px] font-semibold">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-5 border-t border-sep text-[11px] text-textMuted font-mono tracking-widest uppercase">
        {role === 'super_admin' ? 'Süper yönetim' : 'Site yönetimi'}
      </div>
    </aside>
  );
}

/**
 * Okunmamış admin bildirimi sayısı. Sayfa geçişlerinde ve 60 sn'de bir
 * yenilenir (mobildeki "Daha" rozetinin web karşılığı; realtime gerekmez).
 */
function useUnreadNotificationCount(pathname: string): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      // getSession çerezden okur (ağa çıkmaz); getUser her seferinde uzak
      // Auth sunucusuna giderdi. RLS zaten yalnızca kendi satırlarını verir.
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid || cancelled) return;
      const { count } = await supabase
        .from('admin_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', uid)
        .is('read_at', null);
      if (!cancelled) setUnread(count ?? 0);
    }

    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pathname]);

  return unread;
}
