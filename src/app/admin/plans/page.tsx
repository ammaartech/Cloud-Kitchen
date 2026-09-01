import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { revalidateStorefront } from '@/lib/data/catalog-cache';
import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { money, PLAN_TYPE_LABELS, pluralise } from '@/lib/format';
import { num, nullableNum, slugify, str } from '@/lib/admin/form';
import { ActionFeedback, done, fail, readable } from '@/lib/admin/feedback';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  Input,
  SectionHeading,
  Select,
} from '@/components/ui/primitives';

export const metadata = { title: 'Plans' };
export const dynamic = 'force-dynamic';

const PATH = '/admin/plans';

interface PlanRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  plan_type: string;
  price: string;
  payment_flow: string;
  billing_period_days: number;
  meals_per_cycle: number | null;
  credits_per_cycle: number | null;
  is_published: boolean;
  is_active: boolean;
  archived_at: string | null;
  sort_order: number;
}

/** What a plan hands the customer each cycle, in one phrase. */
function entitlement(plan: PlanRow): string {
  if (plan.plan_type === 'meal_credits') {
    return `${pluralise(plan.credits_per_cycle ?? 0, 'credit')} per cycle`;
  }
  return `${pluralise(plan.meals_per_cycle ?? 0, 'meal')} per cycle`;
}

/**
 * Subscription plans (PRD 7, PRD 13).
 *
 * The Owner creates the real commercial plans here; the storefront only ever
 * shows published, active ones. Creating a plan asks for the commercial
 * minimum -- name, shape, price, cycle, entitlement -- and everything else
 * (menu, windows, pause and skip overrides) lives in the editor, so step one
 * is never a wall of forty fields.
 */
export default async function PlansPage({ searchParams }: PageProps<'/admin/plans'>) {
  await requirePermission(PERMISSIONS.plansManage);
  const params = await searchParams;
  const supabase = await serverClient();

  const [plansResult, subscriptionsResult] = await Promise.all([
    supabase
      .from('subscription_plans')
      .select(
        `id, slug, name, tagline, plan_type, price, payment_flow, billing_period_days,
         meals_per_cycle, credits_per_cycle, is_published, is_active, archived_at, sort_order`,
      )
      .order('sort_order'),
    supabase.from('subscriptions').select('plan_id, status'),
  ]);

  const plans = (plansResult.data ?? []) as unknown as PlanRow[];
  const subscriptions = (subscriptionsResult.data ?? []) as Array<{
    plan_id: string;
    status: string;
  }>;

  // Live subscribers per plan -- the reason a plan is archived, never deleted.
  const liveCount = new Map<string, number>();
  for (const subscription of subscriptions) {
    if (!['active', 'paused', 'past_due'].includes(subscription.status)) continue;
    liveCount.set(subscription.plan_id, (liveCount.get(subscription.plan_id) ?? 0) + 1);
  }

  async function createPlan(formData: FormData) {
    'use server';

    const name = str(formData, 'name');
    if (!name) fail(PATH, 'A plan needs a name.');

    const planType = str(formData, 'planType');
    const meals = nullableNum(formData, 'mealsPerCycle');
    const credits = nullableNum(formData, 'creditsPerCycle');

    // The database enforces this too; catching it here produces a sentence
    // rather than a constraint name.
    if (planType === 'meal_credits' && !credits) {
      fail(PATH, 'A meal-credits plan needs a number of credits per cycle.');
    }
    if (planType !== 'meal_credits' && !meals) {
      fail(PATH, 'This plan shape needs a number of meals per cycle.');
    }

    const db = await serverClient();
    const { data, error } = await db
      .from('subscription_plans')
      .insert({
        slug: str(formData, 'slug') || slugify(name),
        name,
        plan_type: planType,
        price: num(formData, 'price'),
        payment_flow: str(formData, 'paymentFlow'),
        billing_period_days: num(formData, 'billingPeriodDays', 30),
        meals_per_cycle: planType === 'meal_credits' ? null : meals,
        credits_per_cycle: planType === 'meal_credits' ? credits : null,
        selectable_meal_count: planType === 'customer_selected' ? meals : null,
        // A new plan is never live. It is published from the editor once its
        // menu and windows actually exist.
        is_published: false,
      })
      .select('id')
      .single();

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    done(`${PATH}/${data!.id}`, 'Plan created. Add its menu and windows, then publish.');
  }

  async function setPublished(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('subscription_plans')
      .update({ is_published: str(formData, 'publish') === 'true' })
      .eq('id', str(formData, 'planId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/subscriptions');
    revalidateStorefront('/meal-plans');
  }

  async function setArchived(formData: FormData) {
    'use server';

    const archive = str(formData, 'archive') === 'true';

    const db = await serverClient();
    const { error } = await db
      .from('subscription_plans')
      .update({
        archived_at: archive ? new Date().toISOString() : null,
        // Archiving has to take it off the storefront too, or a "deleted" plan
        // carries on selling.
        ...(archive ? { is_published: false } : {}),
      })
      .eq('id', str(formData, 'planId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/subscriptions');
  }

  const live = plans.filter((plan) => !plan.archived_at);
  const archived = plans.filter((plan) => plan.archived_at);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SectionHeading
        title="Subscription plans"
        description="These are the real commercial plans customers buy. Only published, active plans reach the storefront."
      />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      {/* ------------------------------------------------------------------ */}
      {/* Create                                                              */}
      {/* ------------------------------------------------------------------ */}
      <Card className="mb-8 p-5">
        <h2 className="mb-4 font-semibold">New plan</h2>

        <form action={createPlan} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" required>
            <Input name="name" placeholder="Weekday Lunch" required />
          </Field>

          <Field label="Plan shape" required hint="Decides how entitlement works.">
            <Select name="planType" defaultValue="fixed_meals">
              <option value="fixed_meals">Fixed menu</option>
              <option value="meal_credits">Meal credits</option>
              <option value="scheduled_meals">Scheduled menu</option>
              <option value="customer_selected">Customer chooses</option>
            </Select>
          </Field>

          <Field label="Price" required>
            <Input name="price" inputMode="decimal" defaultValue="0" required />
          </Field>

          <Field label="Billing" required>
            <Select name="paymentFlow" defaultValue="one_time">
              <option value="one_time">One-time</option>
              <option value="recurring">Recurring</option>
            </Select>
          </Field>

          <Field label="Cycle length (days)" required>
            <Input name="billingPeriodDays" inputMode="numeric" defaultValue="30" required />
          </Field>

          <Field label="Meals per cycle" hint="Every shape except meal credits.">
            <Input name="mealsPerCycle" inputMode="numeric" placeholder="20" />
          </Field>

          <Field label="Credits per cycle" hint="Meal-credits plans only.">
            <Input name="creditsPerCycle" inputMode="numeric" placeholder="20" />
          </Field>

          <div className="flex items-end">
            <Button type="submit">Create plan</Button>
          </div>
        </form>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Live plans                                                          */}
      {/* ------------------------------------------------------------------ */}
      {live.length === 0 ? (
        <EmptyState
          title="No plans yet"
          description="Create one above. Nothing is sellable until a plan exists and is published."
        />
      ) : (
        <div className="space-y-3">
          {live.map((plan) => {
            const subscribers = liveCount.get(plan.id) ?? 0;

            return (
              <Card key={plan.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/plans/${plan.id}`}
                        className="font-semibold hover:underline"
                      >
                        {plan.name}
                      </Link>
                      {plan.is_published ? (
                        <Badge tone="success">Published</Badge>
                      ) : (
                        <Badge tone="neutral">Draft</Badge>
                      )}
                      {!plan.is_active ? <Badge tone="warning">Inactive</Badge> : null}
                      <Badge tone="accent">
                        {PLAN_TYPE_LABELS[plan.plan_type] ?? plan.plan_type}
                      </Badge>
                    </div>

                    <p className="mt-0.5 text-xs text-subtle">
                      {plan.slug} · {entitlement(plan)} · every {plan.billing_period_days} days ·{' '}
                      {plan.payment_flow === 'recurring' ? 'recurring' : 'one-time'}
                    </p>

                    {subscribers > 0 ? (
                      <p className="mt-1 text-xs text-muted">
                        {pluralise(subscribers, 'live subscription')} on this plan.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-2 font-semibold tabular">{money(plan.price)}</span>

                    <ButtonLink href={`/admin/plans/${plan.id}`} variant="secondary" size="sm">Edit</ButtonLink>

                    <form action={setPublished}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <input
                        type="hidden"
                        name="publish"
                        value={plan.is_published ? 'false' : 'true'}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant={plan.is_published ? 'ghost' : 'primary'}
                      >
                        {plan.is_published ? 'Unpublish' : 'Publish'}
                      </Button>
                    </form>

                    <form action={setArchived}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <input type="hidden" name="archive" value="true" />
                      <Button type="submit" size="sm" variant="danger">
                        Delete
                      </Button>
                    </form>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs text-subtle">
        Deleting archives the plan rather than removing the row, so existing subscriptions keep a
        readable record of what their owner actually bought.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* Archived                                                            */}
      {/* ------------------------------------------------------------------ */}
      {archived.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-subtle uppercase">
            Archived
          </h2>
          <Card className="divide-y divide-line">
            {archived.map((plan) => (
              <div key={plan.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="font-medium text-muted">{plan.name}</span>
                <span className="text-xs text-subtle">{plan.slug}</span>
                <form action={setArchived} className="ml-auto">
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="archive" value="false" />
                  <Button type="submit" size="sm" variant="secondary">
                    Restore
                  </Button>
                </form>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
