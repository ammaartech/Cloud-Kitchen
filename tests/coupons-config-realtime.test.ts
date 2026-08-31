import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, asService, expectFailure, type Db } from './harness/db';
import {
  CUSTOMER_MEERA,
  CUSTOMER_RAHUL,
  CUSTOMER_SANA,
  PLAN_WEEKDAY_LUNCH,
  PLAN_DINNER_CLUB,
} from './harness/ids';

let db: Db;

async function validate(code: string, customerId: string, subtotal = 4499, planId = PLAN_WEEKDAY_LUNCH) {
  const [row] = await asService<{
    is_valid: boolean;
    reason: string;
    discount_amount: string;
  }>(db, 'select * from validate_coupon($1, $2, $3, $4)', [code, customerId, subtotal, planId]);
  return row;
}

beforeAll(async () => {
  db = await createTestDb({ seed: true });
});

afterAll(async () => {
  await db?.close();
});

describe('the first-subscription offer is validated on the server', () => {
  it('applies for a customer who has never activated a subscription', async () => {
    const result = await validate('FIRST5', CUSTOMER_SANA);
    expect(result.is_valid).toBe(true);
    expect(Number(result.discount_amount)).toBeCloseTo(224.95, 2);
  });

  it('refuses a customer who already has an activated subscription', async () => {
    // Rahul's credit plan was activated in the seed, but he never redeemed
    // FIRST5 -- so this is the first_subscription rule firing, not the
    // per-customer usage limit.
    const result = await validate('FIRST5', CUSTOMER_RAHUL);
    expect(result.is_valid).toBe(false);
    expect(result.reason).toMatch(/first subscription only/i);
  });

  it('refuses a customer who has already redeemed it', async () => {
    // Meera redeemed FIRST5 in the seed, so the per-customer limit is what
    // stops her -- a different reason, reported honestly.
    const result = await validate('FIRST5', CUSTOMER_MEERA);
    expect(result.is_valid).toBe(false);
    expect(result.reason).toMatch(/already used this offer/i);
  });

  it('caps a percentage discount at the configured maximum', async () => {
    // 5% of 20,000 would be 1,000; the cap is 500.
    const result = await validate('FIRST5', CUSTOMER_SANA, 20000);
    expect(Number(result.discount_amount)).toBe(500);
  });

  it('enforces a minimum order amount', async () => {
    const result = await validate('FLAT200', CUSTOMER_SANA, 1000);
    expect(result.is_valid).toBe(false);
    expect(result.reason).toMatch(/minimum/i);
  });

  it('rejects an unknown code without throwing', async () => {
    const result = await validate('NOT-A-CODE', CUSTOMER_SANA);
    expect(result.is_valid).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });

  it('rejects an expired offer', async () => {
    await asService(
      db,
      `update coupons
          set valid_from  = now() - interval '3 days',
              valid_until = now() - interval '1 day'
        where code = 'FLAT200'`,
    );
    const result = await validate('FLAT200', CUSTOMER_SANA, 5000);
    expect(result.is_valid).toBe(false);
    expect(result.reason).toMatch(/expired/i);

    await asService(
      db,
      `update coupons set valid_from = now(), valid_until = null where code = 'FLAT200'`,
    );
  });

  it('is redeemed exactly once per subscription', async () => {
    const [row] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from coupon_redemptions r
        join coupons c on c.id = r.coupon_id
       where c.code = 'FIRST5'`,
    );
    expect(row.n).toBe(1);
  });
});

describe('the quote is computed server-side', () => {
  it('splits tax into CGST and SGST and totals them correctly', async () => {
    const [row] = await asService<{ quote: Record<string, unknown> }>(
      db,
      'select quote_subscription($1, $2, null) as quote',
      [PLAN_WEEKDAY_LUNCH, CUSTOMER_SANA],
    );
    const quote = row.quote as {
      subtotal: number;
      tax_total: number;
      grand_total: number;
      tax_breakdown: Array<{ code: string; rate: number; amount: number }>;
    };

    expect(quote.subtotal).toBe(4499);
    expect(quote.tax_breakdown.map((c) => c.code).sort()).toEqual(['CGST', 'SGST']);
    expect(quote.tax_breakdown.every((c) => Number(c.rate) === 2.5)).toBe(true);

    const summed = quote.tax_breakdown.reduce((t, c) => t + Number(c.amount), 0);
    expect(Number(quote.tax_total)).toBeCloseTo(summed, 2);
    expect(Number(quote.grand_total)).toBeCloseTo(
      Number(quote.subtotal) + Number(quote.tax_total),
      2,
    );
  });

  it('reports why a coupon did not apply instead of silently dropping it', async () => {
    const [row] = await asService<{ quote: Record<string, unknown> }>(
      db,
      `select quote_subscription($1, $2, 'FIRST5') as quote`,
      [PLAN_WEEKDAY_LUNCH, CUSTOMER_RAHUL],
    );
    const quote = row.quote as { coupon_applied: boolean; coupon_message: string; discount_total: number };

    expect(quote.coupon_applied).toBe(false);
    expect(Number(quote.discount_total)).toBe(0);
    expect(quote.coupon_message).toMatch(/first subscription/i);
  });

  it('refuses to quote an unpublished plan', async () => {
    await asService(db, 'update subscription_plans set is_published = false where id = $1', [
      PLAN_DINNER_CLUB,
    ]);

    const message = await expectFailure(() =>
      asService(db, 'select quote_subscription($1, $2, null)', [PLAN_DINNER_CLUB, CUSTOMER_SANA]),
    );
    expect(message).toMatch(/not available for purchase/i);

    await asService(db, 'update subscription_plans set is_published = true where id = $1', [
      PLAN_DINNER_CLUB,
    ]);
  });

  it('recomputes the total when the tax rate changes, with no code change', async () => {
    await asService(db, `update tax_settings set rate_percent = 9 where code = 'CGST'`);

    const [row] = await asService<{ quote: Record<string, unknown> }>(
      db,
      'select quote_subscription($1, $2, null) as quote',
      [PLAN_WEEKDAY_LUNCH, CUSTOMER_SANA],
    );
    const quote = row.quote as { tax_total: number };
    // 9% + 2.5% of 4499
    expect(Number(quote.tax_total)).toBeCloseTo(4499 * 0.115, 1);

    await asService(db, `update tax_settings set rate_percent = 2.5 where code = 'CGST'`);
  });
});

describe('configuration is data, not constants', () => {
  it('reads the delivery fee from a rule, including the free-above threshold', async () => {
    const [low] = await asService<{ fee: string }>(db, `select app.resolve_delivery_fee(200, 'SX') fee`);
    const [high] = await asService<{ fee: string }>(db, `select app.resolve_delivery_fee(600, 'SX') fee`);

    expect(Number(low.fee)).toBe(40);
    expect(Number(high.fee)).toBe(0);
  });

  it('fails loudly when a required setting is missing rather than defaulting to zero', async () => {
    await asService(db, `delete from business_settings where key = 'kot.default_prep_minutes'`);

    const message = await expectFailure(() =>
      asService(db, `select app.setting_int('kot.default_prep_minutes')`),
    );
    expect(message).toMatch(/is not configured/i);

    await asService(
      db,
      `insert into business_settings (key, value, value_type, label)
       values ('kot.default_prep_minutes', '25'::jsonb, 'integer', 'Default preparation estimate')`,
    );
  });

  it('marks rules still awaiting owner sign-off as provisional', async () => {
    const rows = await asService<{ key: string }>(
      db,
      'select key from business_settings where is_provisional order by key',
    );
    const keys = rows.map((r) => r.key);

    // These are the ones the PRD lists as open owner-validation items.
    expect(keys).toContain('subscription.max_pauses_per_period');
    expect(keys).toContain('subscription.max_pause_days');
    expect(keys).toContain('kot.release_lead_time_minutes');
  });

  it('keeps COD present in the model but switched off', async () => {
    const [row] = await asService<{ enabled: boolean }>(
      db,
      `select app.setting_bool('payments.cod_enabled') enabled`,
    );
    expect(row.enabled).toBe(false);

    const [enumRow] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from pg_enum e
         join pg_type t on t.oid = e.enumtypid
        where t.typname = 'payment_provider' and e.enumlabel = 'cod'`,
    );
    expect(enumRow.n).toBe(1);
  });

  it('changes the KOT release lead time without touching code', async () => {
    await asService(
      db,
      `update business_settings set value = '999'::jsonb
        where key = 'kot.release_lead_time_minutes'`,
    );

    const [row] = await asService<{ result: { lead_time_minutes: number } }>(
      db,
      'select release_due_deliveries() as result',
    );
    expect(row.result.lead_time_minutes).toBe(999);
  });
});

describe('realtime is wired for the operational tables', () => {
  it('publishes the tables the KOT screens subscribe to', async () => {
    const rows = await asService<{ tablename: string }>(
      db,
      `select tablename from pg_publication_tables
        where pubname = 'supabase_realtime' order by tablename`,
    );
    const tables = rows.map((r) => r.tablename);

    expect(tables).toContain('kot_tickets');
    expect(tables).toContain('kot_status_events');
    expect(tables).toContain('subscription_deliveries');
  });

  it('uses full replica identity so updates carry the previous row', async () => {
    // Clients need the old status to discard a duplicate or out-of-order event.
    const rows = await asService<{ relname: string; relreplident: string }>(
      db,
      `select relname, relreplident from pg_class
        where relname in ('kot_tickets','orders','subscription_deliveries')`,
    );

    for (const row of rows) {
      expect(row.relreplident, `${row.relname} replica identity`).toBe('f');
    }
  });

  it('gates realtime for kitchen staff through the same RLS policy as reads', async () => {
    const [row] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from pg_policies
        where tablename = 'kot_tickets' and cmd = 'SELECT'`,
    );
    expect(row.n).toBe(1);
  });
});
