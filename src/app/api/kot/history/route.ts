import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';

const querySchema = z.object({
  scope: z.enum(['completed', 'all']),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

const MAX_ROWS = 500;

/**
 * A single IST calendar day expressed as a half-open UTC range, so the
 * `[start, end)` filter matches every timestamp that belongs to the business
 * day the manager picked -- regardless of the Postgres session timezone.
 */
function istDayRange(dateISO: string): { startUtc: string; endUtc: string } {
  const start = new Date(`${dateISO}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
  }
  if (!session.permissions.has(PERMISSIONS.kotView)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    scope: url.searchParams.get('scope'),
    date: url.searchParams.get('date'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'That request was not valid' }, { status: 400 });
  }

  const { scope, date } = parsed.data;
  const { startUtc, endUtc } = istDayRange(date);

  const supabase = await serverClient();
  let query = supabase.from('v_kot_tickets').select('*').limit(MAX_ROWS);

  if (scope === 'completed') {
    query = query
      .eq('status', 'COMPLETED')
      .gte('completed_at', startUtc)
      .lt('completed_at', endUtc)
      .order('completed_at', { ascending: false });
  } else {
    // Every ticket for the picked business day, all statuses. `business_date`
    // is the IST calendar day the ticket was placed for and is stable.
    query = query
      .eq('business_date', date)
      .order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ tickets: data ?? [] });
}
