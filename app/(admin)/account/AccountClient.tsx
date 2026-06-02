'use client';

import type { AppUser } from '@/lib/types';
import { ProfileForm } from './ProfileForm';
import { PasswordForm } from './PasswordForm';

interface Props {
  me: AppUser;
  siteName: string | null;
}

export function AccountClient({ me, siteName }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ProfileForm me={me} siteName={siteName} />
      <PasswordForm email={me.email ?? ''} siteId={me.site_id ?? null} />
    </div>
  );
}
