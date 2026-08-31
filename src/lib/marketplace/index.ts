import { PartnerMarketplaceAdapter } from './adapter';
import type { MarketplaceAdapter, MarketplaceProvider } from './types';

export * from './types';
export { PartnerMarketplaceAdapter } from './adapter';

const adapters = new Map<MarketplaceProvider, MarketplaceAdapter>();

/**
 * Resolves a marketplace adapter.
 *
 * Each provider is isolated: constructing or failing one has no effect on the
 * other, which is what keeps a Swiggy outage from stopping Zomato orders
 * (PRD 16).
 */
export function marketplaceAdapter(provider: MarketplaceProvider): MarketplaceAdapter {
  const existing = adapters.get(provider);
  if (existing) return existing;

  const adapter = new PartnerMarketplaceAdapter(
    provider === 'swiggy'
      ? {
          provider: 'swiggy',
          baseUrlEnv: 'SWIGGY_API_BASE_URL',
          apiKeyEnv: 'SWIGGY_API_KEY',
          webhookSecretEnv: 'SWIGGY_WEBHOOK_SECRET',
        }
      : {
          provider: 'zomato',
          baseUrlEnv: 'ZOMATO_API_BASE_URL',
          apiKeyEnv: 'ZOMATO_API_KEY',
          webhookSecretEnv: 'ZOMATO_WEBHOOK_SECRET',
        },
  );

  adapters.set(provider, adapter);
  return adapter;
}

/** Maps our KOT source prefix onto the provider that owns it. */
export function providerForSource(source: string): MarketplaceProvider | null {
  if (source === 'SW') return 'swiggy';
  if (source === 'ZM') return 'zomato';
  return null;
}
