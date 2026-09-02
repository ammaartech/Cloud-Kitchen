'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { BoardTicket } from '@/lib/realtime/use-kot-board';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Alert } from '@/components/ui/primitives';
import { LiveBoard } from './live-board';
import { KotTabs, type KotTabKey } from './tabs';
import { HistoryPane } from './history-pane';

/**
 * KOT Manager: the operational controller's screen (PRD 5.3, PRD 9).
 *
 * The shell owns the header, the tab switcher, and the URL state
 * (`?tab=` and `?date=`). Each tab is its own pane so the realtime KOT
 * subscription only runs while Live is mounted.
 */
export function ManagerBoard({
  initialTickets,
  canAct,
  user,
  initialTab,
  initialDate,
}: {
  initialTickets: BoardTicket[];
  canAct: boolean;
  user: { name: string; role: string };
  initialTab: KotTabKey;
  initialDate: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<KotTabKey>(initialTab);
  const [date, setDate] = useState<string>(initialDate);

  const writeUrl = useCallback(
    (nextTab: KotTabKey, nextDate: string) => {
      const search = new URLSearchParams(params?.toString() ?? '');
      if (nextTab === 'live') search.delete('tab');
      else search.set('tab', nextTab);
      if (nextTab === 'live') search.delete('date');
      else search.set('date', nextDate);
      const qs = search.toString();
      router.replace(qs ? `/kot/manager?${qs}` : '/kot/manager', { scroll: false });
    },
    [params, router],
  );

  const handleTab = (next: KotTabKey) => {
    setTab(next);
    writeUrl(next, date);
  };

  const handleDate = (next: string) => {
    setDate(next);
    writeUrl(tab, next);
  };

  return (
    <div data-surface="ops" className="min-h-dvh bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">KOT · Manager</h1>
            <p className="text-xs text-muted">{tabSubtitle(tab)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
          <LiveBoard initialTickets={initialTickets} canAct={canAct} />
        ) : (
          <HistoryPane scope={tab} date={date} onDateChange={handleDate} />
        )}
      </div>
    </div>
  );
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

