import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';
import {
  PaymentProviderError,
  type CreateOrderInput,
  type CreateOrderResult,
  type PaymentAdapter,
  type RefundInput,
  type RefundResult,
  type VerificationResult,
  type WebhookResult,
} from './types';

/**
 * Sandbox gateway: exercises the real verification path without moving money.
 *
 * Its purpose is to make the PRD's end-to-end flow demonstrable before a
 * merchant account exists. It is not a shortcut around the payment invariant:
 *
 *   - it signs `${orderId}|${paymentId}` with HMAC-SHA256, exactly as Razorpay
 *     does, and `verifyCallback` recomputes and compares that signature;
 *   - a forged or altered callback fails verification, so
 *     `confirm_subscription_payment` refuses and no subscription activates;
 *   - it refuses to construct at all in production.
 *
 * The signing key is CRON_SECRET, which already exists as a server-only shared
 * secret. A browser cannot mint a valid signature with it.
 */
export class SandboxAdapter implements PaymentAdapter {
  readonly id = 'sandbox' as const;
  readonly displayName = 'Test gateway (no real money)';

  private readonly secret?: string;
  private readonly enabled: boolean;

  constructor() {
    const env = serverEnv();

    this.secret = env.CRON_SECRET;
    this.enabled =
      env.ENABLE_SANDBOX_PAYMENTS === 'true' && env.NODE_ENV !== 'production';

    if (env.ENABLE_SANDBOX_PAYMENTS === 'true' && env.NODE_ENV === 'production') {
      // Loud, not silent: leaving this on in production would be a real
      // incident, so it fails at construction rather than quietly disabling.
      throw new PaymentProviderError(
        'ENABLE_SANDBOX_PAYMENTS must not be set in production',
        'sandbox',
      );
    }
  }

  get isConfigured(): boolean {
    return this.enabled && Boolean(this.secret);
  }

  private sign(orderId: string, paymentId: string): string {
    return createHmac('sha256', this.secret ?? '')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    if (!this.isConfigured) {
      throw new PaymentProviderError('Sandbox payments are not enabled', this.id);
    }

    const providerOrderId = `sbox_order_${input.paymentId}`;

    return {
      providerOrderId,
      // No secret is exposed: the browser receives identifiers only and asks
      // the server to sign, which is what keeps this honest.
      checkout: {
        provider: 'sandbox',
        order_id: providerOrderId,
        amount: input.amount,
        currency: input.currency,
        customer_name: input.customer.name,
      },
    };
  }

  /**
   * Issues a signed outcome. Called by the server-side sandbox endpoint when
   * the tester chooses "succeed" or "fail" -- never by the browser directly,
   * because the browser has no access to the signing key.
   */
  signOutcome(orderId: string, paymentId: string): { signature: string } {
    if (!this.isConfigured) {
      throw new PaymentProviderError('Sandbox payments are not enabled', this.id);
    }
    return { signature: this.sign(orderId, paymentId) };
  }

  async verifyCallback(payload: Record<string, unknown>): Promise<VerificationResult> {
    if (!this.isConfigured) {
      return { verified: false, reason: 'Sandbox payments are not enabled' };
    }

    const orderId = String(payload.order_id ?? '');
    const paymentId = String(payload.payment_id ?? '');
    const signature = String(payload.signature ?? '');
    const outcome = String(payload.outcome ?? 'success');

    if (!orderId || !paymentId || !signature) {
      return { verified: false, reason: 'Callback is missing signature fields' };
    }

    const expected = this.sign(orderId, paymentId);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { verified: false, reason: 'Signature mismatch' };
    }

    // A correctly signed *failure* is still a failure. Verification proves the
    // message is authentic, not that the payment succeeded.
    if (outcome === 'failed') {
      return { verified: false, reason: 'Payment declined at the test gateway' };
    }

    if (outcome === 'uncertain') {
      return {
        verified: false,
        uncertain: true,
        reason: 'Test gateway returned an indeterminate result',
      };
    }

    return { verified: true, providerPaymentId: paymentId, providerOrderId: orderId };
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
    if (!this.isConfigured) {
      return { signatureValid: false, reason: 'Sandbox payments are not enabled' };
    }

    const received = headers.get('x-sandbox-signature');
    if (!received) {
      return { signatureValid: false, reason: 'Missing x-sandbox-signature header' };
    }

    const expected = createHmac('sha256', this.secret ?? '').update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { signatureValid: false, reason: 'Signature mismatch' };
    }

    const body = JSON.parse(rawBody) as {
      event_id?: string;
      type?: string;
      order_id?: string;
      payment_id?: string;
      outcome?: string;
      amount?: number;
    };

    return {
      signatureValid: true,
      event: {
        eventId: body.event_id ?? `${body.type}:${body.payment_id}`,
        type: body.type ?? 'payment',
        providerOrderId: body.order_id,
        providerPaymentId: body.payment_id,
        status: body.outcome === 'success' ? 'succeeded' : 'failed',
        amount: body.amount,
        raw: body,
      },
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    if (!this.isConfigured) {
      throw new PaymentProviderError('Sandbox payments are not enabled', this.id);
    }
    return { providerRefundId: `sbox_refund_${input.idempotencyKey}`, status: 'success' };
  }
}
