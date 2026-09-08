'use client';

import { useState } from 'react';
import type { BoardTicket } from '@/lib/realtime/kot-board-shared';

/**
 * Calls the KOT endpoints and reports what actually happened.
 *
 * Two behaviours matter here:
 *
 *  - **Offline actions are refused up front.** A button that appears to work
 *    while the browser is offline would falsely claim the change was persisted
 *    (PRD 11, PRD 19). We check first and say so.
 *  - **The server's refusal is surfaced verbatim.** If the transition trigger
 *    rejects the move -- illegal step, or a role that may not make it -- the
 *    operator sees why rather than a silently unchanged board.
 *
 * The board handle plugs the acting client into the same state that Realtime
 * broadcasts to everyone else. We patch it optimistically the moment the user
 * clicks, then swap in the authoritative row the API returns; if the request
 * fails we roll back. That path never depends on the Realtime broadcast for
 * its own feedback, so the acting screen updates instantly rather than after
 * a round-trip through Postgres WAL.
 */
export interface BoardHandle {
  apply: (id: string, ticket: BoardTicket | null) => void;
  optimistic: (id: string, patch: Partial<BoardTicket>) => () => void;
}

export function useTicketActions(board: BoardHandle, onDone?: () => void) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(
    url: string,
    body: unknown,
    ticketId: string,
    rollback: () => void,
  ) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      rollback();
      setError('You are offline. This change was not saved — reconnect and try again.');
      return false;
    }

    setPendingId(ticketId);
    setError(null);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        rollback();
        setError(data.error ?? 'That action could not be completed.');
        return false;
      }

      // Server sends back the fresh v_kot_tickets row so we skip the extra
      // refetch the Realtime path would trigger for other clients.
      if (data && typeof data === 'object' && 'ticket' in data) {
        board.apply(ticketId, (data as { ticket: BoardTicket | null }).ticket);
      }

      onDone?.();
      return true;
    } catch {
      // A network failure mid-request leaves the outcome genuinely unknown --
      // say that rather than guessing either way. We do NOT roll back here:
      // the mutation may well have committed and the Realtime broadcast will
      // reconcile within a second or two.
      setError(
        'The connection dropped before we could confirm that change. ' +
          'Check the ticket before trying again.',
      );
      return false;
    } finally {
      setPendingId(null);
    }
  }

  return {
    pendingId,
    error,
    clearError: () => setError(null),
    transition: (ticketId: string, toStatus: string, reason?: string | null) => {
      const rollback = board.optimistic(ticketId, { status: toStatus });
      return call(
        '/api/kot/transition',
        { ticketId, toStatus, reason: reason ?? null },
        ticketId,
        rollback,
      );
    },
    overrideEta: (ticketId: string, minutes: number) => {
      const rollback = board.optimistic(ticketId, {
        prep_eta_minutes: minutes,
        eta_overridden_at: new Date().toISOString(),
      });
      return call(
        '/api/kot/eta',
        { ticketId, minutes },
        ticketId,
        rollback,
      );
    },
  };
}
