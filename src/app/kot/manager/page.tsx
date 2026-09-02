import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { ManagerBoard } from '@/components/kot/manager-board';
import { ACTIVE_STATUSES, type BoardTicket } from '@/lib/realtime/kot-board-shared';

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

export const metadata = { title: 'KOT Manager' };

// The board is realtime; a cached render would be a stale board.

export default async function ManagerPage() {
  const session = await requirePermission(PERMISSIONS.kotView);
  const supabase = await serverClient();

  // Server-rendered first paint, then the client takes over on the socket. The
  // screen is useful before JavaScript settles, which matters on a tablet in a
  // kitchen.
  const { data } = await supabase
    .from('v_kot_tickets')
    .select('*')
    .in('status', [...ACTIVE_STATUSES])
    .order('priority', { ascending: false });

  // The Owner holds kot.view and nothing else, which is exactly what makes
  // their board read-only (PRD 5.2, PRD 9).
  const canAct = session.permissions.has(PERMISSIONS.kotAccept);

  return (
    <ManagerBoard
      initialTickets={(data ?? []) as BoardTicket[]}
      canAct={canAct}
      user={{ name: session.fullName || session.email || 'Signed in', role: session.role }}
    />
  );
}
