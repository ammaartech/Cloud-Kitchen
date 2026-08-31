import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { adminClient } from '@/lib/supabase/admin';
import { SandboxAdapter } from '@/lib/payments';
import { confirmCheckout } from '@/lib/checkout/service';
import { clearDraft } from '@/lib/checkout/draft';

/**
 * Stands in for the gateway's hosted page, for the sandbox provider only.
 *
 * The signing key never leaves the server, so the browser cannot mint a
 * callback: it asks for an outcome, and this endpoint signs that outcome for
 * *its own* payment only. The signature is then verified through exactly the
 * same `verifyCallback` path a real provider uses, and
 * `confirm_subscription_payment` applies the same database-level checks.
 *
 * The signing and verifying happen in one process here, which does make the
 * cryptography circular in this specific endpoint. What it still proves end to
 * end is the part that matters: an unverified outcome activates nothing, a
 * declined outcome creates no subscription and no KOT, and a retry is
 * idempotent.
 */
const bodySchema = z.object({
  paymentId: z.string().uuid(),
  outcome: z.enum(['success', 'failed', 'uncertain']),
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

  let adapter: SandboxAdapter;
  try {
    adapter = new SandboxAdapter();
  } catch {
    return NextResponse.json({ error: 'Sandbox payments are not enabled' }, { status: 400 });
  }

  if (!adapter.isConfigured) {
    return NextResponse.json({ error: 'Sandbox payments are not enabled' }, { status: 400 });
  }

  // The payment must be the caller's own, and must actually be a sandbox one.
  const { data: payment } = await adminClient()
    .from('payments')
    .select('id, provider, provider_order_id, customers ( profile_id )')
    .eq('id', parsed.data.paymentId)
    .maybeSingle();

  const row = payment as {
    provider?: string;
    provider_order_id?: string;
    customers?: { profile_id?: string };
  } | null;

  if (!row || row.customers?.profile_id !== session.id) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  if (row.provider !== 'sandbox') {
    return NextResponse.json(
      { error: 'That payment is not a sandbox payment' },
      { status: 400 },
    );
  }

  const orderId = row.provider_order_id ?? `sbox_order_${parsed.data.paymentId}`;
  const { signature } = adapter.signOutcome(orderId, parsed.data.paymentId);

  const outcome = await confirmCheckout({
    provider: 'sandbox',
    paymentId: parsed.data.paymentId,
    payload: {
      order_id: orderId,
      payment_id: parsed.data.paymentId,
      signature,
      outcome: parsed.data.outcome,
    },
  });

  if (outcome.status === 'active') {
    await clearDraft();
  }

  return NextResponse.json(outcome);
}
