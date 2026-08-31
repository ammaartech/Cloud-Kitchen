import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { readDraft } from '@/lib/checkout/draft';
import { getPlan } from '@/lib/data/catalog';
import { serverClient } from '@/lib/supabase/server';
import { availablePaymentProviders } from '@/lib/payments';
import { money, weekdayList, clockTime, PLAN_TYPE_LABELS } from '@/lib/format';
import { Alert, Badge, Card } from '@/components/ui/primitives';
import { ActionFeedback, fail, readable } from '@/lib/admin/feedback';
import { CheckoutAuthStep } from '@/components/checkout/auth-step';
import { ProfileStep } from '@/components/checkout/profile-step';
import { AddressStep } from '@/components/checkout/address-step';
import { PaymentStep } from '@/components/checkout/payment-step';

export const metadata = { title: 'Checkout' };

interface Quote {
  subtotal: number;
  discount_total: number;
  delivery_fee: number;
  tax_total: number;
  grand_total: number;
  coupon_applied: boolean;
  coupon_code: string | null;
  coupon_message: string | null;
  tax_breakdown: Array<{ code: string; label: string; rate: number; amount: number }>;
}

export default async function CheckoutPage({ searchParams }: PageProps<'/checkout'>) {
  const draft = await readDraft();
  if (!draft) redirect('/subscriptions');

  const params = await searchParams;

  const [session, plan] = await Promise.all([getSession(), getPlan(draft.planSlug)]);
  if (!plan) redirect('/subscriptions');

  const supabase = await serverClient();

  /**
   * The quote is computed by the database, not here. Whatever the browser
   * believes the price is, `begin_subscription_checkout` recomputes it before
   * a payment is created (PRD 6, PRD 8).
   */
  const { data: quoteData } = await supabase.rpc('quote_subscription', {
    p_plan_id: draft.planId,
    p_customer_id: session?.customerId ?? null,
    p_coupon_code: draft.couponCode,
  });

  const quote = quoteData as Quote | null;

  const { data: addressRows } = session?.customerId
    ? await supabase
        .from('customer_addresses')
        .select('id, label, recipient_name, phone, line1, line2, landmark, city, state, postal_code, is_default')
        .eq('customer_id', session.customerId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
    : { data: [] };

  const addresses = (addressRows ?? []) as Array<{
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
  }>;

  const window = plan.windows.find((w) => w.id === draft.deliveryWindowId) ?? plan.windows[0];
  const providers = availablePaymentProviders();

  /** Creates the customer record. Account creation happens late (PRD 6). */
  async function saveProfile(formData: FormData) {
    'use server';

    const current = await getSession();
    if (!current) redirect('/checkout');

    const db = await serverClient();
    const { error } = await db.from('customers').insert({
      profile_id: current.id,
      full_name: String(formData.get('fullName') ?? ''),
      email: current.email,
      phone: String(formData.get('phone') ?? ''),
      marketing_consent: formData.get('marketingConsent') === 'on',
      marketing_consent_updated_at: new Date().toISOString(),
      marketing_consent_source: 'checkout',
      created_source: 'website',
    });

    // A silent refusal here would strand the customer on a step that never
    // advances -- the failure has to be said out loud.
    if (error) fail('/checkout', readable(error));

    revalidatePath('/checkout');
  }

  async function saveAddress(formData: FormData) {
    'use server';

    const current = await getSession();
    if (!current?.customerId) redirect('/checkout');

    const db = await serverClient();
    // Only one address may be the default; the incumbent stands down first.
    await db
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', current.customerId);

    const { error } = await db.from('customer_addresses').insert({
      customer_id: current.customerId,
      label: String(formData.get('label') ?? 'Home'),
      recipient_name: String(formData.get('recipientName') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      line1: String(formData.get('line1') ?? ''),
      line2: String(formData.get('line2') ?? '') || null,
      landmark: String(formData.get('landmark') ?? '') || null,
      city: String(formData.get('city') ?? ''),
      state: String(formData.get('state') ?? ''),
      postal_code: String(formData.get('postalCode') ?? ''),
      delivery_instructions: String(formData.get('instructions') ?? '') || null,
      is_default: true,
    });

    if (error) fail('/checkout', readable(error));

    revalidatePath('/checkout');
  }

  const step = !session
    ? 'auth'
    : !session.customerId
      ? 'profile'
      : addresses.length === 0
        ? 'address'
        : 'payment';

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href={`/subscriptions/${plan.slug}`} className="text-sm text-muted hover:text-ink">
        ← Back to plan
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Checkout</h1>

      {typeof params.error === 'string' ? (
        <div className="mt-6">
          <ActionFeedback error={params.error} />
        </div>
      ) : null}

      <ol className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Checkout progress">
        {(
          [
            ['auth', 'Account'],
            ['profile', 'Your details'],
            ['address', 'Delivery address'],
            ['payment', 'Payment'],
          ] as const
        ).map(([key, label], index) => {
          const order = ['auth', 'profile', 'address', 'payment'];
          const done = order.indexOf(step) > index;
          const current = step === key;

          return (
            <li
              key={key}
              aria-current={current ? 'step' : undefined}
              className={
                current
                  ? 'rounded-full bg-brand px-3 py-1 font-medium text-white'
                  : done
                    ? 'rounded-full bg-success-soft px-3 py-1 font-medium text-success'
                    : 'rounded-full bg-sunken px-3 py-1 text-subtle'
              }
            >
              {done ? '✓ ' : ''}
              {label}
            </li>
          );
        })}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-6">
          {step === 'auth' ? <CheckoutAuthStep /> : null}
          {step === 'profile' ? <ProfileStep action={saveProfile} /> : null}
          {step === 'address' ? <AddressStep action={saveAddress} /> : null}
          {step === 'payment' && session?.customerId ? (
            <PaymentStep
              addresses={addresses}
              providers={providers}
              defaultName={session.fullName}
              defaultPhone={session.phone ?? addresses[0]?.phone ?? ''}
              newAddressAction={saveAddress}
            />
          ) : null}
        </div>

        {/* Order summary. Every figure comes from the server-side quote. */}
        <aside className="lg:sticky lg:top-6">
          <Card className="p-5">
            <Badge tone="neutral">{PLAN_TYPE_LABELS[plan.planType] ?? plan.planType}</Badge>
            <h2 className="mt-2 font-semibold">{plan.name}</h2>

            <dl className="mt-4 space-y-2 border-b border-line pb-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Window</dt>
                <dd className="text-right font-medium">
                  {window ? `${window.label} · ${clockTime(window.startsAt)}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Days</dt>
                <dd className="text-right font-medium">{weekdayList(draft.deliveryDays)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Cycle</dt>
                <dd className="text-right font-medium">{plan.billingPeriodDays} days</dd>
              </div>
            </dl>

            {quote ? (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Plan</dt>
                  <dd className="tabular">{money(quote.subtotal)}</dd>
                </div>

                {Number(quote.discount_total) > 0 ? (
                  <div className="flex justify-between gap-3 text-success">
                    <dt>Offer {quote.coupon_code ? `(${quote.coupon_code})` : ''}</dt>
                    <dd className="tabular">−{money(quote.discount_total)}</dd>
                  </div>
                ) : null}

                {Number(quote.delivery_fee) > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Delivery</dt>
                    <dd className="tabular">{money(quote.delivery_fee)}</dd>
                  </div>
                ) : null}

                {quote.tax_breakdown?.map((component) => (
                  <div key={component.code} className="flex justify-between gap-3">
                    <dt className="text-muted">
                      {component.code} {Number(component.rate)}%
                    </dt>
                    <dd className="tabular">{money(component.amount)}</dd>
                  </div>
                ))}

                <div className="flex justify-between gap-3 border-t border-line pt-3 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular">{money(quote.grand_total)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted">Could not price this plan.</p>
            )}

            {quote && !quote.coupon_applied && quote.coupon_message ? (
              <p className="mt-3 text-xs text-warning">{quote.coupon_message}</p>
            ) : null}

            <p className="mt-4 text-xs text-subtle">
              If your payment does not go through, no subscription is created and nothing is
              scheduled.
            </p>
          </Card>

          {providers.length === 0 ? (
            <div className="mt-4">
              <Alert tone="warning" title="No payment method is configured">
                Add Razorpay or Cashfree credentials, or enable the test gateway, before
                taking payments.
              </Alert>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
