'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { browserClient } from '@/lib/supabase/client';
import { requestTicketItems } from '@/lib/kot/items-store';
import { sortTickets } from '@/lib/kot/urgency';
import { chunk } from '@/lib/supabase/query';
import { ACTIVE_STATUSES, type BoardTicket } from './kot-board-shared';

export type { BoardTicket };
export { ACTIVE_STATUSES };

/**
 * Live KOT board (PRD 11).
 *
 * Realtime is the mechanism, not a garnish on top of polling. There is no
 * interval anywhere in this hook.
 *
 * The rules it implements:
 *
 *  - **The server is authoritative.** A change event is treated as a *signal*,
 *    not as data: we refetch the affected rows from `v_kot_tickets` rather than
 *    trusting the payload, so the board reflects what the database actually
 *    holds and the money-masking in that view still applies.
 *  - **Duplicate and out-of-order events are harmless.** Refetching by id means
 *    a replayed event simply re-reads the same row, and a late event cannot
 *    resurrect stale values.
 *  - **A burst is one read.** The release job can drop thirty deliveries onto
 *    the board in the same second, and each arrives as its own event. Signals
 *    received within a few milliseconds of each other are collected and
 *    fetched with one query, so a burst costs one round-trip rather than one
 *    per ticket -- and the rows land together, so the board does not ripple.
 *  - **Connecting resynchronises.** Anything that changed between the server
 *    rendering the board and the socket opening -- or while the socket was
 *    down -- would otherwise be silently missing, so every successful
 *    subscription triggers one full refetch. That is recovery, not polling.
 *  - **Offline is stated, never hidden.** The connection state is surfaced so
 *    nobody trusts a stale board, and actions are refused while offline rather
 *    than appearing to succeed.
 *
 * A ticket's items are requested from the shared items store the moment the
 * ticket is known, so by the time its card mounts the lines are usually
 * already on their way or already here.
 */

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface KotBoardOptions {
  /** Which statuses belong on this board. A ticket in any other leaves it. */
  statuses?: readonly string[];
  /** The clock the board sorts and labels by. See `useNow`. */
  now: number;
}

/** Signals received within this window are fetched together. */
const REFETCH_COALESCE_MS = 40;

/** A failed batch read waits this long before trying again. */
const REFETCH_RETRY_MS = 2000;

/**
 * The online, visibility and subscribe signals can fire within the same
 * moment of a reconnect. One full read is enough for all of them.
 */
const RESYNC_MIN_INTERVAL_MS = 1500;

export function useKotBoard(
  initial: BoardTicket[],
  { statuses = ACTIVE_STATUSES, now }: KotBoardOptions,
) {
  const [tickets, setTickets] = useState<Map<string, BoardTicket>>(
    () => new Map(initial.map((ticket) => [ticket.id, ticket])),
  );
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => new Date(now));

  // The array is rebuilt by the caller every render; only its contents matter.
  const statusKey = statuses.join(',');
  const allowed = useMemo(() => new Set(statusKey.split(',')), [statusKey]);

  const lastResyncRef = useRef(0);
  const pendingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The batch reader schedules its own retry, so a timer needs a handle on
  // the latest version of it without the function referring to itself.
  const flushRef = useRef<() => Promise<void>>(async () => {});

  /** Full read. Used on every connect, and when the tab or network returns. */
  const resync = useCallback(
    async (force = false) => {
      const at = Date.now();
      if (!force && at - lastResyncRef.current < RESYNC_MIN_INTERVAL_MS) return;
      lastResyncRef.current = at;

      const { data, error } = await browserClient()
        .from('v_kot_tickets')
        .select('*')
        .in('status', [...allowed]);

      if (error || !data) return;

      const rows = data as BoardTicket[];
      // Every tab focus and reconnect lands here, and usually nothing has
      // changed. An unchanged row keeps its existing object, so the memoised
      // cards skip the render; an unchanged board keeps the same Map.
      setTickets((current) => {
        let changed = rows.length !== current.size;
        const next = new Map<string, BoardTicket>();
        for (const row of rows) {
          const existing = current.get(row.id);
          if (existing && sameRow(existing, row)) {
            next.set(row.id, existing);
          } else {
            next.set(row.id, row);
            changed = true;
          }
        }
        return changed ? next : current;
      });
      requestTicketItems(rows.map((ticket) => ticket.order_id));
      setLastSyncedAt(new Date());
    },
    [allowed],
  );

  /** Reads every ticket that has signalled since the last flush, in one go. */
  const flushRefetch = useCallback(async () => {
    timerRef.current = null;
    const ids = [...pendingRef.current];
    pendingRef.current = new Set();
    if (ids.length === 0) return;

    const client = browserClient();
    const pages = await Promise.all(
      chunk(ids).map((page) => client.from('v_kot_tickets').select('*').in('id', page)),
    );

    if (pages.some((page) => page.error)) {
      // Nothing is applied from a partial answer. The ids go back on the
      // queue and the read is tried again shortly; a reconnect in the
      // meantime resyncs the whole board anyway.
      for (const id of ids) pendingRef.current.add(id);
      if (timerRef.current === null) {
        timerRef.current = setTimeout(() => void flushRef.current(), REFETCH_RETRY_MS);
      }
      return;
    }

    const fresh = new Map<string, BoardTicket>();
    for (const page of pages) {
      for (const row of (page.data ?? []) as BoardTicket[]) fresh.set(row.id, row);
    }

    const stamp = Date.now();
    setTickets((current) => {
      const next = new Map(current);
      for (const id of ids) {
        const row = fresh.get(id);
        // Gone, or finished: it leaves this board either way.
        if (!row || !allowed.has(row.status)) next.delete(id);
        else next.set(id, { ...row, _changedAt: stamp });
      }
      return next;
    });

    requestTicketItems([...fresh.values()].map((ticket) => ticket.order_id));
    setLastSyncedAt(new Date());
  }, [allowed]);

  useEffect(() => {
    flushRef.current = flushRefetch;
  }, [flushRefetch]);

  const scheduleRefetch = useCallback((id: string) => {
    pendingRef.current.add(id);
    if (timerRef.current === null) {
      timerRef.current = setTimeout(() => void flushRef.current(), REFETCH_COALESCE_MS);
    }
  }, []);

  /**
   * Apply an authoritative ticket row (e.g. the fresh row returned by the
   * mutation API). `null` means the ticket is no longer visible to this
   * caller and should leave the board. Kept separate from the refetch path so
   * the acting client does not need a second round-trip.
   */
  const apply = useCallback(
    (id: string, ticket: BoardTicket | null) => {
      setTickets((current) => {
        const next = new Map(current);
        if (!ticket || !allowed.has(ticket.status)) {
          next.delete(id);
          return next;
        }
        next.set(id, { ...ticket, _changedAt: Date.now() });
        return next;
      });
      setLastSyncedAt(new Date());
    },
    [allowed],
  );

  /**
   * Optimistically patch a ticket (typically its status) before the server
   * confirms. Returns a rollback function the caller invokes if the mutation
   * fails, so the board snaps back to what the DB actually holds.
   *
   * A Realtime event arriving mid-flight is harmless: it triggers a refetch,
   * which reads the row the RPC just committed -- the same value the
   * optimistic patch predicted -- so no flicker occurs.
   */
  const optimistic = useCallback((id: string, patch: Partial<BoardTicket>) => {
    let snapshot: BoardTicket | undefined;
    setTickets((current) => {
      snapshot = current.get(id);
      if (!snapshot) return current;
      const next = new Map(current);
      next.set(id, { ...snapshot, ...patch, _changedAt: Date.now() });
      return next;
    });
    return () => {
      if (!snapshot) return;
      const restore = snapshot;
      setTickets((current) => {
        const next = new Map(current);
        next.set(id, { ...restore, _changedAt: Date.now() });
        return next;
      });
    };
  }, []);

  useEffect(() => {
    const supabase = browserClient();

    // A name of its own per subscription. Two boards sharing one browser
    // client (a manager screen open beside a kitchen one) must not collide.
    // Not `crypto.randomUUID()`: that exists only in a secure context, and a
    // kitchen tablet reaching a dev server by LAN address is plain HTTP.
    const channel = supabase
      .channel(`kot-board:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kot_tickets' },
        (payload: RealtimePostgresChangesPayload<{ id: string }>) => {
          if (payload.eventType === 'DELETE') {
            // A deleted row cannot be refetched; it leaves the board directly.
            const id = (payload.old as { id?: string } | null)?.id;
            if (!id) return;
            setTickets((current) => {
              if (!current.has(id)) return current;
              const next = new Map(current);
              next.delete(id);
              return next;
            });
            return;
          }

          const id = (payload.new as { id?: string } | null)?.id;
          if (id) scheduleRefetch(id);
        },
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          setConnection('live');
          // Catch up on anything that happened before the socket was open,
          // including the gap between the server render and now.
          void resync(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnection('reconnecting');
        } else if (status === 'CLOSED') {
          setConnection((current) => (current === 'offline' ? current : 'reconnecting'));
        }
      });

    const timer = timerRef;
    return () => {
      void supabase.removeChannel(channel);
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [resync, scheduleRefetch]);

  /* The browser knows about connectivity before the socket times out. */
  useEffect(() => {
    function handleOffline() {
      setConnection('offline');
    }

    function handleOnline() {
      setConnection('reconnecting');
      void resync();
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [resync]);

  /**
   * A backgrounded tab can have its socket dropped without an error ever
   * firing. Returning to it resyncs, so nobody acts on a stale board.
   */
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') void resync();
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [resync]);

  const list = useMemo(() => sortTickets(tickets.values(), now), [tickets, now]);

  const forceResync = useCallback(() => resync(true), [resync]);

  return { tickets: list, connection, lastSyncedAt, resync: forceResync, apply, optimistic, now };
}

export type KotBoard = ReturnType<typeof useKotBoard>;

/**
 * True when a freshly read row matches what the board holds. Only the fresh
 * row's columns are compared, so the board's own `_changedAt` stamp is
 * ignored; a column holding an object compares by identity, which reads as
 * changed -- a spare render, never a missed update.
 */
function sameRow(held: BoardTicket, fresh: BoardTicket): boolean {
  const a = held as unknown as Record<string, unknown>;
  const b = fresh as unknown as Record<string, unknown>;
  return Object.keys(b).every((key) => Object.is(a[key], b[key]));
}
