'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Spinner, cx } from '@/components/ui/primitives';
import { buttonClasses } from '@/components/ui/button-styles';
import { LockIcon } from '@/components/site/icons';
import { money } from '@/lib/format';
import { openCashfree, openRazorpay, type GatewayResult } from '@/lib/payments/browser';
import { CheckoutSection } from './checkout-section';
import { DeliveryForm } from './delivery-form';
import { Receipt } from './receipt';
import { AnimatedMoney } from './animated-money';
import { useCheckoutStage } from './checkout-stage';
import { useChoiceFlip } from './choice-flip';
import { gsap, motionAllowed, shake, useGSAP } from './checkout-gsap';

export interface CheckoutAddress {
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
  delivery_instructions: string | null;
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
  gateway: 'Finish paying in the window…',
  confirming: 'Confirming your payment…',
};

/**
 * How each gateway is described to a customer. Nobody chooses a gateway for
 * its name; they choose it for whether it takes the way they want to pay, so
 * the methods lead and the provider is the small print.
 */
const PROVIDER_COPY: Record<string, { title: string; methods: string[] }> = {
  razorpay: { title: 'UPI, cards, net banking or wallet', methods: ['UPI', 'Cards', 'Net banking', 'Wallets'] },
  cashfree: { title: 'UPI, cards or net banking', methods: ['UPI', 'Cards', 'Net banking'] },
  sandbox: { title: 'Test gateway', methods: ['No real money'] },
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

function addressLines(address: CheckoutAddress): string {
  return [address.line1, address.line2, address.landmark, `${address.city} ${address.postal_code}`]
    .filter(Boolean)
    .join(', ');
}

/**
 * Delivery and payment, the last two sections of checkout.
 *
 * They are one component because they share a decision: the address picked in
 * one is the address paid for in the other, and the pay button has to know it.
 *
 * ## The shape on a phone
 *
 * The chosen address shows as one line with "Change", since most people have
 * one address and should not scroll past a list to reach the button. Payment
 * methods are large radio cards. The pay button lives in a dock that sticks to
 * the bottom of the screen for the whole of these two sections, with the total
 * beside it -- in the thumb's reach, never scrolled out of view, and always
 * saying the amount it is about to charge.
 *
 * ## Outcomes
 *
 * All three are shown honestly. In particular a payment we could not confirm
 * is NOT reported as success or as plain failure -- it says money may have
 * moved, that no subscription exists yet, and that a human will reconcile it
 * (PRD 8, PRD 19). The flow logic below is unchanged from the version this
 * replaces; only what it renders is new.
 */
export function PaymentStep({
  addresses,
  providers,
  contactName,
  contactPhone,
  total,
  planName,
  firstDelivery,
  isCredits,
  returningOrderId,
}: {
  addresses: CheckoutAddress[];
  providers: Provider[];
  contactName: string;
  contactPhone: string | null;
  total: number | null;
  planName: string;
  firstDelivery: string | null;
  isCredits: boolean;
  /**
   * Set when Cashfree has just redirected the customer back to us after a UPI
   * or net-banking journey. Its value is the order id, which for Cashfree is
   * our own payment id -- so it is enough to finish the confirmation.
   */
  returningOrderId?: string;
}) {
  const { setConfirmed } = useCheckoutStage();

  const [addressId, setAddressId] = useState(addresses[0]?.id ?? '');
  const [provider, setProvider] = useState(
    returningOrderId ? 'cashfree' : (providers[0]?.id ?? ''),
  );
  const [changingAddress, setChangingAddress] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);

  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(returningOrderId ?? null);

  const addressGroup = useRef<HTMLDivElement>(null);
  const providerGroup = useRef<HTMLDivElement>(null);
  const payButton = useRef<HTMLButtonElement>(null);
  const captureAddress = useChoiceFlip(addressGroup, addressId);
  const captureProvider = useChoiceFlip(providerGroup, provider);

  const pending = busy !== null;
  const selectedAddress = addresses.find((address) => address.id === addressId) ?? addresses[0];
  const selectedProvider = providers.find((option) => option.id === provider);

  const settle = useCallback(
    (result: Outcome) => {
      setOutcome(result);
      if (result.status === 'active') setConfirmed(true);
    },
    [setConfirmed],
  );

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
        // draft cookie, and a render without a draft is the empty checkout --
        // so refreshing would throw the customer off the receipt for the
        // payment they just made. The account page they move on to is dynamic
        // and reads fresh anyway.
        settle(data as Outcome);
      } catch {
        // The money may well have moved; what we lost is the answer. Saying
        // "failed" here would be a guess, and an expensive one (PRD 8).
        setError(
          'The connection dropped before we could confirm the outcome. Do not pay again. ' +
            'Check your account in a minute; if the plan is not active, reconciliation will ' +
            'either activate it or ensure nothing was charged.',
        );
      } finally {
        setBusy(null);
      }
    },
    [settle],
  );

  /**
   * Cashfree's UPI and net-banking journeys leave the site entirely and come
   * back to `/checkout?cf_order_id=…`. Picking that up on mount is what makes
   * the redirect flow finish the same way the in-page modal does -- the guard
   * keeps a re-render from confirming twice.
   */
  const resumeAttempted = useRef(false);

  useEffect(() => {
    if (!returningOrderId || resumeAttempted.current) return;
    resumeAttempted.current = true;
    void confirmPayment(returningOrderId, 'cashfree', { order_id: returningOrderId });
  }, [returningOrderId, confirmPayment]);

  // The button's words change with what it is waiting on; they slide rather
  // than swap, so a change of state reads as progress and not as a flicker.
  useGSAP(
    () => {
      if (!motionAllowed()) return;
      const label = payButton.current?.querySelector('.co-pay-label');
      if (label) gsap.fromTo(label, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.28, ease: 'ck' });
    },
    { dependencies: [busy], revertOnUpdate: false },
  );

  function fail(message: string) {
    setError(message);
    setBusy(null);
    shake(payButton.current);
  }

  async function startPayment() {
    // Refused up front rather than left to time out: an offline browser must
    // never look like it is mid-payment (PRD 11).
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      fail('You are offline. Nothing was started. Reconnect and try again.');
      return;
    }

    if (!selectedAddress) {
      fail('Choose where to deliver before paying.');
      return;
    }

    setBusy('starting');
    setError(null);

    let begun: { paymentId: string; checkout: Record<string, unknown> };

    try {
      const beginResponse = await fetch('/api/checkout/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId: selectedAddress.id,
          provider,
          fullName: contactName || selectedAddress.recipient_name,
          phone: contactPhone || selectedAddress.phone,
        }),
      });

      const data = await beginResponse.json();

      if (!beginResponse.ok) {
        fail(data.error ?? 'Checkout could not be started. Nothing was charged.');
        return;
      }

      begun = data;
    } catch {
      // Before any money moves, a dropped connection is safely retryable.
      fail('We could not reach the server. Nothing was charged. Try again.');
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
      fail(
        gatewayError instanceof Error
          ? `${gatewayError.message} Nothing was charged. Try again.`
          : 'The payment gateway could not be opened. Nothing was charged.',
      );
      return;
    }

    if (result.status === 'redirecting') {
      // The gateway is navigating this tab away. Leaving the button busy is
      // the honest state: the page is about to stop existing.
      return;
    }

    if (result.status === 'dismissed') {
      fail('You closed the payment window before it finished. Nothing was charged.');
      return;
    }

    if (result.status === 'failed') {
      fail(result.message);
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
      // land on the empty checkout instead of the result.
      settle(data as Outcome);
    } catch {
      // Mid-confirmation the outcome is genuinely unknown -- say that rather
      // than guessing either way (PRD 8): the payment may or may not have
      // registered, and reconciliation will settle it.
      setError(
        'The connection dropped before we could confirm the outcome. Do not pay again. ' +
          'Check your account in a minute; if the plan is not active, reconciliation will ' +
          'either activate it or ensure nothing was charged.',
      );
    } finally {
      setBusy(null);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Confirmed                                                           */
  /* ------------------------------------------------------------------ */
  if (outcome?.status === 'active') {
    return (
      <Receipt
        details={{
          planName,
          subscriptionNumber: outcome.subscriptionNumber,
          creditsGranted: outcome.creditsGranted,
          deliveriesGenerated: outcome.deliveriesGenerated,
          total,
          firstDelivery,
          isCredits,
          deliverTo: selectedAddress
            ? `${selectedAddress.label}, ${selectedAddress.line1}`
            : 'Your saved address',
        }}
      />
    );
  }

  const deliverySummary = selectedAddress ? (
    <>
      <span className="co-summary-strong">{selectedAddress.label}</span>
      {' · '}
      {addressLines(selectedAddress)}
    </>
  ) : null;

  return (
    <div className="co-pay-stage">
      <CheckoutSection
        id="co-delivery"
        index={2}
        title="Delivery"
        state={changingAddress || addingAddress ? 'current' : 'done'}
        summary={
          changingAddress || addingAddress ? (
            firstDelivery ? <>First delivery {firstDelivery}</> : null
          ) : (
            <>
              {deliverySummary}
              {firstDelivery ? (
                <span className="co-summary-date">First delivery {firstDelivery}</span>
              ) : null}
            </>
          )
        }
        action={
          addingAddress ? null : (
            <button
              type="button"
              className="co-link"
              aria-expanded={changingAddress}
              aria-controls="co-address-options"
              onClick={() => setChangingAddress((open) => !open)}
              disabled={pending}
            >
              {changingAddress ? 'Done' : 'Change'}
            </button>
          )
        }
      >
        {addingAddress ? (
          <DeliveryForm
            defaultName={contactName}
            defaultPhone={contactPhone ?? ''}
            includeConsent={false}
            submitLabel="Save and deliver here"
            onSaved={(id) => {
              setAddressId(id);
              setAddingAddress(false);
              setChangingAddress(false);
            }}
            onCancel={() => setAddingAddress(false)}
          />
        ) : changingAddress ? (
          <fieldset id="co-address-options" className="co-fieldset">
            <legend className="sr-only">Deliver to</legend>
            <div ref={addressGroup} className="co-options">
              {addresses.map((address) => (
                <label key={address.id} className="co-option">
                  <input
                    type="radio"
                    name="address"
                    value={address.id}
                    checked={address.id === addressId}
                    onChange={() => {
                      captureAddress();
                      setAddressId(address.id);
                    }}
                    className="co-radio"
                  />
                  {address.id === addressId ? (
                    <span className="choice-ring" data-flip-id="address" />
                  ) : null}
                  <span className="co-option-body">
                    <span className="co-option-title">
                      {address.label}
                      {address.is_default ? <Badge tone="neutral">Default</Badge> : null}
                    </span>
                    <span className="co-option-text">
                      {address.recipient_name} · {address.phone}
                    </span>
                    <span className="co-option-text">{addressLines(address)}</span>
                    {address.delivery_instructions ? (
                      <span className="co-option-note">“{address.delivery_instructions}”</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="co-link mt-3"
              onClick={() => setAddingAddress(true)}
            >
              + Deliver to a new address
            </button>
          </fieldset>
        ) : null}
      </CheckoutSection>

      <CheckoutSection id="co-payment" index={3} title="Payment" state="current">
        {outcome?.status === 'needs_reconciliation' ? (
          <div className="co-result" data-tone="warning" role="alert">
            <Badge tone="warning">Payment unconfirmed</Badge>
            <h3 className="co-result-title">We could not confirm that payment</h3>
            <p>{outcome.message}</p>
            <p>
              Please do not pay again yet. If the amount was debited, it will show up in our
              reconciliation and we will either activate the plan or refund you.
            </p>
            <button
              type="button"
              className={cx(buttonClasses('outline', 'lg'), 'btn-square')}
              onClick={() => setOutcome(null)}
            >
              Back to checkout
            </button>
          </div>
        ) : outcome?.status === 'failed' ? (
          <div className="co-result" data-tone="danger" role="alert">
            <Badge tone="danger">Payment failed</Badge>
            <h3 className="co-result-title">Your plan is not active yet</h3>
            <p>{outcome.message}</p>
            <button
              type="button"
              className={cx(buttonClasses('primary', 'lg'), 'btn-square')}
              onClick={() => {
                setOutcome(null);
                setPaymentId(null);
                setError(null);
              }}
            >
              Try again
            </button>
            <p className="co-hint">
              Retrying is safe. It reuses the same checkout rather than creating a second
              subscription.
            </p>
          </div>
        ) : paymentId && provider === 'sandbox' ? (
          <div className="co-result" data-tone="test">
            <Badge tone="warning">Test gateway</Badge>
            <h3 className="co-result-title">Choose what the gateway reports</h3>
            <p>
              No money moves. Each outcome is signed on the server and verified through the same
              path a real provider uses.
            </p>
            <div className="co-sandbox-actions">
              <button
                type="button"
                className={cx(buttonClasses('success', 'lg'), 'btn-square')}
                disabled={pending}
                onClick={() => completeSandbox('success')}
              >
                {pending ? <Spinner /> : null} Succeed
              </button>
              <button
                type="button"
                className={cx(buttonClasses('danger', 'lg'), 'btn-square')}
                disabled={pending}
                onClick={() => completeSandbox('failed')}
              >
                Decline
              </button>
              <button
                type="button"
                className={cx(buttonClasses('outline', 'lg'), 'btn-square')}
                disabled={pending}
                onClick={() => completeSandbox('uncertain')}
              >
                Time out
              </button>
            </div>
            {error ? <Alert tone="danger">{error}</Alert> : null}
          </div>
        ) : providers.length === 0 ? (
          <Alert tone="warning" title="Payments are not available right now">
            No payment gateway is configured, so checkout cannot take a payment. Nothing has been
            charged.
          </Alert>
        ) : (
          <fieldset className="co-fieldset">
            <legend className="sr-only">How would you like to pay?</legend>
            <div ref={providerGroup} className="co-options">
              {providers.map((option) => {
                const copy = PROVIDER_COPY[option.id] ?? { title: option.displayName, methods: [] };
                return (
                  <label key={option.id} className="co-option">
                    <input
                      type="radio"
                      name="provider"
                      value={option.id}
                      checked={provider === option.id}
                      onChange={() => {
                        captureProvider();
                        setProvider(option.id);
                      }}
                      disabled={pending}
                      className="co-radio"
                    />
                    {provider === option.id ? (
                      <span className="choice-ring" data-flip-id="provider" />
                    ) : null}
                    <span className="co-option-body">
                      <span className="co-option-title">
                        {copy.title}
                        {option.isSandbox ? <Badge tone="warning">Test only</Badge> : null}
                      </span>
                      <span className="co-methods">
                        {copy.methods.map((method) => (
                          <span key={method} className="co-method">
                            {method}
                          </span>
                        ))}
                      </span>
                      <span className="co-option-text">via {option.displayName}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </CheckoutSection>

      {outcome || (paymentId && provider === 'sandbox') || providers.length === 0 ? null : (
        <div className="co-pay-dock">
          {error ? (
            <div role="alert" className="co-pay-error">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}

          <div className="co-pay-row">
            {total !== null ? (
              <p className="co-pay-total">
                <span className="co-pay-total-label">Total</span>
                <AnimatedMoney value={total} className="co-pay-total-value tabular" />
              </p>
            ) : null}

            <button
              ref={payButton}
              type="button"
              className={cx(buttonClasses('primary', 'lg'), 'btn-square co-pay-button')}
              disabled={pending || !selectedAddress || !provider || total === null}
              onClick={startPayment}
            >
              {pending ? <Spinner /> : <LockIcon />}
              <span className="co-pay-label" key={busy ?? 'idle'}>
                {busy ? BUSY_LABEL[busy] : total !== null ? `Pay ${money(total)}` : 'Pay'}
              </span>
            </button>
          </div>

          <p className="co-pay-note">
            Paid securely through {selectedProvider?.displayName ?? 'the gateway'}. Card and UPI
            details never reach our servers, and we verify the payment before anything is
            scheduled.
          </p>
        </div>
      )}
    </div>
  );
}
