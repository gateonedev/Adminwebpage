'use client';

import { SignOut } from '@phosphor-icons/react';
import type { UserRole } from '@/lib/types';

interface Props {
  email: string | null;
  fullName: string | null;
  role: UserRole;
}

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Süper yönetici',
  site_admin:  'Site yöneticisi',
  resident:    'Sakin',
  guest:       'Misafir',
};

export function Topbar({ email, fullName, role }: Props) {
  return (
    <header className="flex items-center justify-between h-16 px-6 lg:px-8 border-b border-sep bg-bg/80 backdrop-blur sticky top-0 z-30">
      <div className="text-sm text-textSec">
        {ROLE_LABEL[role]} paneli
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="text-sm text-text leading-tight">
            {fullName ?? ROLE_LABEL[role]}
          </span>
          {email && (
            <span className="text-[11px] text-textMuted font-mono leading-tight">
              {email}
            </span>
          )}
        </div>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="h-9 px-3 inline-flex items-center gap-2 rounded-[10px] border border-sep bg-surface hover:bg-surfaceUp text-sm text-textSec hover:text-text transition-colors active:translate-y-px"
            aria-label="Çıkış yap"
          >
            <SignOut size={16} weight="regular" />
            <span>Çıkış</span>
          </button>
        </form>
      </div>
    </header>
  );
}
