import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';
import { paymentAdapter, type PaymentProviderId } from '@/lib/payments';

/**
 * Payment provider webhook (PRD 8).
 *
 * This is the authoritative confirmation path. The browser callback is a
 * convenience for the customer's screen; the webhook is what the business
 * trusts, because it arrives even if the customer closes the tab mid-payment.
 *
 * Both paths converge on `confirm_subscription_payment`, which is idempotent,
 * so a callback and a webhook racing each other produce one activation, one
 * credit grant and one invoice.
 */
export async function POST(
  request: Request,
  context: RouteContext<'/api/payments/[provider]/webhook'>,
) {
  const { provider } = await context.params;

  if (!['razorpay', 'cashfree', 'sandbox'].includes(provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }

  // Raw body: parsing first would invalidate the signature.
  const rawBody = await request.text();

  let adapter;
  try {
    adapter = paymentAdapter(provider as PaymentProviderId);
  } catch {
    return NextResponse.json({ error: 'Provider is not configured' }, { status: 400 });
  }

  const result = await adapter.verifyWebhook(rawBody, request.headers);

  if (!result.signatureValid || !result.event) {
    return NextResponse.json(
      { error: result.reason ?? 'Signature verification failed' },
      { status: 401 },
    );
  }

  const db = adminClient();
  const event = result.event;

  // Deduplicate on the provider's own event id. The unique index is what makes
  // a replayed webhook a no-op rather than a second activation.
  const { error: insertError } = await db.from('payment_events').insert({
    provider,
    provider_event_id: event.eventId,
    event_type: event.type,
    signature_valid: true,
    payload: event.raw as Record<string, unknown>,
  });

  if (insertError) {
    // 23505 is a unique violation: we have already processed this event.
    if (insertError.code === '23505') {
      return NextResponse.json({ duplicate: true });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Find our payment from whichever identifier the provider sent.
  const { data: payment } = await db
    .from('payments')
    .select('id, status')
    .or(
      [
        event.providerPaymentId ? `provider_payment_id.eq.${event.providerPaymentId}` : null,
        event.providerOrderId ? `provider_order_id.eq.${event.providerOrderId}` : null,
      ]
        .filter(Boolean)
        .join(','),
    )
    .eq('provider', provider)
    .maybeSingle();

  if (!payment) {
    await db
      .from('payment_events')
      .update({
        processed_at: new Date().toISOString(),
        processing_error: 'No matching internal payment',
      })
      .eq('provider', provider)
      .eq('provider_event_id', event.eventId);

    // 200, not an error: the provider should not retry something we will never
    // be able to match. It is recorded for reconciliation instead.
    return NextResponse.json({ matched: false });
  }

  if (event.status === 'succeeded') {
    const { error } = await db.rpc('confirm_subscription_payment', {
      p_payment_id: payment.id,
      p_provider_payment_id: event.providerPaymentId ?? null,
      p_signature_verified: true,
      p_verified_via: 'webhook',
      p_raw: event.raw as Record<string, unknown>,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (event.status === 'failed') {
    await db.rpc('fail_subscription_payment', {
      p_payment_id: payment.id,
      p_code: event.type,
      p_message: 'Provider reported the payment failed',
      p_uncertain: false,
      p_raw: event.raw as Record<string, unknown>,
    });
  }

  await db
    .from('payment_events')
    .update({ payment_id: payment.id, processed_at: new Date().toISOString() })
    .eq('provider', provider)
    .eq('provider_event_id', event.eventId);

  return NextResponse.json({ handled: true, status: event.status });
}
