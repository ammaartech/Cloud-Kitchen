import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { parseJsonBody } from '@/lib/api/request';
import { serverClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  ticketId: z.string().uuid(),
  minutes: z.number().int().min(1).max(240),
});

/**
 * Manager-only ETA override.
 *
 * The permission is checked here so a caller without it gets a plain 403
 * before any database work, and checked again inside the RPC, which is the
 * boundary that actually holds. A hidden button is not a security boundary,
 * and neither is this early return.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
  }
  if (!session.permissions.has(PERMISSIONS.kotOverrideEta)) {
    return NextResponse.json({ error: 'Your role cannot change an ETA.' }, { status: 403 });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (!body.ok) return body.response;

  const supabase = await serverClient();
  const { data, error } = await supabase.rpc('override_prep_eta', {
    p_ticket_id: body.data.ticketId,
    p_minutes: body.data.minutes,
  });

  if (error) {
    const forbidden = error.message.includes('not permitted');
    return NextResponse.json({ error: error.message }, { status: forbidden ? 403 : 400 });
  }

  const { data: ticket } = await supabase
    .from('v_kot_tickets')
    .select('*')
    .eq('id', body.data.ticketId)
    .maybeSingle();

  return NextResponse.json({ ...(data as object | null), ticket });
}
