'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, FunnelSimple, MagnifyingGlass, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { cx } from '@/lib/cx';
import { createClient } from '@/lib/supabase/client';
import { LOG_SELECT, PAGE_SIZE } from './logQuery';
import type { AccessMethod } from '@/lib/types';

export interface BarrierLite { id: string; name: string }
export interface LogRow {
  id: string;
  barrier_id: string;
  user_id: string | null;
  method: AccessMethod;
  timestamp: string;
  users:    { full_name: string | null } | null;
  guests:   { guest_name: string | null } | null;
  barriers: { name: string | null } | null;
}

type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

/** Uygulanan filtre seti. Boş dizi = "tümü". */
interface LogFilters {
  datePreset: DatePreset;
  customStart: string;
  customEnd: string;
  barrierIds: string[];
  methods: AccessMethod[];
}

const DEFAULT_FILTERS: LogFilters = {
  datePreset: 'all',
  customStart: '',
  customEnd: '',
  barrierIds: [],
  methods: [],
};

const METHOD_LABEL: Record<AccessMethod, string> = {
  manual:     'Manuel',
  hands_free: 'Elsiz',
  guest:      'Misafir',
};

const METHOD_TONE: Record<AccessMethod, 'accent' | 'success' | 'warn'> = {
  manual:     'accent',
  hands_free: 'success',
  guest:      'warn',
};

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

const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

interface Props {
  siteId: string;
  initialLogs: LogRow[];
  initialHasMore: boolean;
  barriers: BarrierLite[];
}

function normalize(s: string | null | undefined): string {
  return (s ?? '').toLocaleLowerCase('tr');
}

function startOfDay(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/** Preset → [start, endExclusive] aralığı. 'all' ve boş 'custom' için null. */
function presetRange(f: LogFilters): { start: Date | null; endExclusive: Date | null } | null {
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

function activeFilterCount(f: LogFilters): number {
  let n = 0;
  if (f.datePreset !== 'all' && presetRange(f) !== null) n++;
  if (f.barrierIds.length > 0) n++;
  if (f.methods.length > 0) n++;
  return n;
}

export function LogsPageClient({ siteId, initialLogs, initialHasMore, barriers }: Props) {
  const [logs, setLogs] = useState(initialLogs);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [filters, setFilters] = useState<LogFilters>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<LogFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Uygulanan filtre seti değiştiğinde yeniden sorgula (ilk mount hariç).
  const [didMount, setDidMount] = useState(false);
  useEffect(() => {
    if (!didMount) {
      setDidMount(true);
      return;
    }
    void refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function buildQuery(cursor: { timestamp: string; id: string } | null) {
    const supabase = createClient();
    let q = supabase
      .from('access_logs')
      .select(LOG_SELECT)
      .eq('barriers.site_id', siteId)
      .eq('event_type', 'open');
    if (filters.barrierIds.length > 0) q = q.in('barrier_id', filters.barrierIds);
    if (filters.methods.length > 0) q = q.in('method', filters.methods);
    const range = presetRange(filters);
    if (range?.start) q = q.gte('timestamp', range.start.toISOString());
    if (range?.endExclusive) q = q.lt('timestamp', range.endExclusive.toISOString());
    if (cursor) {
      // Keyset: (timestamp, id) ikilisi ile — offset sayfalamanın aksine yeni
      // kayıt eklendiğinde kayma/tekrar olmaz. Mobil ile aynı desen.
      q = q.or(
        `timestamp.lt.${cursor.timestamp},and(timestamp.eq.${cursor.timestamp},id.lt.${cursor.id})`,
      );
    }
    return q
      .order('timestamp', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1);
  }

  async function refresh() {
    setRefreshing(true);
    const { data } = await buildQuery(null);
    const rows = (data ?? []) as unknown as LogRow[];
    setHasMore(rows.length > PAGE_SIZE);
    setLogs(rows.slice(0, PAGE_SIZE));
    setRefreshing(false);
  }

  async function loadMore() {
    const last = logs[logs.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    const { data } = await buildQuery({ timestamp: last.timestamp, id: last.id });
    const rows = (data ?? []) as unknown as LogRow[];
    setHasMore(rows.length > PAGE_SIZE);
    setLogs((prev) => [...prev, ...rows.slice(0, PAGE_SIZE)]);
    setLoadingMore(false);
  }

  function openFilter() {
    setDraft(filters);
    setFilterOpen(true);
  }

  function applyFilters() {
    setFilters(draft);
    setFilterOpen(false);
  }

  function toggleDraft<K extends 'barrierIds' | 'methods'>(key: K, value: string) {
    setDraft((d) => {
      const list = d[key] as string[];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...d, [key]: next };
    });
  }

  const appliedCount = activeFilterCount(filters);
  const barrierName = (id: string) => barriers.find((b) => b.id === id)?.name ?? '—';

  const filteredLogs = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return logs;
    return logs.filter(
      (log) =>
        normalize(log.users?.full_name).includes(q) ||
        normalize(log.guests?.guest_name).includes(q),
    );
  }, [logs, search]);

  const counts = useMemo(
    () => ({ total: filteredLogs.length, all: logs.length }),
    [filteredLogs, logs],
  );

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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sakin veya misafir adı ile ara…"
              className="w-full h-10 rounded-[10px] bg-surfaceUp border border-white/[0.06] pl-9 pr-9 text-sm text-text placeholder:text-textMuted outline-none focus:border-accent/40 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
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
            {filters.datePreset !== 'all' && presetRange(filters) !== null && (
              <FilterChip
                label={DATE_LABEL[filters.datePreset as Exclude<DatePreset, 'all'>]}
                onRemove={() =>
                  setFilters((f) => ({ ...f, datePreset: 'all', customStart: '', customEnd: '' }))
                }
              />
            )}
            {filters.barrierIds.map((id) => (
              <FilterChip
                key={id}
                label={barrierName(id)}
                onRemove={() =>
                  setFilters((f) => ({ ...f, barrierIds: f.barrierIds.filter((b) => b !== id) }))
                }
              />
            ))}
            {filters.methods.map((m) => (
              <FilterChip
                key={m}
                label={METHOD_LABEL[m]}
                onRemove={() =>
                  setFilters((f) => ({ ...f, methods: f.methods.filter((x) => x !== m) }))
                }
              />
            ))}
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
          <span>
            {search.trim()
              ? `${counts.total} / ${counts.all} kayıt gösteriliyor`
              : `${counts.total}${hasMore ? '+' : ''} hareket`}
          </span>
          <Button variant="subtle" size="sm" onClick={refresh} loading={refreshing}>
            <ArrowsClockwise size={14} />
            Yenile
          </Button>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="border-t border-sep py-16 text-center">
          <p className="text-text font-medium">
            {search.trim() ? 'Aramaya uyan kayıt yok.' : 'Kayıt yok.'}
          </p>
          <p className="mt-1 text-sm text-textSec">
            Filtrelere veya aramaya uyan herhangi bir hareket bulunamadı.
          </p>
        </div>
      ) : (
        <>
          <div className="border-t border-sep divide-y divide-sep">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-[1.5fr_1.2fr_auto_auto] gap-4 px-3 py-3 items-center"
              >
                <div className="text-sm text-text truncate">
                  {log.users?.full_name ??
                    log.guests?.guest_name ??
                    <span className="text-textMuted">—</span>}
                </div>
                <div className="text-sm text-textSec truncate">{log.barriers?.name ?? '—'}</div>
                <Badge tone={METHOD_TONE[log.method]}>{METHOD_LABEL[log.method]}</Badge>
                <div className="text-xs text-textMuted font-mono w-28 text-right">
                  {dateTimeFormatter.format(new Date(log.timestamp))}
                </div>
              </div>
            ))}
          </div>
          {hasMore && !search.trim() && (
            <div className="flex justify-center py-4 border-t border-sep">
              <Button variant="subtle" size="sm" onClick={loadMore} loading={loadingMore}>
                Sonraki {PAGE_SIZE} hareketi görüntüle
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Filtrele"
        description="Tarih tek seçim; bariyer ve yöntemde birden fazla seçebilirsiniz."
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
            <h4 className="text-[11px] uppercase tracking-wider text-textMuted mb-3">
              Bariyer <span className="normal-case tracking-normal">(çoklu seçim)</span>
            </h4>
            <div className="flex gap-2 flex-wrap">
              <Pill
                active={draft.barrierIds.length === 0}
                onClick={() => setDraft((d) => ({ ...d, barrierIds: [] }))}
              >
                Tümü
              </Pill>
              {barriers.map((b) => (
                <Pill
                  key={b.id}
                  active={draft.barrierIds.includes(b.id)}
                  onClick={() => toggleDraft('barrierIds', b.id)}
                >
                  {b.name}
                </Pill>
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-[11px] uppercase tracking-wider text-textMuted mb-3">
              Yöntem <span className="normal-case tracking-normal">(çoklu seçim)</span>
            </h4>
            <div className="flex gap-2 flex-wrap">
              <Pill
                active={draft.methods.length === 0}
                onClick={() => setDraft((d) => ({ ...d, methods: [] }))}
              >
                Tümü
              </Pill>
              {(['manual', 'hands_free', 'guest'] as AccessMethod[]).map((m) => (
                <Pill
                  key={m}
                  active={draft.methods.includes(m)}
                  onClick={() => toggleDraft('methods', m)}
                  tone={METHOD_TONE[m]}
                >
                  {METHOD_LABEL[m]}
                </Pill>
              ))}
            </div>
          </section>
        </div>
      </Dialog>
    </>
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
  tone,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'accent' | 'success' | 'warn';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'h-8 px-3 inline-flex items-center rounded-full border text-xs font-medium transition-colors whitespace-nowrap',
        active
          ? tone === 'success'
            ? 'bg-successDim border-success/40 text-success'
            : tone === 'warn'
            ? 'bg-warnDim border-warn/40 text-warn'
            : 'bg-accentDim border-accent/40 text-accent'
          : 'bg-surface border-sep text-textSec hover:text-text',
      )}
    >
      {children}
    </button>
  );
}
