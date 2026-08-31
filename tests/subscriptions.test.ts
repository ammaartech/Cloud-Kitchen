import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, actingAs, expectFailure, asService, type Db } from './harness/db';
import {
  MEERA,
  RAHUL,
  CUSTOMER_MEERA,
  CUSTOMER_RAHUL,
  CUSTOMER_SANA,
  ADDRESS_SANA_HOME,
  PLAN_BUILD_YOUR_OWN,
  PRODUCT_BIRYANI,
  PRODUCT_KHICHDI,
  PRODUCT_FISH_THALI,
} from './harness/ids';

let db: Db;

async function subscriptionOf(customerId: string) {
  const [row] = await asService<{ id: string; status: string }>(
    db,
    `select id, status from subscriptions
      where customer_id = $1 and status = 'active' order by created_at limit 1`,
    [customerId],
  );
  return row;
}

async function balance(subscriptionId: string) {
  const [row] = await asService<{ balance: number }>(
    db,
    'select subscription_credit_balance($1) as balance',
    [subscriptionId],
  );
  return row.balance;
}

beforeAll(async () => {
  db = await createTestDb({ seed: true });
});

afterAll(async () => {
  await db?.close();
});

describe('the credit ledger', () => {
  it('derives the balance from entries rather than a mutable column', async () => {
    const subscription = await subscriptionOf(CUSTOMER_RAHUL);

    const entries = await asService<{ entry_type: string; credits: number }>(
      db,
      'select entry_type, credits from subscription_credit_ledger where subscription_id = $1 order by created_at',
      [subscription.id],
    );

    const summed = entries.reduce((total, e) => total + e.credits, 0);
    expect(await balance(subscription.id)).toBe(summed);
    expect(entries[0].entry_type).toBe('grant');
  });

  it('charges a premium meal more credits than a standard one', async () => {
    // Rahul's seeded booking is one biryani (2 credits) + one khichdi (1).
    const [row] = await asService<{ credits: number }>(
      db,
      `select -credits as credits from subscription_credit_ledger
        where entry_type = 'consume'
          and subscription_id = $1 order by created_at limit 1`,
      [(await subscriptionOf(CUSTOMER_RAHUL)).id],
    );
    expect(row.credits).toBe(3);
  });

  it('refuses to overwrite or delete an entry', async () => {
    const message = await expectFailure(() =>
      asService(db, `update subscription_credit_ledger set credits = 999`),
    );
    expect(message).toMatch(/append-only/i);
  });

  it('will not let a booking exceed the available balance', async () => {
    const subscription = await subscriptionOf(CUSTOMER_RAHUL);
    const available = await balance(subscription.id);

    const items = JSON.stringify(
      Array.from({ length: available + 5 }, () => ({
        product_id: PRODUCT_KHICHDI,
        quantity: 1,
      })),
    );

    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: RAHUL }, (tx) =>
        tx.query(
          `select schedule_credit_delivery($1, app.business_date() + 2,
             (select id from delivery_windows where code = 'DINNER'), $2::jsonb)`,
          [subscription.id, items],
        ),
      ),
    );
    expect(message).toMatch(/not enough credits/i);
    expect(await balance(subscription.id)).toBe(available);
  });

  it('will not book an unavailable meal', async () => {
    const subscription = await subscriptionOf(CUSTOMER_RAHUL);

    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: RAHUL }, (tx) =>
        tx.query(
          `select schedule_credit_delivery($1, app.business_date() + 2,
             (select id from delivery_windows where code = 'DINNER'),
             $2::jsonb)`,
          [subscription.id, JSON.stringify([{ product_id: PRODUCT_FISH_THALI, quantity: 1 }])],
        ),
      ),
    );
    expect(message).toMatch(/currently unavailable/i);
  });
});

describe('skipping a delivery', () => {
  it('returns the entitlement as a compensating entry, not an edit', async () => {
    const subscription = await subscriptionOf(CUSTOMER_MEERA);

    const [delivery] = await asService<{ id: string; credits_cost: number }>(
      db,
      `select id, credits_cost from subscription_deliveries
        where subscription_id = $1 and status = 'scheduled'
        order by scheduled_date limit 1`,
      [subscription.id],
    );

    const before = await balance(subscription.id);

    const result = await actingAs(
      db,
      { role: 'authenticated', profileId: MEERA },
      async (tx) => {
        const r = await tx.query<{ result: { credits_returned: number; status: string } }>(
          `select skip_subscription_delivery($1, 'Travelling') as result`,
          [delivery.id],
        );
        return r.rows[0].result;
      },
    );

    expect(result.status).toBe('skipped');
    expect(result.credits_returned).toBe(delivery.credits_cost);
    expect(await balance(subscription.id)).toBe(before + delivery.credits_cost);

    const [reversal] = await asService<{ entry_type: string }>(
      db,
      `select entry_type from subscription_credit_ledger
        where delivery_id = $1 and entry_type = 'reverse'`,
      [delivery.id],
    );
    expect(reversal.entry_type).toBe('reverse');
  });

  it('is idempotent when repeated', async () => {
    const subscription = await subscriptionOf(CUSTOMER_MEERA);
    const [delivery] = await asService<{ id: string }>(
      db,
      `select id from subscription_deliveries
        where subscription_id = $1 and status = 'scheduled'
        order by scheduled_date limit 1`,
      [subscription.id],
    );

    await actingAs(db, { role: 'authenticated', profileId: MEERA }, (tx) =>
      tx.query('select skip_subscription_delivery($1)', [delivery.id]),
    );
    const after = await balance(subscription.id);

    const second = await actingAs(
      db,
      { role: 'authenticated', profileId: MEERA },
      async (tx) => {
        const r = await tx.query<{ result: { noop: boolean } }>(
          'select skip_subscription_delivery($1) as result',
          [delivery.id],
        );
        return r.rows[0].result;
      },
    );

    expect(second.noop).toBe(true);
    expect(await balance(subscription.id)).toBe(after);
  });

  it('cannot skip a delivery that has already reached the kitchen', async () => {
    const [delivery] = await asService<{ id: string }>(
      db,
      `select id from subscription_deliveries where status = 'released' limit 1`,
    );

    const message = await expectFailure(() =>
      asService(db, 'select skip_subscription_delivery($1)', [delivery.id]),
    );
    expect(message).toMatch(/can no longer be skipped/i);
  });
});

describe('pausing', () => {
  it('enforces the configured maximum pause length', async () => {
    const subscription = await subscriptionOf(CUSTOMER_MEERA);
    const [setting] = await asService<{ max_days: number }>(
      db,
      `select app.setting_int('subscription.max_pause_days') as max_days`,
    );

    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: MEERA }, (tx) =>
        tx.query(
          `select pause_subscription($1, app.business_date() + 1,
                                     app.business_date() + 1 + $2::int)`,
          [subscription.id, setting.max_days + 1],
        ),
      ),
    );
    expect(message).toMatch(new RegExp(`may not exceed ${setting.max_days} days`, 'i'));
  });

  it('enforces the configured maximum number of pauses per period', async () => {
    const subscription = await subscriptionOf(CUSTOMER_MEERA);
    const [setting] = await asService<{ max_pauses: number }>(
      db,
      `select app.setting_int('subscription.max_pauses_per_period') as max_pauses`,
    );

    for (let i = 0; i < setting.max_pauses; i += 1) {
      await actingAs(db, { role: 'authenticated', profileId: MEERA }, (tx) =>
        tx.query(
          `select pause_subscription($1, app.business_date() + $2::int,
                                     app.business_date() + $2::int)`,
          [subscription.id, 10 + i * 3],
        ),
      );
    }

    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: MEERA }, (tx) =>
        tx.query(
          `select pause_subscription($1, app.business_date() + 40, app.business_date() + 40)`,
          [subscription.id],
        ),
      ),
    );
    expect(message).toMatch(/pause limit reached/i);
  });

  it('reflects a settings change without a code change', async () => {
    // The rule is provisional pending owner sign-off (PRD 22), so it must be
    // retunable at runtime.
    await asService(
      db,
      `update business_settings set value = '9'::jsonb where key = 'subscription.max_pause_days'`,
    );

    const subscription = await subscriptionOf(CUSTOMER_RAHUL);
    await actingAs(db, { role: 'authenticated', profileId: RAHUL }, (tx) =>
      tx.query(
        `select pause_subscription($1, app.business_date() + 5, app.business_date() + 13)`,
        [subscription.id],
      ),
    );

    const [pause] = await asService<{ n: number }>(
      db,
      'select count(*)::int n from subscription_pauses where subscription_id = $1',
      [subscription.id],
    );
    expect(pause.n).toBe(1);
  });

  it('skips the deliveries that fall inside the pause window', async () => {
    const subscription = await subscriptionOf(CUSTOMER_MEERA);

    const [row] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from subscription_deliveries
        where subscription_id = $1 and status = 'skipped'
          and skip_reason = 'Subscription paused'`,
      [subscription.id],
    );
    expect(row.n).toBeGreaterThan(0);
  });
});

describe('cancellation', () => {
  it('stops future deliveries but preserves the record', async () => {
    const subscription = await subscriptionOf(CUSTOMER_MEERA);

    const [released] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from subscription_deliveries
        where subscription_id = $1 and status = 'released'`,
      [subscription.id],
    );

    await actingAs(db, { role: 'authenticated', profileId: MEERA }, (tx) =>
      tx.query(`select cancel_subscription($1, 'Moving cities')`, [subscription.id]),
    );

    const [after] = await asService<{
      status: string;
      cancelled_at: string;
      cancellation_reason: string;
    }>(db, 'select status, cancelled_at, cancellation_reason from subscriptions where id = $1', [
      subscription.id,
    ]);

    expect(after.status).toBe('cancelled');
    expect(after.cancellation_reason).toBe('Moving cities');

    const [scheduled] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from subscription_deliveries
        where subscription_id = $1 and status = 'scheduled'`,
      [subscription.id],
    );
    expect(scheduled.n).toBe(0);

    // Anything already sent to the kitchen is untouched.
    const [stillReleased] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from subscription_deliveries
        where subscription_id = $1 and status = 'released'`,
      [subscription.id],
    );
    expect(stillReleased.n).toBe(released.n);
  });
});

describe('customer-selected plans', () => {
  it('refuses a meal that is not in the plan"s selectable pool', async () => {
    const message = await expectFailure(() =>
      asService(
        db,
        `select begin_subscription_checkout(
           p_customer_id        => $1,
           p_plan_id            => $2,
           p_address_id         => $3,
           p_delivery_window_id => (select id from delivery_windows where code = 'LUNCH'),
           p_provider           => 'razorpay',
           p_idempotency_key    => 'test-bad-selection-01',
           p_selected_meals     => $4::jsonb)`,
        [
          CUSTOMER_SANA,
          PLAN_BUILD_YOUR_OWN,
          ADDRESS_SANA_HOME,
          // Butter naan is not in the lunch pool.
          JSON.stringify([{ product_id: '40000001-0000-4000-8000-000000000008', quantity: 1 }]),
        ],
      ),
    );
    expect(message).toMatch(/not selectable on this plan/i);
  });

  it('accepts meals that are in the pool and schedules them', async () => {
    const [checkout] = await asService<{ result: { subscription_id: string; payment_id: string } }>(
      db,
      `select begin_subscription_checkout(
         p_customer_id        => $1,
         p_plan_id            => $2,
         p_address_id         => $3,
         p_delivery_window_id => (select id from delivery_windows where code = 'LUNCH'),
         p_provider           => 'razorpay',
         p_idempotency_key    => 'test-good-selection-1',
         p_selected_meals     => $4::jsonb,
         p_starts_on          => app.business_date()) as result`,
      [
        CUSTOMER_SANA,
        PLAN_BUILD_YOUR_OWN,
        ADDRESS_SANA_HOME,
        JSON.stringify([
          { product_id: PRODUCT_BIRYANI, quantity: 1 },
          { product_id: PRODUCT_KHICHDI, quantity: 1 },
        ]),
      ],
    );

    const [confirmed] = await asService<{ result: { deliveries_generated: number } }>(
      db,
      `select confirm_subscription_payment($1, 'pay_sel_1', true) as result`,
      [checkout.result.payment_id],
    );

    expect(confirmed.result.deliveries_generated).toBeGreaterThan(0);

    const [items] = await asService<{ n: number }>(
      db,
      `select count(distinct i.product_id)::int n
         from subscription_delivery_items i
         join subscription_deliveries d on d.id = i.delivery_id
        where d.subscription_id = $1`,
      [checkout.result.subscription_id],
    );
    expect(items.n).toBe(2);
  });
});
