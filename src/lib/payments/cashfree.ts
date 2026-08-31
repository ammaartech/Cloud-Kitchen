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

const API_VERSION = '2023-08-01';

function signaturesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Cashfree adapter.
 *
 * Cashfree works in rupees rather than paise, and returns a session token the
 * browser SDK consumes instead of an order id -- both differences are absorbed
 * here so the checkout code is identical for either provider.
 */
export class CashfreeAdapter implements PaymentAdapter {
  readonly id = 'cashfree' as const;
  readonly displayName = 'Cashfree';

  private readonly appId?: string;
  private readonly secretKey?: string;
  private readonly webhookSecret?: string;
  private readonly baseUrl: string;

  constructor() {
    const env = serverEnv();
    this.appId = env.CASHFREE_APP_ID;
    this.secretKey = env.CASHFREE_SECRET_KEY;
    this.webhookSecret = env.CASHFREE_WEBHOOK_SECRET ?? env.CASHFREE_SECRET_KEY;
    this.baseUrl =
      env.CASHFREE_ENVIRONMENT === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';
  }

  get isConfigured(): boolean {
    return Boolean(this.appId && this.secretKey);
  }

  private headers(): Record<string, string> {
    return {
      'x-api-version': API_VERSION,
      'x-client-id': this.appId ?? '',
      'x-client-secret': this.secretKey ?? '',
      'Content-Type': 'application/json',
    };
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    if (!this.isConfigured) {
      throw new PaymentProviderError('Cashfree is not configured', this.id);
    }

    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        order_id: input.paymentId,
        order_amount: Number(input.amount.toFixed(2)),
        order_currency: input.currency,
        customer_details: {
          customer_id: input.paymentId,
          customer_name: input.customer.name,
          customer_email: input.customer.email ?? undefined,
          customer_phone: input.customer.phone,
        },
        order_note: input.notes ? JSON.stringify(input.notes) : undefined,
      }),
    });

    if (!response.ok) {
      throw new PaymentProviderError(
        `Cashfree order creation failed (${response.status})`,
        this.id,
        await response.text(),
      );
    }

    const order = (await response.json()) as {
      cf_order_id: string;
      order_id: string;
      payment_session_id: string;
    };

    return {
      providerOrderId: order.order_id,
      checkout: {
        payment_session_id: order.payment_session_id,
        order_id: order.order_id,
      },
    };
  }

  /**
   * Cashfree's browser handshake carries no signature of its own, so the
   * callback is confirmed by asking Cashfree directly what the order's status
   * is. The browser is treated purely as a hint that something happened.
   */
  async verifyCallback(payload: Record<string, unknown>): Promise<VerificationResult> {
    if (!this.isConfigured) {
      return { verified: false, reason: 'Cashfree is not configured' };
    }

    const orderId = String(payload.order_id ?? '');
    if (!orderId) {
      return { verified: false, reason: 'Callback is missing order_id' };
    }

    const response = await fetch(`${this.baseUrl}/orders/${orderId}/payments`, {
      headers: this.headers(),
    });

    if (!response.ok) {
      // We could not confirm either way; do not guess.
      return {
        verified: false,
        uncertain: true,
        reason: `Could not read order status from Cashfree (${response.status})`,
      };
    }

    const payments = (await response.json()) as Array<{
      cf_payment_id: string | number;
      payment_status: string;
    }>;

    const successful = payments.find((p) => p.payment_status === 'SUCCESS');
    if (successful) {
      return {
        verified: true,
        providerPaymentId: String(successful.cf_payment_id),
        providerOrderId: orderId,
      };
    }

    const pending = payments.find((p) => p.payment_status === 'PENDING');
    if (pending) {
      return { verified: false, uncertain: true, reason: 'Payment still pending at Cashfree' };
    }

    return { verified: false, reason: 'No successful payment found for this order' };
  }

  /**
   * Cashfree signs `timestamp + rawBody` with the secret and sends the result
   * base64-encoded in x-webhook-signature.
   */
  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
    if (!this.webhookSecret) {
      return { signatureValid: false, reason: 'Cashfree webhook secret is not configured' };
    }

    const received = headers.get('x-webhook-signature');
    const timestamp = headers.get('x-webhook-timestamp');

    if (!received || !timestamp) {
      return { signatureValid: false, reason: 'Missing Cashfree webhook signature headers' };
    }

    const expected = createHmac('sha256', this.webhookSecret)
      .update(timestamp + rawBody)
      .digest('base64');

    if (!signaturesMatch(expected, received)) {
      return { signatureValid: false, reason: 'Signature mismatch' };
    }

    const body = JSON.parse(rawBody) as {
      type?: string;
      data?: {
        order?: { order_id?: string; order_amount?: number };
        payment?: { cf_payment_id?: string | number; payment_status?: string };
      };
    };

    const paymentStatus = body.data?.payment?.payment_status;
    const status =
      paymentStatus === 'SUCCESS'
        ? ('succeeded' as const)
        : paymentStatus === 'FAILED' || paymentStatus === 'USER_DROPPED'
          ? ('failed' as const)
          : body.type?.includes('REFUND')
            ? ('refunded' as const)
            : ('other' as const);

    return {
      signatureValid: true,
      event: {
        eventId: `${body.type ?? 'event'}:${body.data?.payment?.cf_payment_id ?? body.data?.order?.order_id ?? timestamp}`,
        type: body.type ?? 'unknown',
        providerOrderId: body.data?.order?.order_id,
        providerPaymentId: body.data?.payment?.cf_payment_id
          ? String(body.data.payment.cf_payment_id)
          : undefined,
        status,
        amount: body.data?.order?.order_amount,
        raw: body,
      },
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    if (!this.isConfigured) {
      throw new PaymentProviderError('Cashfree is not configured', this.id);
    }

    const response = await fetch(`${this.baseUrl}/orders/${input.providerPaymentId}/refunds`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        refund_amount: Number(input.amount.toFixed(2)),
        // Cashfree dedupes on refund_id, which is what makes a retry safe.
        refund_id: input.idempotencyKey,
        refund_note: input.reason ?? '',
      }),
    });

    if (!response.ok) {
      throw new PaymentProviderError(
        `Cashfree refund failed (${response.status})`,
        this.id,
        await response.text(),
      );
    }

    const refund = (await response.json()) as { refund_id: string; refund_status: string };
    return {
      providerRefundId: refund.refund_id,
      status:
        refund.refund_status === 'SUCCESS'
          ? 'success'
          : refund.refund_status === 'FAILED'
            ? 'failed'
            : 'pending',
    };
  }
}
