import { configuredPaymentProviders } from '@/lib/env';
import { CashfreeAdapter } from './cashfree';
import { RazorpayAdapter } from './razorpay';
import { SandboxAdapter } from './sandbox';
import { PaymentProviderError, type PaymentAdapter, type PaymentProviderId } from './types';

export * from './types';
export { SandboxAdapter } from './sandbox';

const adapters = new Map<PaymentProviderId, PaymentAdapter>();

const DISPLAY_NAMES: Record<PaymentProviderId, string> = {
  razorpay: 'Razorpay',
  cashfree: 'Cashfree',
  sandbox: 'Test gateway (no real money)',
  cod: 'Cash on delivery',
};

/**
 * Resolves the adapter for a provider.
 *
 * Cached per process: constructing one reads the environment, and none of them
 * hold per-request state.
 */
export function paymentAdapter(provider: PaymentProviderId): PaymentAdapter {
  if (provider === 'cod') {
    // COD exists in the data model but is paused (PRD 3, PRD 8). Turning it on
    // needs a settings change *and* a real adapter -- never a silent
    // fallthrough that marks an order paid because nobody objected.
    throw new PaymentProviderError('Cash on delivery is not enabled', 'cod');
  }

  const existing = adapters.get(provider);
  if (existing) return existing;

  const adapter: PaymentAdapter =
    provider === 'razorpay'
      ? new RazorpayAdapter()
      : provider === 'cashfree'
        ? new CashfreeAdapter()
        : new SandboxAdapter();

  if (!adapter.isConfigured) {
    throw new PaymentProviderError(
      `${adapter.displayName} has no credentials configured`,
      provider,
    );
  }

  adapters.set(provider, adapter);
  return adapter;
}

/**
 * The providers a customer may actually choose from. One without credentials is
 * never offered, so a checkout cannot begin against a provider that would fail
 * at the gateway.
 */
export function availablePaymentProviders(): Array<{
  id: PaymentProviderId;
  displayName: string;
  isSandbox: boolean;
}> {
  return configuredPaymentProviders().map((id) => ({
    id,
    displayName: DISPLAY_NAMES[id],
    isSandbox: id === 'sandbox',
  }));
}
