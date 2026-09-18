'use client';

import { memo, useState } from 'react';
import { useKotBoard, type BoardTicket } from '@/lib/realtime/use-kot-board';
import { KITCHEN_STATUSES } from '@/lib/realtime/kot-board-shared';
import { itemsFor, primeTicketItems, useTicketItems } from '@/lib/kot/items-store';
import type { TicketItem } from '@/lib/kot/items';
import { useNow } from '@/hooks/use-now';
import { useTicketActions } from './ticket-actions';
import { ConnectionBadge } from './connection-badge';
import { TicketItems } from './ticket-items';
import { useFlash } from './use-flash';
import { SignOutButton } from '@/components/auth/sign-out-button';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  SourceTag,
  cx,
  sourceCardTone,
} from '@/components/ui/primitives';
import { elapsedSince, untilDeadline, timeOnly, SOURCE_LABELS } from '@/lib/format';

/**
 * Kitchen Display (PRD 5.4, PRD 9, PRD 19).
 *
 * Kanban columns, deliberately large type, no money anywhere. All three kitchen
 * accounts see this same physical display, so it is built to be read across a
 * counter rather than leaned into.
 *
 * The kitchen can start preparing. It cannot mark ready: the cook tells the
 * manager verbally, and the manager performs that step. That is a rule of the
 * business, and it is enforced in the database -- this screen simply does not
 * offer a button the kitchen's role would be refused for.
 */

const COLUMNS: Array<{ key: string; title: string; statuses: string[]; tone: string }> = [
  { key: 'queue', title: 'Accepted: start these', statuses: ['ACCEPTED'], tone: 'text-info' },
  { key: 'cooking', title: 'Cooking now', statuses: ['PREPARING'], tone: 'text-accent' },
  {
    key: 'done',
    title: 'Ready: manager to hand off',
    statuses: ['READY_FOR_PICKUP'],
    tone: 'text-success',
  },
];

export function KitchenBoard({
  initialTickets,
  initialItems,
  renderedAt,
  user,
}: {
  initialTickets: BoardTicket[];
  /** The initial tickets' lines, keyed by order id, read by the server. */
  initialItems: Record<string, TicketItem[]>;
  /** The server's clock when it rendered, so the first paint and hydration agree. */
  renderedAt: number;
  /** All three kitchen accounts share this display, so it says which one. */
  user: { name: string; role: string };
}) {
  // Seeds the shared items cache before the first render reads from it, so
  // no card ever shows a skeleton for lines the server already sent.
  useState(() => {
    primeTicketItems(new Map(Object.entries(initialItems)));
    return null;
  });

  const now = useNow(renderedAt);
  const { tickets, connection, lastSyncedAt, apply, optimistic } = useKotBoard(initialTickets, {
    statuses: KITCHEN_STATUSES,
    now,
  });
  const actions = useTicketActions({ apply, optimistic });

  useTicketItems(tickets.map((ticket) => ticket.order_id));

  return (
    <div data-surface="ops" className="min-h-dvh bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 px-5 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Kitchen Display</h1>
          <div className="flex flex-wrap items-center gap-3">
            <ConnectionBadge state={connection} lastSyncedAt={lastSyncedAt} />
            <span className="text-xs text-subtle">{user.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {actions.error ? (
        <div className="px-5 pt-4">
          <Alert tone="danger" title="That did not go through">
            <div className="flex items-start justify-between gap-4">
              <span>{actions.error}</span>
              <Button size="sm" variant="ghost" onClick={actions.clearError}>
                Dismiss
              </Button>
            </div>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-5 p-5 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const columnTickets = tickets.filter((ticket) =>
            column.statuses.includes(ticket.status),
          );

          return (
            <section key={column.key} className="flex flex-col">
              <h2
                className={cx(
                  'mb-3 flex items-center gap-2 text-base font-semibold tracking-wide uppercase',
                  column.tone,
                )}
              >
                {column.title}
                <span className="rounded-full bg-sunken px-2.5 py-0.5 text-sm tabular text-muted">
                  {columnTickets.length}
                </span>
              </h2>

              <div className="flex-1 space-y-4">
                {columnTickets.length === 0 ? (
                  <EmptyState title="Nothing here" />
                ) : null}

                {columnTickets.map((ticket) => (
                  <KitchenTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    items={itemsFor(ticket.order_id)}
                    now={now}
                    busy={actions.isPending(ticket.id)}
                    transition={actions.transition}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One ticket, memoised: a Realtime change or an items read re-renders the
 * card it concerns, not the whole display.
 */
const KitchenTicketCard = memo(function KitchenTicketCard({
  ticket,
  items,
  now,
  busy,
  transition,
}: {
  ticket: BoardTicket;
  items: TicketItem[] | undefined;
  now: number;
  busy: boolean;
  transition: ReturnType<typeof useTicketActions>['transition'];
}) {
  const flashRef = useFlash<HTMLDivElement>(ticket._changedAt);
  const deadline = untilDeadline(ticket.sla_due_at, now);

  return (
    <Card
      ref={flashRef}
      className={cx(
        'p-4',
        sourceCardTone(ticket.source, Boolean(ticket.subscription_number)),
        deadline?.overdue && 'border-danger',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <SourceTag source={ticket.source} ticketCode={ticket.ticket_code} size="lg" />

        <div className="text-right">
          <p
            className={cx(
              'text-lg font-semibold tabular',
              deadline?.overdue ? 'text-danger' : 'text-muted',
            )}
          >
            {deadline?.label ?? elapsedSince(ticket.created_at, now)}
          </p>
          <p className="text-xs text-subtle">
            {SOURCE_LABELS[ticket.source] ?? ticket.source}
            {ticket.delivery_window_label ? ` · ${ticket.delivery_window_label}` : ''}
          </p>
        </div>
      </div>

      {/* Large item list -- this is the part a cook reads. */}
      <TicketItems items={items} size="lg" />

      {ticket.special_instructions ? (
        <p className="mt-3 rounded-ck bg-warning-soft px-3 py-2 text-base font-medium text-warning">
          {ticket.special_instructions}
        </p>
      ) : null}

      {ticket.scheduled_for ? (
        <p className="mt-3 text-sm text-subtle">Due {timeOnly(ticket.scheduled_for)}</p>
      ) : null}

      {ticket.status === 'ACCEPTED' ? (
        <Button
          size="lg"
          className="mt-4 w-full"
          disabled={busy}
          onClick={() => transition(ticket.id, 'PREPARING')}
        >
          Start preparing
        </Button>
      ) : null}

      {ticket.status === 'PREPARING' ? (
        <p className="mt-4 rounded-ck border border-line bg-sunken px-3 py-2 text-center text-sm text-muted">
          Tell the manager when this is ready
        </p>
      ) : null}
    </Card>
  );
});
