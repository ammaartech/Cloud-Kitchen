import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { KitchenBoard } from '@/components/kot/kitchen-board';
import { KITCHEN_STATUSES, type BoardTicket } from '@/lib/realtime/kot-board-shared';

export const metadata = { title: 'Kitchen Display' };

export const dynamic = 'force-dynamic';

export default async function KitchenPage() {
  const session = await requirePermission(PERMISSIONS.kotView);
  const supabase = await serverClient();

  // The kitchen only ever sees accepted work onward -- an unaccepted ticket is
  // the manager's decision, not the kitchen's (PRD 9).
  const { data } = await supabase
    .from('v_kot_tickets')
    .select('*')
    .in('status', [...KITCHEN_STATUSES])
    .order('priority', { ascending: false });

  return (
    <KitchenBoard
      initialTickets={(data ?? []) as BoardTicket[]}
      user={{ name: session.fullName || session.email || 'Signed in', role: session.role }}
    />
  );
}
