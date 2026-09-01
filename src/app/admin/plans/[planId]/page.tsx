import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { revalidateStorefront } from '@/lib/data/catalog-cache';
import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { clockTime, money, weekdayName, PLAN_TYPE_LABELS } from '@/lib/format';
import { bool, list, nullableBool, nullableNum, num, str } from '@/lib/admin/form';
import { ActionFeedback, done, fail, readable } from '@/lib/admin/feedback';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmButton,
  Field,
  Input,
  SectionHeading,
  Select,
  Textarea,
} from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/admin/plans/[planId]'>) {
  const { planId } = await params;
  const supabase = await serverClient();
  const { data } = await supabase
    .from('subscription_plans')
    .select('name')
    .eq('id', planId)
    .maybeSingle();

  return { title: data ? `${(data as { name: string }).name} · Plan` : 'Plan' };
}

interface Plan {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  image_url: string | null;
  plan_type: string;
  price: string;
  payment_flow: string;
  billing_period_days: number;
  meals_per_cycle: number | null;
  credits_per_cycle: number | null;
  selectable_meal_count: number | null;
  allows_variants: boolean;
  allows_add_ons: boolean;
  allows_address_override: boolean;
  grace_period_days: number | null;
  max_pauses_per_period: number | null;
  max_pause_days: number | null;
  skip_returns_credit: boolean | null;
  is_published: boolean;
  is_active: boolean;
  archived_at: string | null;
  sort_order: number;
}

/**
 * Plan editor (PRD 7, PRD 13).
 *
 * Three separable jobs live here, deliberately as three forms rather than one:
 * the commercial terms, the rule overrides, and the plan's actual menu. Saving
 * a price should not require re-submitting the menu, and an Owner adjusting a
 * pause limit should not be able to blank a delivery window by accident.
 *
 * Editing a plan never rewrites what an existing customer bought -- purchases
 * carry a frozen `plan_snapshot` (see 0006).
 */
export default async function PlanEditorPage({
  params,
  searchParams,
}: PageProps<'/admin/plans/[planId]'>) {
  await requirePermission(PERMISSIONS.plansManage);

  const { planId } = await params;
  const query = await searchParams;
  const path = `/admin/plans/${planId}`;
  const supabase = await serverClient();

  const [planResult, windowsResult, planWindowsResult, mealsResult, productsResult, subsResult] =
    await Promise.all([
      supabase.from('subscription_plans').select('*').eq('id', planId).maybeSingle(),
      supabase
        .from('delivery_windows')
        .select('id, code, label, starts_at, ends_at, is_active')
        .order('sort_order'),
      supabase.from('subscription_plan_windows').select('delivery_window_id').eq('plan_id', planId),
      supabase
        .from('subscription_plan_meals')
        .select(
          'id, product_id, day_of_week, delivery_window_id, quantity, is_selectable, sort_order, products ( name, credit_cost )',
        )
        .eq('plan_id', planId)
        .order('sort_order'),
      supabase
        .from('products')
        .select('id, name, credit_cost, is_available')
        .is('archived_at', null)
        .order('sort_order'),
      supabase.from('subscriptions').select('id, status').eq('plan_id', planId),
    ]);

  const plan = planResult.data as Plan | null;
  if (!plan) notFound();

  const windows = (windowsResult.data ?? []) as Array<{
    id: string;
    code: string;
    label: string;
    starts_at: string;
    ends_at: string;
    is_active: boolean;
  }>;

  const selectedWindows = new Set(
    ((planWindowsResult.data ?? []) as Array<{ delivery_window_id: string }>).map(
      (row) => row.delivery_window_id,
    ),
  );

  const meals = (mealsResult.data ?? []) as unknown as Array<{
    id: string;
    product_id: string;
    day_of_week: number | null;
    delivery_window_id: string | null;
    quantity: number;
    is_selectable: boolean;
    products: { name: string; credit_cost: number } | null;
  }>;

  const products = (productsResult.data ?? []) as Array<{
    id: string;
    name: string;
    credit_cost: number;
    is_available: boolean;
  }>;

  const liveSubscribers = ((subsResult.data ?? []) as Array<{ status: string }>).filter((row) =>
    ['active', 'paused', 'past_due'].includes(row.status),
  ).length;

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  async function saveDetails(formData: FormData) {
    'use server';

    const planType = str(formData, 'planType');
    const mealsPerCycle = nullableNum(formData, 'mealsPerCycle');
    const creditsPerCycle = nullableNum(formData, 'creditsPerCycle');

    if (planType === 'meal_credits' && !creditsPerCycle) {
      fail(path, 'A meal-credits plan needs a number of credits per cycle.');
    }
    if (planType !== 'meal_credits' && !mealsPerCycle) {
      fail(path, 'This plan shape needs a number of meals per cycle.');
    }

    const db = await serverClient();
    const { error } = await db
      .from('subscription_plans')
      .update({
        name: str(formData, 'name'),
        slug: str(formData, 'slug'),
        tagline: str(formData, 'tagline'),
        description: str(formData, 'description'),
        image_url: str(formData, 'imageUrl') || null,
        plan_type: planType,
        price: num(formData, 'price'),
        payment_flow: str(formData, 'paymentFlow'),
        billing_period_days: num(formData, 'billingPeriodDays', 30),
        meals_per_cycle: planType === 'meal_credits' ? null : mealsPerCycle,
        credits_per_cycle: planType === 'meal_credits' ? creditsPerCycle : null,
        selectable_meal_count:
          planType === 'customer_selected' ? nullableNum(formData, 'selectableMealCount') : null,
        sort_order: num(formData, 'sortOrder'),
      })
      .eq('id', planId);

    if (error) fail(path, readable(error));

    revalidatePath(path);
    revalidateStorefront('/subscriptions');
    done(path, 'Plan details saved.');
  }

  async function saveRules(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('subscription_plans')
      .update({
        allows_variants: bool(formData, 'allowsVariants'),
        allows_add_ons: bool(formData, 'allowsAddOns'),
        allows_address_override: bool(formData, 'allowsAddressOverride'),
        // Blank means "inherit the global setting" -- genuinely different from
        // zero, which would be a policy of its own.
        grace_period_days: nullableNum(formData, 'gracePeriodDays'),
        max_pauses_per_period: nullableNum(formData, 'maxPausesPerPeriod'),
        max_pause_days: nullableNum(formData, 'maxPauseDays'),
        skip_returns_credit: nullableBool(formData, 'skipReturnsCredit'),
      })
      .eq('id', planId);

    if (error) fail(path, readable(error));

    revalidatePath(path);
    done(path, 'Subscription rules saved.');
  }

  async function saveWindows(formData: FormData) {
    'use server';

    const chosen = list(formData, 'windowId');
    const db = await serverClient();

    // Replace rather than diff: the form always submits the complete set, and
    // a partial update here would leave a plan sellable in a window the Owner
    // just unticked.
    const { error: clearError } = await db
      .from('subscription_plan_windows')
      .delete()
      .eq('plan_id', planId);

    if (clearError) fail(path, readable(clearError));

    if (chosen.length > 0) {
      const { error } = await db
        .from('subscription_plan_windows')
        .insert(chosen.map((windowId) => ({ plan_id: planId, delivery_window_id: windowId })));

      if (error) fail(path, readable(error));
    }

    revalidatePath(path);
    revalidateStorefront('/subscriptions');
    done(path, 'Delivery windows saved.');
  }

  async function addMeal(formData: FormData) {
    'use server';

    const productId = str(formData, 'productId');
    if (!productId) fail(path, 'Pick a dish to add.');

    const db = await serverClient();
    const { error } = await db.from('subscription_plan_meals').insert({
      plan_id: planId,
      product_id: productId,
      day_of_week: nullableNum(formData, 'dayOfWeek'),
      delivery_window_id: str(formData, 'deliveryWindowId') || null,
      quantity: num(formData, 'quantity', 1),
      is_selectable: bool(formData, 'isSelectable'),
      sort_order: num(formData, 'sortOrder'),
    });

    if (error) fail(path, readable(error));

    revalidatePath(path);
    revalidateStorefront('/subscriptions');
    done(path, 'Dish added to the plan.');
  }

  async function removeMeal(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('subscription_plan_meals')
      .delete()
      .eq('id', str(formData, 'mealId'));

    if (error) fail(path, readable(error));

    revalidatePath(path);
    revalidateStorefront('/subscriptions');
  }

  async function setFlags(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('subscription_plans')
      .update({
        is_published: str(formData, 'isPublished') === 'true',
        is_active: str(formData, 'isActive') === 'true',
      })
      .eq('id', planId);

    if (error) fail(path, readable(error));

    revalidatePath(path);
    revalidatePath('/admin/plans');
    revalidateStorefront('/subscriptions');
    revalidateStorefront('/meal-plans');
  }

  const fixedMeals = meals.filter((meal) => !meal.is_selectable);
  const selectableMeals = meals.filter((meal) => meal.is_selectable);
  const readyToPublish = selectedWindows.size > 0 && (plan.plan_type === 'meal_credits' || meals.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/admin/plans" className="text-sm text-muted hover:text-ink">
        ← All plans
      </Link>

      <div className="mt-3">
        <SectionHeading
          title={plan.name}
          description={
            <>
              {PLAN_TYPE_LABELS[plan.plan_type] ?? plan.plan_type} · {money(plan.price)} · every{' '}
              {plan.billing_period_days} days
              {liveSubscribers > 0 ? ` · ${liveSubscribers} live subscription(s)` : ''}
            </>
          }
          action={
            <form action={setFlags} className="flex items-center gap-2">
              <input
                type="hidden"
                name="isPublished"
                value={plan.is_published ? 'false' : 'true'}
              />
              <input type="hidden" name="isActive" value={String(plan.is_active)} />
              {plan.is_published ? (
                <Badge tone="success">Published</Badge>
              ) : (
                <Badge tone="neutral">Draft</Badge>
              )}
              <Button type="submit" size="sm" variant={plan.is_published ? 'ghost' : 'primary'}>
                {plan.is_published ? 'Unpublish' : 'Publish'}
              </Button>
            </form>
          }
        />
      </div>

      <ActionFeedback error={query.error as string} ok={query.ok as string} />

      {!plan.is_published && !readyToPublish ? (
        <div className="mb-6">
          <Alert tone="warning" title="Not ready to publish">
            A plan needs at least one delivery window
            {plan.plan_type === 'meal_credits' ? '' : ', and at least one dish on its menu'}, or
            customers can buy something the kitchen has no instructions for.
          </Alert>
        </div>
      ) : null}

      {liveSubscribers > 0 ? (
        <div className="mb-6">
          <Alert tone="info">
            {liveSubscribers} live subscription(s) are on this plan. Editing it changes what future
            buyers get — existing subscriptions keep the terms they bought.
          </Alert>
        </div>
      ) : null}

      <div className="space-y-8">
        {/* -------------------------------------------------------------- */}
        {/* Commercial details                                              */}
        {/* -------------------------------------------------------------- */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Plan details
          </h2>

          <Card className="p-5">
            <form action={saveDetails} className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <Input name="name" defaultValue={plan.name} required />
              </Field>

              <Field label="Slug" required hint="Its address on the storefront.">
                <Input name="slug" defaultValue={plan.slug} required />
              </Field>

              <Field label="Tagline">
                <Input name="tagline" defaultValue={plan.tagline} />
              </Field>

              <Field label="Image URL">
                <Input name="imageUrl" defaultValue={plan.image_url ?? ''} placeholder="https://…" />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Description">
                  <Textarea name="description" defaultValue={plan.description} />
                </Field>
              </div>

              <Field label="Plan shape" required>
                <Select name="planType" defaultValue={plan.plan_type}>
                  <option value="fixed_meals">Fixed menu</option>
                  <option value="meal_credits">Meal credits</option>
                  <option value="scheduled_meals">Scheduled menu</option>
                  <option value="customer_selected">Customer chooses</option>
                </Select>
              </Field>

              <Field label="Price" required>
                <Input name="price" defaultValue={plan.price} inputMode="decimal" required />
              </Field>

              <Field label="Billing" required>
                <Select name="paymentFlow" defaultValue={plan.payment_flow}>
                  <option value="one_time">One-time</option>
                  <option value="recurring">Recurring</option>
                </Select>
              </Field>

              <Field label="Cycle length (days)" required>
                <Input
                  name="billingPeriodDays"
                  defaultValue={plan.billing_period_days}
                  inputMode="numeric"
                  required
                />
              </Field>

              <Field label="Meals per cycle" hint="Every shape except meal credits.">
                <Input
                  name="mealsPerCycle"
                  defaultValue={plan.meals_per_cycle ?? ''}
                  inputMode="numeric"
                />
              </Field>

              <Field label="Credits per cycle" hint="Meal-credits plans only.">
                <Input
                  name="creditsPerCycle"
                  defaultValue={plan.credits_per_cycle ?? ''}
                  inputMode="numeric"
                />
              </Field>

              <Field
                label="Dishes the customer picks"
                hint="Customer-chooses plans only: how many from the pool below."
              >
                <Input
                  name="selectableMealCount"
                  defaultValue={plan.selectable_meal_count ?? ''}
                  inputMode="numeric"
                />
              </Field>

              <Field label="Sort order" hint="Lower shows first on the storefront.">
                <Input name="sortOrder" defaultValue={plan.sort_order} inputMode="numeric" />
              </Field>

              <div className="flex items-end sm:col-span-2">
                <Button type="submit">Save details</Button>
              </div>
            </form>
          </Card>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Rules                                                           */}
        {/* -------------------------------------------------------------- */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Subscription rules
          </h2>

          <Card className="p-5">
            <p className="mb-4 text-sm text-muted">
              Leave a number blank to inherit the global rule from Settings. Filling one in
              overrides it for this plan only.
            </p>

            <form action={saveRules} className="grid gap-4 sm:grid-cols-2">
              <Field label="Grace period (days)" hint="How long past due before the plan lapses.">
                <Input
                  name="gracePeriodDays"
                  defaultValue={plan.grace_period_days ?? ''}
                  inputMode="numeric"
                  placeholder="inherit"
                />
              </Field>

              <Field label="Max pauses per period">
                <Input
                  name="maxPausesPerPeriod"
                  defaultValue={plan.max_pauses_per_period ?? ''}
                  inputMode="numeric"
                  placeholder="inherit"
                />
              </Field>

              <Field label="Max pause length (days)">
                <Input
                  name="maxPauseDays"
                  defaultValue={plan.max_pause_days ?? ''}
                  inputMode="numeric"
                  placeholder="inherit"
                />
              </Field>

              <Field label="Skipping returns the credit">
                <Select
                  name="skipReturnsCredit"
                  defaultValue={
                    plan.skip_returns_credit === null ? '' : String(plan.skip_returns_credit)
                  }
                >
                  <option value="">Inherit global setting</option>
                  <option value="true">Yes — return it</option>
                  <option value="false">No — the skip forfeits it</option>
                </Select>
              </Field>

              <div className="space-y-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="allowsVariants"
                    defaultChecked={plan.allows_variants}
                    className="h-4 w-4"
                  />
                  Customers may choose variants
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="allowsAddOns"
                    defaultChecked={plan.allows_add_ons}
                    className="h-4 w-4"
                  />
                  Customers may add add-ons
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="allowsAddressOverride"
                    defaultChecked={plan.allows_address_override}
                    className="h-4 w-4"
                  />
                  Customers may set a different address per delivery
                  <span className="text-xs text-subtle">(pending business approval)</span>
                </label>
              </div>

              <div className="flex items-end sm:col-span-2">
                <Button type="submit" variant="secondary">
                  Save rules
                </Button>
              </div>
            </form>
          </Card>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Delivery windows                                                */}
        {/* -------------------------------------------------------------- */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Delivery windows
          </h2>

          <Card className="p-5">
            <form action={saveWindows}>
              <div className="grid gap-2 sm:grid-cols-3">
                {windows.map((window) => (
                  <label
                    key={window.id}
                    className="flex items-center gap-2 rounded-ck border border-line px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="windowId"
                      value={window.id}
                      defaultChecked={selectedWindows.has(window.id)}
                      className="h-4 w-4"
                    />
                    <span>
                      <span className="font-medium">{window.label}</span>
                      <span className="block text-xs text-subtle">
                        {clockTime(window.starts_at)} – {clockTime(window.ends_at)}
                      </span>
                    </span>
                    {!window.is_active ? <Badge tone="warning">Off</Badge> : null}
                  </label>
                ))}
              </div>

              <Button type="submit" variant="secondary" size="sm" className="mt-4">
                Save windows
              </Button>
            </form>
          </Card>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Menu                                                            */}
        {/* -------------------------------------------------------------- */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Plan menu
          </h2>

          <Card className="p-5">
            <p className="mb-4 text-sm text-muted">
              Dishes marked <em>customer choice</em> form the pool a customer-chooses plan picks
              from. Everything else is what the plan delivers regardless.
            </p>

            {meals.length === 0 ? (
              <p className="text-sm text-subtle">Nothing on the menu yet.</p>
            ) : (
              <div className="space-y-5">
                {[
                  { label: 'Included', rows: fixedMeals },
                  { label: 'Customer chooses from', rows: selectableMeals },
                ]
                  .filter((group) => group.rows.length > 0)
                  .map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 text-xs font-medium text-subtle">{group.label}</p>
                      <ul className="divide-y divide-line rounded-ck border border-line">
                        {group.rows.map((meal) => (
                          <li key={meal.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                            <span className="font-medium">{meal.products?.name ?? 'Dish'}</span>
                            <span className="text-xs text-subtle">
                              ×{meal.quantity}
                              {meal.day_of_week !== null
                                ? ` · ${weekdayName(meal.day_of_week)}`
                                : ' · any day'}
                              {meal.delivery_window_id
                                ? ` · ${
                                    windows.find((w) => w.id === meal.delivery_window_id)?.label ??
                                    'window'
                                  }`
                                : ''}
                              {meal.products?.credit_cost
                                ? ` · ${meal.products.credit_cost} credit(s)`
                                : ''}
                            </span>

                            <form action={removeMeal} className="ml-auto">
                              <input type="hidden" name="mealId" value={meal.id} />
                              <ConfirmButton confirmLabel="Really remove?">Remove</ConfirmButton>
                            </form>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}

            <form
              action={addMeal}
              className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-5"
            >
              <Field label="Dish" required>
                <Select name="productId" defaultValue="">
                  <option value="">Choose a dish…</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                      {product.is_available ? '' : ' (unavailable)'}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Day">
                <Select name="dayOfWeek" defaultValue="">
                  <option value="">Any day</option>
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <option key={day} value={day}>
                      {weekdayName(day)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Window">
                <Select name="deliveryWindowId" defaultValue="">
                  <option value="">Plan default</option>
                  {windows.map((window) => (
                    <option key={window.id} value={window.id}>
                      {window.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Quantity">
                <Input name="quantity" defaultValue="1" inputMode="numeric" />
              </Field>

              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isSelectable" className="h-4 w-4" />
                  Customer choice
                </label>
                <Button type="submit" size="sm">
                  Add dish
                </Button>
              </div>
            </form>
          </Card>
        </section>
      </div>
    </div>
  );
}
