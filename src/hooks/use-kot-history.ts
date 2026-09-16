'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { browserClient } from '@/lib/supabase/client';
import { requestTicketItems } from '@/lib/kot/items-store';
import { ISO_DATE, istDayRange } from '@/lib/kot/date';
import type { BoardTicket } from '@/lib/realtime/kot-board-shared';

export type HistoryScope = 'completed' | 'all';

export interface HistoryTicket extends BoardTicket {
  rejected_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  window_ends_at: string | null;
}

/**
 * The manager's history tabs: completed orders, and every order, for one day.
 *
 * Read straight from `v_kot_tickets` with the browser client. The route this
 * replaces went browser -> Next -> database, verifying the session on the way
 * through; the browser client already carries the same token, RLS applies the
 * same `kot.view` check at the database, and the money columns are masked in
 * the view for whoever asks. Going direct is one round-trip instead of two,
 * and the same path the live board's realtime reads already take.
 *
 * Results are kept per day and scope for the life of the tab, in a small
 * store the hook subscribes to. Switching from Completed to All Orders and
 * back shows the day at once and refreshes it in the background if it is more
 * than half a minute old; the manager is never looking at a skeleton for a
 * list they saw a moment ago.
 */
interface Entry {
  tickets: HistoryTicket[];
  /** When these rows were read, or null while the first read is in flight. */
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
}

const MAX_ROWS = 500;

/** A cached day older than this is shown, then re-read. */
const FRESH_FOR_MS = 30_000;

/** Days kept in memory. A manager rarely looks back more than a few. */
const MAX_ENTRIES = 40;

const EMPTY: HistoryTicket[] = [];

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;

function keyOf(scope: HistoryScope, date: string): string {
  return `${scope}:${date}`;
}

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): number {
  return version;
}

function remember(key: string, entry: Entry): void {
  // Re-inserting moves the key to the end, so eviction takes the least
  // recently touched day rather than the first one ever opened.
  entries.delete(key);
  entries.set(key, entry);
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

async function readHistory(scope: HistoryScope, date: string): Promise<HistoryTicket[]> {
  if (!ISO_DATE.test(date)) throw new Error('Pick a date first.');

  const supabase = browserClient();
  let query = supabase.from('v_kot_tickets').select('*').limit(MAX_ROWS);

  if (scope === 'completed') {
    // DELIVERED is the terminal ticket state in the simplified lifecycle;
    // COMPLETED is unreachable.
    const { startUtc, endUtc } = istDayRange(date);
    query = query
      .eq('status', 'DELIVERED')
      .gte('delivered_at', startUtc)
      .lt('delivered_at', endUtc)
      .order('delivered_at', { ascending: false });
  } else {
    // Every ticket for the picked business day, all statuses. `business_date`
    // is the IST calendar day the ticket was placed for and is stable.
    query = query.eq('business_date', date).order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []) as HistoryTicket[];
}

/** Makes sure a day is loaded, or being loaded, or fresh enough to stand. */
function ensure(scope: HistoryScope, date: string, force: boolean): void {
  const key = keyOf(scope, date);
  const current = entries.get(key);

  if (current?.loading) return;

  if (!force && current?.fetchedAt !== null && current?.fetchedAt !== undefined) {
    if (Date.now() - current.fetchedAt < FRESH_FOR_MS) {
      requestTicketItems(current.tickets.map((ticket) => ticket.order_id));
      return;
    }
  }

  remember(key, {
    tickets: current?.tickets ?? EMPTY,
    fetchedAt: current?.fetchedAt ?? null,
    loading: true,
    error: null,
  });
  notify();

  readHistory(scope, date)
    .then((tickets) => {
      remember(key, { tickets, fetchedAt: Date.now(), loading: false, error: null });
      requestTicketItems(tickets.map((ticket) => ticket.order_id));
    })
    .catch((cause: unknown) => {
      const previous = entries.get(key);
      remember(key, {
        tickets: previous?.tickets ?? EMPTY,
        fetchedAt: previous?.fetchedAt ?? null,
        loading: false,
        error: cause instanceof Error ? cause.message : 'Could not load orders',
      });
    })
    .finally(notify);
}

export function useKotHistory({ scope, date }: { scope: HistoryScope; date: string }) {
  useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    ensure(scope, date, false);
  }, [scope, date]);

  const refetch = useCallback(() => {
    ensure(scope, date, true);
  }, [scope, date]);

  const entry = entries.get(keyOf(scope, date));

  return {
    tickets: entry?.tickets ?? EMPTY,
    /** No rows to show yet. */
    isLoading: !entry || (entry.loading && entry.fetchedAt === null),
    /** Rows are on screen and a fresh read is in flight behind them. */
    isRefreshing: Boolean(entry?.loading && entry.fetchedAt !== null),
    error: entry?.error ?? null,
    refetch,
  };
}
