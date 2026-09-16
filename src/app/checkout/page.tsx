import Link from 'next/link';
import { io } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { readDraft } from '@/lib/checkout/draft';
import { couponReason } from '@/lib/checkout/coupons';
import { calendarDate, firstDeliveryDate, subscriptionStartDate } from '@/lib/checkout/schedule';
import { getPlan, getPlanMeals } from '@/lib/data/catalog';
import { serverClient } from '@/lib/supabase/server';
import { availablePaymentProviders } from '@/lib/payments';
import { clockTime, weekdayList, PLAN_TYPE_LABELS } from '@/lib/format';
import { Alert } from '@/components/ui/primitives';
import { buttonClasses } from '@/components/ui/button-styles';
import { CheckoutAuthStep } from '@/components/checkout/auth-step';
import { CheckoutFlow } from '@/components/checkout/checkout-flow';
import { CheckoutSection } from '@/components/checkout/checkout-section';
import { DeliveryForm } from '@/components/checkout/delivery-form';
import { OrderSummary, type SummaryQuote } from '@/components/checkout/order-summary';
import { PaymentStep, type CheckoutAddress } from '@/components/checkout/payment-step';
import { SwitchAccountButton } from '@/components/checkout/switch-account';

/**
 * These screens are per-user by definition -- a session decides not just what
 * they show but whether you may see them at all -- so there is no static shell
 * to prerender and no point pretending otherwise. `instant = false` says that
 * plainly: this segment is allowed to block.
 *
 * It is a statement about *this* route, not a global escape hatch. The public
 * storefront next door is held to the opposite standard.
 */
export const instant = false;

export const metadata = { title: 'Checkout' };

interface Quote {
  subtotal: number | string;
  discount_total: number | string;
  delivery_fee: number | string;
  tax_total: number | string;
  grand_total: number | string;
  coupon_applied: boolean;
  coupon_code: string | null;
  coupon_message: string | null;
  tax_breakdown: Array<{ code: string; label: string; rate: number | string; amount: number | string }>;
}

type Step = 'account' | 'delivery' | 'payment';

/**
 * Checkout: one page, three sections, the plan beside them.
 *
 * ## What changed, and why
 *
 * It was four screens in a row (account, your details, address, payment),
 * each a card that replaced the last, and between them they asked for a name
 * three times and a mobile number three times. It is now one page:
 *
 *   1. **Account.** Sign in or create one. Folds to a line once done.
 *   2. **Delivery.** Name, mobile and address, asked once. For a returning
 *      customer it is their saved address with "Change".
 *   3. **Payment.** Method, then a pay button that says the amount, in a dock
 *      that stays under the thumb on a phone.
 *
 * The summary is the plan's ticket, filled in, with the offer code and a total
 * priced on the server. On a phone it is a bar at the top that opens.
 *
 * Which section is open is decided here, from the session and the customer's
 * rows, never in the browser: the page re-renders when a step completes, and
 * `CheckoutFlow` animates the handover.
 */
export default async function CheckoutPage({ searchParams }: PageProps<'/checkout'>) {
  const [draft, params] = await Promise.all([readDraft(), searchParams]);
  if (!draft) return <EmptyCheckout />;

  const [session, plan] = await Promise.all([getSession(), getPlan(draft.planSlug)]);
  if (!plan) return <EmptyCheckout reason="plan" />;

  const supabase = await serverClient();

  /**
   * The quote is computed by the database, not here. Whatever the browser
   * believes the price is, `begin_subscription_checkout` recomputes it before
   * a payment is created (PRD 6, PRD 8).
   */
  const [{ data: quoteData }, { data: addressRows }, meals] = await Promise.all([
    supabase.rpc('quote_subscription', {
      p_plan_id: draft.planId,
      p_customer_id: session?.customerId ?? null,
      p_coupon_code: draft.couponCode,
    }),
    session?.customerId
      ? supabase
          .from('customer_addresses')
          .select(
            'id, label, recipient_name, phone, line1, line2, landmark, city, state, postal_code, delivery_instructions, is_default',
          )
          .eq('customer_id', session.customerId)
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    plan.planType === 'customer_selected' ? getPlanMeals(plan.id) : Promise.resolve(null),
  ]);

  const raw = quoteData as Quote | null;
  const addresses = (addressRows ?? []) as CheckoutAddress[];
  const providers = availablePaymentProviders();

  const step: Step = !session
    ? 'account'
    : !session.customerId || addresses.length === 0
      ? 'delivery'
      : 'payment';

  const deliveryWindow =
    plan.windows.find((window) => window.id === draft.deliveryWindowId) ?? plan.windows[0];
  const windowText = deliveryWindow
    ? `${deliveryWindow.label}, ${clockTime(deliveryWindow.startsAt)} to ${clockTime(deliveryWindow.endsAt)}`
    : null;

  const isCredits = plan.planType === 'meal_credits';
  /**
   * The two dates below are read off the clock, and under Cache Components a
   * clock read is synchronous IO: left unannounced, Next either bakes today's
   * answer into the prerendered shell or refuses the route outright, which
   * `instant = false` does not excuse. `io()` says the true thing -- this is
   * per request -- and suspends the prerender here, where `loading.tsx`
   * already covers the gap. A promise of "first delivery Thu, 17 Sept" is
   * worth nothing if it is the date the shell was built on.
   */
  await io();

  const startsOn = calendarDate(subscriptionStartDate());
  const firstDelivery = isCredits
    ? null
    : `${calendarDate(firstDeliveryDate(draft.deliveryDays))}${deliveryWindow ? `, ${clockTime(deliveryWindow.startsAt)}` : ''}`;

  const chosenIds = new Set(draft.selectedMeals.map((meal) => meal.product_id));
  const mealNames = meals ? meals.selectable.filter((meal) => chosenIds.has(meal.id)).map((meal) => meal.name) : [];

  const quote: SummaryQuote | null = raw
    ? {
        subtotal: Number(raw.subtotal),
        discount: Number(raw.discount_total),
        deliveryFee: Number(raw.delivery_fee),
        total: Number(raw.grand_total),
        taxes: (raw.tax_breakdown ?? []).map((tax) => ({
          code: tax.code,
          rate: Number(tax.rate),
          amount: Number(tax.amount),
        })),
        // The quote only names a code it applied; the draft is what is on the plan.
        couponCode: draft.couponCode,
        couponApplied: raw.coupon_applied,
        couponReason:
          draft.couponCode && !raw.coupon_applied && raw.coupon_message
            ? couponReason(raw.coupon_message)
            : null,
      }
    : null;

  const summaryRows = [
    {
      label: 'you get',
      value: isCredits ? `${plan.creditsPerCycle} credits` : `${plan.mealsPerCycle} meals`,
    },
    ...(windowText ? [{ label: 'window', value: windowText }] : []),
    ...(isCredits ? [] : [{ label: 'days', value: weekdayList(draft.deliveryDays) }]),
    isCredits
      ? { label: 'starts', value: startsOn }
      : { label: 'first delivery', value: firstDelivery ?? startsOn },
    {
      label: 'cycle',
      value: `${plan.billingPeriodDays} days, ${plan.paymentFlow === 'recurring' ? 'renews' : 'one-time'}`,
    },
  ];

  return (
    <div className="co-page">
      <div className="co-layout">
        <OrderSummary
          plan={{
            name: plan.name,
            kind: PLAN_TYPE_LABELS[plan.planType] ?? plan.planType,
            slug: plan.slug,
            rows: summaryRows,
            meals: mealNames,
          }}
          quote={quote}
          canCheckCode={Boolean(session?.customerId)}
        />

        <div className="co-main">
          <h1 className="co-title">Checkout</h1>

          {providers.length === 0 ? (
            <div className="mt-4">
              <Alert tone="warning" title="No payment method is configured">
                Add Razorpay or Cashfree credentials, or enable the test gateway, before taking
                payments.
              </Alert>
            </div>
          ) : null}

          <CheckoutFlow step={step}>
            <CheckoutSection
              id="co-account"
              index={1}
              title="Account"
              state={session ? 'done' : 'current'}
              summary={
                session ? (
                  <>
                    <span className="co-summary-strong">{session.fullName || 'Signed in'}</span>
                    {session.email ? <> · {session.email}</> : null}
                  </>
                ) : null
              }
              action={session ? <SwitchAccountButton /> : null}
            >
              {session ? null : <CheckoutAuthStep />}
            </CheckoutSection>

            {step === 'payment' && session ? (
              <PaymentStep
                addresses={addresses}
                providers={providers}
                contactName={session.fullName}
                contactPhone={session.phone}
                total={quote?.total ?? null}
                planName={plan.name}
                firstDelivery={firstDelivery ? `${firstDelivery}` : null}
                isCredits={isCredits}
                /**
                 * Cashfree returns the customer here after a UPI or net-banking
                 * journey. The id is only a pointer: confirmation still runs
                 * server-side against Cashfree, and /api/checkout/confirm still
                 * checks the payment belongs to the caller, so a guessed value
                 * buys nothing.
                 */
                returningOrderId={
                  typeof params.cf_order_id === 'string' ? params.cf_order_id : undefined
                }
              />
            ) : (
              <>
                <CheckoutSection
                  id="co-delivery"
                  index={2}
                  title="Delivery"
                  state={step === 'delivery' ? 'current' : 'upcoming'}
                  summary={
                    firstDelivery ? (
                      <>First delivery {firstDelivery}</>
                    ) : (
                      <>Credits usable from {startsOn}</>
                    )
                  }
                >
                  {step === 'delivery' && session ? (
                    <DeliveryForm
                      defaultName={session.fullName}
                      defaultPhone={session.phone ?? ''}
                      includeConsent={!session.customerId}
                      submitLabel="Save and continue to payment"
                    />
                  ) : null}
                </CheckoutSection>

                <CheckoutSection
                  id="co-payment"
                  index={3}
                  title="Payment"
                  state="upcoming"
                  summary="UPI, cards and net banking"
                />
              </>
            )}
          </CheckoutFlow>
        </div>
      </div>
    </div>
  );
}

/**
 * Nothing to check out: no plan was chosen, or the choice expired.
 *
 * This used to redirect to the plans page without a word, which on a
 * two-hour-old tab reads as the site having lost the order. Saying what
 * happened costs one screen and keeps the customer's trust.
 */
function EmptyCheckout({ reason = 'draft' }: { reason?: 'draft' | 'plan' }) {
  return (
    <div className="co-page">
      <div className="co-empty">
        <p className="ticket-meta">
          <span>checkout</span>
        </p>
        <h1 className="co-empty-title">
          {reason === 'plan' ? 'That plan is no longer offered' : 'Nothing to check out yet'}
        </h1>
        <p className="co-empty-text">
          {reason === 'plan'
            ? 'The plan you chose has been taken off the menu since. Nothing was charged. Pick another and your details will be waiting.'
            : 'A plan you choose is held here for two hours. If you already paid, your subscription is in your account.'}
        </p>
        <div className="co-empty-actions">
          <Link href="/subscriptions" className={`${buttonClasses('primary', 'lg')} btn-square`}>
            See the plans
          </Link>
          <Link href="/account" className={`${buttonClasses('outline', 'lg')} btn-square`}>
            My account
          </Link>
        </div>
      </div>
    </div>
  );
}
