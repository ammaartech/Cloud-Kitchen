/**
 * The browser half of the payment handoff.
 *
 * Both gateways insist on running their own UI in the customer's page -- a
 * card number must never touch our DOM -- so this module's whole job is to
 * load the right SDK, hand it the payload the server prepared, and translate
 * whatever comes back into one of four honest outcomes.
 *
 * What it deliberately does NOT do is decide whether a payment succeeded. The
 * SDKs report an outcome to the page, and a page can be lied to; every result
 * here is a *claim* that `/api/checkout/confirm` re-checks against the
 * provider before anything is activated (PRD 8).
 */

const SDK_URLS = {
  razorpay: 'https://checkout.razorpay.com/v1/checkout.js',
  cashfree: 'https://sdk.cashfree.com/js/v3/cashfree.js',
} as const;

/** Matches --ck-brand, so the gateway's own chrome does not look borrowed. */
const BRAND_COLOR = '#386155';

export type GatewayResult =
  /** The journey ended in the page. `payload` goes to the server to be checked. */
  | { status: 'completed'; payload: Record<string, unknown> }
  /** The customer closed the gateway without paying. Nothing was charged. */
  | { status: 'dismissed' }
  /** The gateway navigated away (UPI intent, bank page). We resume on return. */
  | { status: 'redirecting' }
  /** The gateway itself refused or broke before any money could move. */
  | { status: 'failed'; message: string };

const inFlight = new Map<string, Promise<void>>();

/**
 * Loads a gateway SDK once per page.
 *
 * Deliberately not a <Script> in the layout: neither SDK is needed until a
 * customer actually reaches the pay button, and the storefront is held to a
 * standard where a third-party script on every route would be a regression.
 */
function loadScript(src: string): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Payment gateways can only be opened in a browser'));
  }

  const existing = inFlight.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // A blocked or flaky load must stay retryable -- caching the rejection
      // would strand the customer for the rest of the session.
      inFlight.delete(src);
      script.remove();
      reject(new Error('We could not load the payment gateway.'));
    };
    document.head.appendChild(script);
  });

  inFlight.set(src, promise);
  return promise;
}

/* -------------------------------------------------------------------------- */
/* Razorpay                                                                    */
/* -------------------------------------------------------------------------- */

interface RazorpaySuccess {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: string, handler: (payload: { error?: { description?: string } }) => void): void;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

/**
 * Opens Razorpay's modal and resolves once the customer is done with it.
 *
 * Razorpay's modal survives a declined attempt -- the customer can switch from
 * a failing card to UPI without leaving -- so a `payment.failed` event is not
 * an ending. We remember the reason and report it only if they then give up,
 * which is the difference between saying "your card was declined" and pulling
 * the checkout out from under someone about to try another method.
 */
export function openRazorpay(checkout: Record<string, unknown>): Promise<GatewayResult> {
  return loadScript(SDK_URLS.razorpay).then(
    () =>
      new Promise<GatewayResult>((resolve) => {
        const Razorpay = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;

        if (!Razorpay) {
          resolve({ status: 'failed', message: 'The payment gateway did not load.' });
          return;
        }

        // `provider` is our own routing tag, not a Razorpay option.
        const options = { ...checkout };
        delete options.provider;

        let settled = false;
        let lastFailure: string | null = null;

        const settle = (result: GatewayResult) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };

        const instance = new Razorpay({
          ...options,
          handler: (response: RazorpaySuccess) =>
            settle({
              status: 'completed',
              // Exactly the three signed fields, nothing else. The server
              // recomputes the HMAC over order|payment and compares.
              payload: {
                razorpay_order_id: response.razorpay_order_id ?? '',
                razorpay_payment_id: response.razorpay_payment_id ?? '',
                razorpay_signature: response.razorpay_signature ?? '',
              },
            }),
          modal: {
            ondismiss: () =>
              settle(
                lastFailure
                  ? { status: 'failed', message: lastFailure }
                  : { status: 'dismissed' },
              ),
          },
          theme: { color: BRAND_COLOR },
        });

        instance.on('payment.failed', (event) => {
          lastFailure =
            event.error?.description ??
            'That payment attempt was declined. You can try another method.';
        });

        instance.open();
      }),
  );
}

/* -------------------------------------------------------------------------- */
/* Cashfree                                                                    */
/* -------------------------------------------------------------------------- */

interface CashfreeCheckoutResult {
  error?: { message?: string };
  redirect?: boolean;
  paymentDetails?: { paymentMessage?: string };
}

interface CashfreeInstance {
  checkout(options: Record<string, unknown>): Promise<CashfreeCheckoutResult>;
}

type CashfreeFactory = (config: { mode: 'sandbox' | 'production' }) => CashfreeInstance;

/**
 * Opens Cashfree's drop-in and resolves once the journey ends.
 *
 * The result Cashfree hands the page carries no signature, so unlike Razorpay
 * there is nothing here worth forwarding but the order id: the server asks
 * Cashfree directly what happened to that order. That is also why a closed
 * modal still resolves as `completed` -- "the customer stopped interacting" is
 * not a verdict this side of the wire is entitled to reach, and the server
 * will simply find no successful payment and say so.
 */
export function openCashfree(checkout: Record<string, unknown>): Promise<GatewayResult> {
  return loadScript(SDK_URLS.cashfree).then(async (): Promise<GatewayResult> => {
    const factory = (window as unknown as { Cashfree?: CashfreeFactory }).Cashfree;

    if (!factory) {
      return { status: 'failed', message: 'The payment gateway did not load.' };
    }

    const sessionId = String(checkout.payment_session_id ?? '');
    const orderId = String(checkout.order_id ?? '');

    if (!sessionId || !orderId) {
      return { status: 'failed', message: 'The gateway session was incomplete.' };
    }

    const cashfree = factory({
      // Mirrors the key the server authenticated with; a mismatch here would
      // open a session the gateway does not recognise.
      mode: checkout.mode === 'production' ? 'production' : 'sandbox',
    });

    const result = await cashfree.checkout({
      paymentSessionId: sessionId,
      redirectTarget: '_modal',
    });

    // A UPI intent or bank page takes the whole tab. We come back through
    // order_meta.return_url and pick the order up from the query string.
    if (result?.redirect) return { status: 'redirecting' };

    if (result?.error) {
      return {
        status: 'failed',
        message: result.error.message ?? 'The payment could not be completed.',
      };
    }

    return { status: 'completed', payload: { order_id: orderId } };
  });
}
