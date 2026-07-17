'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, FunnelSimple, MagnifyingGlass, X } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from '@/components/ui/Toast';
import { cx } from '@/lib/cx';
import { createClient } from '@/lib/supabase/client';
import { AUDIT_PAGE_SIZE, AUDIT_SELECT } from './auditQuery';

type Category = 'all' | 'admin' | 'user' | 'guest' | 'site' | 'barrier';
type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export interface AuditRow {
  id: string;
  action: string;
  target_type: 'admin' | 'user' | 'site' | 'guest' | 'barrier' | null;
  target_id: string | null;
  target_label: string | null;
  site_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  users: { full_name: string | null; email: string | null } | null;
  sites: { name: string | null } | null;
}

export interface ActorOption { id: string; label: string }
export interface SiteOption { id: string; name: string }

/** Uygulanan filtre seti (arama hariç — o debounce'lu ayrı state). */
interface AuditFilters {
  datePreset: DatePreset;
  customStart: string;
  customEnd: string;
  category: Category;
  actionKeys: string[];
  actorId: string; // 'all' | uuid
  siteId: string;  // 'all' | uuid — yalnız super_admin görünümünde kullanılır
}

const DEFAULT_FILTERS: AuditFilters = {
  datePreset: 'all',
  customStart: '',
  customEnd: '',
  category: 'all',
  actionKeys: [],
  actorId: 'all',
  siteId: 'all',
};

const CATEGORY_LABEL: Record<Category, string> = {
  all:     'Tümü',
  admin:   'Yönetici',
  user:    'Sakin',
  guest:   'Misafir',
  site:    'Site',
  barrier: 'Bariyer',
};

const ACTION_DEF: Record<string, { label: string; tone: 'accent' | 'success' | 'warn' | 'danger' | 'muted' }> = {
  'admin.create':               { label: 'Yönetici oluşturuldu',        tone: 'accent'  },
  'admin.update_role':          { label: 'Yönetici rolü değişti',       tone: 'accent'  },
  'admin.set_status':           { label: 'Yönetici durumu değişti',     tone: 'warn'    },
  'admin.reset_password':       { label: 'Yönetici şifresi sıfırlandı', tone: 'warn'    },
  'admin.delete':               { label: 'Yönetici silindi',            tone: 'danger'  },
  'admin.self_profile_update':  { label: 'Profil güncellendi',          tone: 'muted'   },
  'admin.self_password_change': { label: 'Kendi şifresini değiştirdi',  tone: 'warn'    },
  'user.approve':               { label: 'Sakin onaylandı',             tone: 'success' },
  'user.reject':                { label: 'Sakin reddedildi',            tone: 'danger'  },
  'user.suspend':               { label: 'Sakin askıya alındı',         tone: 'warn'    },
  'user.unsuspend':             { label: 'Sakin aktifleştirildi',       tone: 'success' },
  'user.archive':               { label: 'Sakin arşivlendi',            tone: 'danger'  },
  'user.restore':               { label: 'Sakin arşivden çıkarıldı',    tone: 'success' },
  'user.reset_device':          { label: 'Sakin cihazı sıfırlandı',     tone: 'warn'    },
  // admin_reset_device RPC'si audit'e 'user.device_reset' yazar (migration 42);
  // iki ad da aynı etikete eşlenir ki mevcut kayıtlar ham metin görünmesin.
  'user.device_reset':          { label: 'Sakin cihazı sıfırlandı',     tone: 'warn'    },
  'user.profile_update':        { label: 'Sakin profili güncellendi',   tone: 'accent'  },
  'user.bulk_approve':          { label: 'Toplu sakin onayı',           tone: 'success' },
  'user.bulk_suspend':          { label: 'Toplu sakin askıya alma',     tone: 'warn'    },
  'user.bulk_unsuspend':        { label: 'Toplu sakin aktifleştirme',   tone: 'success' },
  'guest.approve':              { label: 'Misafir onaylandı',           tone: 'success' },
  'guest.reject':               { label: 'Misafir reddedildi',          tone: 'danger'  },
  'guest.revoke':               { label: 'Misafir daveti iptal edildi', tone: 'warn'    },
  'site.create':                { label: 'Site oluşturuldu',            tone: 'accent'  },
  'site.update':                { label: 'Site güncellendi',            tone: 'accent'  },
  'site.delete':                { label: 'Site silindi',                tone: 'danger'  },
  'barrier.create':             { label: 'Bariyer oluşturuldu',         tone: 'accent'  },
  'barrier.update':             { label: 'Bariyer güncellendi',         tone: 'accent'  },
  'barrier.delete':             { label: 'Bariyer silindi',             tone: 'danger'  },
  'barrier.rotate_secret':      { label: 'Bariyer anahtarı yenilendi',  tone: 'warn'    },
};

// Aynı işleme birden fazla aksiyon kodu yazılmış olabilir; seçim ikisini de
// kapsamalı (admin_reset_device RPC'si 'user.device_reset' yazar).
const ACTION_ALIAS: Record<string, string[]> = {
  'user.reset_device': ['user.reset_device', 'user.device_reset'],
};

// Filtre panelindeki AKSİYON çoklu seçimi; etiketler ACTION_DEF'ten gelir.
// Toplu aksiyonlar yalnız web'den yazılır; mobil listede yoklar ama burada
// filtrelenebilir olmaları gerekir.
const ACTION_GROUPS: { category: Exclude<Category, 'all'>; label: string; keys: string[] }[] = [
  {
    category: 'user',
    label: 'Sakin',
    keys: [
      'user.approve', 'user.reject', 'user.suspend', 'user.unsuspend',
      'user.archive', 'user.restore', 'user.reset_device', 'user.profile_update',
      'user.bulk_approve', 'user.bulk_suspend', 'user.bulk_unsuspend',
    ],
  },
  {
    category: 'guest',
    label: 'Misafir',
    keys: ['guest.approve', 'guest.reject', 'guest.revoke'],
  },
  {
    category: 'admin',
    label: 'Yönetici',
    keys: [
      'admin.create', 'admin.update_role', 'admin.set_status',
      'admin.reset_password', 'admin.delete', 'admin.self_profile_update',
      'admin.self_password_change',
    ],
  },
  {
    category: 'site',
    label: 'Site',
    keys: ['site.create', 'site.update', 'site.delete'],
  },
  {
    category: 'barrier',
    label: 'Bariyer',
    keys: ['barrier.create', 'barrier.update', 'barrier.delete', 'barrier.rotate_secret'],
  },
];

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all',       label: 'Tümü' },
  { value: 'today',     label: 'Bugün' },
  { value: 'yesterday', label: 'Dün' },
  { value: 'week',      label: 'Son 7 gün' },
  { value: 'month',     label: 'Son 30 gün' },
  { value: 'custom',    label: 'Özel' },
];

const DATE_LABEL: Record<Exclude<DatePreset, 'all'>, string> = {
  today:     'Bugün',
  yesterday: 'Dün',
  week:      'Son 7 gün',
  month:     'Son 30 gün',
  custom:    'Özel aralık',
};

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
  archived:  'Arşiv',
};

const PROFILE_FIELD_TR: Record<string, string> = {
  full_name: 'ad',
  phone: 'telefon',
  plate: 'plaka',
  block_name: 'blok',
  apartment_no: 'daire',
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

function describe(row: AuditRow): string | null {
  const m = row.metadata ?? {};
  switch (row.action) {
    case 'admin.create':
      return typeof m.role === 'string' ? `Rol: ${ROLE_TR[m.role] ?? m.role}` : null;
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
    case 'user.archive': {
      const direct = typeof m.direct_access_removed === 'number' ? m.direct_access_removed : 0;
      const groups = typeof m.group_members_removed === 'number' ? m.group_members_removed : 0;
      const guests = typeof m.active_guests_disabled === 'number' ? m.active_guests_disabled : 0;
      const parts: string[] = [];
      if (direct > 0) parts.push(`${direct} bariyer`);
      if (groups > 0) parts.push(`${groups} grup`);
      if (guests > 0) parts.push(`${guests} misafir`);
      return parts.length > 0 ? parts.join(' · ') : 'Aktif yetki yoktu';
    }
    case 'user.restore':
      return 'Yetkiler yeniden atanmalı';
    case 'user.approve': {
      const b = typeof m.barrier_count === 'number' ? m.barrier_count : 0;
      const g = typeof m.group_count === 'number' ? m.group_count : 0;
      const parts: string[] = [];
      if (b > 0) parts.push(`${b} bariyer`);
      if (g > 0) parts.push(`${g} grup`);
      return parts.length > 0 ? parts.join(' · ') : 'Yetki atanmadı';
    }
    case 'user.reset_device':
    case 'user.device_reset': {
      const prev = typeof m.previous_device_id === 'string' ? m.previous_device_id : null;
      return prev ? `Önceki cihaz: ${prev}` : null;
    }
    case 'site.update': {
      const fn = typeof m.from_name === 'string' ? m.from_name : null;
      const tn = typeof m.to_name === 'string' ? m.to_name : null;
      if (fn && tn && fn !== tn) return `${fn} → ${tn}`;
      return null;
    }
    case 'user.profile_update': {
      const fn = typeof m.from_name === 'string' ? m.from_name : null;
      const tn = typeof m.to_name === 'string' ? m.to_name : null;
      if (fn && tn && fn !== tn) return `${fn} → ${tn}`;
      const changed = Array.isArray(m.changed)
        ? (m.changed as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
      const parts = changed.map((k) => PROFILE_FIELD_TR[k] ?? k);
      return parts.length > 0 ? parts.join(' · ') : null;
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

const timeFormatter = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const fullDateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  weekday: 'long',
});

/** Saat dilimine göre yerel, sözlüksel sıralanabilir YYYY-MM-DD gün anahtarı. */
function localDayKey(value: string): string {
  const d = new Date(value);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatDayLabel(value: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const key = localDayKey(value);
  if (key === localDayKey(today.toISOString())) return 'Bugün';
  if (key === localDayKey(yesterday.toISOString())) return 'Dün';
  return fullDateFormatter.format(new Date(value));
}

function startOfDay(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/** Preset → [start, endExclusive] aralığı. 'all' ve boş 'custom' için null. */
function presetRange(f: AuditFilters): { start: Date | null; endExclusive: Date | null } | null {
  switch (f.datePreset) {
    case 'today':     return { start: startOfDay(0), endExclusive: startOfDay(-1) };
    case 'yesterday': return { start: startOfDay(1), endExclusive: startOfDay(0) };
    case 'week':      return { start: startOfDay(6), endExclusive: startOfDay(-1) };
    case 'month':     return { start: startOfDay(29), endExclusive: startOfDay(-1) };
    case 'custom': {
      const start = f.customStart ? new Date(f.customStart) : null;
      const end   = f.customEnd ? new Date(f.customEnd) : null;
      if (!start && !end) return null;
      return { start, endExclusive: end };
    }
    default: return null;
  }
}

/** %, _ ve \ karakterlerini kaçışla — aksi halde ilike deseni bozulur. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (m) => '\\' + m);
}

function activeFilterCount(f: AuditFilters): number {
  let n = 0;
  if (f.datePreset !== 'all' && presetRange(f) !== null) n++;
  if (f.category !== 'all') n++;
  if (f.actionKeys.length > 0) n++;
  if (f.actorId !== 'all') n++;
  if (f.siteId !== 'all') n++;
  return n;
}

interface Props {
  viewerRole: string;
  initialRows: AuditRow[];
  initialHasMore: boolean;
  actors: ActorOption[];
  sites: SiteOption[];
}

export function AuditPageClient({ viewerRole, initialRows, initialHasMore, actors, sites }: Props) {
  const isSuper = viewerRole === 'super_admin';
  const [rows, setRows] = useState(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [filters, setFilters] = useState<AuditFilters>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<AuditFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Arama debounce'u: input her tuşta değil, 300 ms durunca uygulanır.
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearch((prev) => (prev === trimmed ? prev : trimmed));
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Uygulanan filtre/arama değiştiğinde yeniden sorgula (ilk mount hariç).
  const [didMount, setDidMount] = useState(false);
  useEffect(() => {
    if (!didMount) {
      setDidMount(true);
      return;
    }
    void refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, search]);

  function buildQuery(
    f: AuditFilters,
    searchTerm: string,
    cursor: { created_at: string; id: string } | null,
    limit: number,
  ) {
    const supabase = createClient();
    let q = supabase.from('admin_audit_log').select(AUDIT_SELECT);
    if (f.category !== 'all') q = q.like('action', f.category + '.%');
    if (f.actionKeys.length > 0) {
      q = q.in('action', f.actionKeys.flatMap((k) => ACTION_ALIAS[k] ?? [k]));
    }
    if (f.actorId !== 'all') q = q.eq('actor_id', f.actorId);
    if (f.siteId !== 'all') q = q.eq('site_id', f.siteId);
    const range = presetRange(f);
    if (range?.start) q = q.gte('created_at', range.start.toISOString());
    if (range?.endExclusive) q = q.lt('created_at', range.endExclusive.toISOString());
    if (searchTerm) q = q.ilike('target_label', `%${escapeLike(searchTerm)}%`);
    if (cursor) {
      // Keyset: (created_at, id) ikilisi — migration 57'deki kompozit indekse
      // oturur; offset sayfalamanın kayma/tekrar sorunları olmaz.
      q = q.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
      );
    }
    return q
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);
  }

  async function refresh() {
    setRefreshing(true);
    const { data, error } = await buildQuery(filters, search, null, AUDIT_PAGE_SIZE + 1);
    setRefreshing(false);
    if (error) {
      toast(`Kayıtlar yüklenemedi: ${error.message}`, 'error');
      return;
    }
    const list = (data ?? []) as unknown as AuditRow[];
    setHasMore(list.length > AUDIT_PAGE_SIZE);
    setRows(list.slice(0, AUDIT_PAGE_SIZE));
  }

  async function loadMore() {
    const last = rows[rows.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    const { data, error } = await buildQuery(
      filters,
      search,
      { created_at: last.created_at, id: last.id },
      AUDIT_PAGE_SIZE + 1,
    );
    setLoadingMore(false);
    if (error) {
      toast(`Sonraki kayıtlar yüklenemedi: ${error.message}`, 'error');
      return;
    }
    const list = (data ?? []) as unknown as AuditRow[];
    setHasMore(list.length > AUDIT_PAGE_SIZE);
    setRows((prev) => {
      const existing = new Set(prev.map((r) => r.id));
      return [...prev, ...list.slice(0, AUDIT_PAGE_SIZE).filter((r) => !existing.has(r.id))];
    });
  }

  function openFilter() {
    setDraft(filters);
    setFilterOpen(true);
  }

  function applyFilters() {
    setFilters(draft);
    setFilterOpen(false);
  }

  /** Kategori değişince o kategoriye ait olmayan aksiyon seçimleri temizlenir. */
  function setDraftCategory(next: Category) {
    setDraft((d) => {
      if (next === d.category) return d;
      const actionKeys =
        next === 'all'
          ? d.actionKeys
          : d.actionKeys.filter((k) =>
              ACTION_GROUPS.some((g) => g.category === next && g.keys.includes(k)),
            );
      return { ...d, category: next, actionKeys };
    });
  }

  function toggleDraftAction(key: string) {
    setDraft((d) => ({
      ...d,
      actionKeys: d.actionKeys.includes(key)
        ? d.actionKeys.filter((k) => k !== key)
        : [...d.actionKeys, key],
    }));
  }

  const appliedCount = activeFilterCount(filters);
  const actorLabel = (id: string) => actors.find((a) => a.id === id)?.label ?? '—';
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? '—';

  // Kategori seçiliyken aksiyon listesi o kategoriye daraltılır.
  const visibleGroups =
    draft.category === 'all'
      ? ACTION_GROUPS
      : ACTION_GROUPS.filter((g) => g.category === draft.category);

  // Gün başlıklarıyla gruplama (satırlar zaten created_at desc sıralı gelir).
  const sections = useMemo(() => {
    const result: { key: string; title: string; rows: AuditRow[] }[] = [];
    for (const row of rows) {
      const key = localDayKey(row.created_at);
      const current = result[result.length - 1];
      if (current?.key === key) current.rows.push(row);
      else result.push({ key, title: formatDayLabel(row.created_at), rows: [row] });
    }
    return result;
  }, [rows]);

  // Site admini RLS gereği super_admin'in users satırını okuyamaz; aktör
  // bilgisi gelmeyen satırlar onun görünümünde büyük olasılıkla süper
  // yönetici işlemidir, silinmiş hesap değil.
  const actorFallback = viewerRole === 'site_admin' ? 'Gate One yönetimi' : 'Silinmiş hesap';

  const searchActive = search !== '';
  const rangeActive = filters.datePreset !== 'all' && presetRange(filters) !== null;
  const otherFiltersActive =
    filters.category !== 'all' ||
    filters.actionKeys.length > 0 ||
    filters.actorId !== 'all' ||
    filters.siteId !== 'all';

  return (
    <>
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={16}
              weight="regular"
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Hedef ara: ad veya e-posta"
              className="w-full h-10 rounded-[10px] bg-surfaceUp border border-white/[0.06] pl-9 pr-9 text-sm text-text placeholder:text-textMuted outline-none focus:border-accent/40 transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label="Temizle"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-textMuted hover:text-text hover:bg-surface transition-colors"
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={openFilter}
            aria-label="Filtrele"
            className={cx(
              'h-10 px-3 inline-flex items-center gap-2 rounded-[10px] border text-sm font-medium transition-colors shrink-0',
              appliedCount > 0
                ? 'bg-accentDim border-accent/40 text-accent'
                : 'bg-surfaceUp border-white/[0.06] text-textSec hover:text-text',
            )}
          >
            <FunnelSimple size={16} weight={appliedCount > 0 ? 'fill' : 'regular'} />
            Filtrele
            {appliedCount > 0 && (
              <span className="min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-full bg-accent text-white text-[11px] font-semibold">
                {appliedCount}
              </span>
            )}
          </button>
        </div>

        {/* Uygulanan filtre çipleri — tek tıkla kaldırılabilir. */}
        {appliedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {rangeActive && (
              <FilterChip
                label={DATE_LABEL[filters.datePreset as Exclude<DatePreset, 'all'>]}
                onRemove={() =>
                  setFilters((f) => ({ ...f, datePreset: 'all', customStart: '', customEnd: '' }))
                }
              />
            )}
            {filters.category !== 'all' && (
              <FilterChip
                label={CATEGORY_LABEL[filters.category]}
                onRemove={() => setFilters((f) => ({ ...f, category: 'all' }))}
              />
            )}
            {filters.actionKeys.length > 0 && (
              <FilterChip
                label={
                  filters.actionKeys.length === 1
                    ? ACTION_DEF[filters.actionKeys[0]]?.label ?? filters.actionKeys[0]
                    : `${filters.actionKeys.length} aksiyon`
                }
                onRemove={() => setFilters((f) => ({ ...f, actionKeys: [] }))}
              />
            )}
            {filters.actorId !== 'all' && (
              <FilterChip
                label={actorLabel(filters.actorId)}
                onRemove={() => setFilters((f) => ({ ...f, actorId: 'all' }))}
              />
            )}
            {filters.siteId !== 'all' && (
              <FilterChip
                label={siteName(filters.siteId)}
                onRemove={() => setFilters((f) => ({ ...f, siteId: 'all' }))}
              />
            )}
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-xs text-textMuted hover:text-text underline underline-offset-2 transition-colors"
            >
              Tümünü temizle
            </button>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-textMuted">
          <span>{`${rows.length}${hasMore ? '+' : ''} kayıt`}</span>
          <Button variant="subtle" size="sm" onClick={refresh} loading={refreshing}>
            <ArrowsClockwise size={14} />
            Yenile
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="border-t border-sep py-16 text-center">
          <p className="text-text font-medium">
            {searchActive
              ? 'Eşleşen kayıt yok.'
              : rangeActive
              ? 'Bu aralıkta kayıt yok.'
              : otherFiltersActive
              ? 'Eşleşen kayıt yok.'
              : 'Henüz denetim kaydı yok.'}
          </p>
          <p className="mt-1 text-sm text-textSec">
            {searchActive
              ? 'Arama metnini kontrol edin.'
              : rangeActive
              ? 'Tarih aralığını genişletin veya filtreyi temizleyin.'
              : otherFiltersActive
              ? 'Kategori, aksiyon, yapan veya site filtresini değiştirmeyi deneyin.'
              : 'Yönetici aksiyonları burada listelenir.'}
          </p>
        </div>
      ) : (
        <>
          <div className="border-t border-sep">
            {sections.map((section) => (
              <div key={section.key}>
                <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-textMuted bg-surface/40 border-b border-sep">
                  {section.title}
                </div>
                <div className="divide-y divide-sep">
                  {section.rows.map((r) => (
                    <Row key={r.id} row={r} actorFallback={actorFallback} showSite={isSuper} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {hasMore ? (
            <div className="flex justify-center py-4 border-t border-sep">
              <Button variant="subtle" size="sm" onClick={loadMore} loading={loadingMore}>
                Sonraki {AUDIT_PAGE_SIZE} kaydı görüntüle
              </Button>
            </div>
          ) : (
            <div className="py-4 border-t border-sep text-center text-xs text-textMuted">
              {rangeActive
                ? 'Seçilen aralıktaki tüm kayıtlar gösteriliyor.'
                : 'Tüm kayıtlar gösteriliyor.'}
            </div>
          )}
        </>
      )}

      <Dialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Filtrele"
        description="Kategori ve tarih tek seçim; aksiyonda birden fazla seçebilirsiniz."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDraft(DEFAULT_FILTERS)}>
              Temizle
            </Button>
            <Button size="sm" onClick={applyFilters}>
              Uygula
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <section>
            <h4 className="text-[11px] uppercase tracking-wider text-textMuted mb-3">Tarih</h4>
            <div className="flex gap-2 flex-wrap">
              {DATE_PRESETS.map((p) => (
                <Pill
                  key={p.value}
                  active={draft.datePreset === p.value}
                  onClick={() => setDraft((d) => ({ ...d, datePreset: p.value }))}
                >
                  {p.label}
                </Pill>
              ))}
            </div>
            {draft.datePreset === 'custom' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  value={draft.customStart}
                  onChange={(e) => setDraft((d) => ({ ...d, customStart: e.target.value }))}
                  aria-label="Başlangıç"
                  className="h-9 px-3 rounded-[10px] bg-surfaceUp border border-white/[0.06] text-xs text-text outline-none focus:border-accent/40 transition-colors"
                />
                <span className="text-xs text-textMuted">—</span>
                <input
                  type="datetime-local"
                  value={draft.customEnd}
                  onChange={(e) => setDraft((d) => ({ ...d, customEnd: e.target.value }))}
                  aria-label="Bitiş"
                  className="h-9 px-3 rounded-[10px] bg-surfaceUp border border-white/[0.06] text-xs text-text outline-none focus:border-accent/40 transition-colors"
                />
              </div>
            )}
          </section>

          <section>
            <h4 className="text-[11px] uppercase tracking-wider text-textMuted mb-3">Kategori</h4>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                <Pill key={c} active={draft.category === c} onClick={() => setDraftCategory(c)}>
                  {CATEGORY_LABEL[c]}
                </Pill>
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-[11px] uppercase tracking-wider text-textMuted mb-3">
              Aksiyon <span className="normal-case tracking-normal">(çoklu seçim)</span>
            </h4>
            <div className="flex flex-col gap-4">
              {visibleGroups.map((g) => (
                <div key={g.category}>
                  {draft.category === 'all' && (
                    <div className="text-xs text-textMuted mb-2">{g.label}</div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {g.keys.map((key) => (
                      <Pill
                        key={key}
                        active={draft.actionKeys.includes(key)}
                        onClick={() => toggleDraftAction(key)}
                      >
                        {ACTION_DEF[key].label}
                      </Pill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-[11px] uppercase tracking-wider text-textMuted mb-3">Yapan</h4>
            <div className="flex gap-2 flex-wrap">
              <Pill active={draft.actorId === 'all'} onClick={() => setDraft((d) => ({ ...d, actorId: 'all' }))}>
                Tümü
              </Pill>
              {actors.map((a) => (
                <Pill
                  key={a.id}
                  active={draft.actorId === a.id}
                  onClick={() => setDraft((d) => ({ ...d, actorId: a.id }))}
                >
                  {a.label}
                </Pill>
              ))}
            </div>
          </section>

          {isSuper && (
            <section>
              <h4 className="text-[11px] uppercase tracking-wider text-textMuted mb-3">Site</h4>
              <div className="flex gap-2 flex-wrap">
                <Pill active={draft.siteId === 'all'} onClick={() => setDraft((d) => ({ ...d, siteId: 'all' }))}>
                  Tümü
                </Pill>
                {sites.map((s) => (
                  <Pill
                    key={s.id}
                    active={draft.siteId === s.id}
                    onClick={() => setDraft((d) => ({ ...d, siteId: s.id }))}
                  >
                    {s.name}
                  </Pill>
                ))}
              </div>
            </section>
          )}
        </div>
      </Dialog>
    </>
  );
}

function Row({
  row,
  actorFallback,
  showSite,
}: {
  row: AuditRow;
  actorFallback: string;
  showSite: boolean;
}) {
  const def = ACTION_DEF[row.action] ?? { label: row.action, tone: 'muted' as const };
  const detail = describe(row);
  const actorName = row.users?.full_name?.trim() || row.users?.email || actorFallback;

  return (
    <div
      className={cx(
        'grid gap-4 px-3 py-3 items-center',
        showSite
          ? 'grid-cols-[1.3fr_1.7fr_1.2fr_0.9fr_auto]'
          : 'grid-cols-[1.3fr_1.7fr_1.2fr_auto]',
      )}
    >
      <div className="min-w-0">
        <div className="text-sm text-text truncate">{actorName}</div>
        {row.users?.email && (
          <div className="text-[11px] text-textMuted font-mono truncate">{row.users.email}</div>
        )}
      </div>
      <div className="min-w-0 flex flex-col gap-1.5">
        <div>
          <Badge tone={def.tone}>{def.label}</Badge>
        </div>
        {detail && <span className="text-[11px] text-textMuted leading-snug truncate">{detail}</span>}
      </div>
      <div className="text-sm text-textSec font-mono truncate">
        {row.target_label ?? <span className="text-textMuted">—</span>}
      </div>
      {showSite && (
        <div className="text-sm text-textSec truncate">
          {row.sites?.name ?? <span className="text-textMuted">—</span>}
        </div>
      )}
      <div className="text-xs text-textMuted font-mono w-20 text-right">
        {timeFormatter.format(new Date(row.created_at))}
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="h-7 pl-3 pr-1 inline-flex items-center gap-1 rounded-full bg-accentDim border border-accent/40 text-xs text-accent">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${label} filtresini kaldır`}
        className="h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-accent/20 transition-colors"
      >
        <X size={11} weight="bold" />
      </button>
    </span>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'h-8 px-3 inline-flex items-center rounded-full border text-xs font-medium transition-colors whitespace-nowrap',
        active
          ? 'bg-accentDim border-accent/40 text-accent'
          : 'bg-surface border-sep text-textSec hover:text-text',
      )}
    >
      {children}
    </button>
  );
}
