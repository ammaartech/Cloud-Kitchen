'use client';

import { useState } from 'react';

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
 */
export function useTicketActions(onDone?: () => void) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, body: unknown, ticketId: string) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
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
        setError(data.error ?? 'That action could not be completed.');
        return false;
      }

      onDone?.();
      return true;
    } catch {
      // A network failure mid-request leaves the outcome genuinely unknown --
      // say that rather than guessing either way.
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
    transition: (ticketId: string, toStatus: string, reason?: string | null) =>
      call('/api/kot/transition', { ticketId, toStatus, reason: reason ?? null }, ticketId),
    overrideEta: (ticketId: string, minutes: number) =>
      call('/api/kot/eta', { ticketId, minutes }, ticketId),
  };
}
