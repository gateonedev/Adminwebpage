'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Buildings, ShieldCheck, House, Users, Garage, UsersThree, ClockCounterClockwise, UserPlus, ShieldStar, UserCircle } from '@phosphor-icons/react';
import { cx } from '@/lib/cx';
import { Logo } from '@/components/Logo';
import type { UserRole } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: typeof House;
  superOnly?: boolean;
}

const items: NavItem[] = [
  { href: '/dashboard', label: 'Genel bakış',  icon: House },
  { href: '/users',     label: 'Kullanıcılar', icon: Users },
  { href: '/barriers',  label: 'Bariyerler',   icon: Garage },
  { href: '/groups',    label: 'Gruplar',      icon: UsersThree },
  { href: '/logs',      label: 'Hareketler',   icon: ClockCounterClockwise },
  { href: '/guests',    label: 'Misafirler',   icon: UserPlus },
  { href: '/sites',     label: 'Siteler',      icon: Buildings,   superOnly: true },
  { href: '/admins',    label: 'Yöneticiler',  icon: ShieldCheck, superOnly: true },
  { href: '/audit',     label: 'Denetim',      icon: ShieldStar,  superOnly: true },
  { href: '/account',   label: 'Hesabım',      icon: UserCircle },
];

interface Props {
  role: UserRole;
}

export function Sidebar({ role }: Props) {
  const pathname = usePathname();
  const visible = items.filter((i) => !i.superOnly || role === 'super_admin');

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
