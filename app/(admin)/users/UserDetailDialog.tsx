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
  archived:  'Arşivlendi',
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
  const [confirmAction, setConfirmAction] = useState<null | 'archive' | 'restore'>(null);

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
    setConfirmAction(null);
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
    // Device columns are privilege-hidden since migration 42; the reset goes
    // through the dedicated RPC (same as the mobile admin screens).
    const { data, error } = await supabase.rpc('admin_reset_device', {
      p_user_id: user.id,
    });
    setBusy(null);
    if (error) {
      onError(`Cihaz sıfırlanamadı: ${error.message}`);
      return;
    }
    const result = data as { ok?: boolean; reason?: string } | null;
    if (!result?.ok) {
      onError(
        result?.reason === 'forbidden'
          ? 'Bu kullanıcı için yetkiniz yok.'
          : 'Cihaz sıfırlanamadı.',
      );
      return;
    }
    void logAudit({
      action: 'user.reset_device',
      target_type: 'user',
      target_id: user.id,
      target_label: user.full_name || user.email || undefined,
      site_id: user.site_id,
    });
    onSuccess('Cihaz bağı kaldırıldı.');
  }

  async function handleArchive() {
    if (!user) return;
    setConfirmAction(null);
    setBusy('archive');
    const supabase = createClient();
    // Yetki/temizlik işlemleri sunucuda: bariyer erişimleri, grup üyelikleri,
    // aktif davetler ve cihaz bağı RPC içinde kapatılır; audit'i de RPC yazar.
    const { data, error } = await supabase.rpc('archive_user', { p_user_id: user.id });
    setBusy(null);
    if (error) {
      onError(`Arşivlenemedi: ${error.message}`);
      return;
    }
    const result = data as { ok?: boolean } | null;
    if (!result?.ok) {
      onError('Arşivlenemedi.');
      return;
    }
    onSuccess(`${user.full_name || 'Kullanıcı'} arşivlendi.`);
  }

  async function handleRestore() {
    if (!user) return;
    setConfirmAction(null);
    setBusy('restore');
    const supabase = createClient();
    const { data, error } = await supabase.rpc('restore_archived_user', { p_user_id: user.id });
    setBusy(null);
    if (error) {
      onError(`Geri yüklenemedi: ${error.message}`);
      return;
    }
    const result = data as { ok?: boolean; reason?: string } | null;
    if (!result?.ok) {
      onError(result?.reason === 'not_archived' ? 'Kullanıcı zaten arşivde değil.' : 'Geri yüklenemedi.');
      return;
    }
    onSuccess(
      `${user.full_name || 'Kullanıcı'} geri yüklendi. Bariyer ve grup yetkileri otomatik geri gelmez — yeniden atayın.`,
    );
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
    <>
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
          onArchiveClick={() => setConfirmAction('archive')}
          onRestoreClick={() => setConfirmAction('restore')}
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

    <Dialog
      open={confirmAction !== null}
      onOpenChange={(open) => {
        if (!open && !busy) setConfirmAction(null);
      }}
      title={confirmAction === 'archive' ? 'Siteden çıkar' : 'Arşivden geri yükle'}
      description={user.full_name || user.email || undefined}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)} disabled={!!busy}>
            Vazgeç
          </Button>
          {confirmAction === 'archive' ? (
            <Button variant="danger" size="sm" onClick={handleArchive} loading={busy === 'archive'}>
              Siteden çıkar
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={handleRestore} loading={busy === 'restore'}>
              Geri yükle
            </Button>
          )}
        </>
      }
    >
      <p className="text-sm text-textSec">
        {confirmAction === 'archive'
          ? 'Kullanıcı aktif listeden kaldırılacak. Kapı yetkileri, grup üyelikleri, aktif misafir davetleri ve cihaz bağı kapatılır; geçmiş kayıtlar saklanır.'
          : 'Kullanıcı arşivden çıkarılıp tekrar aktif edilecek. Bariyer ve grup yetkileri otomatik geri gelmez — onay sonrası yeniden atamanız gerekir.'}
      </p>
    </Dialog>
    </>
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
  const readOnly = isPending || user.status === 'archived';
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Field label="Ad soyad" htmlFor="ud-name">
        <Input
          id="ud-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={readOnly}
        />
      </Field>
      <Field label="Telefon" htmlFor="ud-phone" optional>
        <Input
          id="ud-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+90…"
          disabled={readOnly}
        />
      </Field>
      <Field label="Plaka" htmlFor="ud-plate">
        <Input id="ud-plate" value={user.plate ?? '—'} disabled className="font-mono" />
      </Field>
      <Field label="Blok / Daire" htmlFor="ud-unit">
        <Input
          id="ud-unit"
          value={
            user.block_name || user.apartment_no
              ? [user.block_name, user.apartment_no].filter(Boolean).join(' / ')
              : '—'
          }
          disabled
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
          {/* device_id is privilege-hidden from clients (migration 42); only
              the reset action remains, handled server-side via RPC. */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm text-textMuted truncate">
              Cihaz bilgisi sunucuda saklanır
            </span>
            <Badge tone={user.hands_free_enabled ? 'success' : 'muted'}>
              {user.hands_free_enabled ? 'Elsiz açık' : 'Elsiz kapalı'}
            </Badge>
          </div>
          {!isPending && user.status !== 'archived' && (user.role === 'resident' || user.role === 'guest') && (
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
      {user.status === 'archived' && user.archived_at && (
        <Field label="Arşivlendi" htmlFor="ud-archived">
          <Input
            id="ud-archived"
            value={dateFormatter.format(new Date(user.archived_at))}
            disabled
            className="font-mono"
          />
        </Field>
      )}
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
  onArchiveClick,
  onRestoreClick,
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
  onArchiveClick: () => void;
  onRestoreClick: () => void;
}) {
  // archive_user / restore_archived_user RPC'leri yalnızca sakin hesaplarını kabul eder.
  const canArchive = user.role === 'resident';

  if (user.status === 'archived') {
    if (!canArchive) return null;
    return (
      <Button onClick={onRestoreClick} loading={busy === 'restore'} disabled={!!busy}>
        Geri yükle
      </Button>
    );
  }

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
    if (!canArchive) return null;
    return (
      <Button variant="ghost" onClick={onArchiveClick} loading={busy === 'archive'} disabled={!!busy}>
        Siteden çıkar
      </Button>
    );
  }

  if (step === 'details') {
    return (
      <>
        {canArchive && (
          <Button variant="ghost" onClick={onArchiveClick} loading={busy === 'archive'} disabled={!!busy}>
            Siteden çıkar
          </Button>
        )}
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
