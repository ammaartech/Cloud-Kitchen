'use client';

import { useCallback, useState } from 'react';
import { useKotBoard, type BoardTicket } from '@/lib/realtime/use-kot-board';
import { primeTicketItems } from '@/lib/kot/items-store';
import type { TicketItem } from '@/lib/kot/items';
import { useNow } from '@/hooks/use-now';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Alert } from '@/components/ui/primitives';
import { LiveBoard } from './live-board';
import { KotTabs, type KotTabKey } from './tabs';
import { HistoryPane } from './history-pane';
import { DevGenerateOrderButton } from './dev-generate-order-button';

/**
 * KOT Manager: the operational controller's screen (PRD 5.3, PRD 9).
 *
 * The shell owns the header, the tab switcher, the URL state (`?tab=` and
 * `?date=`) and the live board's state. The board used to live inside the
 * Live tab and unmount with it, which meant every return to that tab showed
 * the tickets the server rendered at page load -- stale by however long the
 * manager had spent on the history tabs -- until the socket reconnected and
 * the first change happened to arrive. The subscription now runs for the life
 * of the screen, so the live tab is current the instant it is opened.
 *
 * The URL is updated with the History API rather than the router. A router
 * navigation to the same page with a new query string re-runs the server
 * render -- the session, the ticket read, all of it -- for a change that only
 * this component needs to know about. `replaceState` keeps the address
 * bookmarkable and reload-safe, which is all the URL was ever for here.
 */
export function ManagerBoard({
  initialTickets,
  initialItems,
  renderedAt,
  canAct,
  user,
  initialTab,
  initialDate,
  showDevTools,
}: {
  initialTickets: BoardTicket[];
  /** The initial tickets' lines, keyed by order id, read by the server. */
  initialItems: Record<string, TicketItem[]>;
  /** The server's clock when it rendered, so the first paint and hydration agree. */
  renderedAt: number;
  canAct: boolean;
  user: { name: string; role: string };
  initialTab: KotTabKey;
  initialDate: string;
  showDevTools?: boolean;
}) {
  // Seeds the shared items cache before the first render reads from it, so
  // no card ever shows a skeleton for lines the server already sent.
  useState(() => {
    primeTicketItems(new Map(Object.entries(initialItems)));
    return null;
  });

  const now = useNow(renderedAt);
  const board = useKotBoard(initialTickets, { now });

  const [tab, setTab] = useState<KotTabKey>(initialTab);
  const [date, setDate] = useState<string>(initialDate);

  const handleTab = (next: KotTabKey) => {
    setTab(next);
    writeUrl(next, date);
  };

  // Stable, so the memoised history pane is left alone by the clock tick and
  // by live-board events it has no part in.
  const handleDate = useCallback(
    (next: string) => {
      setDate(next);
      writeUrl(tab, next);
    },
    [tab],
  );

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">KOT · Manager</h1>
            <p className="text-xs text-muted">{tabSubtitle(tab)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {showDevTools ? <DevGenerateOrderButton /> : null}
            <span className="text-xs text-subtle">
              {user.name} · {user.role.replace('_', ' ')}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-4">
        <KotTabs active={tab} onChange={handleTab} />
      </div>

      {!canAct && tab === 'live' ? (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <Alert tone="info" title="Read-only view">
            Your role can watch the board but not change it. Operational actions belong to
            the Branch Manager.
          </Alert>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        {tab === 'live' ? (
          <LiveBoard board={board} canAct={canAct} />
        ) : (
          <HistoryPane scope={tab} date={date} onDateChange={handleDate} />
        )}
      </div>
    </div>
  );
}

function writeUrl(nextTab: KotTabKey, nextDate: string) {
  const search = new URLSearchParams();
  if (nextTab !== 'live') {
    search.set('tab', nextTab);
    search.set('date', nextDate);
  }
  const query = search.toString();
  window.history.replaceState(null, '', query ? `/kot/manager?${query}` : '/kot/manager');
}

function tabSubtitle(tab: KotTabKey): string {
  switch (tab) {
    case 'completed':
      return 'Completed orders';
    case 'all':
      return 'All orders';
    default:
      return 'Live board';
  }
}
