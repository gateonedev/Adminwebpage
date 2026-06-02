'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { cx } from '@/lib/cx';
import type { AuditAction } from '@/lib/audit';

export interface AuditRow {
  id: string;
  action: AuditAction;
  target_type: 'admin' | 'user' | 'site' | null;
  target_id: string | null;
  target_label: string | null;
  site_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  users: { full_name: string | null; email: string | null; role: string | null } | null;
  sites: { name: string | null } | null;
}

type Category = 'all' | 'admin' | 'user' | 'site';

const CATEGORY_LABEL: Record<Category, string> = {
  all:   'Tümü',
  admin: 'Yönetici',
  user:  'Sakin',
  site:  'Site',
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
  'user.bulk_approve':            { label: 'Toplu sakin onayı',             tone: 'success' },
  'user.bulk_suspend':            { label: 'Toplu sakin askıya alma',       tone: 'warn'    },
  'user.bulk_unsuspend':          { label: 'Toplu sakin aktifleştirme',     tone: 'success' },
  'site.create':                  { label: 'Site oluşturuldu',              tone: 'accent'  },
  'site.update':                  { label: 'Site güncellendi',              tone: 'accent'  },
  'site.delete':                  { label: 'Site silindi',                  tone: 'danger'  },
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
    const c: Record<Category, number> = { all: rows.length, admin: 0, user: 0, site: 0 };
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
    default:
      return null;
  }
}
