'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardTicket } from '@/lib/realtime/kot-board-shared';

export type HistoryScope = 'completed' | 'all';

export interface HistoryTicket extends BoardTicket {
  rejected_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  window_ends_at: string | null;
}

interface State {
  tickets: HistoryTicket[];
  isLoading: boolean;
  error: string | null;
}

const INITIAL: State = { tickets: [], isLoading: true, error: null };

export function useKotHistory({
  scope,
  date,
}: {
  scope: HistoryScope;
  date: string;
}) {
  const [state, setState] = useState<State>(INITIAL);
  const [refreshToken, setRefreshToken] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    let active = true;

    async function run() {
      try {
        const response = await fetch(
          `/api/kot/history?scope=${scope}&date=${date}`,
          { cache: 'no-store' },
        );
        const body = await response.json();
        if (!active || id !== requestId.current) return;

        if (!response.ok) {
          setState({
            tickets: [],
            isLoading: false,
            error: body?.error ?? 'Could not load orders',
          });
        } else {
          setState({
            tickets: (body?.tickets ?? []) as HistoryTicket[],
            isLoading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!active || id !== requestId.current) return;
        setState({
          tickets: [],
          isLoading: false,
          error: err instanceof Error ? err.message : 'Network error',
        });
      }
    }

    void run();

    return () => {
      active = false;
    };
    // `refreshToken` participates so `refetch()` re-runs the effect.
  }, [scope, date, refreshToken]);

  // Reset visible tickets when the query key changes, so a date switch does
  // not leave the previous day's cards on screen while the new day loads.
  // This is React's "adjusting state on prop change" pattern -- setting state
  // during render on the same component reruns render immediately, which is
  // strictly better than doing it in an effect.
  const nextKey = keyOf(scope, date);
  const [prevKey, setPrevKey] = useState(nextKey);
  if (prevKey !== nextKey) {
    setPrevKey(nextKey);
    setState(INITIAL);
  }

  const refetch = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  return {
    tickets: state.tickets,
    isLoading: state.isLoading,
    error: state.error,
    refetch,
  };
}

function keyOf(scope: HistoryScope, date: string): string {
  return `${scope}:${date}`;
}
