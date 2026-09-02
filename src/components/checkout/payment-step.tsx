'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card, Field, Input, Spinner, cx } from '@/components/ui/primitives';
import { openCashfree, openRazorpay, type GatewayResult } from '@/lib/payments/browser';
import { AddressStep } from './address-step';

interface Address {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postal_code: string;
  is_default: boolean;
}

interface Provider {
  id: string;
  displayName: string;
  isSandbox: boolean;
}

type Outcome = {
  status: 'active' | 'failed' | 'needs_reconciliation';
  message: string;
  subscriptionNumber?: string;
  creditsGranted?: number;
  deliveriesGenerated?: number;
};

/** What the pay button is currently waiting on, so it can say so. */
type Busy = 'starting' | 'gateway' | 'confirming';

const BUSY_LABEL: Record<Busy, string> = {
  starting: 'Preparing your order…',
  gateway: 'Waiting for the payment gateway…',
  confirming: 'Confirming your payment…',
};

/**
 * Routes to the provider's own browser SDK.
 *
 * Anything not listed here is refused rather than approximated -- an unknown
 * provider must not fall through to something that looks like it worked.
 */
function openGateway(
  provider: string,
  checkout: Record<string, unknown>,
): Promise<GatewayResult> {
  if (provider === 'razorpay') return openRazorpay(checkout);
  if (provider === 'cashfree') return openCashfree(checkout);
  return Promise.resolve({
    status: 'failed',
    message: 'That payment method cannot be opened in this browser.',
  });
}

/**
 * The final step: choose an address, choose how to pay, pay.
 *
 * The three outcomes are all shown honestly. In particular a payment we could
 * not confirm is NOT reported as success or as plain failure -- it says money
 * may have moved, that no subscription exists yet, and that a human will
 * reconcile it (PRD 8, PRD 19).
 */
export function PaymentStep({
  addresses,
  providers,
  defaultName,
  defaultPhone,
  newAddressAction,
  returningOrderId,
}: {
  addresses: Address[];
  providers: Provider[];
  defaultName: string;
  defaultPhone: string;
  newAddressAction: (formData: FormData) => Promise<void>;
  /**
   * Set when Cashfree has just redirected the customer back to us after a UPI
   * or net-banking journey. Its value is the order id, which for Cashfree is
   * our own payment id -- so it is enough to finish the confirmation.
   */
  returningOrderId?: string;
}) {
  const router = useRouter();

  const [addressId, setAddressId] = useState(addresses[0]?.id ?? '');
  const [provider, setProvider] = useState(providers[0]?.id ?? '');
  const [fullName, setFullName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [addingAddress, setAddingAddress] = useState(false);

  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const pending = busy !== null;

  /**
   * Hands the gateway's claim to the server and shows whatever verdict comes
   * back. The claim itself is never believed here: `/api/checkout/confirm`
   * re-derives the signature (Razorpay) or asks the provider outright
   * (Cashfree) before a single credit is granted.
   */
  const confirmPayment = useCallback(
    async (id: string, forProvider: string, payload: Record<string, unknown>) => {
      setBusy('confirming');
      setError(null);

      try {
        const response = await fetch('/api/checkout/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: id, provider: forProvider, payload }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? 'Could not confirm the payment.');
          return;
        }

        // Deliberately no router.refresh() here. A confirmed payment clears the
        // draft cookie, and this page redirects to /subscriptions the moment
        // that cookie is gone -- so refreshing would throw the customer off the
        // receipt for the payment they just made. The account page they move on
        // to is dynamic and reads fresh anyway.
        setOutcome(data as Outcome);
      } catch {
        // The money may well have moved; what we lost is the answer. Saying
        // "failed" here would be a guess, and an expensive one (PRD 8).
        setError(
          'The connection dropped before we could confirm the outcome. Do not pay again — ' +
            'check your account in a minute; if the plan is not active, reconciliation will ' +
            'either activate it or ensure nothing was charged.',
        );
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  /**
   * Cashfree's UPI and net-banking journeys leave the site entirely and come
   * back to `/checkout?cf_order_id=…`. Picking that up on mount is what makes
   * the redirect flow finish the same way the in-page modal does — the guard
   * keeps a re-render from confirming twice.
   */
  const resumeAttempted = useRef(false);

  useEffect(() => {
    if (!returningOrderId || resumeAttempted.current) return;
    resumeAttempted.current = true;

    setProvider('cashfree');
    setPaymentId(returningOrderId);
    void confirmPayment(returningOrderId, 'cashfree', { order_id: returningOrderId });
  }, [returningOrderId, confirmPayment]);

  async function startPayment() {
    // Refused up front rather than left to time out: an offline browser must
    // never look like it is mid-payment (PRD 11).
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('You are offline. Nothing was started — reconnect and try again.');
      return;
    }

    setBusy('starting');
    setError(null);

    let begun: { paymentId: string; checkout: Record<string, unknown> };

    try {
      const beginResponse = await fetch('/api/checkout/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressId, provider, fullName, phone }),
      });

      const data = await beginResponse.json();

      if (!beginResponse.ok) {
        setError(data.error ?? 'Checkout could not be started.');
        setBusy(null);
        return;
      }

      begun = data;
    } catch {
      // Before any money moves, a dropped connection is safely retryable.
      setError('We could not reach the server. Nothing was charged — try again.');
      setBusy(null);
      return;
    }

    setPaymentId(begun.paymentId);

    // The sandbox gateway asks for an outcome instead of opening a hosted
    // page; its own panel takes over from here.
    if (provider === 'sandbox') {
      setBusy(null);
      return;
    }

    /**
     * Hand over to the provider. From this point the customer may be entering
     * card details or approving a UPI mandate, so nothing below treats silence
     * as failure -- every branch ends in either a server-checked verdict or a
     * statement that nothing was charged.
     */
    let result: GatewayResult;

    try {
      setBusy('gateway');
      result = await openGateway(provider, begun.checkout);
    } catch (gatewayError) {
      setError(
        gatewayError instanceof Error
          ? `${gatewayError.message} Nothing was charged — try again.`
          : 'The payment gateway could not be opened. Nothing was charged.',
      );
      setBusy(null);
      return;
    }

    if (result.status === 'redirecting') {
      // The gateway is navigating this tab away. Leaving the button busy is
      // the honest state: the page is about to stop existing.
      return;
    }

    if (result.status === 'dismissed') {
      setError('You closed the payment window before it finished. Nothing was charged.');
      setBusy(null);
      return;
    }

    if (result.status === 'failed') {
      setError(result.message);
      setBusy(null);
      return;
    }

    await confirmPayment(begun.paymentId, provider, result.payload);
  }

  async function completeSandbox(result: 'success' | 'failed' | 'uncertain') {
    if (!paymentId) return;
    setBusy('confirming');
    setError(null);

    try {
      const response = await fetch('/api/checkout/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, outcome: result }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Could not complete the payment.');
        return;
      }

      // Same reasoning as the live path: the draft is gone, so a refresh would
      // redirect away from the result the tester is here to read.
      setOutcome(data as Outcome);
    } catch {
      // Mid-confirmation the outcome is genuinely unknown -- say that rather
      // than guessing either way (PRD 8): the payment may or may not have
      // registered, and reconciliation will settle it.
      setError(
        'The connection dropped before we could confirm the outcome. Do not pay again — ' +
          'check your account in a minute; if the plan is not active, reconciliation will ' +
          'either activate it or ensure nothing was charged.',
      );
    } finally {
      setBusy(null);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Result states                                                       */
  /* ------------------------------------------------------------------ */
  if (outcome?.status === 'active') {
    return (
      <Card className="p-6">
        <Badge tone="success">Subscription active</Badge>
        <h2 className="mt-3 text-xl font-semibold">You are all set</h2>
        <p className="mt-1 text-sm text-muted">
          {outcome.subscriptionNumber} · {outcome.creditsGranted} credits granted ·{' '}
          {outcome.deliveriesGenerated} deliveries scheduled.
        </p>
        <p className="mt-3 text-sm text-muted">
          Your meals enter the kitchen queue shortly before each delivery window — you can
          watch that from your account.
        </p>

        <div className="mt-5 flex gap-3">
          <Button onClick={() => router.push('/account')}>Go to my account</Button>
        </div>
      </Card>
    );
  }

  if (outcome?.status === 'needs_reconciliation') {
    return (
      <Card className="p-6">
        <Badge tone="warning">Payment unconfirmed</Badge>
        <h2 className="mt-3 text-xl font-semibold">We could not confirm that payment</h2>
        <p className="mt-2 text-sm text-muted">{outcome.message}</p>
        <p className="mt-3 text-sm text-muted">
          Please do not pay again yet. If the amount was debited, it will show up in our
          reconciliation and we will either activate the plan or refund you.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" onClick={() => setOutcome(null)}>
            Back to checkout
          </Button>
        </div>
      </Card>
    );
  }

  if (outcome?.status === 'failed') {
    return (
      <Card className="p-6">
        <Badge tone="danger">Payment failed</Badge>
        <h2 className="mt-3 text-xl font-semibold">Your subscription is not active</h2>
        <p className="mt-2 text-sm text-muted">{outcome.message}</p>
        <div className="mt-5 flex gap-3">
          <Button
            onClick={() => {
              setOutcome(null);
              setPaymentId(null);
              setError(null);
            }}
          >
            Try again
          </Button>
        </div>
        <p className="mt-3 text-xs text-subtle">
          Retrying is safe — it reuses the same checkout rather than creating a second
          subscription.
        </p>
      </Card>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Sandbox gateway                                                     */
  /* ------------------------------------------------------------------ */
  if (paymentId && provider === 'sandbox') {
    return (
      <Card className="p-6">
        <Badge tone="warning">Test gateway</Badge>
        <h2 className="mt-3 font-semibold">Simulate the gateway result</h2>
        <p className="mt-1 text-sm text-muted">
          No money moves. Each outcome is signed on the server and verified through the same
          path a real provider uses.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Button variant="success" size="lg" disabled={pending} onClick={() => completeSandbox('success')}>
            {pending ? <Spinner /> : null} Succeed
          </Button>
          <Button variant="danger" size="lg" disabled={pending} onClick={() => completeSandbox('failed')}>
            Decline
          </Button>
          <Button variant="secondary" size="lg" disabled={pending} onClick={() => completeSandbox('uncertain')}>
            Time out
          </Button>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}
      </Card>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Address + provider selection                                        */
  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Delivery address</h2>
          <Button variant="ghost" size="sm" onClick={() => setAddingAddress((v) => !v)}>
            {addingAddress ? 'Cancel' : 'Add another'}
          </Button>
        </div>

        {addingAddress ? (
          <AddressStep action={newAddressAction} compact />
        ) : (
          <div className="mt-4 space-y-3">
            {addresses.map((address) => (
              <button
                key={address.id}
                type="button"
                onClick={() => setAddressId(address.id)}
                aria-pressed={addressId === address.id}
                className={cx(
                  'w-full rounded-ck border p-4 text-left transition-colors',
                  addressId === address.id
                    ? 'border-brand bg-brand-soft'
                    : 'border-line-strong hover:bg-sunken',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{address.label}</span>
                  {address.is_default ? <Badge tone="neutral">Default</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {address.recipient_name} · {address.phone}
                </p>
                <p className="text-sm text-muted">
                  {[address.line1, address.line2, address.landmark].filter(Boolean).join(', ')},{' '}
                  {address.city} {address.postal_code}
                </p>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Contact for this order</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Meera Iyer"
            />
          </Field>
          <Field label="Mobile" required>
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 98100 00000"
            />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Payment method</h2>

        {providers.length === 0 ? (
          <div className="mt-4">
            <Alert tone="warning" title="No payment method is available">
              No gateway credentials are configured, so checkout cannot take a payment.
            </Alert>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {providers.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setProvider(option.id)}
                aria-pressed={provider === option.id}
                className={cx(
                  'flex w-full items-center justify-between rounded-ck border p-4 text-left transition-colors',
                  provider === option.id
                    ? 'border-brand bg-brand-soft'
                    : 'border-line-strong hover:bg-sunken',
                )}
              >
                <span className="font-medium">{option.displayName}</span>
                {option.isSandbox ? <Badge tone="warning">Test only</Badge> : null}
              </button>
            ))}
          </div>
        )}

        {error ? (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}

        <Button
          size="lg"
          className="mt-5 w-full"
          disabled={pending || !addressId || !provider || providers.length === 0}
          onClick={startPayment}
        >
          {pending ? <Spinner /> : null}
          {busy ? BUSY_LABEL[busy] : 'Pay and activate'}
        </Button>

        <p className="mt-3 text-xs text-subtle">
          We verify the payment on our side before anything is activated. Nothing is
          scheduled until that check passes.
        </p>
      </Card>
    </div>
  );
}
