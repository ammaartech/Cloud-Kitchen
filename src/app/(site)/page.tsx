import Link from 'next/link';
import Image from 'next/image';
import { listPlans, listMenu, listPublicOffers, listDeliveryWindows } from '@/lib/data/catalog';
import { money, PLAN_TYPE_LABELS } from '@/lib/format';
import { Badge, ButtonLink, Card } from '@/components/ui/primitives';
import { StorefrontHero } from '@/components/site/storefront-hero';

export const metadata = {
  title: 'Home-style meals, on subscription',
};

export default async function HomePage() {
  const [plans, menu, offers, windows] = await Promise.all([
    listPlans(),
    listMenu(),
    listPublicOffers(),
    listDeliveryWindows(),
  ]);

  const featured = menu.filter((product) => product.isAvailable).slice(0, 3);

  return (
    <>
      <StorefrontHero plans={plans} menu={menu} offers={offers} windows={windows} />

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">How a subscription works</h2>

        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: 'Pick a plan',
              body: 'A fixed menu, a pool you choose from, or a bank of credits you spend when you like.',
            },
            {
              title: 'Set your schedule',
              body: 'Choose your delivery window and the days you want food. Change it later.',
            },
            {
              title: 'We cook to that plan',
              body: 'Your meals enter the kitchen queue shortly before your window opens — not days early.',
            },
            {
              title: 'Skip or pause freely',
              body: 'Skipping returns the entitlement to your balance. Travelling? Pause the plan.',
            },
          ].map((step, index) => (
            <li key={step.title}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                {index + 1}
              </span>
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Plans                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Plans on offer</h2>
              <p className="mt-1 text-muted">Every plan is prepaid for one cycle. Cancel anytime.</p>
            </div>
            <Link href="/subscriptions" className="text-sm font-medium text-brand hover:underline">
              Compare all plans →
            </Link>
          </div>

          {plans.length === 0 ? (
            <p className="mt-8 text-sm text-muted">
              No plans are published yet. Check back shortly.
            </p>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {plans.slice(0, 4).map((plan) => (
                <Card key={plan.id} className="flex flex-col p-5">
                  <Badge tone="neutral">{PLAN_TYPE_LABELS[plan.planType] ?? plan.planType}</Badge>
                  <h3 className="mt-3 font-semibold">{plan.name}</h3>
                  <p className="mt-1 flex-1 text-sm text-muted">{plan.tagline}</p>

                  <p className="mt-4 text-2xl font-semibold tabular">{money(plan.price)}</p>
                  <p className="text-xs text-subtle">
                    per {plan.billingPeriodDays} days
                    {plan.paymentFlow === 'recurring' ? ', renews automatically' : ''}
                  </p>

                  <ButtonLink href={`/subscriptions/${plan.slug}`} variant="secondary" size="sm" className="mt-4 w-full">View plan</ButtonLink>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Menu preview                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">What we cook</h2>
            <p className="mt-1 text-muted">
              The menu is for browsing — meals are ordered through a subscription.
            </p>
          </div>
          <Link href="/menu" className="text-sm font-medium text-brand hover:underline">
            See the full menu →
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((product) => (
            <Card key={product.id} className="flex gap-4 p-4">
              {product.imageUrl ? (
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-ck bg-sunken">
                  <Image
                    src={product.imageUrl}
                    alt={product.imageAlt}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                <h3 className="font-medium">{product.name}</h3>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                  {product.shortDescription}
                </p>
                <p className="mt-1 text-sm font-medium tabular">{money(product.basePrice)}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
