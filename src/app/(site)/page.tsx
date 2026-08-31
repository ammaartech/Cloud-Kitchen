import Link from 'next/link';
import Image from 'next/image';
import { listPlans, listMenu, listPublicOffers, listDeliveryWindows } from '@/lib/data/catalog';
import { money, clockTime, PLAN_TYPE_LABELS } from '@/lib/format';
import { Badge, Button, Card } from '@/components/ui/primitives';

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
  const headlineOffer = offers[0];

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            {headlineOffer ? (
              <Badge tone="accent" className="mb-4">
                {headlineOffer.discountType === 'percent'
                  ? `${Number(headlineOffer.discountValue)}% off your first subscription`
                  : `${money(headlineOffer.discountValue)} off your first subscription`}
              </Badge>
            ) : null}

            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              One kitchen. One menu a day. Cooked properly.
            </h1>

            <p className="mt-4 max-w-lg text-lg text-muted text-pretty">
              We are not a marketplace with ten thousand dishes. We cook a small menu each
              day and deliver it on a schedule you set — breakfast, lunch or dinner.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/subscriptions">
                <Button size="lg">See subscription plans</Button>
              </Link>
              <Link href="/menu">
                <Button size="lg" variant="secondary">
                  Look at the menu
                </Button>
              </Link>
            </div>

            {windows.length ? (
              <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
                {windows.map((window) => (
                  <div key={window.id}>
                    <dt className="text-xs font-medium tracking-wide text-subtle uppercase">
                      {window.label}
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium tabular text-ink">
                      {clockTime(window.starts_at)} – {clockTime(window.ends_at)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {featured.slice(0, 3).map((product, index) => (
              <div
                key={product.id}
                className={
                  index === 0
                    ? 'relative col-span-2 aspect-[16/10] overflow-hidden rounded-ck-lg bg-sunken'
                    : 'relative aspect-square overflow-hidden rounded-ck-lg bg-sunken'
                }
              >
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.imageAlt}
                    fill
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    className="object-cover"
                    priority={index === 0}
                  />
                ) : null}
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-3">
                  <p className="text-sm font-medium text-white">{product.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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

                  <Link href={`/subscriptions/${plan.slug}`} className="mt-4">
                    <Button className="w-full" variant="secondary" size="sm">
                      View plan
                    </Button>
                  </Link>
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
