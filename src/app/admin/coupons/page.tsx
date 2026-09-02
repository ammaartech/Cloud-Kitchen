import { revalidatePath } from 'next/cache';
import { revalidateStorefront } from '@/lib/data/catalog-cache';
import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { dateTime, money } from '@/lib/format';
import { bool, codify, list, nullableNum, num, str } from '@/lib/admin/form';
import { ActionFeedback, done, fail, readable } from '@/lib/admin/feedback';

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
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  Input,
  SectionHeading,
  Select,
  Textarea,
} from '@/components/ui/primitives';

export const metadata = { title: 'Offers' };

const PATH = '/admin/coupons';

/**
 * The business day runs on Asia/Kolkata (PRD 10), so a date the Owner types is
 * anchored to that zone rather than to whatever zone the server happens to be
 * in. Without this, "valid until 31 March" quietly expires at 5:30am on the
 * 31st for a UTC deployment.
 */
const IST_OFFSET = '+05:30';

function startOfBusinessDay(date: string | null): string | null {
  return date ? `${date}T00:00:00${IST_OFFSET}` : null;
}

function endOfBusinessDay(date: string | null): string | null {
  return date ? `${date}T23:59:59${IST_OFFSET}` : null;
}

/** ISO timestamp back to the `yyyy-mm-dd` an `<input type="date">` wants. */
function dateInputValue(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

interface CouponRow {
  id: string;
  code: string;
  name: string;
  description: string;
  discount_type: string;
  discount_value: string;
  max_discount_amount: string | null;
  min_order_amount: string;
  applies_to: string;
  per_customer_limit: number | null;
  total_usage_limit: number | null;
  times_redeemed: number;
  is_auto_visible: boolean;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
}

interface RuleRow {
  id: string;
  coupon_id: string;
  rule_type: string;
  config: Record<string, unknown>;
}

const RULE_LABELS: Record<string, string> = {
  first_subscription: 'Only on a customer’s first subscription',
  new_customer_only: 'Only for customers who have never ordered',
  plan_in: 'Only on specific plans',
  source_in: 'Only on specific channels',
  customer_in: 'Only for specific customers',
};

/** A rule row in one readable sentence, so eligibility is never a guess. */
function describeRule(rule: RuleRow, planNames: Map<string, string>): string {
  const label = RULE_LABELS[rule.rule_type] ?? rule.rule_type;

  if (rule.rule_type === 'plan_in') {
    const ids = (rule.config.plan_ids as string[] | undefined) ?? [];
    return `${label}: ${ids.map((id) => planNames.get(id) ?? id).join(', ') || 'none set'}`;
  }
  if (rule.rule_type === 'source_in') {
    const sources = (rule.config.sources as string[] | undefined) ?? [];
    return `${label}: ${sources.join(', ') || 'none set'}`;
  }
  if (rule.rule_type === 'customer_in') {
    const ids = (rule.config.customer_ids as string[] | undefined) ?? [];
    return `${label}: ${ids.length} account(s)`;
  }
  return label;
}

/**
 * Offers and coupons (PRD 14).
 *
 * Everything a coupon can do is a row: its percentage, its caps, its window
 * and its eligibility rules. The 5% first-subscription offer is one of these
 * rows, not a constant -- which is why it can be retuned or retired here
 * without a deploy. Eligibility is still decided by `validate_coupon()` on the
 * server at checkout; this screen only decides what the rules are.
 */
export default async function CouponsPage({ searchParams }: PageProps<'/admin/coupons'>) {
  await requirePermission(PERMISSIONS.couponsManage);
  const params = await searchParams;
  const supabase = await serverClient();

  const [couponsResult, rulesResult, plansResult] = await Promise.all([
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    supabase.from('coupon_rules').select('id, coupon_id, rule_type, config'),
    supabase
      .from('subscription_plans')
      .select('id, name')
      .is('archived_at', null)
      .order('sort_order'),
  ]);

  const coupons = (couponsResult.data ?? []) as unknown as CouponRow[];
  const rules = (rulesResult.data ?? []) as unknown as RuleRow[];
  const plans = (plansResult.data ?? []) as Array<{ id: string; name: string }>;
  const planNames = new Map(plans.map((plan) => [plan.id, plan.name]));

  const rulesByCoupon = new Map<string, RuleRow[]>();
  for (const rule of rules) {
    rulesByCoupon.set(rule.coupon_id, [...(rulesByCoupon.get(rule.coupon_id) ?? []), rule]);
  }

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  async function createCoupon(formData: FormData) {
    'use server';

    const name = str(formData, 'name');
    const code = codify(str(formData, 'code') || name);
    if (!name || !code) fail(PATH, 'An offer needs a name and a code.');

    const discountValue = num(formData, 'discountValue');
    if (discountValue <= 0) fail(PATH, 'The discount has to be greater than zero.');
    if (str(formData, 'discountType') === 'percent' && discountValue > 100) {
      fail(PATH, 'A percentage discount cannot exceed 100%.');
    }

    const db = await serverClient();
    const { error } = await db.from('coupons').insert({
      code,
      name,
      description: str(formData, 'description'),
      discount_type: str(formData, 'discountType'),
      discount_value: discountValue,
      max_discount_amount: nullableNum(formData, 'maxDiscountAmount'),
      min_order_amount: num(formData, 'minOrderAmount'),
      applies_to: str(formData, 'appliesTo'),
      per_customer_limit: nullableNum(formData, 'perCustomerLimit'),
      total_usage_limit: nullableNum(formData, 'totalUsageLimit'),
      is_auto_visible: bool(formData, 'isAutoVisible'),
      valid_from: startOfBusinessDay(str(formData, 'validFrom') || null) ?? new Date().toISOString(),
      valid_until: endOfBusinessDay(str(formData, 'validUntil') || null),
      is_active: true,
    });

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/offers');
    done(PATH, `Offer ${code} created.`);
  }

  async function updateCoupon(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('coupons')
      .update({
        name: str(formData, 'name'),
        description: str(formData, 'description'),
        discount_value: num(formData, 'discountValue'),
        max_discount_amount: nullableNum(formData, 'maxDiscountAmount'),
        min_order_amount: num(formData, 'minOrderAmount'),
        per_customer_limit: nullableNum(formData, 'perCustomerLimit'),
        total_usage_limit: nullableNum(formData, 'totalUsageLimit'),
        is_auto_visible: bool(formData, 'isAutoVisible'),
        valid_until: endOfBusinessDay(str(formData, 'validUntil') || null),
      })
      .eq('id', str(formData, 'couponId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/offers');
    done(PATH, 'Offer updated.');
  }

  async function setActive(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db
      .from('coupons')
      .update({ is_active: str(formData, 'active') === 'true' })
      .eq('id', str(formData, 'couponId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/offers');
  }

  async function deleteCoupon(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db.from('coupons').delete().eq('id', str(formData, 'couponId'));

    // A redeemed coupon is referenced by a redemption row on purpose: deleting
    // it would erase the discount someone actually received.
    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    revalidateStorefront('/offers');
    done(PATH, 'Offer deleted.');
  }

  async function addRule(formData: FormData) {
    'use server';

    const ruleType = str(formData, 'ruleType');
    let config: Record<string, unknown> = {};

    if (ruleType === 'plan_in') {
      const planIds = list(formData, 'planId');
      if (planIds.length === 0) fail(PATH, 'Pick at least one plan for that rule.');
      config = { plan_ids: planIds };
    } else if (ruleType === 'source_in') {
      const sources = list(formData, 'source');
      if (sources.length === 0) fail(PATH, 'Pick at least one channel for that rule.');
      config = { sources };
    } else if (ruleType === 'customer_in') {
      const ids = str(formData, 'customerIds')
        .split(/[\s,]+/)
        .filter(Boolean);
      if (ids.length === 0) fail(PATH, 'Paste at least one customer ID for that rule.');
      config = { customer_ids: ids };
    }

    const db = await serverClient();
    const { error } = await db.from('coupon_rules').insert({
      coupon_id: str(formData, 'couponId'),
      rule_type: ruleType,
      config,
    });

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    done(PATH, 'Eligibility rule added.');
  }

  async function removeRule(formData: FormData) {
    'use server';

    const db = await serverClient();
    const { error } = await db.from('coupon_rules').delete().eq('id', str(formData, 'ruleId'));

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SectionHeading
        title="Offers"
        description="Discounts, their limits and who qualifies. Eligibility is re-checked on the server at checkout — nothing here is trusted from the browser."
      />

      <ActionFeedback error={params.error as string} ok={params.ok as string} />

      {/* ------------------------------------------------------------------ */}
      {/* Create                                                              */}
      {/* ------------------------------------------------------------------ */}
      <Card className="mb-8 p-5">
        <h2 className="mb-4 font-semibold">New offer</h2>

        <form action={createCoupon} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" required>
            <Input name="name" placeholder="First subscription" required />
          </Field>

          <Field label="Code" hint="Left blank, it is derived from the name.">
            <Input name="code" placeholder="FIRST5" />
          </Field>

          <Field label="Discount type" required>
            <Select name="discountType" defaultValue="percent">
              <option value="percent">Percentage</option>
              <option value="fixed_amount">Fixed amount</option>
            </Select>
          </Field>

          <Field label="Discount value" required>
            <Input name="discountValue" inputMode="decimal" placeholder="5" required />
          </Field>

          <Field label="Applies to" required>
            <Select name="appliesTo" defaultValue="subscription">
              <option value="subscription">Subscriptions</option>
              <option value="order">Orders</option>
              <option value="all">Everything</option>
            </Select>
          </Field>

          <Field label="Max discount" hint="Caps a percentage. Blank = uncapped.">
            <Input name="maxDiscountAmount" inputMode="decimal" />
          </Field>

          <Field label="Minimum order">
            <Input name="minOrderAmount" inputMode="decimal" defaultValue="0" />
          </Field>

          <Field label="Per-customer limit" hint="Blank = unlimited.">
            <Input name="perCustomerLimit" inputMode="numeric" />
          </Field>

          <Field label="Total usage limit" hint="Blank = unlimited.">
            <Input name="totalUsageLimit" inputMode="numeric" />
          </Field>

          <Field label="Valid from" hint="Blank = right now.">
            <Input name="validFrom" type="date" />
          </Field>

          <Field label="Valid until" hint="Blank = no expiry.">
            <Input name="validUntil" type="date" />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea name="description" className="min-h-10" />
            </Field>
          </div>

          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" name="isAutoVisible" className="h-4 w-4" />
            Show as already unlocked
          </label>

          <div className="flex items-end">
            <Button type="submit">Create offer</Button>
          </div>
        </form>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Existing offers                                                     */}
      {/* ------------------------------------------------------------------ */}
      {coupons.length === 0 ? (
        <EmptyState title="No offers yet" description="Create one above." />
      ) : (
        <div className="space-y-4">
          {coupons.map((coupon) => {
            const couponRules = rulesByCoupon.get(coupon.id) ?? [];
            const expired =
              coupon.valid_until !== null && new Date(coupon.valid_until) <= new Date();
            const exhausted =
              coupon.total_usage_limit !== null &&
              coupon.times_redeemed >= coupon.total_usage_limit;

            return (
              <Card key={coupon.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-ck border border-line bg-sunken px-2 py-0.5 font-mono text-sm font-semibold">
                        {coupon.code}
                      </span>
                      <span className="font-semibold">{coupon.name}</span>
                      {coupon.is_active ? (
                        <Badge tone="success">Active</Badge>
                      ) : (
                        <Badge tone="neutral">Paused</Badge>
                      )}
                      {expired ? <Badge tone="danger">Expired</Badge> : null}
                      {exhausted ? <Badge tone="warning">Limit reached</Badge> : null}
                      {coupon.is_auto_visible ? <Badge tone="accent">Shown unlocked</Badge> : null}
                    </div>

                    <p className="mt-1 text-sm text-muted">
                      {coupon.discount_type === 'percent'
                        ? `${Number(coupon.discount_value)}% off`
                        : `${money(coupon.discount_value)} off`}
                      {coupon.max_discount_amount
                        ? `, capped at ${money(coupon.max_discount_amount)}`
                        : ''}
                      {Number(coupon.min_order_amount) > 0
                        ? `, minimum ${money(coupon.min_order_amount)}`
                        : ''}{' '}
                      · {coupon.applies_to}
                    </p>

                    <p className="mt-0.5 text-xs text-subtle">
                      Redeemed {coupon.times_redeemed}
                      {coupon.total_usage_limit ? ` of ${coupon.total_usage_limit}` : ''} ·{' '}
                      {coupon.per_customer_limit
                        ? `${coupon.per_customer_limit} per customer`
                        : 'unlimited per customer'}{' '}
                      · from {dateTime(coupon.valid_from)}
                      {coupon.valid_until ? ` until ${dateTime(coupon.valid_until)}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <form action={setActive}>
                      <input type="hidden" name="couponId" value={coupon.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={coupon.is_active ? 'false' : 'true'}
                      />
                      <Button type="submit" size="sm" variant={coupon.is_active ? 'ghost' : 'primary'}>
                        {coupon.is_active ? 'Pause' : 'Activate'}
                      </Button>
                    </form>

                    <form action={deleteCoupon}>
                      <input type="hidden" name="couponId" value={coupon.id} />
                      <ConfirmButton confirmLabel="Really delete?">Delete</ConfirmButton>
                    </form>
                  </div>
                </div>

                {/* ---------------------------------------------------- */}
                {/* Edit                                                  */}
                {/* ---------------------------------------------------- */}
                <form
                  action={updateCoupon}
                  className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4"
                >
                  <input type="hidden" name="couponId" value={coupon.id} />

                  <Field label="Name">
                    <Input name="name" defaultValue={coupon.name} />
                  </Field>

                  <Field label="Discount value">
                    <Input
                      name="discountValue"
                      defaultValue={coupon.discount_value}
                      inputMode="decimal"
                    />
                  </Field>

                  <Field label="Max discount">
                    <Input
                      name="maxDiscountAmount"
                      defaultValue={coupon.max_discount_amount ?? ''}
                      inputMode="decimal"
                      placeholder="uncapped"
                    />
                  </Field>

                  <Field label="Minimum order">
                    <Input
                      name="minOrderAmount"
                      defaultValue={coupon.min_order_amount}
                      inputMode="decimal"
                    />
                  </Field>

                  <Field label="Per-customer limit">
                    <Input
                      name="perCustomerLimit"
                      defaultValue={coupon.per_customer_limit ?? ''}
                      inputMode="numeric"
                      placeholder="unlimited"
                    />
                  </Field>

                  <Field label="Total usage limit">
                    <Input
                      name="totalUsageLimit"
                      defaultValue={coupon.total_usage_limit ?? ''}
                      inputMode="numeric"
                      placeholder="unlimited"
                    />
                  </Field>

                  <Field label="Valid until">
                    <Input
                      name="validUntil"
                      type="date"
                      defaultValue={dateInputValue(coupon.valid_until)}
                    />
                  </Field>

                  <div className="sm:col-span-2 lg:col-span-4">
                    <Field label="Description">
                      <Textarea
                        name="description"
                        defaultValue={coupon.description}
                        className="min-h-10"
                      />
                    </Field>
                  </div>

                  <label className="flex items-center gap-2 self-end text-sm">
                    <input
                      type="checkbox"
                      name="isAutoVisible"
                      defaultChecked={coupon.is_auto_visible}
                      className="h-4 w-4"
                    />
                    Show as already unlocked
                  </label>

                  <div className="flex items-end">
                    <Button type="submit" variant="secondary" size="sm">
                      Save offer
                    </Button>
                  </div>
                </form>

                {/* ---------------------------------------------------- */}
                {/* Eligibility rules                                     */}
                {/* ---------------------------------------------------- */}
                <div className="mt-5 border-t border-line pt-5">
                  <p className="mb-2 text-xs font-medium text-subtle">Eligibility rules</p>

                  {couponRules.length === 0 ? (
                    <p className="text-sm text-muted">
                      No extra rules — anyone within the limits above qualifies.
                    </p>
                  ) : (
                    <ul className="mb-3 space-y-1">
                      {couponRules.map((rule) => (
                        <li
                          key={rule.id}
                          className="flex items-center gap-3 rounded-ck border border-line px-3 py-1.5 text-sm"
                        >
                          <span>{describeRule(rule, planNames)}</span>
                          <form action={removeRule} className="ml-auto">
                            <input type="hidden" name="ruleId" value={rule.id} />
                            <ConfirmButton confirmLabel="Really remove?">Remove</ConfirmButton>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}

                  <form action={addRule} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <input type="hidden" name="couponId" value={coupon.id} />

                    <Field label="Add rule">
                      <Select name="ruleType" defaultValue="first_subscription">
                        {Object.entries(RULE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Plans" hint="For the “specific plans” rule.">
                      <Select name="planId" multiple size={3} className="min-h-20">
                        {plans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Channels" hint="For the “specific channels” rule.">
                      <Select name="source" multiple size={3} className="min-h-20">
                        <option value="SX">Website</option>
                        <option value="SW">Swiggy</option>
                        <option value="ZM">Zomato</option>
                      </Select>
                    </Field>

                    <div className="flex flex-col justify-end gap-2">
                      <Field label="Customer IDs" hint="Comma or space separated.">
                        <Input name="customerIds" placeholder="uuid, uuid" />
                      </Field>
                      <Button type="submit" size="sm" variant="secondary">
                        Add rule
                      </Button>
                    </div>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
