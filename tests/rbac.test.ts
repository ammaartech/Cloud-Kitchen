import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, actingAs, expectFailure, type Db } from './harness/db';
import { OWNER, MANAGER, KITCHEN, DEV_ADMIN, MEERA, RAHUL } from './harness/ids';

let db: Db;

beforeAll(async () => {
  db = await createTestDb({ seed: true });
});

afterAll(async () => {
  await db?.close();
});

describe('role permissions are data, not code', () => {
  it('gives Developer Admin every permission', async () => {
    const { rows } = await db.query<{ total: number; granted: number }>(`
      select (select count(*) from permissions)::int as total,
             (select count(*) from role_permissions where role = 'developer_admin')::int as granted
    `);
    expect(rows[0].granted).toBe(rows[0].total);
  });

  it('withholds every KOT transition permission from the Owner', async () => {
    // PRD 5.2 / PRD 9: the Owner watches the kitchen, and cannot touch it.
    const { rows } = await db.query<{ permission_code: string }>(`
      select permission_code from role_permissions
       where role = 'owner' and permission_code like 'kot.%'
    `);
    expect(rows.map((r) => r.permission_code)).toEqual(['kot.view']);
  });

  it('withholds pricing, payment and profit from the Branch Manager', async () => {
    const { rows } = await db.query<{ permission_code: string }>(`
      select permission_code from role_permissions
       where role = 'branch_manager'
         and permission_code in
           ('orders.view_financial','payments.view','analytics.view',
            'customers.manage','plans.manage','permissions.manage')
    `);
    expect(rows).toHaveLength(0);
  });

  it('gives Kitchen Staff only the board and the ability to start cooking', async () => {
    const { rows } = await db.query<{ permission_code: string }>(`
      select permission_code from role_permissions
       where role = 'kitchen_staff' order by permission_code
    `);
    expect(rows.map((r) => r.permission_code)).toEqual(['kot.start_prep', 'kot.view']);
  });
});

describe('audit log visibility', () => {
  it('is readable by Developer Admin and Owner', async () => {
    for (const profileId of [DEV_ADMIN, OWNER]) {
      const visible = await actingAs(db, { role: 'authenticated', profileId }, async (tx) => {
        const r = await tx.query<{ n: number }>('select count(*)::int n from audit_logs');
        return r.rows[0].n;
      });
      expect(visible).toBeGreaterThan(0);
    }
  });

  it('is invisible to the Branch Manager and to Kitchen Staff', async () => {
    for (const profileId of [MANAGER, KITCHEN]) {
      const visible = await actingAs(db, { role: 'authenticated', profileId }, async (tx) => {
        const r = await tx.query<{ n: number }>('select count(*)::int n from audit_logs');
        return r.rows[0].n;
      });
      expect(visible).toBe(0);
    }
  });

  it('cannot be rewritten, even by a Developer Admin', async () => {
    const message = await expectFailure(() =>
      actingAs(db, { role: 'service_role' }, (tx) =>
        tx.query(`update audit_logs set action = 'delete' where id = (select min(id) from audit_logs)`),
      ),
    );
    expect(message).toMatch(/append-only/i);
  });
});

describe('kitchen staff are kept away from money', () => {
  it('masks order totals and customer phone numbers on the shared board', async () => {
    const row = await actingAs(db, { role: 'authenticated', profileId: KITCHEN }, async (tx) => {
      const r = await tx.query(`
        select order_total, order_subtotal, customer_phone
          from v_kot_tickets where source <> 'SX' limit 1
      `);
      return r.rows[0] as Record<string, unknown>;
    });

    expect(row.order_total).toBeNull();
    expect(row.order_subtotal).toBeNull();
    expect(row.customer_phone).toBeNull();
  });

  it('shows the same columns to the Owner', async () => {
    const row = await actingAs(db, { role: 'authenticated', profileId: OWNER }, async (tx) => {
      const r = await tx.query(`
        select order_total, customer_phone
          from v_kot_tickets where source <> 'SX' limit 1
      `);
      return r.rows[0] as Record<string, unknown>;
    });

    expect(row.order_total).not.toBeNull();
    expect(row.customer_phone).not.toBeNull();
  });

  it('returns no rows at all from the analytics views', async () => {
    const n = await actingAs(db, { role: 'authenticated', profileId: KITCHEN }, async (tx) => {
      const r = await tx.query<{ n: number }>('select count(*)::int n from v_owner_dashboard');
      return r.rows[0].n;
    });
    expect(n).toBe(0);
  });

  it('hides the orders table itself, since kitchen staff hold no orders.view', async () => {
    const n = await actingAs(db, { role: 'authenticated', profileId: KITCHEN }, async (tx) => {
      const r = await tx.query<{ n: number }>('select count(*)::int n from orders');
      return r.rows[0].n;
    });
    expect(n).toBe(0);
  });
});

describe('customers see only their own records', () => {
  it('shows a customer their own subscription and not anyone else"s', async () => {
    const meera = await actingAs(db, { role: 'authenticated', profileId: MEERA }, async (tx) => {
      const r = await tx.query<{ n: number }>('select count(*)::int n from subscriptions');
      return r.rows[0].n;
    });
    const rahul = await actingAs(db, { role: 'authenticated', profileId: RAHUL }, async (tx) => {
      const r = await tx.query<{ n: number }>('select count(*)::int n from subscriptions');
      return r.rows[0].n;
    });

    expect(meera).toBe(1);
    expect(rahul).toBe(1);
  });

  it('refuses to let one customer cancel another"s subscription', async () => {
    const { rows } = await db.query<{ id: string }>(
      `select id from subscriptions where customer_id =
         (select id from customers where profile_id = $1)`,
      [MEERA],
    );
    const meeraSubscription = rows[0].id;

    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: RAHUL }, (tx) =>
        tx.query('select cancel_subscription($1, $2)', [meeraSubscription, 'not mine']),
      ),
    );
    expect(message).toMatch(/not permitted to act on this subscription/i);
  });

  it('stops a user promoting themselves to Owner', async () => {
    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: MEERA }, (tx) =>
        tx.query(`update auth_profiles set role = 'owner' where id = $1`, [MEERA]),
      ),
    );
    expect(message).toMatch(/may not change your own role/i);
  });

  it('lets a customer update their own name', async () => {
    await actingAs(db, { role: 'authenticated', profileId: MEERA }, (tx) =>
      tx.query(`update auth_profiles set full_name = 'Meera I.' where id = $1`, [MEERA]),
    );

    const { rows } = await db.query<{ full_name: string }>(
      'select full_name from auth_profiles where id = $1',
      [MEERA],
    );
    expect(rows[0].full_name).toBe('Meera I.');
  });
});

describe('anonymous storefront access', () => {
  it('can browse published products, including unavailable ones', async () => {
    const rows = await actingAs(db, { role: 'anon' }, async (tx) => {
      const r = await tx.query<{ n: number }>(
        'select count(*)::int n from products where is_available = false',
      );
      return r.rows[0].n;
    });
    // Unavailable products must still be readable: they render grayscale with
    // a badge rather than disappearing (PRD 6, PRD 19).
    expect(rows).toBeGreaterThan(0);
  });

  it('cannot read customers, orders, payments or the audit log', async () => {
    for (const table of ['customers', 'orders', 'payments', 'audit_logs', 'subscriptions']) {
      const n = await actingAs(db, { role: 'anon' }, async (tx) => {
        const r = await tx.query<{ n: number }>(`select count(*)::int n from ${table}`);
        return r.rows[0].n;
      });
      expect(n, `anon should not read ${table}`).toBe(0);
    }
  });

  it('sees only offers marked as publicly visible', async () => {
    const codes = await actingAs(db, { role: 'anon' }, async (tx) => {
      const r = await tx.query<{ code: string }>('select code from coupons order by code');
      return r.rows.map((x) => x.code);
    });
    expect(codes).toEqual(['FIRST5']);
  });
});
