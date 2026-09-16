import { io } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { rowsOf } from '@/lib/supabase/query';
import { serverEnv } from '@/lib/env';
import { loadTicketItems } from '@/lib/kot/items';
import { ManagerBoard } from '@/components/kot/manager-board';
import { ACTIVE_STATUSES, type BoardTicket } from '@/lib/realtime/kot-board-shared';
import type { KotTabKey } from '@/components/kot/tabs';
import { ISO_DATE, todayISO } from '@/lib/kot/date';

export const instant = false;

export const metadata = { title: 'KOT Manager' };

const VALID_TABS: readonly KotTabKey[] = ['live', 'completed', 'all'];

export default async function ManagerPage({ searchParams }: PageProps<'/kot/manager'>) {
  const supabase = await serverClient();

  // The guard, the URL and the board read go out together. The read is
  // already filtered by RLS as this user, and a refused guard still redirects
  // before render.
  const [session, raw, ticketsResult] = await Promise.all([
    requirePermission(PERMISSIONS.kotView),
    searchParams,
    supabase.from('v_kot_tickets').select('*').in('status', [...ACTIVE_STATUSES]),
  ]);

  const tickets = rowsOf<BoardTicket>(ticketsResult, 'v_kot_tickets');

  // The lines, for every ticket, in one read -- so the first paint is the
  // whole board rather than cards that fill in one by one.
  const items = await loadTicketItems(
    supabase,
    tickets.map((ticket) => ticket.order_id),
  );

  const tabParam = pickOne(raw.tab);
  const initialTab: KotTabKey = VALID_TABS.includes(tabParam as KotTabKey)
    ? (tabParam as KotTabKey)
    : 'live';

  // The clock read is per request: it seeds the board's relative times and
  // the history date. `io()` keeps it out of any prerendered shell.
  await io();

  const initialDate = normaliseDate(pickOne(raw.date)) ?? todayISO();
  const canAct = session.permissions.has(PERMISSIONS.kotAccept);

  return (
    <ManagerBoard
      initialTickets={tickets}
      initialItems={Object.fromEntries(items)}
      // A Server Component runs once per request, and this is that request's
      // clock, announced with `io()` above. The purity rule is written for
      // components that re-render; this one never does.
      // eslint-disable-next-line react-hooks/purity
      renderedAt={Date.now()}
      canAct={canAct}
      user={{ name: session.fullName || session.email || 'Signed in', role: session.role }}
      initialTab={initialTab}
      initialDate={initialDate}
      showDevTools={serverEnv().SHOW_DEV_TOOLS === 'true'}
    />
  );
}

function pickOne(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normaliseDate(value: string | undefined): string | null {
  if (!value || !ISO_DATE.test(value)) return null;
  return value;
}
