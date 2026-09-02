'use client';

import { useState } from 'react';
import { useKotBoard, type BoardTicket } from '@/lib/realtime/use-kot-board';
import { useTicketActions } from './ticket-actions';
import { ConnectionBadge } from './connection-badge';
import { TicketItems } from './ticket-items';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  SourceTag,
  Spinner,
  cx,
} from '@/components/ui/primitives';
import {
  elapsedSince,
  untilDeadline,
  money,
  timeOnly,
  KOT_STATUS_LABELS,
  SOURCE_LABELS,
} from '@/lib/format';

const GROUPS: Array<{ key: string; title: string; statuses: string[] }> = [
  { key: 'incoming', title: 'Waiting on you', statuses: ['NEW'] },
  { key: 'kitchen', title: 'In the kitchen', statuses: ['ACCEPTED', 'PREPARING'] },
  { key: 'ready', title: 'Ready and handoff', statuses: ['READY_FOR_PICKUP'] },
  {
    key: 'out',
    title: 'Out for delivery',
    statuses: ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  },
];

/**
 * The realtime live board.
 *
 * Kept in its own component so the KOT subscription only runs while the Live
 * tab is mounted -- switching to Completed or All Orders unsubscribes and does
 * not compete with the history queries.
 */
export function LiveBoard({
  initialTickets,
  canAct,
}: {
  initialTickets: BoardTicket[];
  canAct: boolean;
}) {
  const { tickets, connection, lastSyncedAt } = useKotBoard(initialTickets);
  const actions = useTicketActions();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [etaFor, setEtaFor] = useState<string | null>(null);
  const [etaValue, setEtaValue] = useState('');

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {tickets.length} active {tickets.length === 1 ? 'ticket' : 'tickets'}
        </p>
        <ConnectionBadge state={connection} lastSyncedAt={lastSyncedAt} />
      </div>

      {actions.error ? (
        <Alert tone="danger" title="That did not go through">
          <div className="flex items-start justify-between gap-4">
            <span>{actions.error}</span>
            <Button size="sm" variant="ghost" onClick={actions.clearError}>
              Dismiss
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className="space-y-8">
        {tickets.length === 0 ? (
          <EmptyState
            title="Nothing on the board"
            description="New marketplace orders and released subscription deliveries appear here the moment they arrive."
          />
        ) : null}

        {GROUPS.map((group) => {
          const groupTickets = tickets.filter((ticket) =>
            group.statuses.includes(ticket.status),
          );
          if (groupTickets.length === 0) return null;

          return (
            <section key={group.key}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
                {group.title}
                <span className="rounded-full bg-sunken px-2 py-0.5 text-xs tabular">
                  {groupTickets.length}
                </span>
              </h2>

              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {groupTickets.map((ticket) => {
                  const deadline = untilDeadline(ticket.sla_due_at);
                  const busy = actions.pendingId === ticket.id;

                  return (
                    <Card
                      key={ticket.id}
                      className={cx(
                        'flex flex-col p-4',
                        ticket._changedAt !== undefined &&
                          Date.now() - ticket._changedAt < 2000 &&
                          'ck-flash',
                        deadline?.overdue && 'border-danger',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <SourceTag source={ticket.source} ticketCode={ticket.ticket_code} />
                          <span className="text-xs text-subtle">
                            {SOURCE_LABELS[ticket.source] ?? ticket.source}
                          </span>
                        </div>

                        {deadline ? (
                          <Badge tone={deadline.overdue ? 'danger' : 'neutral'}>
                            {deadline.label}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-baseline justify-between gap-3">
                        <p className="font-medium">
                          {ticket.customer_name ?? 'Marketplace customer'}
                        </p>
                        {ticket.order_total ? (
                          <p className="text-sm tabular text-muted">
                            {money(ticket.order_total)}
                          </p>
                        ) : null}
                      </div>

                      <p className="mt-0.5 text-xs text-subtle">
                        #{ticket.order_number}
                        {ticket.subscription_number ? ` · ${ticket.subscription_number}` : ''}
                        {ticket.delivery_window_label
                          ? ` · ${ticket.delivery_window_label}`
                          : ''}
                        {ticket.scheduled_for ? ` · due ${timeOnly(ticket.scheduled_for)}` : ''}
                      </p>

                      <TicketItems ticketId={ticket.id} orderId={ticket.order_id} />

                      {ticket.special_instructions ? (
                        <p className="mt-2 rounded-ck bg-warning-soft px-2 py-1 text-xs text-warning">
                          {ticket.special_instructions}
                        </p>
                      ) : null}

                      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
                        <div className="flex gap-1">
                          <dt>Waiting</dt>
                          <dd className="tabular text-muted">
                            {elapsedSince(ticket.created_at)}
                          </dd>
                        </div>
                        <div className="flex gap-1">
                          <dt>ETA</dt>
                          <dd className="tabular text-muted">
                            {ticket.prep_eta_minutes ?? '—'} min
                            {ticket.eta_overridden_at ? ' (overridden)' : ''}
                          </dd>
                        </div>
                        <div className="flex gap-1">
                          <dt>Status</dt>
                          <dd className="text-muted">
                            {KOT_STATUS_LABELS[ticket.status] ?? ticket.status}
                          </dd>
                        </div>
                      </dl>

                      {canAct ? (
                        <div className="mt-4 border-t border-line pt-3">
                          {rejecting === ticket.id ? (
                            <div className="space-y-2">
                              <Input
                                autoFocus
                                value={rejectReason}
                                placeholder="Why are you rejecting this?"
                                onChange={(event) => setRejectReason(event.target.value)}
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="danger"
                                  size="sm"
                                  disabled={!rejectReason.trim() || busy}
                                  onClick={async () => {
                                    const ok = await actions.transition(
                                      ticket.id,
                                      'REJECTED',
                                      rejectReason.trim(),
                                    );
                                    if (ok) {
                                      setRejecting(null);
                                      setRejectReason('');
                                    }
                                  }}
                                >
                                  Confirm rejection
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setRejecting(null);
                                    setRejectReason('');
                                  }}
                                >
                                  Keep it
                                </Button>
                              </div>
                            </div>
                          ) : etaFor === ticket.id ? (
                            <div className="flex gap-2">
                              <Input
                                autoFocus
                                type="number"
                                min={1}
                                max={240}
                                value={etaValue}
                                placeholder="Minutes"
                                onChange={(event) => setEtaValue(event.target.value)}
                              />
                              <Button
                                size="sm"
                                disabled={!etaValue || busy}
                                onClick={async () => {
                                  const ok = await actions.overrideEta(
                                    ticket.id,
                                    Number(etaValue),
                                  );
                                  if (ok) {
                                    setEtaFor(null);
                                    setEtaValue('');
                                  }
                                }}
                              >
                                Set
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setEtaFor(null)}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {busy ? <Spinner className="mt-2" /> : null}

                              {ticket.status === 'NEW' ? (
                                <>
                                  <Button
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => actions.transition(ticket.id, 'ACCEPTED')}
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => setRejecting(ticket.id)}
                                  >
                                    Reject
                                  </Button>
                                </>
                              ) : null}

                              {ticket.status === 'PREPARING' ? (
                                <Button
                                  variant="success"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    actions.transition(ticket.id, 'READY_FOR_PICKUP')
                                  }
                                >
                                  Ready for pickup
                                </Button>
                              ) : null}

                              {ticket.status === 'READY_FOR_PICKUP' ? (
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => actions.transition(ticket.id, 'PICKED_UP')}
                                >
                                  Picked up
                                </Button>
                              ) : null}

                              {ticket.status === 'PICKED_UP' ? (
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    actions.transition(ticket.id, 'OUT_FOR_DELIVERY')
                                  }
                                >
                                  Out for delivery
                                </Button>
                              ) : null}

                              {ticket.status === 'OUT_FOR_DELIVERY' ? (
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => actions.transition(ticket.id, 'DELIVERED')}
                                >
                                  Delivered
                                </Button>
                              ) : null}

                              {ticket.status === 'DELIVERED' ? (
                                <Button
                                  variant="success"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => actions.transition(ticket.id, 'COMPLETED')}
                                >
                                  Complete
                                </Button>
                              ) : null}

                              {['NEW', 'ACCEPTED', 'PREPARING'].includes(ticket.status) ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => {
                                    setEtaFor(ticket.id);
                                    setEtaValue(String(ticket.prep_eta_minutes ?? 25));
                                  }}
                                >
                                  Change ETA
                                </Button>
                              ) : null}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

