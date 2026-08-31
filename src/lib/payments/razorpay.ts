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

const API_BASE = 'https://api.razorpay.com/v1';

/** Constant-time compare that tolerates differing lengths without leaking them. */
function signaturesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Razorpay adapter.
 *
 * Amounts cross this boundary in paise; nothing outside this file needs to
 * know that (the rest of the system works in rupees).
 */
export class RazorpayAdapter implements PaymentAdapter {
  readonly id = 'razorpay' as const;
  readonly displayName = 'Razorpay';

  private readonly keyId?: string;
  private readonly keySecret?: string;
  private readonly webhookSecret?: string;

  constructor() {
    const env = serverEnv();
    this.keyId = env.RAZORPAY_KEY_ID;
    this.keySecret = env.RAZORPAY_KEY_SECRET;
    this.webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
  }

  get isConfigured(): boolean {
    return Boolean(this.keyId && this.keySecret);
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    if (!this.isConfigured) {
      throw new PaymentProviderError('Razorpay is not configured', this.id);
    }

    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        receipt: input.paymentId,
        notes: input.notes ?? {},
      }),
    });

    if (!response.ok) {
      throw new PaymentProviderError(
        `Razorpay order creation failed (${response.status})`,
        this.id,
        await response.text(),
      );
    }

    const order = (await response.json()) as { id: string; amount: number; currency: string };

    return {
      providerOrderId: order.id,
      // Publishable key only. The secret never leaves the server.
      checkout: {
        key: this.keyId,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        name: input.customer.name,
        prefill: {
          name: input.customer.name,
          email: input.customer.email ?? undefined,
          contact: input.customer.phone,
        },
      },
    };
  }

  /**
   * Verifies the handshake the browser returns after checkout.
   * Razorpay signs `${order_id}|${payment_id}` with the key secret.
   */
  async verifyCallback(payload: Record<string, unknown>): Promise<VerificationResult> {
    if (!this.keySecret) {
      return { verified: false, reason: 'Razorpay is not configured' };
    }

    const orderId = String(payload.razorpay_order_id ?? '');
    const paymentId = String(payload.razorpay_payment_id ?? '');
    const signature = String(payload.razorpay_signature ?? '');

    if (!orderId || !paymentId || !signature) {
      return { verified: false, reason: 'Callback is missing signature fields' };
    }

    const expected = createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (!signaturesMatch(expected, signature)) {
      return { verified: false, reason: 'Signature mismatch' };
    }

    return { verified: true, providerPaymentId: paymentId, providerOrderId: orderId };
  }

  /**
   * Verifies a webhook. The signature covers the raw body byte-for-byte, so
   * the caller must pass the unparsed string.
   */
  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
    if (!this.webhookSecret) {
      return { signatureValid: false, reason: 'Razorpay webhook secret is not configured' };
    }

    const received = headers.get('x-razorpay-signature');
    if (!received) {
      return { signatureValid: false, reason: 'Missing x-razorpay-signature header' };
    }

    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    if (!signaturesMatch(expected, received)) {
      return { signatureValid: false, reason: 'Signature mismatch' };
    }

    const body = JSON.parse(rawBody) as {
      event: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string; amount?: number } };
      };
    };
    const payment = body.payload?.payment?.entity;

    const status =
      body.event === 'payment.captured'
        ? ('succeeded' as const)
        : body.event === 'payment.failed'
          ? ('failed' as const)
          : body.event.startsWith('refund.')
            ? ('refunded' as const)
            : ('other' as const);

    return {
      signatureValid: true,
      event: {
        // Razorpay does not send a dedicated event id header on all plans, so
        // the payment id plus event name is the stable dedupe key.
        eventId: `${body.event}:${payment?.id ?? 'unknown'}`,
        type: body.event,
        providerOrderId: payment?.order_id,
        providerPaymentId: payment?.id,
        status,
        amount: payment?.amount ? payment.amount / 100 : undefined,
        raw: body,
      },
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    if (!this.isConfigured) {
      throw new PaymentProviderError('Razorpay is not configured', this.id);
    }

    const response = await fetch(`${API_BASE}/payments/${input.providerPaymentId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
        // Razorpay honours this header, so a retried refund does not double-pay.
        'X-Razorpay-Idempotency': input.idempotencyKey,
      },
      body: JSON.stringify({
        amount: Math.round(input.amount * 100),
        notes: input.reason ? { reason: input.reason } : {},
      }),
    });

    if (!response.ok) {
      throw new PaymentProviderError(
        `Razorpay refund failed (${response.status})`,
        this.id,
        await response.text(),
      );
    }

    const refund = (await response.json()) as { id: string; status: string };
    return {
      providerRefundId: refund.id,
      status:
        refund.status === 'processed'
          ? 'success'
          : refund.status === 'failed'
            ? 'failed'
            : 'pending',
    };
  }
}
