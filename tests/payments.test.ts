import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, actingAs, expectFailure, asService, type Db } from './harness/db';
import {
  CUSTOMER_SANA,
  ADDRESS_SANA_HOME,
  PLAN_DINNER_CLUB,
  PLAN_FLEXI_CREDITS,
  CUSTOMER_MEERA,
  ADDRESS_MEERA_HOME,
  MEERA,
} from './harness/ids';

let db: Db;

/** Start a checkout as the server would, returning the RPC's payload. */
async function beginCheckout(
  customerId: string,
  planId: string,
  addressId: string,
  idempotencyKey: string,
  couponCode: string | null = null,
) {
  const rows = await asService<{ result: Record<string, unknown> }>(
    db,
    `select begin_subscription_checkout(
       p_customer_id        => $1,
       p_plan_id            => $2,
       p_address_id         => $3,
       p_delivery_window_id => (select id from delivery_windows
                                 join subscription_plan_windows w
                                   on w.delivery_window_id = delivery_windows.id
                                where w.plan_id = $2 limit 1),
       p_provider           => 'razorpay',
       p_idempotency_key    => $4,
       p_coupon_code        => $5,
       p_starts_on          => app.business_date()
     ) as result`,
    [customerId, planId, addressId, idempotencyKey, couponCode],
  );
  return rows[0].result as {
    subscription_id: string;
    payment_id: string;
    amount: string;
    replayed: boolean;
  };
}

beforeAll(async () => {
  db = await createTestDb({ seed: true });
});

afterAll(async () => {
  await db?.close();
});

describe('an unverified payment creates nothing', () => {
  it('leaves the subscription inactive and produces no KOT ticket', async () => {
    const checkout = await beginCheckout(
      CUSTOMER_SANA,
      PLAN_DINNER_CLUB,
      ADDRESS_SANA_HOME,
      'test-fail-path-0001',
    );

    await asService(db, `select fail_subscription_payment($1, 'DECLINED', 'Card declined')`, [
      checkout.payment_id,
    ]);

    const [subscription] = await asService<{ status: string; activated_at: string | null }>(
      db,
      'select status, activated_at from subscriptions where id = $1',
      [checkout.subscription_id],
    );
    expect(subscription.status).toBe('pending_payment');
    expect(subscription.activated_at).toBeNull();

    const [tickets] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from kot_tickets t
         join orders o on o.id = t.order_id
        where o.subscription_id = $1`,
      [checkout.subscription_id],
    );
    expect(tickets.n).toBe(0);

    const [deliveries] = await asService<{ n: number }>(
      db,
      'select count(*)::int n from subscription_deliveries where subscription_id = $1',
      [checkout.subscription_id],
    );
    expect(deliveries.n).toBe(0);
  });

  it('refuses to confirm a payment whose signature was not verified', async () => {
    const checkout = await beginCheckout(
      CUSTOMER_SANA,
      PLAN_DINNER_CLUB,
      ADDRESS_SANA_HOME,
      'test-unsigned-0001',
    );

    const message = await expectFailure(() =>
      asService(db, `select confirm_subscription_payment($1, 'pay_x', false)`, [
        checkout.payment_id,
      ]),
    );
    expect(message).toMatch(/signature was not verified/i);
  });

  it('blocks activation at the database level even if application code slips', async () => {
    // Bypasses the RPC entirely: the trigger from 0008 is the last line of
    // defence and must hold on its own.
    const checkout = await beginCheckout(
      CUSTOMER_SANA,
      PLAN_DINNER_CLUB,
      ADDRESS_SANA_HOME,
      'test-direct-activate-01',
    );

    const message = await expectFailure(() =>
      asService(
        db,
        `update subscriptions set status = 'active', activated_at = now() where id = $1`,
        [checkout.subscription_id],
      ),
    );
    expect(message).toMatch(/without a verified successful payment/i);
  });

  it('records an uncertain outcome for reconciliation instead of guessing', async () => {
    const checkout = await beginCheckout(
      CUSTOMER_SANA,
      PLAN_DINNER_CLUB,
      ADDRESS_SANA_HOME,
      'test-uncertain-0001',
    );

    await asService(
      db,
      `select fail_subscription_payment($1, 'TIMEOUT', 'Gateway did not respond', true)`,
      [checkout.payment_id],
    );

    const [payment] = await asService<{ needs_reconciliation: boolean; status: string }>(
      db,
      'select needs_reconciliation, status from payments where id = $1',
      [checkout.payment_id],
    );
    expect(payment.status).toBe('failed');
    expect(payment.needs_reconciliation).toBe(true);
  });
});

describe('idempotency', () => {
  it('returns the original subscription when a checkout is retried', async () => {
    const first = await beginCheckout(
      CUSTOMER_MEERA,
      PLAN_FLEXI_CREDITS,
      ADDRESS_MEERA_HOME,
      'test-retry-checkout-01',
    );
    const second = await beginCheckout(
      CUSTOMER_MEERA,
      PLAN_FLEXI_CREDITS,
      ADDRESS_MEERA_HOME,
      'test-retry-checkout-01',
    );

    expect(second.replayed).toBe(true);
    expect(second.subscription_id).toBe(first.subscription_id);
    expect(second.payment_id).toBe(first.payment_id);

    const [count] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from payments where idempotency_key = 'test-retry-checkout-01'`,
    );
    expect(count.n).toBe(1);
  });

  it('treats a duplicate payment webhook as a no-op', async () => {
    const checkout = await beginCheckout(
      CUSTOMER_MEERA,
      PLAN_FLEXI_CREDITS,
      ADDRESS_MEERA_HOME,
      'test-dup-webhook-0001',
    );

    const [first] = await asService<{ result: Record<string, unknown> }>(
      db,
      `select confirm_subscription_payment($1, 'pay_dup_1', true, 'webhook') as result`,
      [checkout.payment_id],
    );
    const [second] = await asService<{ result: Record<string, unknown> }>(
      db,
      `select confirm_subscription_payment($1, 'pay_dup_1', true, 'webhook') as result`,
      [checkout.payment_id],
    );

    expect(first.result.replayed).toBe(false);
    expect(second.result.replayed).toBe(true);

    // The credit grant, the invoice and the redemption must each have happened
    // exactly once despite two confirmations.
    const [ledger] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from subscription_credit_ledger
        where subscription_id = $1 and entry_type = 'grant'`,
      [checkout.subscription_id],
    );
    expect(ledger.n).toBe(1);

    const [invoices] = await asService<{ n: number }>(
      db,
      'select count(*)::int n from invoices where subscription_id = $1',
      [checkout.subscription_id],
    );
    expect(invoices.n).toBe(1);
  });

  it('will not let a late failure notice undo a confirmed payment', async () => {
    const [payment] = await asService<{ id: string }>(
      db,
      `select id from payments where status = 'success' limit 1`,
    );

    const [result] = await asService<{ result: Record<string, unknown> }>(
      db,
      `select fail_subscription_payment($1, 'LATE', 'arrived out of order') as result`,
      [payment.id],
    );
    expect(result.result.ignored).toBe(true);

    const [after] = await asService<{ status: string }>(
      db,
      'select status from payments where id = $1',
      [payment.id],
    );
    expect(after.status).toBe('success');
  });
});

describe('payment state is separate from order state', () => {
  it('never lets a browser token confirm its own payment', async () => {
    const checkout = await beginCheckout(
      CUSTOMER_MEERA,
      PLAN_FLEXI_CREDITS,
      ADDRESS_MEERA_HOME,
      'test-browser-confirm-1',
    );

    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: MEERA }, (tx) =>
        tx.query(`select confirm_subscription_payment($1, 'pay_evil', true)`, [
          checkout.payment_id,
        ]),
      ),
    );
    expect(message).toMatch(/permission denied|not exist/i);
  });

  it('will not let a customer write the payments table directly', async () => {
    const [before] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from payments where status = 'success'`,
    );

    // There is no UPDATE policy on payments, so RLS matches no rows. Postgres
    // reports that as zero rows affected rather than as an error -- the
    // meaningful assertion is that nothing changed, not that it threw.
    const affected = await actingAs(
      db,
      { role: 'authenticated', profileId: MEERA },
      async (tx) => {
        const result = await tx.query(
          `update payments set status = 'success', verified_at = now()`,
        );
        return result.affectedRows ?? 0;
      },
    );
    expect(affected).toBe(0);

    const [after] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from payments where status = 'success'`,
    );
    expect(after.n).toBe(before.n);
  });
});

describe('invoices carry the tax split', () => {
  it('records CGST and SGST as separate components', async () => {
    const [invoice] = await asService<{ tax_breakdown: Array<{ code: string; amount: string }> }>(
      db,
      'select tax_breakdown from invoices order by issued_at limit 1',
    );

    const codes = invoice.tax_breakdown.map((c) => c.code).sort();
    expect(codes).toEqual(['CGST', 'SGST']);
  });
});
