import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import '@/components/site/ticket.css';
import '@/components/checkout/checkout.css';
import { getPlan, getPlanMeals, listPlans, listPublicOffers } from '@/lib/data/catalog';
import { saveDraft, draftSchema } from '@/lib/checkout/draft';
import { PlanConfigurator } from '@/components/checkout/plan-configurator';
import { FlowProgress } from '@/components/checkout/flow-progress';
import { ArrowLeftIcon } from '@/components/site/icons';
import { PLAN_TYPE_LABELS } from '@/lib/format';
import { Alert } from '@/components/ui/primitives';

/**
 * Enumerates every plan so each one is prerendered at build rather than on the
 * first visitor's request. The list is small and already cached, so this costs
 * one read shared with the pages themselves.
 *
 * A slug that is not returned here still works -- Next prerenders a shell for
 * it and streams the rest -- so a plan added between deploys is served, just
 * without the head start. `notFound()` below is what rejects a slug that is
 * not a plan at all.
 */
export async function generateStaticParams() {
  const plans = await listPlans();
  return plans.map((plan) => ({ slug: plan.slug }));
}

/**
 * The one request-dependent thing on this page: whether the last attempt to
 * save a configuration bounced. It is isolated behind its own boundary so that
 * reading `searchParams` costs this alert its prerender rather than the whole
 * plan page.
 */
async function ConfigurationError({
  searchParams,
}: {
  searchParams: PageProps<'/subscriptions/[slug]'>['searchParams'];
}) {
  const query = await searchParams;
  if (query.error !== 'invalid') return null;

  return (
    <div className="mt-4">
      <Alert tone="danger" title="That plan could not be saved">
        Something about the selection did not check out on our side. Nothing was charged.
        Check your choices below and continue again.
      </Alert>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps<'/subscriptions/[slug]'>) {
  const { slug } = await params;
  const plan = await getPlan(slug);
  return { title: plan?.name ?? 'Plan' };
}

export default async function PlanPage({
  params,
  searchParams,
}: PageProps<'/subscriptions/[slug]'>) {
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
   * The checks here are the cheap ones worth making before a redirect; the
   * database repeats every one of them, and more, when the plan is bought.
   */
  async function continueToCheckout(formData: FormData) {
    'use server';

    const current = await getPlan(slug);
    if (!current) redirect('/subscriptions');

    const deliveryDays = [...new Set(formData.getAll('day').map(Number))];
    const selectedMeals = [...new Set(formData.getAll('meal').map(String))].map((productId) => ({
      product_id: productId,
      quantity: 1,
    }));

    const parsed = draftSchema.safeParse({
      idempotencyKey: crypto.randomUUID(),
      planId: formData.get('planId'),
      planSlug: formData.get('planSlug'),
      deliveryWindowId: formData.get('deliveryWindowId'),
      // Seven days chosen is every day, and is stored the way every day is.
      deliveryDays: deliveryDays.length === 7 ? [] : deliveryDays,
      selectedMeals,
      couponCode: autoOffer?.code ?? null,
      // Instructions are asked for with the address at checkout, where the
      // rider reads them; the kitchen ticket falls back to the address's note.
      deliveryInstructions: null,
    });

    const pickedAll =
      current.planType !== 'customer_selected' ||
      selectedMeals.length === (current.selectableMealCount ?? 0);
    const windowOffered = current.windows.some(
      (window) => window.id === formData.get('deliveryWindowId'),
    );

    if (!parsed.success || parsed.data.planId !== current.id || !pickedAll || !windowOffered) {
      redirect(`/subscriptions/${slug}?error=invalid`);
    }

    await saveDraft(parsed.data);
    redirect('/checkout');
  }

  const kind = PLAN_TYPE_LABELS[plan.planType] ?? plan.planType;
  const entitlement =
    plan.planType === 'meal_credits'
      ? `${plan.creditsPerCycle} credits`
      : `${plan.mealsPerCycle} meals`;

  const header = (
    <header>
      <p className="ticket-meta">
        <span>{kind}</span>
      </p>
      <h1 className="cfg-title">{plan.name}</h1>
      <p className="cfg-lede">{plan.description}</p>
      <ul className="cfg-facts">
        <li>
          <strong>{entitlement}</strong>
        </li>
        <li>every {plan.billingPeriodDays} days</li>
        <li>{plan.paymentFlow === 'recurring' ? 'renews automatically' : 'one-time payment'}</li>
      </ul>
    </header>
  );

  const included =
    meals.fixed.length > 0 ? (
      <section className="cfg-included" aria-labelledby="cfg-included-title">
        <h2 id="cfg-included-title" className="cfg-section-title">
          What is in it
        </h2>
        <ul className="cfg-included-list">
          {meals.fixed.map((product) => (
            <li key={product.id} className="cfg-dish">
              {product.imageUrl ? (
                <span className="cfg-thumb">
                  <Image src={product.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                </span>
              ) : null}
              <span className="min-w-0">
                <span className="cfg-dish-name block">{product.name}</span>
                <span className="cfg-dish-meta block">
                  {[
                    product.calories ? `${product.calories} kcal` : null,
                    product.proteinGrams ? `${Number(product.proteinGrams)} g protein` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || product.shortDescription}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <div className="cfg-page landing-container">
      <div className="cfg-topbar">
        <Link href="/subscriptions" className="co-link">
          <ArrowLeftIcon />
          All plans
        </Link>
        <FlowProgress current={1} />
      </div>

      {/* An empty element rather than `null`. A null fallback is not counted as
          a placeholder, and the boundary then reads as a `searchParams` access
          with nothing to stream behind it -- which Next reports in development
          as data that stops this route navigating instantly. `hidden` keeps it
          out of the layout and out of the accessibility tree. */}
      <Suspense fallback={<div hidden />}>
        <ConfigurationError searchParams={searchParams} />
      </Suspense>

      <PlanConfigurator
        plan={plan}
        selectableMeals={meals.selectable}
        action={continueToCheckout}
        offer={autoOffer ? { code: autoOffer.code, name: autoOffer.name } : null}
        header={header}
        included={included}
      />
    </div>
  );
}
