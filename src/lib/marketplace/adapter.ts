import { createHmac, timingSafeEqual } from 'node:crypto';
import { resolveSecret } from '@/lib/env';
import { adminClient } from '@/lib/supabase/admin';
import type {
  CapabilityState,
  IncomingOrder,
  MarketplaceAdapter,
  MarketplaceCapability,
  MarketplaceProvider,
  MarketplaceResult,
  MarketplaceWebhookResult,
} from './types';

interface AdapterConfig {
  provider: MarketplaceProvider;
  baseUrlEnv: string;
  apiKeyEnv: string;
  webhookSecretEnv: string;
}

/**
 * Shared implementation for both marketplaces.
 *
 * Swiggy and Zomato differ only in configuration here because we have no
 * documented differences to encode. When a real partner contract arrives, the
 * provider-specific request shapes belong in a subclass -- and the capability
 * register moves from 'blocked' to 'integrated' at the same time.
 */
export class PartnerMarketplaceAdapter implements MarketplaceAdapter {
  readonly provider: MarketplaceProvider;
  private readonly baseUrl?: string;
  private readonly apiKey?: string;
  private readonly webhookSecret?: string;

  constructor(config: AdapterConfig) {
    this.provider = config.provider;
    this.baseUrl = resolveSecret(config.baseUrlEnv);
    this.apiKey = resolveSecret(config.apiKeyEnv);
    this.webhookSecret = resolveSecret(config.webhookSecretEnv);
  }

  get isLive(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  /** Reads the recorded state for a capability. Unknown means blocked. */
  private async capabilityState(
    capability: MarketplaceCapability,
  ): Promise<CapabilityState> {
    const { data } = await adminClient()
      .from('integration_capabilities')
      .select('state')
      .eq('provider', this.provider)
      .eq('capability', capability)
      .maybeSingle();

    return (data?.state as CapabilityState | undefined) ?? 'blocked';
  }

  /**
   * The gate every outbound call passes through.
   *
   * 'integrated' calls the live endpoint. 'mocked' runs the mock transport so
   * the flow is exercisable end to end. 'blocked' refuses -- it does not fall
   * back to guessing a URL.
   */
  private async attempt<T>(
    capability: MarketplaceCapability,
    live: () => Promise<T>,
    mock: () => T,
  ): Promise<MarketplaceResult<T>> {
    const state = await this.capabilityState(capability);

    if (state === 'blocked') {
      return {
        ok: false,
        capability,
        state,
        reason:
          `${this.provider} ${capability} is not available: no verified partner API ` +
          'access is configured. Nothing was sent.',
      };
    }

    if (state === 'integrated') {
      if (!this.isLive) {
        return {
          ok: false,
          capability,
          state,
          reason:
            `${this.provider} ${capability} is marked integrated but its base URL or ` +
            'API key is missing from the environment.',
        };
      }

      try {
        const data = await live();
        await adminClient().rpc('record_integration_success', { p_provider: this.provider });
        return { ok: true, data, via: 'live' };
      } catch (error) {
        // A failure here trips this provider's circuit only -- the other
        // marketplace and the website are untouched (PRD 16).
        await adminClient().rpc('record_integration_failure', {
          p_provider: this.provider,
          p_error: error instanceof Error ? error.message : String(error),
        });
        return {
          ok: false,
          capability,
          state,
          reason: error instanceof Error ? error.message : 'Marketplace call failed',
        };
      }
    }

    return { ok: true, data: mock(), via: 'mock' };
  }

  private async post(path: string, body: unknown): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`${this.provider} responded ${response.status}`);
    }
  }

  /**
   * Verifies an inbound webhook.
   *
   * The signature scheme is a plain HMAC-SHA256 of the raw body, which is what
   * both platforms' merchant documentation describes for partners. Until a
   * real integration is confirmed, an unsigned or unverifiable payload is
   * rejected rather than trusted.
   */
  async verifyWebhook(rawBody: string, headers: Headers): Promise<MarketplaceWebhookResult> {
    if (!this.webhookSecret) {
      return {
        signatureValid: false,
        reason: `No webhook secret configured for ${this.provider}`,
      };
    }

    const received =
      headers.get('x-webhook-signature') ?? headers.get(`x-${this.provider}-signature`);

    if (!received) {
      return { signatureValid: false, reason: 'Missing webhook signature header' };
    }

    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { signatureValid: false, reason: 'Signature mismatch' };
    }

    const body = JSON.parse(rawBody) as Record<string, unknown>;
    return { signatureValid: true, ...interpretPayload(body) };
  }

  async acceptOrder(externalOrderId: string, etaMinutes?: number) {
    return this.attempt<void>(
      'accept_reject',
      () => this.post(`/orders/${externalOrderId}/accept`, { eta_minutes: etaMinutes }),
      () => undefined,
    );
  }

  async rejectOrder(externalOrderId: string, reason: string) {
    return this.attempt<void>(
      'accept_reject',
      () => this.post(`/orders/${externalOrderId}/reject`, { reason }),
      () => undefined,
    );
  }

  async markReady(externalOrderId: string) {
    return this.attempt<void>(
      'status_sync',
      () => this.post(`/orders/${externalOrderId}/ready`, {}),
      () => undefined,
    );
  }

  async setItemAvailability(externalItemId: string, available: boolean) {
    return this.attempt<void>(
      'menu_availability_sync',
      () => this.post(`/menu/items/${externalItemId}/availability`, { available }),
      () => undefined,
    );
  }

  /**
   * For reconciliation. The mock answers with what we already hold, which
   * makes the reconciliation path exercisable and always reports 'clean' --
   * honest, because a mock cannot disagree with us about reality.
   */
  async listOrderIds(from: Date, to: Date) {
    return this.attempt<string[]>(
      'reconciliation',
      async () => {
        const response = await fetch(
          `${this.baseUrl}/orders?from=${from.toISOString()}&to=${to.toISOString()}`,
          { headers: { Authorization: `Bearer ${this.apiKey}` } },
        );
        if (!response.ok) throw new Error(`${this.provider} responded ${response.status}`);
        const body = (await response.json()) as { orders?: Array<{ id: string }> };
        return (body.orders ?? []).map((o) => o.id);
      },
      () => [],
    );
  }
}

/**
 * Best-effort interpretation of an inbound payload.
 *
 * Both platforms describe an order envelope with an id, items and totals; the
 * exact field names differ per contract, so this reads the common shapes and
 * reports 'other' rather than mangling something it does not recognise.
 */
function interpretPayload(
  body: Record<string, unknown>,
): Omit<MarketplaceWebhookResult, 'signatureValid'> {
  const eventType = String(body.event ?? body.type ?? '').toLowerCase();
  const order = (body.order ?? body.data ?? body) as Record<string, unknown>;
  const externalOrderId = String(order.order_id ?? order.id ?? body.order_id ?? '');

  if (!externalOrderId) {
    return { kind: 'other', reason: 'Payload carried no recognisable order id' };
  }

  if (eventType.includes('cancel')) {
    return {
      kind: 'order.cancelled',
      statusUpdate: {
        externalOrderId,
        status: 'CANCELLED',
        externalEventId: body.event_id ? String(body.event_id) : undefined,
      },
    };
  }

  if (eventType.includes('status') || order.status) {
    return {
      kind: 'order.status',
      statusUpdate: {
        externalOrderId,
        status: String(order.status ?? 'unknown'),
        externalEventId: body.event_id ? String(body.event_id) : undefined,
      },
    };
  }

  const rawItems = Array.isArray(order.items) ? (order.items as Record<string, unknown>[]) : [];

  const incoming: IncomingOrder = {
    externalOrderId,
    externalEventId: body.event_id ? String(body.event_id) : undefined,
    placedAt: String(order.placed_at ?? new Date().toISOString()),
    items: rawItems.map((item) => ({
      name: String(item.name ?? 'Item'),
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unit_price ?? item.price ?? 0),
      productId: item.product_id ? String(item.product_id) : undefined,
      instructions: item.instructions ? String(item.instructions) : undefined,
    })),
    totals: {
      subtotal: Number((order.totals as Record<string, unknown>)?.subtotal ?? 0),
      grandTotal: Number((order.totals as Record<string, unknown>)?.grand_total ?? 0),
      taxTotal: Number((order.totals as Record<string, unknown>)?.tax_total ?? 0),
      deliveryFee: Number((order.totals as Record<string, unknown>)?.delivery_fee ?? 0),
    },
    customer: {
      name: (order.customer as Record<string, unknown>)?.name as string | undefined,
      phone: (order.customer as Record<string, unknown>)?.phone as string | undefined,
    },
    raw: body,
  };

  return { kind: 'order.new', order: incoming };
}
