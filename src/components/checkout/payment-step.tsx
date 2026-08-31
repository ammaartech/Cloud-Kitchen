'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card, Field, Input, Spinner, cx } from '@/components/ui/primitives';
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
}: {
  addresses: Address[];
  providers: Provider[];
  defaultName: string;
  defaultPhone: string;
  newAddressAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();

  const [addressId, setAddressId] = useState(addresses[0]?.id ?? '');
  const [provider, setProvider] = useState(providers[0]?.id ?? '');
  const [fullName, setFullName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [addingAddress, setAddingAddress] = useState(false);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  async function startPayment() {
    setPending(true);
    setError(null);

    const beginResponse = await fetch('/api/checkout/begin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId, provider, fullName, phone }),
    });

    const begun = await beginResponse.json();

    if (!beginResponse.ok) {
      setError(begun.error ?? 'Checkout could not be started.');
      setPending(false);
      return;
    }

    setPaymentId(begun.paymentId);

    // The sandbox gateway asks for an outcome instead of opening a hosted
    // page. A real provider would hand control to its SDK here and return via
    // /api/checkout/confirm.
    if (provider === 'sandbox') {
      setPending(false);
      return;
    }

    setError(
      'This provider needs its browser SDK to complete the payment. ' +
        'Enable the test gateway to walk the flow end to end.',
    );
    setPending(false);
  }

  async function completeSandbox(result: 'success' | 'failed' | 'uncertain') {
    if (!paymentId) return;
    setPending(true);
    setError(null);

    const response = await fetch('/api/checkout/sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, outcome: result }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? 'Could not complete the payment.');
      setPending(false);
      return;
    }

    setOutcome(data as Outcome);
    setPending(false);

    if (data.status === 'active') {
      router.refresh();
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
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </Field>
          <Field label="Mobile" required>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
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
          Pay and activate
        </Button>

        <p className="mt-3 text-xs text-subtle">
          We verify the payment on our side before anything is activated. Nothing is
          scheduled until that check passes.
        </p>
      </Card>
    </div>
  );
}
