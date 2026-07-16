'use client';

import { useMemo, useState } from 'react';
import { Prohibit, Check, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from '@/components/ui/Toast';
import { cx } from '@/lib/cx';
import { createClient } from '@/lib/supabase/client';
import type { GuestAccessType, GuestApprovalStatus } from '@/lib/types';

export interface GuestRow {
  id: string;
  guest_name: string;
  guest_phone: string | null;
  access_type: GuestAccessType;
  expires_at: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  approval_status: GuestApprovalStatus;
  user_id: string | null;
  created_at: string;
  barriers: { name: string | null } | null;
  users:    { full_name: string | null } | null;
  /** Çoklu bariyer davetleri (migration 53). Boşsa tek bariyerli eski davet. */
  guest_barriers: { barriers: { name: string | null } | null }[] | null;
}

// set_guest_approval RPC dönüş şekli — mobile/lib/supabase.ts ile eş.
type SetGuestApprovalResult =
  | { ok: true;  decision: 'approved' | 'rejected' }
  | { ok: false; reason: 'not_pending'; current: GuestApprovalStatus };

type RevokeGuestResult =
  | { ok: true; already_inactive?: boolean }
  | { ok: false; reason: 'not_found' };

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

interface Props {
  initialGuests: GuestRow[];
}

type Mode = 'pending' | 'active' | 'app_users' | 'all';

const MODES: { value: Mode; label: string }[] = [
  { value: 'pending',   label: 'Bekleyen' },
  { value: 'active',    label: 'Aktif' },
  { value: 'app_users', label: 'Uygulamalı' },
  { value: 'all',       label: 'Tümü' },
];

const EMPTY_LABEL: Record<Mode, string> = {
  pending:   'Onay bekleyen misafir yok.',
  active:    'Aktif misafir yok.',
  app_users: 'Uygulamalı misafir yok.',
  all:       'Hiç misafir kaydı yok.',
};

export function GuestsPageClient({ initialGuests }: Props) {
  const [guests, setGuests] = useState(initialGuests);
  const [mode, setMode] = useState<Mode>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ guest: GuestRow; decision: 'approved' | 'rejected' } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const counts = useMemo(() => {
    let pending = 0;
    let active = 0;
    let app_users = 0;
    for (const g of guests) {
      if (g.is_active && g.approval_status === 'pending') pending++;
      if (g.is_active) active++;
      if (g.user_id != null) app_users++;
    }
    return { pending, active, app_users, all: guests.length };
  }, [guests]);

  const filtered = useMemo(() => {
    if (mode === 'pending')   return guests.filter((g) => g.is_active && g.approval_status === 'pending');
    if (mode === 'active')    return guests.filter((g) => g.is_active);
    if (mode === 'app_users') return guests.filter((g) => g.user_id != null);
    return guests;
  }, [guests, mode]);

  async function revoke(g: GuestRow) {
    if (!g.is_active) return;
    setBusyId(g.id);
    const supabase = createClient();
    // guests tablosuna direkt UPDATE izni kaldırıldı (migration 49-52);
    // iptal artık RPC ile yapılır. Audit kaydını (guest.revoke) RPC yazar.
    const { data, error } = await supabase.rpc('revoke_guest_invitation', {
      p_guest_id: g.id,
    });
    setBusyId(null);
    if (error) {
      toast(`İptal edilemedi: ${error.message}`, 'error');
      return;
    }
    const res = data as RevokeGuestResult;
    if (!res.ok) {
      toast('Davet bulunamadı. Liste güncel olmayabilir.', 'error');
      return;
    }
    setGuests((prev) => prev.map((row) => (row.id === g.id ? { ...row, is_active: false } : row)));
    toast(res.already_inactive ? 'Davet zaten iptal edilmişti.' : 'Misafir iptal edildi.', 'success');
  }

  function barrierLabel(g: GuestRow): string {
    const multi = (g.guest_barriers ?? [])
      .map((gb) => gb.barriers?.name)
      .filter((n): n is string => Boolean(n));
    if (multi.length > 0) return multi.join(', ');
    return g.barriers?.name ?? '—';
  }

  function decide(g: GuestRow, decision: 'approved' | 'rejected') {
    setConfirm({ guest: g, decision });
  }

  async function runDecision() {
    if (!confirm) return;
    const { guest, decision } = confirm;
    setConfirmBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('set_guest_approval', {
      p_guest_id: guest.id,
      p_decision: decision,
    });
    setConfirmBusy(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    const res = data as SetGuestApprovalResult;
    if (!res.ok) {
      // Davet başka bir admin/cihaz tarafından zaten işlenmiş. Gerçek durumu yansıt.
      setGuests((prev) =>
        prev.map((row) => (row.id === guest.id ? { ...row, approval_status: res.current } : row)),
      );
      toast('Bu davet zaten işlenmiş.', 'error');
      setConfirm(null);
      return;
    }
    setGuests((prev) =>
      prev.map((row) => (row.id === guest.id ? { ...row, approval_status: decision } : row)),
    );
    toast(decision === 'approved' ? 'Davet onaylandı.' : 'Davet reddedildi.', 'success');
    setConfirm(null);
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
      <div className="flex flex-wrap gap-2 mb-6">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={cx(
              'h-8 px-3 inline-flex items-center gap-2 rounded-full border text-xs font-medium transition-colors',
              mode === m.value
                ? 'bg-accentDim border-accent/40 text-accent'
                : 'bg-surface border-sep text-textSec hover:text-text',
            )}
          >
            <span>{m.label}</span>
            <span className="font-mono text-textMuted">{counts[m.value]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="border-t border-sep py-16 text-center">
          <p className="text-text font-medium">{EMPTY_LABEL[mode]}</p>
        </div>
      ) : (
        <div className="border-t border-sep divide-y divide-sep">
          <div className="grid grid-cols-[1.4fr_1.1fr_1.1fr_auto_auto_auto] gap-4 px-3 py-3 text-[11px] uppercase tracking-wider text-textMuted">
            <div>Misafir</div>
            <div>Bariyer</div>
            <div>Davet eden</div>
            <div>Tür</div>
            <div>Bilgi</div>
            <div className="w-40" />
          </div>
          {filtered.map((g) => (
            <div
              key={g.id}
              className={cx(
                'grid grid-cols-[1.4fr_1.1fr_1.1fr_auto_auto_auto] gap-4 px-3 py-3 items-center',
                !g.is_active && 'opacity-60',
              )}
            >
              <div className="min-w-0">
                <div className="text-sm text-text truncate">{g.guest_name}</div>
                {g.guest_phone && (
                  <div className="text-[11px] text-textMuted font-mono truncate">{g.guest_phone}</div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {g.approval_status === 'pending' && <Badge tone="warn">Onay bekliyor</Badge>}
                  {g.approval_status === 'rejected' && <Badge tone="danger">Reddedildi</Badge>}
                  {g.user_id ? (
                    <Badge tone="success">Uygulamalı</Badge>
                  ) : (
                    <Badge tone="muted">App-suz</Badge>
                  )}
                </div>
              </div>
              <div className="text-sm text-textSec truncate" title={barrierLabel(g)}>{barrierLabel(g)}</div>
              <div className="text-sm text-textSec truncate">{g.users?.full_name ?? '—'}</div>
              <Badge tone={ACCESS_TONE[g.access_type]}>{ACCESS_LABEL[g.access_type]}</Badge>
              <div className="text-xs text-textSec font-mono whitespace-nowrap">{expiryLabel(g)}</div>
              <div className="flex items-center justify-end gap-2">
                {!g.is_active ? (
                  <Badge tone="muted">İptal edildi</Badge>
                ) : g.approval_status === 'pending' ? (
                  <>
                    <Button variant="danger" size="sm" onClick={() => decide(g, 'rejected')}>
                      <X size={14} />
                      Reddet
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => decide(g, 'approved')}>
                      <Check size={14} />
                      Onayla
                    </Button>
                  </>
                ) : g.approval_status === 'rejected' ? (
                  <Badge tone="danger">Reddedildi</Badge>
                ) : (
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
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !confirmBusy) setConfirm(null);
        }}
        title={confirm?.decision === 'approved' ? 'Daveti onayla' : 'Daveti reddet'}
        description={
          confirm
            ? `${confirm.guest.guest_name} için davet ${
                confirm.decision === 'approved' ? 'onaylansın' : 'reddedilsin'
              } mi?`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)} disabled={confirmBusy}>
              Vazgeç
            </Button>
            <Button
              variant={confirm?.decision === 'approved' ? 'primary' : 'danger'}
              size="sm"
              onClick={runDecision}
              loading={confirmBusy}
            >
              {confirm?.decision === 'approved' ? 'Onayla' : 'Reddet'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-textSec">
          {confirm?.decision === 'approved'
            ? 'Davet onaylandığında sakine bildirim gider ve misafir davet kodunu kullanarak geçiş yapabilir.'
            : 'Davet reddedildiğinde sakine bildirim gider ve davet kodu geçersiz olur.'}
        </p>
      </Dialog>
    </>
  );
}
