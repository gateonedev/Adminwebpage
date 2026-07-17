'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { cx } from '@/lib/cx';
import type { AuditAction } from '@/lib/audit';

export interface AuditRow {
  id: string;
  action: AuditAction;
  target_type: 'admin' | 'user' | 'site' | 'guest' | 'barrier' | null;
  target_id: string | null;
  target_label: string | null;
  site_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  users: { full_name: string | null; email: string | null; role: string | null } | null;
  sites: { name: string | null } | null;
}

type Category = 'all' | 'admin' | 'user' | 'guest' | 'site' | 'barrier';

const CATEGORY_LABEL: Record<Category, string> = {
  all:     'Tümü',
  admin:   'Yönetici',
  user:    'Sakin',
  guest:   'Misafir',
  site:    'Site',
  barrier: 'Bariyer',
};

const ACTION_DEF: Record<AuditAction, { label: string; tone: 'accent' | 'success' | 'warn' | 'danger' | 'muted' }> = {
  'admin.create':                 { label: 'Yönetici oluşturuldu',         tone: 'accent'  },
  'admin.update_role':            { label: 'Yönetici rolü değişti',         tone: 'accent'  },
  'admin.set_status':             { label: 'Yönetici durumu değişti',       tone: 'warn'    },
  'admin.reset_password':         { label: 'Yönetici şifresi sıfırlandı',  tone: 'warn'    },
  'admin.delete':                 { label: 'Yönetici silindi',              tone: 'danger'  },
  'admin.self_profile_update':    { label: 'Profil güncellendi',            tone: 'muted'   },
  'admin.self_password_change':   { label: 'Kendi şifresini değiştirdi',    tone: 'warn'    },
  'user.approve':                 { label: 'Sakin onaylandı',               tone: 'success' },
  'user.reject':                  { label: 'Sakin reddedildi',              tone: 'danger'  },
  'user.suspend':                 { label: 'Sakin askıya alındı',           tone: 'warn'    },
  'user.unsuspend':               { label: 'Sakin aktifleştirildi',         tone: 'success' },
  'user.reset_device':            { label: 'Sakin cihazı sıfırlandı',       tone: 'warn'    },
  'user.archive':                 { label: 'Sakin arşivlendi',              tone: 'warn'    },
  'user.restore':                 { label: 'Sakin geri yüklendi',           tone: 'success' },
  'user.bulk_approve':            { label: 'Toplu sakin onayı',             tone: 'success' },
  'user.bulk_suspend':            { label: 'Toplu sakin askıya alma',       tone: 'warn'    },
  'user.bulk_unsuspend':          { label: 'Toplu sakin aktifleştirme',     tone: 'success' },
  'guest.approve':                { label: 'Misafir onaylandı',             tone: 'success' },
  'guest.reject':                 { label: 'Misafir reddedildi',            tone: 'danger'  },
  'guest.revoke':                 { label: 'Misafir daveti iptal edildi',   tone: 'warn'    },
  'site.create':                  { label: 'Site oluşturuldu',              tone: 'accent'  },
  'site.update':                  { label: 'Site güncellendi',              tone: 'accent'  },
  'site.delete':                  { label: 'Site silindi',                  tone: 'danger'  },
  'barrier.create':               { label: 'Bariyer oluşturuldu',           tone: 'accent'  },
  'barrier.update':               { label: 'Bariyer güncellendi',           tone: 'accent'  },
  'barrier.delete':               { label: 'Bariyer silindi',               tone: 'danger'  },
  'barrier.rotate_secret':        { label: 'Bariyer anahtarı yenilendi',    tone: 'warn'    },
};

const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

interface Props {
  rows: AuditRow[];
}

export function AuditPageClient({ rows }: Props) {
  const [category, setCategory] = useState<Category>('all');

  const counts = useMemo(() => {
    const c: Record<Category, number> = { all: rows.length, admin: 0, user: 0, guest: 0, site: 0, barrier: 0 };
    for (const r of rows) {
      const cat = r.action.split('.')[0] as Exclude<Category, 'all'>;
      if (cat in c) c[cat]++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    if (category === 'all') return rows;
    return rows.filter((r) => r.action.startsWith(category + '.'));
  }, [rows, category]);

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-6">
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cx(
              'h-8 px-3 inline-flex items-center gap-2 rounded-full border text-xs font-medium transition-colors',
              category === c
                ? 'bg-accentDim border-accent/40 text-accent'
                : 'bg-surface border-sep text-textSec hover:text-text',
            )}
          >
            <span>{CATEGORY_LABEL[c]}</span>
            <span className="font-mono text-textMuted">{counts[c]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="border-t border-sep py-16 text-center">
          <p className="text-text font-medium">Bu kategoride kayıt yok.</p>
          <p className="mt-1 text-sm text-textSec">
            Filtreyi değiştirerek tüm aksiyonları görüntüleyin.
          </p>
        </div>
      ) : (
        <div className="border-t border-sep divide-y divide-sep">
          <div className="grid grid-cols-[1.4fr_1.6fr_1.4fr_auto_auto] gap-4 px-3 py-3 text-[11px] uppercase tracking-wider text-textMuted">
            <div>Yapan</div>
            <div>Aksiyon</div>
            <div>Hedef</div>
            <div>Site</div>
            <div className="w-28 text-right">Zaman</div>
          </div>
          {filtered.map((r) => (
            <Row key={r.id} row={r} />
          ))}
        </div>
      )}
    </>
  );
}

function Row({ row }: { row: AuditRow }) {
  const def = ACTION_DEF[row.action] ?? { label: row.action, tone: 'muted' as const };
  const actorName = row.users?.full_name?.trim() || row.users?.email || 'Silinmiş hesap';
  const actorEmail = row.users?.email ?? null;
  const detail = describeMetadata(row);

  return (
    <div className="grid grid-cols-[1.4fr_1.6fr_1.4fr_auto_auto] gap-4 px-3 py-3 items-center">
      <div className="min-w-0">
        <div className="text-sm text-text truncate">{actorName}</div>
        {actorEmail && (
          <div className="text-[11px] text-textMuted font-mono truncate">{actorEmail}</div>
        )}
      </div>
      <div className="min-w-0 flex flex-col gap-1.5">
        <Badge tone={def.tone}>{def.label}</Badge>
        {detail && <span className="text-[11px] text-textMuted leading-snug truncate">{detail}</span>}
      </div>
      <div className="text-sm text-textSec font-mono truncate">
        {row.target_label ?? <span className="text-textMuted">—</span>}
      </div>
      <div className="text-sm text-textSec truncate w-32">
        {row.sites?.name ?? <span className="text-textMuted">—</span>}
      </div>
      <div className="text-xs text-textMuted font-mono w-28 text-right">
        {dateTimeFormatter.format(new Date(row.created_at))}
      </div>
    </div>
  );
}

const ROLE_TR: Record<string, string> = {
  resident:    'Sakin',
  site_admin:  'Site yöneticisi',
  super_admin: 'Süper yönetici',
};

const STATUS_TR: Record<string, string> = {
  active:    'Aktif',
  suspended: 'Askıda',
  pending:   'Beklemede',
  rejected:  'Reddedildi',
};

const BARRIER_FIELD_TR: Record<string, string> = {
  name: 'ad',
  site_id: 'site',
  ble_identifier: 'BLE kimliği',
  relay_duration_ms: 'röle süresi',
  rssi_threshold: 'RSSI eşiği',
  is_active: 'aktiflik',
  hands_free_enabled: 'elsiz mod',
};

function describeMetadata(row: AuditRow): string | null {
  const m = row.metadata ?? {};
  switch (row.action) {
    case 'admin.create': {
      const role = typeof m.role === 'string' ? ROLE_TR[m.role] ?? m.role : null;
      return role ? `Rol: ${role}` : null;
    }
    case 'admin.update_role': {
      const fr = typeof m.from_role === 'string' ? ROLE_TR[m.from_role] ?? m.from_role : '?';
      const to = typeof m.to_role === 'string' ? ROLE_TR[m.to_role] ?? m.to_role : '?';
      return `${fr} → ${to}`;
    }
    case 'admin.set_status': {
      const fr = typeof m.from_status === 'string' ? STATUS_TR[m.from_status] ?? m.from_status : '?';
      const to = typeof m.to_status === 'string' ? STATUS_TR[m.to_status] ?? m.to_status : '?';
      return `${fr} → ${to}`;
    }
    case 'user.approve': {
      const b = typeof m.barrier_count === 'number' ? m.barrier_count : 0;
      const g = typeof m.group_count === 'number'   ? m.group_count   : 0;
      const parts: string[] = [];
      if (b > 0) parts.push(`${b} bariyer`);
      if (g > 0) parts.push(`${g} grup`);
      return parts.length > 0 ? parts.join(' · ') : 'Yetki atanmadı';
    }
    case 'site.update': {
      const fn = typeof m.from_name === 'string' ? m.from_name : null;
      const tn = typeof m.to_name === 'string' ? m.to_name : null;
      if (fn && tn && fn !== tn) return `${fn} → ${tn}`;
      return null;
    }
    case 'user.reset_device': {
      const prev = typeof m.previous_device_id === 'string' ? m.previous_device_id : null;
      return prev ? `Önceki cihaz: ${prev}` : null;
    }
    case 'barrier.create':
      return typeof m.ble_identifier === 'string' ? `BLE: ${m.ble_identifier}` : null;
    case 'barrier.update': {
      const fn = typeof m.from_name === 'string' ? m.from_name : null;
      const tn = typeof m.to_name === 'string' ? m.to_name : null;
      if (fn && tn && fn !== tn) return `${fn} → ${tn}`;
      const changed = Array.isArray(m.changed)
        ? (m.changed as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
      const parts = changed.map((k) => BARRIER_FIELD_TR[k] ?? k);
      return parts.length > 0 ? parts.join(' · ') : null;
    }
    case 'barrier.delete': {
      const logs = typeof m.access_log_count === 'number' ? m.access_log_count : 0;
      const guests = typeof m.guest_count === 'number' ? m.guest_count : 0;
      const parts: string[] = [];
      if (logs > 0) parts.push(`${logs} geçiş kaydı`);
      if (guests > 0) parts.push(`${guests} misafir daveti`);
      return parts.length > 0 ? `${parts.join(' · ')} silindi` : null;
    }
    case 'barrier.rotate_secret':
      return m.generated === false ? 'Özel anahtar yüklendi' : 'Yeni anahtar üretildi';
    default:
      return null;
  }
}
