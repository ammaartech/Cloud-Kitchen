import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { serverClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  ticketId: z.string().uuid(),
  toStatus: z.enum([
    'ACCEPTED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'COMPLETED',
    'REJECTED',
    'CANCELLED',
  ]),
  reason: z.string().max(500).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

/**
 * Moves a ticket.
 *
 * Note what this route does *not* do: it does not decide whether the move is
 * allowed. It calls the RPC with the caller's own token, and the transition
 * trigger checks both that the transition is legal and that this actor holds
 * the permission it requires. An Owner's token reaching this endpoint still
 * cannot accept a ticket -- their read-only KOT is enforced in the database,
 * not by hiding a button.
 */
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

  const { data, error } = await supabase.rpc('transition_kot_ticket', {
    p_ticket_id: parsed.data.ticketId,
    p_to_status: parsed.data.toStatus,
    p_reason: parsed.data.reason ?? null,
    p_notes: parsed.data.notes ?? null,
  });

  if (error) {
    // 'insufficient_privilege' from the trigger becomes a 403 rather than a
    // generic 500, so the screen can say something useful.
    const forbidden =
      error.message.includes('may not perform transition') ||
      error.message.includes('insufficient');

    return NextResponse.json(
      { error: error.message },
      { status: forbidden ? 403 : 400 },
    );
  }

  return NextResponse.json(data);
}
