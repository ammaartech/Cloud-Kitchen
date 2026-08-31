import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getPlan, getPlanMeals, listPublicOffers } from '@/lib/data/catalog';
import { saveDraft, draftSchema } from '@/lib/checkout/draft';
import { PlanConfigurator } from '@/components/checkout/plan-configurator';
import { ProductTile } from '@/components/product-card';
import { money, PLAN_TYPE_LABELS } from '@/lib/format';
import { Badge, Card } from '@/components/ui/primitives';

export async function generateMetadata({ params }: PageProps<'/subscriptions/[slug]'>) {
  const { slug } = await params;
  const plan = await getPlan(slug);
  return { title: plan?.name ?? 'Plan' };
}

export default async function PlanPage({ params }: PageProps<'/subscriptions/[slug]'>) {
  const { slug } = await params;
  const plan = await getPlan(slug);

  if (!plan) notFound();

  const [meals, offers] = await Promise.all([getPlanMeals(plan.id), listPublicOffers()]);
  const autoOffer = offers[0] ?? null;

  /**
   * Stores the configuration and moves to checkout.
   *
   * Deliberately stores intent only. No subscription, no payment and no price
   * exists until checkout runs `begin_subscription_checkout` on the server.
   */
  async function continueToCheckout(formData: FormData) {
    'use server';

    const parsed = draftSchema.safeParse({
      idempotencyKey: crypto.randomUUID(),
      planId: formData.get('planId'),
      planSlug: formData.get('planSlug'),
      deliveryWindowId: formData.get('deliveryWindowId'),
      deliveryDays: JSON.parse(String(formData.get('deliveryDays') ?? '[]')),
      selectedMeals: JSON.parse(String(formData.get('selectedMeals') ?? '[]')),
      couponCode: autoOffer?.code ?? null,
      deliveryInstructions: String(formData.get('deliveryInstructions') ?? '') || null,
    });

    if (!parsed.success) {
      redirect(`/subscriptions/${slug}?error=invalid`);
    }

    await saveDraft(parsed.data);
    redirect('/checkout');
  }

  const entitlement =
    plan.planType === 'meal_credits'
      ? `${plan.creditsPerCycle} credits`
      : `${plan.mealsPerCycle} meals`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link href="/subscriptions" className="text-sm text-muted hover:text-ink">
        ← All plans
      </Link>

      <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div>
          <header>
            <Badge tone="neutral">{PLAN_TYPE_LABELS[plan.planType] ?? plan.planType}</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{plan.name}</h1>
            <p className="mt-2 max-w-xl text-muted text-pretty">{plan.description}</p>
          </header>

          {meals.fixed.length > 0 ? (
            <section className="mt-10">
              <h2 className="font-semibold">What is included</h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {meals.fixed.map((product) => (
                  <ProductTile key={product.id} product={product} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-10">
            <h2 className="text-xl font-semibold tracking-tight">Configure your plan</h2>
            <div className="mt-5">
              <PlanConfigurator
                plan={plan}
                selectableMeals={meals.selectable}
                action={continueToCheckout}
              />
            </div>
          </section>
        </div>

        {/* Sticky summary: what the plan gives, and what happens next. */}
        <aside className="lg:sticky lg:top-24">
          <Card className="p-6">
            <p className="text-3xl font-semibold tabular">{money(plan.price)}</p>
            <p className="text-sm text-subtle">
              per {plan.billingPeriodDays} days
              {plan.paymentFlow === 'recurring' ? ' · renews automatically' : ' · one-time'}
            </p>

            <dl className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">You get</dt>
                <dd className="font-medium tabular">{entitlement}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Variants</dt>
                <dd className="font-medium">{plan.allowsVariants ? 'Allowed' : 'Fixed'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Add-ons</dt>
                <dd className="font-medium">{plan.allowsAddOns ? 'Allowed' : 'Not on this plan'}</dd>
              </div>
            </dl>

            {autoOffer ? (
              <div className="mt-5 rounded-ck border border-accent/30 bg-accent-soft p-3">
                <p className="text-sm font-medium text-ink">{autoOffer.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Applied at checkout if you qualify. We verify eligibility on our side.
                </p>
              </div>
            ) : null}

            <p className="mt-5 text-xs text-subtle">
              You will not be charged until you confirm payment. If a payment fails, no
              subscription is created and no food is scheduled.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
