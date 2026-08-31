/**
 * Payment provider abstraction (PRD 8, PRD 20).
 *
 * Razorpay and Cashfree sit behind this interface so either can be swapped, or
 * a third added, without the checkout or the subscription engine changing.
 *
 * Two rules every adapter must honour:
 *   1. Verification happens on the server. `verifyCallback` and `verifyWebhook`
 *      check a cryptographic signature; neither ever trusts a status the
 *      browser reported.
 *   2. Nothing here mutates application state. An adapter returns a verdict;
 *      confirm_subscription_payment is what actually activates anything.
 */

export type PaymentProviderId = 'razorpay' | 'cashfree' | 'cod' | 'sandbox';

export interface CreateOrderInput {
  /** Our internal payment row id -- becomes the provider's receipt reference. */
  paymentId: string;
  amount: number;
  currency: string;
  customer: {
    name: string;
    email?: string | null;
    phone: string;
  };
  /** Free-form context echoed back by the provider, useful for reconciliation. */
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  providerOrderId: string;
  /**
   * Everything the browser needs to open the provider's checkout. Contains
   * publishable identifiers only -- never a secret key.
   */
  checkout: Record<string, unknown>;
}

export interface VerificationResult {
  verified: boolean;
  providerPaymentId?: string;
  providerOrderId?: string;
  /** Why verification failed, for the audit trail. Never shown raw to a customer. */
  reason?: string;
  /**
   * True when the provider indicates money may have moved but the outcome is
   * not confirmable. Routed to reconciliation rather than guessed at (PRD 8).
   */
  uncertain?: boolean;
}

export interface WebhookEvent {
  /** Provider's own event id. Uniqueness on this is what makes replays safe. */
  eventId: string;
  type: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  status: 'succeeded' | 'failed' | 'refunded' | 'other';
  amount?: number;
  raw: unknown;
}

export interface WebhookResult {
  signatureValid: boolean;
  event?: WebhookEvent;
  reason?: string;
}

export interface RefundInput {
  providerPaymentId: string;
  amount: number;
  idempotencyKey: string;
  reason?: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: 'pending' | 'success' | 'failed';
}

export interface PaymentAdapter {
  readonly id: PaymentProviderId;
  readonly displayName: string;
  /** False when credentials are missing; the provider is then not offered. */
  readonly isConfigured: boolean;

  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;

  /** Verifies the signed payload the browser hands back after checkout. */
  verifyCallback(payload: Record<string, unknown>): Promise<VerificationResult>;

  /** Verifies a webhook from its raw body -- parsing first would break the signature. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookResult>;

  refund(input: RefundInput): Promise<RefundResult>;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly provider: PaymentProviderId,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
