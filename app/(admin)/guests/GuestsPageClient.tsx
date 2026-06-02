'use client';

import { useMemo, useState } from 'react';
import { Prohibit } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { cx } from '@/lib/cx';
import { createClient } from '@/lib/supabase/client';
import type { GuestAccessType } from '@/lib/types';

export interface GuestRow {
  id: string;
  guest_name: string;
  guest_phone: string | null;
  access_type: GuestAccessType;
  expires_at: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  created_at: string;
  barriers: { name: string | null } | null;
  users:    { full_name: string | null } | null;
}

const ACCESS_LABEL: Record<GuestAccessType, string> = {
  one_time:      'Tek seferlik',
  time_limited:  'Süreli',
  count_limited: 'Sayılı',
};

const ACCESS_TONE: Record<GuestAccessType, 'accent' | 'warn' | 'success'> = {
  one_time:      'accent',
  time_limited:  'warn',
  count_limited: 'success',
};

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

interface Props {
  initialGuests: GuestRow[];
}

type Mode = 'active' | 'all';

export function GuestsPageClient({ initialGuests }: Props) {
  const [guests, setGuests] = useState(initialGuests);
  const [mode, setMode] = useState<Mode>('active');
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    let active = 0;
    let revoked = 0;
    for (const g of guests) g.is_active ? active++ : revoked++;
    return { active, revoked };
  }, [guests]);

  const filtered = mode === 'active' ? guests.filter((g) => g.is_active) : guests;

  async function revoke(g: GuestRow) {
    if (!g.is_active) return;
    setBusyId(g.id);
    const supabase = createClient();
    const { error } = await supabase.from('guests').update({ is_active: false }).eq('id', g.id);
    setBusyId(null);
    if (error) {
      toast(`İptal edilemedi: ${error.message}`, 'error');
      return;
    }
    setGuests((prev) => prev.map((row) => (row.id === g.id ? { ...row, is_active: false } : row)));
    toast('Misafir iptal edildi.', 'success');
  }

  function expiryLabel(g: GuestRow): string {
    if (g.access_type === 'count_limited') {
      return `${g.current_uses}/${g.max_uses ?? '?'} kullanım`;
    }
    if (g.access_type === 'time_limited' && g.expires_at) {
      return dateFormatter.format(new Date(g.expires_at));
    }
    if (g.access_type === 'one_time') {
      return g.current_uses > 0 ? 'Kullanıldı' : 'Tek seferlik';
    }
    return '—';
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-6 text-sm">
          <Stat label="Aktif" value={counts.active} tone="success" />
          <span className="h-4 w-px bg-sep" />
          <Stat label="İptal" value={counts.revoked} tone="muted" />
        </div>
        <div className="inline-flex rounded-full border border-sep bg-surface p-0.5">
          {(['active', 'all'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cx(
                'h-8 px-4 text-xs font-medium rounded-full transition-colors',
                mode === m ? 'bg-accentDim text-accent' : 'text-textSec hover:text-text',
              )}
            >
              {m === 'active' ? 'Sadece aktif' : 'Tümü'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border-t border-sep py-16 text-center">
          <p className="text-text font-medium">Gösterilecek misafir yok.</p>
        </div>
      ) : (
        <div className="border-t border-sep divide-y divide-sep">
          <div className="grid grid-cols-[1.4fr_1.2fr_1.2fr_auto_auto_auto] gap-4 px-3 py-3 text-[11px] uppercase tracking-wider text-textMuted">
            <div>Misafir</div>
            <div>Bariyer</div>
            <div>Davet eden</div>
            <div>Tür</div>
            <div>Bilgi</div>
            <div className="w-24" />
          </div>
          {filtered.map((g) => (
            <div
              key={g.id}
              className={cx(
                'grid grid-cols-[1.4fr_1.2fr_1.2fr_auto_auto_auto] gap-4 px-3 py-3 items-center',
                !g.is_active && 'opacity-60',
              )}
            >
              <div className="min-w-0">
                <div className="text-sm text-text truncate">{g.guest_name}</div>
                {g.guest_phone && (
                  <div className="text-[11px] text-textMuted font-mono truncate">{g.guest_phone}</div>
                )}
              </div>
              <div className="text-sm text-textSec truncate">{g.barriers?.name ?? '—'}</div>
              <div className="text-sm text-textSec truncate">{g.users?.full_name ?? '—'}</div>
              <Badge tone={ACCESS_TONE[g.access_type]}>{ACCESS_LABEL[g.access_type]}</Badge>
              <div className="text-xs text-textSec font-mono whitespace-nowrap">{expiryLabel(g)}</div>
              <div className="text-right">
                {g.is_active ? (
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => revoke(g)}
                    loading={busyId === g.id}
                    aria-label="İptal et"
                  >
                    <Prohibit size={14} />
                    İptal
                  </Button>
                ) : (
                  <span className="text-[11px] text-textMuted font-mono whitespace-nowrap">
                    {dateTimeFormatter.format(new Date(g.created_at))}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'success' | 'muted' }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span
        className={cx(
          'font-mono text-2xl tabular-nums',
          tone === 'success' ? 'text-success' : 'text-textMuted',
        )}
      >
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-textMuted">{label}</span>
    </span>
  );
}
