import { io } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { rowsOf } from '@/lib/supabase/query';
import { loadTicketItems } from '@/lib/kot/items';
import { KitchenBoard } from '@/components/kot/kitchen-board';
import { KITCHEN_STATUSES, type BoardTicket } from '@/lib/realtime/kot-board-shared';

/**
 * These screens are per-user by definition -- a session decides not just what
 * they show but whether you may see them at all -- so there is no static shell
 * to prerender and no point pretending otherwise. `instant = false` says that
 * plainly: this segment is allowed to block.
 *
 * It is a statement about *this* route, not a global escape hatch. The public
 * storefront next door is held to the opposite standard.
 */
export const instant = false;

export const metadata = { title: 'Kitchen Display' };

export default async function KitchenPage() {
  const supabase = await serverClient();

  // The guard and the board read go out together. The read is already
  // filtered by RLS as this user, and a refused guard still redirects before
  // render. The hosted database is a region away; running the two in sequence
  // cost this screen a round-trip before its own data could start.
  const [session, ticketsResult] = await Promise.all([
    requirePermission(PERMISSIONS.kotView),
    supabase
      .from('v_kot_tickets')
      .select('*')
      // The kitchen only ever sees accepted work onward -- an unaccepted
      // ticket is the manager's decision, not the kitchen's (PRD 9).
      .in('status', [...KITCHEN_STATUSES]),
  ]);

  const tickets = rowsOf<BoardTicket>(ticketsResult, 'v_kot_tickets');

  // The lines, for every ticket, in one read -- so the first paint is the
  // whole board rather than cards that fill in one by one.
  const items = await loadTicketItems(
    supabase,
    tickets.map((ticket) => ticket.order_id),
  );

  // The clock read is per request and is what the board's relative times are
  // first drawn from; `io()` keeps it out of any prerendered shell.
  await io();

  return (
    <KitchenBoard
      initialTickets={tickets}
      initialItems={Object.fromEntries(items)}
      // A Server Component runs once per request, and this is that request's
      // clock, announced with `io()` above. The purity rule is written for
      // components that re-render; this one never does.
      // eslint-disable-next-line react-hooks/purity
      renderedAt={Date.now()}
      user={{ name: session.fullName || session.email || 'Signed in', role: session.role }}
    />
  );
}
