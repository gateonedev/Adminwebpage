'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, MagnifyingGlass, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cx } from '@/lib/cx';
import { createClient } from '@/lib/supabase/client';
import type { AccessMethod } from '@/lib/types';

export interface BarrierLite { id: string; name: string }
export interface LogRow {
  id: string;
  barrier_id: string;
  user_id: string | null;
  method: AccessMethod;
  timestamp: string;
  users:    { full_name: string | null } | null;
  barriers: { name: string | null } | null;
}

type MethodFilter = 'all' | AccessMethod;

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
  barriers: BarrierLite[];
}

function normalize(s: string | null | undefined): string {
  return (s ?? '').toLocaleLowerCase('tr');
}

export function LogsPageClient({ siteId, initialLogs, barriers }: Props) {
  const [logs, setLogs] = useState(initialLogs);
  const [barrierFilter, setBarrierFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Re-query whenever filters change (after initial mount).
  const [didMount, setDidMount] = useState(false);
  useEffect(() => {
    if (!didMount) {
      setDidMount(true);
      return;
    }
    void refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barrierFilter, methodFilter]);

  async function refresh() {
    setRefreshing(true);
    const supabase = createClient();
    const ids = barriers.map((b) => b.id);
    if (ids.length === 0) {
      setLogs([]);
      setRefreshing(false);
      return;
    }
    let q = supabase
      .from('access_logs')
      .select('id, barrier_id, user_id, method, timestamp, users(full_name), barriers(name)')
      .in('barrier_id', ids)
      .order('timestamp', { ascending: false })
      .limit(200);
    if (barrierFilter !== 'all') q = q.eq('barrier_id', barrierFilter);
    if (methodFilter !== 'all') q = q.eq('method', methodFilter);
    const { data } = await q;
    setLogs((data ?? []) as unknown as LogRow[]);
    setRefreshing(false);
  }

  const filteredLogs = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return logs;
    return logs.filter((log) => normalize(log.users?.full_name).includes(q));
  }, [logs, search]);

  const counts = useMemo(
    () => ({ total: filteredLogs.length, all: logs.length }),
    [filteredLogs, logs],
  );

  return (
    <>
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <MagnifyingGlass
            size={16}
            weight="regular"
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sakin adı ile ara…"
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

        <FilterRow label="Bariyer">
          <Pill active={barrierFilter === 'all'} onClick={() => setBarrierFilter('all')}>
            Tümü
          </Pill>
          {barriers.map((b) => (
            <Pill
              key={b.id}
              active={barrierFilter === b.id}
              onClick={() => setBarrierFilter(b.id)}
            >
              {b.name}
            </Pill>
          ))}
        </FilterRow>
        <FilterRow label="Yöntem">
          <Pill active={methodFilter === 'all'} onClick={() => setMethodFilter('all')}>
            Tümü
          </Pill>
          {(['manual', 'hands_free', 'guest'] as AccessMethod[]).map((m) => (
            <Pill
              key={m}
              active={methodFilter === m}
              onClick={() => setMethodFilter(m)}
              tone={METHOD_TONE[m]}
            >
              {METHOD_LABEL[m]}
            </Pill>
          ))}
        </FilterRow>
        <div className="flex items-center justify-between text-xs text-textMuted">
          <span>
            {search.trim()
              ? `${counts.total} / ${counts.all} kayıt gösteriliyor`
              : `${counts.total} kayıt gösteriliyor (en fazla 200).`}
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
        <div className="border-t border-sep divide-y divide-sep">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="grid grid-cols-[1.5fr_1.2fr_auto_auto] gap-4 px-3 py-3 items-center"
            >
              <div className="text-sm text-text truncate">
                {log.users?.full_name ?? <span className="text-textMuted">—</span>}
              </div>
              <div className="text-sm text-textSec truncate">{log.barriers?.name ?? '—'}</div>
              <Badge tone={METHOD_TONE[log.method]}>{METHOD_LABEL[log.method]}</Badge>
              <div className="text-xs text-textMuted font-mono w-28 text-right">
                {dateTimeFormatter.format(new Date(log.timestamp))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-1">
      <span className="text-[11px] uppercase tracking-wider text-textMuted shrink-0">{label}</span>
      <div className="flex gap-2 flex-wrap">{children}</div>
    </div>
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
