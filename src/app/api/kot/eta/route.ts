import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { serverClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  ticketId: z.string().uuid(),
  minutes: z.number().int().min(1).max(240),
});

/** Manager-only ETA override. The RPC re-checks the permission itself. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'That request was not valid' }, { status: 400 });
  }

  const supabase = await serverClient();
  const { data, error } = await supabase.rpc('override_prep_eta', {
    p_ticket_id: parsed.data.ticketId,
    p_minutes: parsed.data.minutes,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json(data);
}
