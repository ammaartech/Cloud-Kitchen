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

/**
 * Cashfree stamps the environment into the secret key itself, which is the one
 * source of truth that cannot drift from the credentials in use. Pointing a
 * `cfsk_ma_prod_` key at sandbox.cashfree.com just 401s, so the prefix is read
 * rather than guessed.
 */
function environmentFromKey(secretKey: string | undefined): 'sandbox' | 'production' | null {
  if (!secretKey) return null;
  if (secretKey.startsWith('cfsk_ma_prod_')) return 'production';
  if (secretKey.startsWith('cfsk_ma_test_')) return 'sandbox';
  return null;
}

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
  private readonly returnUrl: string;
  private readonly notifyUrl: string;
  readonly environment: 'sandbox' | 'production';
  private readonly baseUrl: string;

  constructor() {
    const env = serverEnv();
    this.appId = env.CASHFREE_APP_ID;
    this.secretKey = env.CASHFREE_SECRET_KEY;
    // Cashfree signs webhooks with the client secret unless a separate one is
    // configured in the dashboard.
    this.webhookSecret = env.CASHFREE_WEBHOOK_SECRET ?? env.CASHFREE_SECRET_KEY;

    const fromKey = environmentFromKey(this.secretKey);

    // An explicit setting that contradicts the key is a misconfiguration that
    // would otherwise surface as an opaque 401 mid-checkout. Loud, not silent
    // -- the same stance the sandbox adapter takes in production.
    if (env.CASHFREE_ENVIRONMENT && fromKey && env.CASHFREE_ENVIRONMENT !== fromKey) {
      throw new PaymentProviderError(
        `CASHFREE_ENVIRONMENT is '${env.CASHFREE_ENVIRONMENT}' but CASHFREE_SECRET_KEY is a ` +
          `${fromKey} key. Fix one of the two rather than letting checkout fail at the gateway.`,
        'cashfree',
      );
    }

    this.environment = fromKey ?? env.CASHFREE_ENVIRONMENT ?? 'sandbox';
    this.baseUrl =
      this.environment === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';

    // UPI-intent and net-banking journeys leave the page entirely, so Cashfree
    // needs somewhere to land. `/checkout` picks the order back up and runs the
    // same server-side confirmation the in-page modal does.
    this.returnUrl = `${env.NEXT_PUBLIC_SITE_URL}/checkout?cf_order_id={order_id}`;
    this.notifyUrl = `${env.NEXT_PUBLIC_SITE_URL}/api/payments/cashfree/webhook`;
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
        order_meta: {
          return_url: this.returnUrl,
          notify_url: this.notifyUrl,
        },
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
        provider: 'cashfree',
        // A session token, not a credential: it is scoped to this one order and
        // is what the v3 browser SDK is built to receive.
        payment_session_id: order.payment_session_id,
        order_id: order.order_id,
        mode: this.environment,
      },
    };
  }

  /**
   * A Cashfree payment session is single-use, so a customer who dismisses the
   * modal cannot reopen it with the token we already handed out. Reading the
   * order back yields a fresh session for the *same* order -- which is what
   * keeps a retry from becoming a second charge.
   */
  async resumeOrder(providerOrderId: string): Promise<CreateOrderResult> {
    if (!this.isConfigured) {
      throw new PaymentProviderError('Cashfree is not configured', this.id);
    }

    const response = await fetch(`${this.baseUrl}/orders/${providerOrderId}`, {
      headers: this.headers(),
    });

    if (!response.ok) {
      throw new PaymentProviderError(
        `Cashfree order lookup failed (${response.status})`,
        this.id,
        await response.text(),
      );
    }

    const order = (await response.json()) as {
      order_id: string;
      order_status: string;
      payment_session_id: string;
    };

    if (order.order_status === 'PAID') {
      // Already settled. Reopening would invite a second payment; the confirm
      // path can still activate the subscription from the existing one.
      throw new PaymentProviderError('This order has already been paid', this.id);
    }

    if (order.order_status !== 'ACTIVE') {
      throw new PaymentProviderError(
        `This checkout has expired at Cashfree (${order.order_status}). Start a new one.`,
        this.id,
      );
    }

    return {
      providerOrderId: order.order_id,
      checkout: {
        provider: 'cashfree',
        payment_session_id: order.payment_session_id,
        order_id: order.order_id,
        mode: this.environment,
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

    // Cashfree scopes refunds to the order, not the payment.
    const orderId = input.providerOrderId;
    if (!orderId) {
      throw new PaymentProviderError(
        'Cashfree refunds need the order id, not just the payment id',
        this.id,
      );
    }

    const response = await fetch(`${this.baseUrl}/orders/${orderId}/refunds`, {
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
