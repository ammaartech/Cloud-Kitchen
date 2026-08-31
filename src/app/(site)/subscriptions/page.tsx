import Link from 'next/link';
import { listPlans, listPublicOffers } from '@/lib/data/catalog';
import { money, clockTime, PLAN_TYPE_LABELS } from '@/lib/format';
import { Badge, Button, Card, EmptyState } from '@/components/ui/primitives';

export const metadata = {
  title: 'Subscriptions',
  description: 'Prepaid meal plans, delivered on your schedule.',
};

/** What each plan shape means, in plain terms rather than jargon. */
const PLAN_TYPE_EXPLAINER: Record<string, string> = {
  fixed_meals: 'We decide the menu. You get a set number of meals in the cycle.',
  meal_credits: 'You get a bank of credits and spend them whenever you want.',
  scheduled_meals: 'A menu that changes by day of the week, on a fixed schedule.',
  customer_selected: 'You pick your meals from our pool, and we repeat them.',
};

export default async function SubscriptionsPage() {
  const [plans, offers] = await Promise.all([listPlans(), listPublicOffers()]);
  const firstOffer = offers[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="mt-2 text-muted text-pretty">
          This is where you actually buy. Each plan is prepaid for one cycle; you choose the
          delivery window and the days, and you can skip, pause or cancel from your account.
        </p>
      </header>

      {firstOffer ? (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-ck border border-accent/30 bg-accent-soft px-4 py-3">
          <Badge tone="accent">Unlocked</Badge>
          <p className="text-sm text-ink">
            <span className="font-medium">{firstOffer.name}.</span>{' '}
            <span className="text-muted">
              Applied at checkout if your account qualifies — we check on our side.
            </span>
          </p>
        </div>
      ) : null}

      {plans.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No plans are published"
            description="The kitchen has not published any subscription plans yet."
          />
        </div>
      ) : (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {plans.map((plan) => {
            const entitlement =
              plan.planType === 'meal_credits'
                ? `${plan.creditsPerCycle} credits`
                : `${plan.mealsPerCycle} meals`;

            return (
              <Card key={plan.id} className="flex flex-col p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge tone="neutral">
                      {PLAN_TYPE_LABELS[plan.planType] ?? plan.planType}
                    </Badge>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight">{plan.name}</h2>
                    <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-semibold tabular">{money(plan.price)}</p>
                    <p className="text-xs text-subtle">per {plan.billingPeriodDays} days</p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-muted">
                  {PLAN_TYPE_EXPLAINER[plan.planType] ?? plan.description}
                </p>

                <dl className="mt-5 grid grid-cols-2 gap-4 rounded-ck bg-sunken p-4 text-sm">
                  <div>
                    <dt className="text-xs text-subtle">You get</dt>
                    <dd className="mt-0.5 font-medium tabular">{entitlement}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">Billing</dt>
                    <dd className="mt-0.5 font-medium">
                      {plan.paymentFlow === 'recurring' ? 'Renews automatically' : 'One-time'}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-subtle">Delivery windows</dt>
                    <dd className="mt-0.5 font-medium">
                      {plan.windows.length
                        ? plan.windows
                            .map(
                              (window) =>
                                `${window.label} (${clockTime(window.startsAt)}–${clockTime(window.endsAt)})`,
                            )
                            .join(', ')
                        : 'Any window'}
                    </dd>
                  </div>
                </dl>

                {plan.planType === 'meal_credits' ? (
                  <p className="mt-3 text-xs text-subtle">
                    Premium dishes cost more than one credit. The exact cost is shown on each
                    meal.
                  </p>
                ) : null}

                <div className="mt-6 flex-1" />

                <Link href={`/subscriptions/${plan.slug}`}>
                  <Button className="w-full" size="lg">
                    Choose this plan
                  </Button>
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      <section className="mt-14 grid gap-6 rounded-ck-lg border border-line bg-surface p-8 sm:grid-cols-3">
        {[
          {
            title: 'Skipping returns your entitlement',
            body: 'Skip a delivery before it reaches the kitchen and the credit goes back to your balance.',
          },
          {
            title: 'Pausing is built in',
            body: 'Going away? Pause the plan. Deliveries in that window are skipped automatically.',
          },
          {
            title: 'Cancel without losing history',
            body: 'Cancelling stops future deliveries. Anything already cooking still arrives, and your records stay.',
          },
        ].map((item) => (
          <div key={item.title}>
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-muted">{item.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
