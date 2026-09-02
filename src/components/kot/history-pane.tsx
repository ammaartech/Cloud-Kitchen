'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  EmptyState,
  Input,
  Skeleton,
  cx,
} from '@/components/ui/primitives';
import {
  useKotHistory,
  type HistoryScope,
  type HistoryTicket,
} from '@/hooks/use-kot-history';
import { TicketCardReadonly } from './ticket-card-readonly';
import { KOT_STATUS_LABELS } from '@/lib/format';
import { todayISO } from '@/lib/kot/date';

const ALL_STATUS_FILTERS = [
  'NEW',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
] as const;

type StatusFilter = (typeof ALL_STATUS_FILTERS)[number] | 'ANY';

export function HistoryPane({
  scope,
  date,
  onDateChange,
}: {
  scope: HistoryScope;
  date: string;
  onDateChange: (next: string) => void;
}) {
  const { tickets, isLoading, error, refetch } = useKotHistory({ scope, date });
  const [filter, setFilter] = useState<StatusFilter>('ANY');

  const filtered = useMemo(() => {
    if (scope === 'completed' || filter === 'ANY') return tickets;
    return tickets.filter((t) => t.status === filter);
  }, [tickets, filter, scope]);

  const counts = useMemo(() => countByStatus(tickets), [tickets]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium tracking-wide text-subtle uppercase">
              Date
            </span>
            <Input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(event) => onDateChange(event.target.value)}
              className="w-44"
            />
          </label>
          <p className="pb-2 text-xs text-subtle">
            {tickets.length} {tickets.length === 1 ? 'order' : 'orders'}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={refetch} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {scope === 'all' ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label={`All (${tickets.length})`}
            active={filter === 'ANY'}
            onClick={() => setFilter('ANY')}
          />
          {ALL_STATUS_FILTERS.filter((s) => (counts[s] ?? 0) > 0).map((status) => (
            <FilterChip
              key={status}
              label={`${KOT_STATUS_LABELS[status] ?? status} (${counts[status]})`}
              active={filter === status}
              onClick={() => setFilter(status)}
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <Alert tone="danger" title="Could not load orders">
          {error}
        </Alert>
      ) : null}

      {isLoading && tickets.length === 0 ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            scope === 'completed'
              ? 'No completed orders on this day'
              : 'No orders on this day'
          }
          description={
            scope === 'completed'
              ? 'Pick another date to see completed orders from that day.'
              : 'Pick another date, or clear the status filter.'
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((ticket) => (
            <TicketCardReadonly key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ease-ck',
        active
          ? 'border-transparent bg-brand-soft text-brand'
          : 'border-line bg-surface text-muted hover:text-ink',
      )}
    >
      {label}
    </button>
  );
}

function countByStatus(tickets: HistoryTicket[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tickets) out[t.status] = (out[t.status] ?? 0) + 1;
  return out;
}

