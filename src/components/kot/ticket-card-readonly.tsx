'use client';

import { Badge, Card, SourceTag } from '@/components/ui/primitives';
import { TicketItems } from './ticket-items';
import type { HistoryTicket } from '@/hooks/use-kot-history';
import {
  KOT_STATUS_LABELS,
  SOURCE_LABELS,
  money,
  timeOnly,
} from '@/lib/format';

/**
 * A ticket in a history view: no action buttons, and the terminal event --
 * completed / rejected / cancelled -- is surfaced instead of the live ETA.
 */
export function TicketCardReadonly({ ticket }: { ticket: HistoryTicket }) {
  const tone = statusTone(ticket.status);
  const terminal = terminalLabel(ticket);

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <SourceTag source={ticket.source} ticketCode={ticket.ticket_code} />
          <span className="text-xs text-subtle">
            {SOURCE_LABELS[ticket.source] ?? ticket.source}
          </span>
        </div>
        <Badge tone={tone}>{KOT_STATUS_LABELS[ticket.status] ?? ticket.status}</Badge>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <p className="font-medium">
          {ticket.customer_name ?? 'Marketplace customer'}
        </p>
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

      <TicketItems ticketId={ticket.id} orderId={ticket.order_id} />

      {ticket.special_instructions ? (
        <p className="mt-2 rounded-ck bg-warning-soft px-2 py-1 text-xs text-warning">
          {ticket.special_instructions}
        </p>
      ) : null}

      {terminal ? (
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
          <div className="flex gap-1">
            <dt>{terminal.label}</dt>
            <dd className="tabular text-muted">{timeOnly(terminal.at)}</dd>
          </div>
          {terminal.reason ? (
            <div className="flex gap-1">
              <dt>Reason</dt>
              <dd className="text-muted">{terminal.reason}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
          <div className="flex gap-1">
            <dt>Placed</dt>
            <dd className="tabular text-muted">{timeOnly(ticket.created_at)}</dd>
          </div>
          {ticket.prep_eta_minutes ? (
            <div className="flex gap-1">
              <dt>ETA</dt>
              <dd className="tabular text-muted">
                {ticket.prep_eta_minutes} min
                {ticket.eta_overridden_at ? ' (overridden)' : ''}
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </Card>
  );
}

function statusTone(
  status: string,
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'COMPLETED':
    case 'DELIVERED':
      return 'success';
    case 'REJECTED':
    case 'CANCELLED':
      return 'danger';
    case 'NEW':
      return 'info';
    case 'PREPARING':
    case 'READY_FOR_PICKUP':
      return 'warning';
    default:
      return 'neutral';
  }
}

function terminalLabel(
  ticket: HistoryTicket,
): { label: string; at: string; reason?: string | null } | null {
  if (ticket.status === 'COMPLETED' && ticket.completed_at) {
    return { label: 'Completed', at: ticket.completed_at };
  }
  if (ticket.status === 'REJECTED' && ticket.rejected_at) {
    return { label: 'Rejected', at: ticket.rejected_at, reason: ticket.rejection_reason };
  }
  if (ticket.status === 'CANCELLED' && ticket.cancelled_at) {
    return {
      label: 'Cancelled',
      at: ticket.cancelled_at,
      reason: ticket.cancellation_reason,
    };
  }
  return null;
}
