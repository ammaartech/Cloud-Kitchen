import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { ManagerBoard } from '@/components/kot/manager-board';
import { ACTIVE_STATUSES, type BoardTicket } from '@/lib/realtime/kot-board-shared';
import type { KotTabKey } from '@/components/kot/tabs';
import { todayISO } from '@/lib/kot/date';

export const instant = false;

export const metadata = { title: 'KOT Manager' };

const VALID_TABS: readonly KotTabKey[] = ['live', 'completed', 'all'];

export default async function ManagerPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission(PERMISSIONS.kotView);
  const supabase = await serverClient();

  const raw = (await searchParams) ?? {};
  const tabParam = pickOne(raw.tab);
  const initialTab: KotTabKey = VALID_TABS.includes(tabParam as KotTabKey)
    ? (tabParam as KotTabKey)
    : 'live';
  const initialDate = normaliseDate(pickOne(raw.date)) ?? todayISO();

  const { data } = await supabase
    .from('v_kot_tickets')
    .select('*')
    .in('status', [...ACTIVE_STATUSES])
    .order('priority', { ascending: false });

  const canAct = session.permissions.has(PERMISSIONS.kotAccept);

  return (
    <ManagerBoard
      initialTickets={(data ?? []) as BoardTicket[]}
      canAct={canAct}
      user={{ name: session.fullName || session.email || 'Signed in', role: session.role }}
      initialTab={initialTab}
      initialDate={initialDate}
    />
  );
}

function pickOne(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normaliseDate(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}
