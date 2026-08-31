import { serverClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import type { SessionProfile } from '@/lib/auth/session';
import type { CheckoutDraft } from './draft';
import { paymentAdapter, type PaymentProviderId } from '@/lib/payments';

/**
 * Checkout orchestration.
 *
 * The division of labour matters:
 *
 *   - `serverClient()` (the user's own token) runs anything the customer is
 *     doing, so RLS and the ownership guards apply to them specifically.
 *   - `adminClient()` runs only the two things a browser must never be able to
 *     do: confirming a payment and failing one.
 *
 * Reaching for the admin client to "simplify" the customer-facing half would
 * quietly delete the protection this flow exists to provide.
 */

export interface BeginResult {
  subscriptionId: string;
  paymentId: string;
  amount: number;
  checkout: Record<string, unknown>;
  replayed: boolean;
}

/**
 * Ensures the signed-in profile has a customer record.
 *
 * Customers normally arrive through a website order (PRD 14), and account
 * creation happens late in checkout -- so the first purchase is where the
 * customer row appears.
 */
export async function ensureCustomer(
  session: SessionProfile,
  details: { fullName: string; phone: string },
): Promise<string> {
  if (session.customerId) return session.customerId;

  const supabase = await serverClient();

  const { data, error } = await supabase
    .from('customers')
    .insert({
      profile_id: session.id,
      full_name: details.fullName,
      email: session.email,
      phone: details.phone,
      phone_verified: false,
      created_source: 'website',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Could not create your customer record: ${error.message}`);
  }

  return data.id as string;
}

/**
 * Step one: create the subscription (inactive) and the payment (pending), then
 * ask the gateway for an order.
 *
 * Nothing is granted here. No credits, no schedule, no ticket -- the
 * subscription sits in `pending_payment` until a verified payment arrives.
 */
export async function beginCheckout(input: {
  customerId: string;
  draft: CheckoutDraft;
  addressId: string;
  provider: PaymentProviderId;
  customer: { name: string; email: string | null; phone: string };
}): Promise<BeginResult> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc('begin_subscription_checkout', {
    p_customer_id: input.customerId,
    p_plan_id: input.draft.planId,
    p_address_id: input.addressId,
    p_delivery_window_id: input.draft.deliveryWindowId,
    p_provider: input.provider,
    p_idempotency_key: input.draft.idempotencyKey,
    p_delivery_days: input.draft.deliveryDays,
    p_selected_meals: input.draft.selectedMeals,
    p_coupon_code: input.draft.couponCode,
    p_delivery_instructions: input.draft.deliveryInstructions,
    p_starts_on: null,
  });

  if (error) throw new Error(error.message);

  const result = data as {
    subscription_id: string;
    payment_id: string;
    amount: number | string;
    replayed: boolean;
  };

  const amount = Number(result.amount);
  const adapter = paymentAdapter(input.provider);

  // A replayed checkout may already have a gateway order; reuse it rather than
  // creating a second one against the same payment.
  const { data: existing } = await adminClient()
    .from('payments')
    .select('provider_order_id')
    .eq('id', result.payment_id)
    .maybeSingle();

  if (existing?.provider_order_id) {
    return {
      subscriptionId: result.subscription_id,
      paymentId: result.payment_id,
      amount,
      replayed: true,
      checkout: {
        provider: input.provider,
        order_id: existing.provider_order_id,
        amount,
        currency: 'INR',
      },
    };
  }

  const order = await adapter.createOrder({
    paymentId: result.payment_id,
    amount,
    currency: 'INR',
    customer: input.customer,
    notes: { subscription_id: result.subscription_id },
  });

  // payments has no client write policy, so recording the gateway's order id
  // is server work.
  await adminClient()
    .from('payments')
    .update({ provider_order_id: order.providerOrderId, status: 'processing' })
    .eq('id', result.payment_id);

  return {
    subscriptionId: result.subscription_id,
    paymentId: result.payment_id,
    amount,
    checkout: order.checkout,
    replayed: Boolean(result.replayed),
  };
}

export interface ConfirmOutcome {
  status: 'active' | 'failed' | 'needs_reconciliation';
  subscriptionId?: string;
  subscriptionNumber?: string;
  creditsGranted?: number;
  deliveriesGenerated?: number;
  message: string;
}

/**
 * Step two: verify with the provider, then act on the verdict.
 *
 * The browser's claim that payment succeeded is never taken at face value. The
 * adapter checks a signature (or asks the provider directly); only a verified
 * success reaches `confirm_subscription_payment`, and that function refuses
 * anyway unless we pass `p_signature_verified => true`.
 */
export async function confirmCheckout(input: {
  provider: PaymentProviderId;
  paymentId: string;
  payload: Record<string, unknown>;
}): Promise<ConfirmOutcome> {
  const adapter = paymentAdapter(input.provider);
  const verification = await adapter.verifyCallback(input.payload);
  const db = adminClient();

  if (!verification.verified) {
    const { data } = await db.rpc('fail_subscription_payment', {
      p_payment_id: input.paymentId,
      p_code: verification.uncertain ? 'UNCERTAIN' : 'VERIFICATION_FAILED',
      p_message: verification.reason ?? 'Payment could not be verified',
      p_uncertain: verification.uncertain ?? false,
      p_raw: input.payload,
    });

    const ignored = (data as { ignored?: boolean } | null)?.ignored;

    if (ignored) {
      // A verified success already landed, most likely by webhook while the
      // browser was still finishing. The subscription is fine.
      return { status: 'active', message: 'Your payment was already confirmed.' };
    }

    return {
      status: verification.uncertain ? 'needs_reconciliation' : 'failed',
      message: verification.uncertain
        ? 'We could not confirm your payment. If money left your account, our team will ' +
          'reconcile it and contact you — no subscription has been created yet.'
        : 'Your payment was not completed, so no subscription was created and no ' +
          'deliveries were scheduled.',
    };
  }

  const { data, error } = await db.rpc('confirm_subscription_payment', {
    p_payment_id: input.paymentId,
    p_provider_payment_id: verification.providerPaymentId ?? null,
    p_signature_verified: true,
    p_verified_via: 'callback',
    p_raw: input.payload,
  });

  if (error) throw new Error(error.message);

  const result = data as {
    subscription_id: string;
    subscription_number: string;
    credits_granted: number;
    deliveries_generated: number;
  };

  return {
    status: 'active',
    subscriptionId: result.subscription_id,
    subscriptionNumber: result.subscription_number,
    creditsGranted: result.credits_granted,
    deliveriesGenerated: result.deliveries_generated,
    message: 'Your subscription is active.',
  };
}
