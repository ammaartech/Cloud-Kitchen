'use client';

import { useKotBoard, type BoardTicket } from '@/lib/realtime/use-kot-board';
import { useTicketActions } from './ticket-actions';
import { ConnectionBadge } from './connection-badge';
import { TicketItems } from './ticket-items';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Alert, Button, Card, EmptyState, SourceTag, cx } from '@/components/ui/primitives';
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
  { key: 'queue', title: 'Accepted — start these', statuses: ['ACCEPTED'], tone: 'text-info' },
  { key: 'cooking', title: 'Cooking now', statuses: ['PREPARING'], tone: 'text-accent' },
  {
    key: 'done',
    title: 'Ready — manager to hand off',
    statuses: ['READY_FOR_PICKUP'],
    tone: 'text-success',
  },
];

export function KitchenBoard({
  initialTickets,
  user,
}: {
  initialTickets: BoardTicket[];
  /** All three kitchen accounts share this display, so it says which one. */
  user: { name: string; role: string };
}) {
  const { tickets, connection, lastSyncedAt } = useKotBoard(initialTickets);
  const actions = useTicketActions();

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

                {columnTickets.map((ticket) => {
                  const deadline = untilDeadline(ticket.sla_due_at);
                  const busy = actions.pendingId === ticket.id;

                  return (
                    <Card
                      key={ticket.id}
                      className={cx(
                        'p-4',
                        ticket._changedAt !== undefined &&
                          Date.now() - ticket._changedAt < 2000 &&
                          'ck-flash',
                        deadline?.overdue && 'border-danger',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <SourceTag
                          source={ticket.source}
                          ticketCode={ticket.ticket_code}
                          size="lg"
                        />

                        <div className="text-right">
                          <p
                            className={cx(
                              'text-lg font-semibold tabular',
                              deadline?.overdue ? 'text-danger' : 'text-muted',
                            )}
                          >
                            {deadline?.label ?? elapsedSince(ticket.created_at)}
                          </p>
                          <p className="text-xs text-subtle">
                            {SOURCE_LABELS[ticket.source] ?? ticket.source}
                            {ticket.delivery_window_label
                              ? ` · ${ticket.delivery_window_label}`
                              : ''}
                          </p>
                        </div>
                      </div>

                      {/* Large item list -- this is the part a cook reads. */}
                      <TicketItems ticketId={ticket.id} orderId={ticket.order_id} size="lg" />

                      {ticket.special_instructions ? (
                        <p className="mt-3 rounded-ck bg-warning-soft px-3 py-2 text-base font-medium text-warning">
                          {ticket.special_instructions}
                        </p>
                      ) : null}

                      {ticket.scheduled_for ? (
                        <p className="mt-3 text-sm text-subtle">
                          Due {timeOnly(ticket.scheduled_for)}
                        </p>
                      ) : null}

                      {ticket.status === 'ACCEPTED' ? (
                        <Button
                          size="lg"
                          className="mt-4 w-full"
                          disabled={busy}
                          onClick={() => actions.transition(ticket.id, 'PREPARING')}
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
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
