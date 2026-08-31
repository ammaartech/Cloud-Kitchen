/**
 * Marketplace adapter contract (PRD 16).
 *
 * A deliberate constraint runs through this whole module: **no endpoint is
 * ever invented**. Swiggy and Zomato grant partner API access per merchant
 * under contract, and we have no such contract or documentation here. So every
 * capability carries an explicit state in `integration_capabilities`:
 *
 *   integrated -> a real, documented endpoint is called
 *   mocked     -> the logic exists and runs against the mock transport
 *   blocked    -> not available; the call returns a refusal, never a guess
 *
 * An adapter method checks that state first and refuses rather than attempting
 * a URL that may not exist. The Owner's integration screen shows the same
 * states, so the UI never implies a connection the system does not have.
 */

export type MarketplaceProvider = 'swiggy' | 'zomato';

export type MarketplaceCapability =
  | 'order_ingestion'
  | 'accept_reject'
  | 'cancellation'
  | 'status_sync'
  | 'menu_availability_sync'
  | 'reconciliation';

export type CapabilityState = 'integrated' | 'mocked' | 'blocked';

export type MarketplaceResult<T> =
  | { ok: true; data: T; via: 'live' | 'mock' }
  | { ok: false; reason: string; capability: MarketplaceCapability; state: CapabilityState };

export interface IncomingOrder {
  externalOrderId: string;
  externalEventId?: string;
  placedAt: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    productId?: string;
    variants?: Array<{ group: string; name: string }>;
    addOns?: Array<{ name: string; price: number }>;
    instructions?: string;
  }>;
  totals: {
    subtotal: number;
    discountTotal?: number;
    deliveryFee?: number;
    taxTotal?: number;
    grandTotal: number;
  };
  customer: {
    name?: string;
    phone?: string;
    address?: Record<string, unknown>;
    deliveryInstructions?: string;
  };
  raw: unknown;
}

export interface MarketplaceWebhookResult {
  signatureValid: boolean;
  kind?: 'order.new' | 'order.status' | 'order.cancelled' | 'other';
  order?: IncomingOrder;
  statusUpdate?: { externalOrderId: string; status: string; externalEventId?: string };
  reason?: string;
}

export interface MarketplaceAdapter {
  readonly provider: MarketplaceProvider;
  /** True only when a base URL and credential are actually configured. */
  readonly isLive: boolean;

  verifyWebhook(rawBody: string, headers: Headers): Promise<MarketplaceWebhookResult>;

  acceptOrder(externalOrderId: string, etaMinutes?: number): Promise<MarketplaceResult<void>>;
  rejectOrder(externalOrderId: string, reason: string): Promise<MarketplaceResult<void>>;
  markReady(externalOrderId: string): Promise<MarketplaceResult<void>>;

  setItemAvailability(
    externalItemId: string,
    available: boolean,
  ): Promise<MarketplaceResult<void>>;

  /** Order ids the platform believes it sent us in a window, for reconciliation. */
  listOrderIds(from: Date, to: Date): Promise<MarketplaceResult<string[]>>;
}
