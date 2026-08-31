'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { browserClient } from '@/lib/supabase/client';
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
 *    not as data: we refetch the affected row from `v_kot_tickets` rather than
 *    trusting the payload, so the board reflects what the database actually
 *    holds and the money-masking in that view still applies.
 *  - **Duplicate and out-of-order events are harmless.** Refetching by id means
 *    a replayed event simply re-reads the same row, and a late event cannot
 *    resurrect stale values.
 *  - **Reconnecting resynchronises.** Anything that changed while the socket
 *    was down would otherwise be silently missing, so a reconnect triggers one
 *    full refetch. That is recovery, not polling.
 *  - **Offline is stated, never hidden.** The connection state is surfaced so
 *    nobody trusts a stale board, and actions are refused while offline rather
 *    than appearing to succeed.
 */

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';

export function useKotBoard(initial: BoardTicket[]) {
  const [tickets, setTickets] = useState<Map<string, BoardTicket>>(
    () => new Map(initial.map((ticket) => [ticket.id, ticket])),
  );
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());

  const channelRef = useRef<RealtimeChannel | null>(null);
  // Distinguishes the first connect from a genuine reconnect, so we do not
  // resync redundantly right after the server already rendered the board.
  const hasConnectedRef = useRef(false);

  /** Full resync. Used on reconnect and when the tab returns to the foreground. */
  const resync = useCallback(async () => {
    const { data, error } = await browserClient()
      .from('v_kot_tickets')
      .select('*')
      .in('status', [...ACTIVE_STATUSES])
      .order('priority', { ascending: false });

    if (error || !data) return;

    setTickets(new Map((data as BoardTicket[]).map((ticket) => [ticket.id, ticket])));
    setLastSyncedAt(new Date());
  }, []);

  /** Refetches one ticket in response to a change signal. */
  const refetchOne = useCallback(async (id: string) => {
    const { data } = await browserClient()
      .from('v_kot_tickets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    setTickets((current) => {
      const next = new Map(current);
      const incoming = data as BoardTicket | null;

      // Gone, or finished: it leaves the active board either way.
      if (!incoming || !(ACTIVE_STATUSES as readonly string[]).includes(incoming.status)) {
        next.delete(id);
        return next;
      }

      next.set(id, { ...incoming, _changedAt: Date.now() });
      return next;
    });

    setLastSyncedAt(new Date());
  }, []);

  useEffect(() => {
    const supabase = browserClient();

    const channel = supabase
      .channel('kot-board')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kot_tickets' },
        (payload: RealtimePostgresChangesPayload<{ id: string }>) => {
          const row = (payload.new ?? payload.old) as { id?: string } | null;
          if (row?.id) void refetchOne(row.id);
        },
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          setConnection('live');

          if (hasConnectedRef.current) {
            // We were disconnected and are back: catch up on what we missed.
            void resync();
          }
          hasConnectedRef.current = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnection('reconnecting');
        } else if (status === 'CLOSED') {
          setConnection((current) => (current === 'offline' ? current : 'reconnecting'));
        }
      });

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [refetchOne, resync]);

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

  // Marketplace orders outrank scheduled deliveries by baseline priority, and
  // an approaching deadline escalates anything (PRD 9).
  const list = [...tickets.values()].sort((a, b) => {
    const weightA = a.priority + a.urgency_score;
    const weightB = b.priority + b.urgency_score;
    if (weightA !== weightB) return weightB - weightA;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return { tickets: list, connection, lastSyncedAt, resync };
}
