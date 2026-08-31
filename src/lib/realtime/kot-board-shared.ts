/**
 * Shared between the server pages and the client board.
 *
 * Deliberately NOT in the `'use client'` hook module: a value exported from a
 * client module and imported by a Server Component arrives as a client
 * reference rather than the value itself, so `ACTIVE_STATUSES` would silently
 * become a function and `new Set(...)` would throw at request time.
 */

/** Statuses that keep a ticket on the live board. */
export const ACTIVE_STATUSES = [
  'NEW',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;

/** What the kitchen display shows: accepted work onward, never unaccepted. */
export const KITCHEN_STATUSES = ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'] as const;

export interface BoardTicket {
  id: string;
  order_id: string;
  ticket_code: string;
  source: string;
  status: string;
  business_date: string;
  daily_number: number;
  priority: number;
  urgency_score: number;
  sla_due_at: string | null;
  prep_eta_minutes: number | null;
  prep_eta_minutes_original: number | null;
  eta_overridden_at: string | null;
  accepted_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  picked_up_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  rejection_reason: string | null;
  cancellation_reason: string | null;
  cancellation_origin: string | null;
  created_at: string;
  order_number: number;
  external_order_id: string | null;
  scheduled_for: string | null;
  special_instructions: string | null;
  delivery_instructions: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_window_code: string | null;
  delivery_window_label: string | null;
  window_starts_at: string | null;
  order_total: string | null;
  order_subtotal: string | null;
  subscription_number: string | null;
  item_count: number;
  /** Set locally when a row changes, so the card can flash once. Not persisted. */
  _changedAt?: number;
}
