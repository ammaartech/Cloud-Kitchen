-- =============================================================================
-- 0101  Sandbox payment provider
-- =============================================================================
-- Adds a fourth provider used only for demonstration and testing, so the full
-- purchase -> verification -> activation -> KOT path can be exercised before
-- real Razorpay or Cashfree credentials exist.
--
-- It is NOT a bypass. The sandbox adapter signs its callback with HMAC-SHA256
-- and `confirm_subscription_payment` still refuses to activate anything unless
-- that signature verified server-side -- exactly the same gate the real
-- providers pass through. What it does not do is move money.
--
-- It is switched on by ENABLE_SANDBOX_PAYMENTS in the environment and is
-- refused outright when NODE_ENV is production, so it cannot be left on by
-- accident in a live deployment.
-- =============================================================================

alter type public.payment_provider add value if not exists 'sandbox';

comment on type public.payment_provider is
  'Payment providers. "cod" exists in the model but is paused (PRD 3, PRD 8). '
  '"sandbox" is a non-production test gateway: it verifies a real signature but '
  'moves no money, and the application refuses it in production.';
