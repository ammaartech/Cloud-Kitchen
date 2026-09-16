import type { SupabaseClient } from '@supabase/supabase-js';
import { chunk } from '@/lib/supabase/query';

/**
 * The lines the kitchen actually cooks, read in bulk.
 *
 * Read from `v_kot_ticket_items`, which masks unit price and line total unless
 * the reader holds `orders.view_financial` -- so a Kitchen session receives no
 * money at all, rather than receiving it and being trusted not to render it
 * (PRD 5.4, PRD 17).
 *
 * One query per hundred tickets rather than one per ticket. Every card on the
 * board used to run its own read after it mounted, which on a board of thirty
 * tickets was thirty requests to a database a region away, queued six at a
 * time by the browser -- and on the history tab, up to five hundred. An
 * order's items are snapshotted at the moment the order is placed and never
 * change afterwards, which is what makes them safe to fetch once and keep.
 *
 * Plain module, no `'use client'`: the server pages read the initial board's
 * items through the same function with the request-scoped client, so the
 * first paint carries every line and no card ever shows a skeleton for
 * something the server already knew.
 */
export interface TicketItem {
  id: string;
  order_id: string;
  name: string;
  quantity: number;
  variants: Array<{ group?: string; name?: string }> | null;
  add_ons: Array<{ name?: string }> | null;
  special_instructions: string | null;
}

export type ItemsByOrder = Map<string, TicketItem[]>;

const COLUMNS = 'id, order_id, name, quantity, variants, add_ons, special_instructions';

/**
 * Tickets per query. PostgREST caps a response at 1,000 rows and says nothing
 * when it does, so the chunk is sized for the worst realistic order -- ten
 * lines -- to stay under it, and a response that hits the cap anyway is split
 * and re-read rather than trusted.
 */
const ORDERS_PER_QUERY = 100;
const RESPONSE_CAP = 1000;

type ItemsClient = Pick<SupabaseClient, 'from'>;

export async function loadTicketItems(
  client: ItemsClient,
  orderIds: Iterable<string>,
): Promise<ItemsByOrder> {
  const unique = [...new Set(orderIds)];
  const out: ItemsByOrder = new Map(unique.map((id) => [id, []]));

  await Promise.all(chunk(unique, ORDERS_PER_QUERY).map((ids) => readChunk(client, ids, out)));

  return out;
}

async function readChunk(client: ItemsClient, ids: string[], out: ItemsByOrder): Promise<void> {
  const { data, error } = await client
    .from('v_kot_ticket_items')
    .select(COLUMNS)
    .in('order_id', ids)
    .order('id');

  if (error) throw new Error(`v_kot_ticket_items: ${error.message}`);

  const rows = (data ?? []) as TicketItem[];

  // A full page is a capped page. Halve the request and read both halves;
  // a single order that alone exceeds the cap is not a case worth designing
  // for, so that one is accepted as it came.
  if (rows.length >= RESPONSE_CAP && ids.length > 1) {
    const middle = Math.ceil(ids.length / 2);
    await Promise.all([
      readChunk(client, ids.slice(0, middle), out),
      readChunk(client, ids.slice(middle), out),
    ]);
    return;
  }

  for (const row of rows) out.get(row.order_id)?.push(row);
}
