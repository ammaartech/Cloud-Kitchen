import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { confirmCheckout } from '@/lib/checkout/service';
import { clearDraft } from '@/lib/checkout/draft';
import { adminClient } from '@/lib/supabase/admin';

const bodySchema = z.object({
  paymentId: z.string().uuid(),
  provider: z.enum(['razorpay', 'cashfree', 'sandbox']),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'That request was not valid' }, { status: 400 });
  }

  // The payment must belong to the caller. Without this, a signed-in customer
  // could post a callback against someone else's payment id.
  const { data: payment } = await adminClient()
    .from('payments')
    .select('id, customer_id, customers ( profile_id )')
    .eq('id', parsed.data.paymentId)
    .maybeSingle();

  const ownerProfile = (payment as { customers?: { profile_id?: string } } | null)?.customers
    ?.profile_id;

  if (!payment || ownerProfile !== session.id) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  try {
    const outcome = await confirmCheckout({
      provider: parsed.data.provider,
      paymentId: parsed.data.paymentId,
      payload: parsed.data.payload,
    });

    if (outcome.status === 'active') {
      await clearDraft();
    }

    return NextResponse.json(outcome);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not confirm the payment';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
