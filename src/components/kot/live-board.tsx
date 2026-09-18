'use client';

import { memo, useCallback, useState } from 'react';
import type { BoardTicket, KotBoard } from '@/lib/realtime/use-kot-board';
import type { TicketItem } from '@/lib/kot/items';
import { itemsFor, useTicketItems } from '@/lib/kot/items-store';
import { useTicketActions } from './ticket-actions';
import { ConnectionBadge } from './connection-badge';
import { TicketItems } from './ticket-items';
import { useFlash } from './use-flash';
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
  sourceCardTone,
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
  // Post-handoff. Manager clicked "Handed off" to enter PICKED_UP; OUT_FOR_DELIVERY
  // lands here for SW/ZM tickets via the rider webhook. DELIVERED is terminal
  // and leaves the live board entirely (see ACTIVE_STATUSES) -- it appears on
  // the Completed tab instead.
  {
    key: 'out',
    title: 'In transit',
    statuses: ['PICKED_UP', 'OUT_FOR_DELIVERY'],
  },
];

type EditMode = 'reject' | 'eta';
type TicketActions = ReturnType<typeof useTicketActions>;

/**
 * The realtime live board.
 *
 * The board state itself lives in `ManagerBoard`, so the subscription keeps
 * running while the manager is on a history tab and the live tab is current
 * the instant they return. This component renders it and acts on it.
 *
 * Each ticket is its own memoised card. A Realtime change, an items read
 * landing or a keystroke in one card's form re-renders that card only; the
 * rest of the board re-renders on the clock tick, when their labels change.
 */
export function LiveBoard({ board, canAct }: { board: KotBoard; canAct: boolean }) {
  const { tickets, connection, lastSyncedAt, apply, optimistic, now } = board;
  const actions = useTicketActions({ apply, optimistic });

  // One card at a time is mid-edit. Which one is board state; the text being
  // typed is the card's own, so typing never reaches the other cards.
  const [editing, setEditing] = useState<{ id: string; mode: EditMode } | null>(null);
  const edit = useCallback((id: string, mode: EditMode | null) => {
    setEditing((current) => {
      if (mode) return { id, mode };
      // Closing only closes this card's editor; another may have opened since.
      return current?.id === id ? null : current;
    });
  }, []);

  useTicketItems(tickets.map((ticket) => ticket.order_id));

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

      {tickets.length === 0 ? (
        <EmptyState
          title="Nothing on the board"
          description="New marketplace orders and released subscription deliveries appear here the moment they arrive."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {GROUPS.map((group) => {
            const groupTickets = tickets.filter((ticket) =>
              group.statuses.includes(ticket.status),
            );

            return (
              <section key={group.key} className="flex flex-col">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
                  {group.title}
                  <span className="rounded-full bg-sunken px-2 py-0.5 text-xs tabular">
                    {groupTickets.length}
                  </span>
                </h2>

                <div className="flex-1 space-y-3">
                  {groupTickets.length === 0 ? (
                    <EmptyState title="Nothing here" />
                  ) : null}

                  {groupTickets.map((ticket) => (
                    <LiveTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      items={itemsFor(ticket.order_id)}
                      now={now}
                      busy={actions.isPending(ticket.id)}
                      canAct={canAct}
                      mode={editing?.id === ticket.id ? editing.mode : null}
                      onEdit={edit}
                      transition={actions.transition}
                      overrideEta={actions.overrideEta}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

const LiveTicketCard = memo(function LiveTicketCard({
  ticket,
  items,
  now,
  busy,
  canAct,
  mode,
  onEdit,
  transition,
  overrideEta,
}: {
  ticket: BoardTicket;
  items: TicketItem[] | undefined;
  now: number;
  busy: boolean;
  canAct: boolean;
  mode: EditMode | null;
  onEdit: (id: string, mode: EditMode | null) => void;
  transition: TicketActions['transition'];
  overrideEta: TicketActions['overrideEta'];
}) {
  const flashRef = useFlash<HTMLDivElement>(ticket._changedAt);
  // The reject reason or the ETA minutes, whichever editor is open.
  const [draft, setDraft] = useState('');
  const deadline = untilDeadline(ticket.sla_due_at, now);

  return (
    <Card
      ref={flashRef}
      className={cx(
        'flex flex-col p-4',
        sourceCardTone(ticket.source, Boolean(ticket.subscription_number)),
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
          <Badge tone={deadline.overdue ? 'danger' : 'neutral'}>{deadline.label}</Badge>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <p className="font-medium">{ticket.customer_name ?? 'Marketplace customer'}</p>
        {ticket.order_total ? (
          <p className="text-sm tabular text-muted">{money(ticket.order_total)}</p>
        ) : null}
      </div>

      <p className="mt-0.5 text-xs text-subtle">
        #{ticket.order_number}
        {ticket.subscription_number ? ` · ${ticket.subscription_number}` : ''}
        {ticket.delivery_window_label ? ` · ${ticket.delivery_window_label}` : ''}
        {ticket.scheduled_for ? ` · due ${timeOnly(ticket.scheduled_for)}` : ''}
      </p>

      <TicketItems items={items} />

      {ticket.special_instructions ? (
        <p className="mt-2 rounded-ck bg-warning-soft px-2 py-1 text-xs text-warning">
          {ticket.special_instructions}
        </p>
      ) : null}

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
        <div className="flex gap-1">
          <dt>Waiting</dt>
          <dd className="tabular text-muted">{elapsedSince(ticket.created_at, now)}</dd>
        </div>
        <div className="flex gap-1">
          <dt>ETA</dt>
          <dd className="tabular text-muted">
            {ticket.prep_eta_minutes ?? '-'} min
            {ticket.eta_overridden_at ? ' (overridden)' : ''}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Status</dt>
          <dd className="text-muted">{KOT_STATUS_LABELS[ticket.status] ?? ticket.status}</dd>
        </div>
      </dl>

      {canAct ? (
        <div className="mt-4 border-t border-line pt-3">
          {mode === 'reject' ? (
            <div className="space-y-2">
              <Input
                autoFocus
                value={draft}
                placeholder="Why are you rejecting this?"
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={!draft.trim() || busy}
                  onClick={async () => {
                    const ok = await transition(ticket.id, 'REJECTED', draft.trim());
                    if (ok) onEdit(ticket.id, null);
                  }}
                >
                  Confirm rejection
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onEdit(ticket.id, null)}>
                  Keep it
                </Button>
              </div>
            </div>
          ) : mode === 'eta' ? (
            <div className="flex gap-2">
              <Input
                autoFocus
                type="number"
                min={1}
                max={240}
                value={draft}
                placeholder="Minutes"
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button
                size="sm"
                disabled={!draft || busy}
                onClick={async () => {
                  const ok = await overrideEta(ticket.id, Number(draft));
                  if (ok) onEdit(ticket.id, null);
                }}
              >
                Set
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onEdit(ticket.id, null)}>
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
                    onClick={() => transition(ticket.id, 'ACCEPTED')}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setDraft('');
                      onEdit(ticket.id, 'reject');
                    }}
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
                  onClick={() => transition(ticket.id, 'READY_FOR_PICKUP')}
                >
                  Ready for pickup
                </Button>
              ) : null}

              {ticket.status === 'READY_FOR_PICKUP' ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => transition(ticket.id, 'PICKED_UP')}
                >
                  Handed off
                </Button>
              ) : null}

              {['PICKED_UP', 'OUT_FOR_DELIVERY'].includes(ticket.status) ? (
                <>
                  {ticket.source !== 'SX' ? (
                    <span className="text-xs text-subtle">
                      Awaiting {SOURCE_LABELS[ticket.source] ?? ticket.source} update
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => transition(ticket.id, 'DELIVERED')}
                    title="Only use if the delivery partner didn't update automatically"
                  >
                    Mark delivered
                  </Button>
                </>
              ) : null}

              {['NEW', 'ACCEPTED', 'PREPARING'].includes(ticket.status) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setDraft(String(ticket.prep_eta_minutes ?? 25));
                    onEdit(ticket.id, 'eta');
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
});
