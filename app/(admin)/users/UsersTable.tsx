'use client';

import { Check } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/Badge';
import { cx } from '@/lib/cx';
import type { AppUser, UserStatus } from '@/lib/types';

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const STATUS_TONE: Record<UserStatus, 'success' | 'warn' | 'muted' | 'danger'> = {
  active:    'success',
  pending:   'warn',
  suspended: 'muted',
  rejected:  'danger',
  archived:  'muted',
};

const STATUS_LABEL: Record<UserStatus, string> = {
  active:    'Aktif',
  pending:   'Beklemede',
  suspended: 'Askıda',
  rejected:  'Reddedildi',
  archived:  'Arşivlendi',
};

const ROLE_LABEL: Record<AppUser['role'], string> = {
  resident:    'Sakin',
  site_admin:  'Yönetici',
  super_admin: 'Süper',
  guest:       'Misafir',
};

/**
 * Satır bilgisi: "A Blok · Daire 12". Blok adında "blok" kelimesi zaten
 * geçiyorsa tekrar eklenmez ("A Blok Blok" olmasın); daire için aynı kural.
 * İkisi de boşsa e-posta fallback'i gösterilir (satır bilgisiz kalmasın;
 * e-posta ayrıca detay görünümünde durur). Mobil residenceLabel ile aynı.
 */
function residenceLabel(user: AppUser): string | null {
  const parts: string[] = [];
  const block = user.block_name?.trim();
  const apartment = user.apartment_no?.trim();
  if (block) parts.push(/blok/i.test(block) ? block : `${block} Blok`);
  if (apartment) parts.push(/daire/i.test(apartment) ? apartment : `Daire ${apartment}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

interface Props {
  users: AppUser[];
  selectedIds: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAllVisible: () => void;
  allVisibleSelected: boolean;
  onSelect: (u: AppUser) => void;
}

const COLUMNS = 'grid-cols-[auto_1.5fr_1.5fr_auto_auto_auto]';

export function UsersTable({
  users,
  selectedIds,
  onToggleOne,
  onToggleAllVisible,
  allVisibleSelected,
  onSelect,
}: Props) {
  return (
    <div className="border-t border-sep divide-y divide-sep">
      <div className={cx('grid gap-4 px-3 py-3 text-[11px] uppercase tracking-wider text-textMuted', COLUMNS)}>
        <CheckBox
          aria-label="Görünenleri seç"
          checked={allVisibleSelected}
          onClick={onToggleAllVisible}
        />
        <div>Ad</div>
        <div>Blok / Daire</div>
        <div>Rol</div>
        <div>Durum</div>
        <div className="w-8" />
      </div>
      {users.map((u) => {
        const isSelected = selectedIds.has(u.id);
        return (
          <div
            key={u.id}
            onClick={() => onSelect(u)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(u);
              }
            }}
            className={cx(
              'grid gap-4 px-3 py-4 items-center cursor-pointer transition-colors',
              COLUMNS,
              isSelected ? 'bg-accentDim/40' : 'hover:bg-surface/50',
            )}
          >
            <CheckBox
              aria-label={`${u.full_name || u.email || 'Kullanıcı'} satırını seç`}
              checked={isSelected}
              onClick={(e) => {
                e.stopPropagation();
                onToggleOne(u.id);
              }}
            />
            <div className="min-w-0">
              <div className="font-medium truncate">{u.full_name || '—'}</div>
              <div className="text-[11px] text-textMuted font-mono">
                {dateFormatter.format(new Date(u.created_at))}
              </div>
            </div>
            <div className="min-w-0 text-sm text-textSec">
              {residenceLabel(u) ? (
                <div className="truncate">{residenceLabel(u)}</div>
              ) : (
                <div className="font-mono truncate">
                  {u.email || <span className="text-textMuted">—</span>}
                </div>
              )}
            </div>
            <div>
              <Badge tone={u.role === 'resident' ? 'muted' : 'accent'}>
                {ROLE_LABEL[u.role]}
              </Badge>
            </div>
            <div>
              <Badge tone={STATUS_TONE[u.status]}>{STATUS_LABEL[u.status]}</Badge>
            </div>
            <div className="text-right">
              <span className="text-xs text-textMuted">›</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface CheckBoxProps {
  checked: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  'aria-label': string;
}

function CheckBox({ checked, onClick, ...rest }: CheckBoxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={cx(
        'h-5 w-5 rounded-md border flex items-center justify-center transition-colors shrink-0',
        checked
          ? 'bg-accent border-accent text-white'
          : 'bg-surface border-sep hover:border-textMuted',
      )}
      {...rest}
    >
      {checked && <Check size={13} weight="bold" />}
    </button>
  );
}
