'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, ArrowLeft, DeviceMobile } from '@phosphor-icons/react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { cx } from '@/lib/cx';
import { createClient } from '@/lib/supabase/client';
import { logAudit } from '@/lib/audit';
import type { AppUser, UserStatus } from '@/lib/types';

interface BarrierLite { id: string; name: string }
interface GroupLite   { id: string; name: string }

interface Props {
  siteId: string;
  user: AppUser | null;
  onOpenChange: (open: boolean) => void;
  barriers: BarrierLite[];
  groups: GroupLite[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

type Step = 'details' | 'assign';

const STATUS_LABEL: Record<UserStatus, string> = {
  active:    'Aktif',
  pending:   'Beklemede',
  suspended: 'Askıda',
  rejected:  'Reddedildi',
};

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function UserDetailDialog({
  user,
  onOpenChange,
  barriers,
  groups,
  onSuccess,
  onError,
}: Props) {
  const [step, setStep] = useState<Step>('details');
  const [busy, setBusy] = useState<null | string>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [selectedBarriers, setSelectedBarriers] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [existingBarriers, setExistingBarriers] = useState<Set<string>>(new Set());
  const [existingGroups, setExistingGroups] = useState<Set<string>>(new Set());
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);

  // Load fresh user state when the dialog opens.
  useEffect(() => {
    let aborted = false;
    if (!user) return;

    setStep('details');
    setBusy(null);
    setFullName(user.full_name ?? '');
    setPhone(user.phone ?? '');
    setSelectedBarriers(new Set());
    setSelectedGroups(new Set());
    setExistingBarriers(new Set());
    setExistingGroups(new Set());
    setAssignmentsLoaded(false);

    if (user.status === 'active' || user.status === 'suspended') {
      const supabase = createClient();
      Promise.all([
        supabase.from('user_barrier_access').select('barrier_id').eq('user_id', user.id),
        supabase.from('group_members').select('group_id').eq('user_id', user.id),
      ]).then(([uba, gm]) => {
        if (aborted) return;
        const ub = new Set((uba.data ?? []).map((r: { barrier_id: string }) => r.barrier_id));
        const gr = new Set((gm.data ?? []).map((r: { group_id: string }) => r.group_id));
        setExistingBarriers(ub);
        setExistingGroups(gr);
        setSelectedBarriers(new Set(ub));
        setSelectedGroups(new Set(gr));
        setAssignmentsLoaded(true);
      });
    } else {
      setAssignmentsLoaded(true);
    }

    return () => {
      aborted = true;
    };
  }, [user]);

  const isPending = user?.status === 'pending';
  const dirtyAssignments = useMemo(() => {
    if (!user || !(user.status === 'active' || user.status === 'suspended')) return false;
    if (!sameSet(existingBarriers, selectedBarriers)) return true;
    if (!sameSet(existingGroups, selectedGroups)) return true;
    return false;
  }, [user, existingBarriers, existingGroups, selectedBarriers, selectedGroups]);
  const dirtyProfile = !!user && (fullName.trim() !== (user.full_name ?? '') || (phone || '') !== (user.phone ?? ''));

  if (!user) return null;

  function toggle(set: Set<string>, fn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    fn(next);
  }

  async function handleApprove() {
    if (!user) return;
    setBusy('approve');
    const supabase = createClient();
    const { error } = await supabase.rpc('approve_user', {
      p_user_id: user.id,
      p_barrier_ids: Array.from(selectedBarriers),
      p_group_ids: Array.from(selectedGroups),
    });
    setBusy(null);
    if (error) {
      onError(`Onaylanamadı: ${error.message}`);
      return;
    }
    onSuccess(`${user.full_name || 'Kullanıcı'} onaylandı.`);
  }

  async function handleReject() {
    if (!user) return;
    setBusy('reject');
    const supabase = createClient();
    const { error } = await supabase.from('users').update({ status: 'rejected' }).eq('id', user.id);
    setBusy(null);
    if (error) {
      onError(`Reddedilemedi: ${error.message}`);
      return;
    }
    void logAudit({
      action: 'user.reject',
      target_type: 'user',
      target_id: user.id,
      target_label: user.full_name || user.email || undefined,
      site_id: user.site_id,
    });
    onSuccess(`${user.full_name || 'Kullanıcı'} reddedildi.`);
  }

  async function handleToggleSuspend() {
    if (!user) return;
    const next = user.status === 'suspended' ? 'active' : 'suspended';
    setBusy('suspend');
    const supabase = createClient();
    const { error } = await supabase.from('users').update({ status: next }).eq('id', user.id);
    setBusy(null);
    if (error) {
      onError(`Güncellenemedi: ${error.message}`);
      return;
    }
    void logAudit({
      action: next === 'suspended' ? 'user.suspend' : 'user.unsuspend',
      target_type: 'user',
      target_id: user.id,
      target_label: user.full_name || user.email || undefined,
      site_id: user.site_id,
    });
    onSuccess(next === 'suspended' ? 'Kullanıcı askıya alındı.' : 'Kullanıcı tekrar aktif edildi.');
  }

  async function handleResetDevice() {
    if (!user) return;
    setBusy('device');
    const supabase = createClient();
    const previousDeviceId = user.device_id;
    const { error } = await supabase
      .from('users')
      .update({ device_id: null, device_registered_at: null, last_device_change_at: null })
      .eq('id', user.id);
    setBusy(null);
    if (error) {
      onError(`Cihaz sıfırlanamadı: ${error.message}`);
      return;
    }
    void logAudit({
      action: 'user.reset_device',
      target_type: 'user',
      target_id: user.id,
      target_label: user.full_name || user.email || undefined,
      site_id: user.site_id,
      metadata: { previous_device_id: previousDeviceId },
    });
    onSuccess('Cihaz bağı kaldırıldı.');
  }

  async function handleSaveProfile() {
    if (!user) return;
    setBusy('profile');
    const supabase = createClient();
    const { error } = await supabase
      .from('users')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      })
      .eq('id', user.id);
    setBusy(null);
    if (error) {
      onError(`Kaydedilemedi: ${error.message}`);
      return;
    }
    onSuccess('Profil kaydedildi.');
  }

  async function handleSaveAssignments() {
    if (!user) return;
    setBusy('assign');
    const supabase = createClient();

    const barriersToRemove = Array.from(existingBarriers).filter((id) => !selectedBarriers.has(id));
    const barriersToAdd    = Array.from(selectedBarriers).filter((id) => !existingBarriers.has(id));
    const groupsToRemove   = Array.from(existingGroups).filter((id) => !selectedGroups.has(id));
    const groupsToAdd      = Array.from(selectedGroups).filter((id) => !existingGroups.has(id));

    try {
      if (barriersToRemove.length) {
        const { error } = await supabase
          .from('user_barrier_access')
          .delete()
          .eq('user_id', user.id)
          .in('barrier_id', barriersToRemove);
        if (error) throw error;
      }
      if (barriersToAdd.length) {
        const { error } = await supabase
          .from('user_barrier_access')
          .insert(barriersToAdd.map((bid) => ({ user_id: user.id, barrier_id: bid })));
        if (error) throw error;
      }
      if (groupsToRemove.length) {
        const { error } = await supabase
          .from('group_members')
          .delete()
          .eq('user_id', user.id)
          .in('group_id', groupsToRemove);
        if (error) throw error;
      }
      if (groupsToAdd.length) {
        const { error } = await supabase
          .from('group_members')
          .insert(groupsToAdd.map((gid) => ({ user_id: user.id, group_id: gid })));
        if (error) throw error;
      }
      onSuccess('Yetkiler güncellendi.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bilinmeyen hata.';
      onError(`Yetkiler kaydedilemedi: ${message}`);
    } finally {
      setBusy(null);
    }
  }

  const title = isPending
    ? (step === 'details' ? 'Onay isteği' : 'Yetki ata')
    : 'Kullanıcı detayları';

  return (
    <Dialog
      open={!!user}
      onOpenChange={onOpenChange}
      title={title}
      size="lg"
      footer={
        <FooterActions
          user={user}
          step={step}
          busy={busy}
          onBack={() => setStep('details')}
          onApprove={handleApprove}
          onReject={handleReject}
          onAdvanceToAssign={() => setStep('assign')}
          dirtyProfile={dirtyProfile}
          dirtyAssignments={dirtyAssignments}
          onSaveProfile={handleSaveProfile}
          onSaveAssignments={handleSaveAssignments}
          onToggleSuspend={handleToggleSuspend}
        />
      }
    >
      {step === 'details' ? (
        <DetailsStep
          user={user}
          fullName={fullName}
          setFullName={setFullName}
          phone={phone}
          setPhone={setPhone}
          isPending={isPending}
          onResetDevice={handleResetDevice}
          deviceBusy={busy === 'device'}
        />
      ) : (
        <AssignStep
          barriers={barriers}
          groups={groups}
          selectedBarriers={selectedBarriers}
          selectedGroups={selectedGroups}
          onToggleBarrier={(id) => toggle(selectedBarriers, setSelectedBarriers, id)}
          onToggleGroup={(id) => toggle(selectedGroups, setSelectedGroups, id)}
          loaded={assignmentsLoaded}
        />
      )}
    </Dialog>
  );
}

function DetailsStep({
  user,
  fullName,
  setFullName,
  phone,
  setPhone,
  isPending,
  onResetDevice,
  deviceBusy,
}: {
  user: AppUser;
  fullName: string;
  setFullName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  isPending: boolean;
  onResetDevice: () => void;
  deviceBusy: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Field label="Ad soyad" htmlFor="ud-name">
        <Input
          id="ud-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={isPending}
        />
      </Field>
      <Field label="Telefon" htmlFor="ud-phone" optional>
        <Input
          id="ud-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+90…"
          disabled={isPending}
        />
      </Field>
      <Field label="E-posta" htmlFor="ud-email">
        <Input id="ud-email" value={user.email ?? ''} disabled className="font-mono" />
      </Field>
      <Field label="Durum" htmlFor="ud-status">
        <div className="h-11 px-4 rounded-[10px] bg-surfaceUp border border-sep flex items-center">
          <Badge
            tone={
              user.status === 'active'
                ? 'success'
                : user.status === 'pending'
                ? 'warn'
                : user.status === 'rejected'
                ? 'danger'
                : 'muted'
            }
          >
            {STATUS_LABEL[user.status]}
          </Badge>
        </div>
      </Field>
      <Field label="Cihaz" htmlFor="ud-device">
        <div className="h-11 px-4 rounded-[10px] bg-surfaceUp border border-sep flex items-center justify-between gap-2">
          <span className="text-sm text-textSec font-mono truncate">
            {user.device_id ?? <span className="text-textMuted">Bağlı değil</span>}
          </span>
          {user.device_id && !isPending && (
            <button
              type="button"
              onClick={onResetDevice}
              disabled={deviceBusy}
              className="text-xs text-danger hover:underline disabled:opacity-50 inline-flex items-center gap-1"
            >
              <DeviceMobile size={13} />
              Sıfırla
            </button>
          )}
        </div>
      </Field>
      <Field label="Eklendi" htmlFor="ud-created">
        <Input
          id="ud-created"
          value={dateFormatter.format(new Date(user.created_at))}
          disabled
          className="font-mono"
        />
      </Field>
    </div>
  );
}

function AssignStep({
  barriers,
  groups,
  selectedBarriers,
  selectedGroups,
  onToggleBarrier,
  onToggleGroup,
  loaded,
}: {
  barriers: BarrierLite[];
  groups: GroupLite[];
  selectedBarriers: Set<string>;
  selectedGroups: Set<string>;
  onToggleBarrier: (id: string) => void;
  onToggleGroup: (id: string) => void;
  loaded: boolean;
}) {
  if (!loaded) {
    return <p className="text-sm text-textMuted">Yetkiler yükleniyor…</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h4 className="text-xs uppercase tracking-wider text-textMuted mb-3">Bariyerler</h4>
        {barriers.length === 0 ? (
          <p className="text-sm text-textMuted">Tanımlı bariyer yok.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {barriers.map((b) => (
              <Toggle
                key={b.id}
                label={b.name}
                selected={selectedBarriers.has(b.id)}
                onClick={() => onToggleBarrier(b.id)}
              />
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="text-xs uppercase tracking-wider text-textMuted mb-3">Gruplar</h4>
        {groups.length === 0 ? (
          <p className="text-sm text-textMuted">Tanımlı grup yok.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {groups.map((g) => (
              <Toggle
                key={g.id}
                label={g.name}
                selected={selectedGroups.has(g.id)}
                onClick={() => onToggleGroup(g.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex items-center justify-between gap-3 px-3 h-10 rounded-[10px] border text-left text-sm transition-colors',
        selected
          ? 'bg-accentDim border-accent/40 text-text'
          : 'bg-surface border-sep text-textSec hover:text-text hover:bg-surfaceUp',
      )}
    >
      <span>{label}</span>
      <span
        className={cx(
          'h-4 w-4 rounded border flex items-center justify-center',
          selected ? 'bg-accent border-accent text-white' : 'bg-surface border-sep',
        )}
      >
        {selected && <CheckCircle size={14} weight="fill" />}
      </span>
    </button>
  );
}

function FooterActions({
  user,
  step,
  busy,
  onBack,
  onApprove,
  onReject,
  onAdvanceToAssign,
  dirtyProfile,
  dirtyAssignments,
  onSaveProfile,
  onSaveAssignments,
  onToggleSuspend,
}: {
  user: AppUser;
  step: Step;
  busy: string | null;
  onBack: () => void;
  onApprove: () => void;
  onReject: () => void;
  onAdvanceToAssign: () => void;
  dirtyProfile: boolean;
  dirtyAssignments: boolean;
  onSaveProfile: () => void;
  onSaveAssignments: () => void;
  onToggleSuspend: () => void;
}) {
  if (user.status === 'pending') {
    if (step === 'details') {
      return (
        <>
          <Button variant="ghost" onClick={onReject} loading={busy === 'reject'} disabled={!!busy}>
            Reddet
          </Button>
          <Button onClick={onAdvanceToAssign} disabled={!!busy}>
            Devam et
          </Button>
        </>
      );
    }
    return (
      <>
        <Button variant="ghost" onClick={onBack} disabled={!!busy}>
          <ArrowLeft size={14} weight="bold" />
          Geri
        </Button>
        <Button onClick={onApprove} loading={busy === 'approve'} disabled={!!busy}>
          Onayla
        </Button>
      </>
    );
  }

  if (user.status === 'rejected') {
    return null;
  }

  if (step === 'details') {
    return (
      <>
        <Button
          variant={user.status === 'suspended' ? 'subtle' : 'ghost'}
          onClick={onToggleSuspend}
          loading={busy === 'suspend'}
          disabled={!!busy}
        >
          {user.status === 'suspended' ? 'Aktifleştir' : 'Askıya al'}
        </Button>
        <Button variant="subtle" onClick={onAdvanceToAssign} disabled={!!busy}>
          Yetkiler
        </Button>
        <Button onClick={onSaveProfile} loading={busy === 'profile'} disabled={!!busy || !dirtyProfile}>
          Kaydet
        </Button>
      </>
    );
  }

  // active/suspended → assign step
  return (
    <>
      <Button variant="ghost" onClick={onBack} disabled={!!busy}>
        <ArrowLeft size={14} weight="bold" />
        Geri
      </Button>
      <Button
        onClick={onSaveAssignments}
        loading={busy === 'assign'}
        disabled={!!busy || !dirtyAssignments}
      >
        Kaydet
      </Button>
    </>
  );
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
