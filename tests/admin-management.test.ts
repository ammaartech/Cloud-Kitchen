import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, actingAs, asService, expectFailure, type Db } from './harness/db';
import {
  OWNER,
  MANAGER,
  MEERA,
  RAHUL,
  SANA,
  CUSTOMER_MEERA,
  CUSTOMER_SANA,
  PRODUCT_KHICHDI,
  PRODUCT_PANEER,
} from './harness/ids';

/**
 * The Owner admin surface: review moderation, the verified-purchase badge, the
 * management policies those screens depend on, and a customer's own refund
 * case.
 *
 * These run against the real migration set, so what is proved here is the
 * database's behaviour rather than the pages that call it.
 */

let db: Db;

beforeAll(async () => {
  db = await createTestDb({ seed: true });
});

afterAll(async () => {
  await db?.close();
});

/* ========================================================================== */
/* Verified purchase                                                          */
/* ========================================================================== */

describe('the verified-purchase badge is derived, not claimed', () => {
  it('refuses a customer’s claim when nothing was ever delivered to them', async () => {
    const [review] = await actingAs(db, { role: 'authenticated', profileId: SANA }, async (tx) => {
      const result = await tx.query<{ is_verified_purchase: boolean }>(
        `insert into public.reviews
           (customer_id, product_id, rating, title, body, is_verified_purchase)
         values ($1, $2, 5, 'Great', 'Claiming a badge I have not earned', true)
         returning is_verified_purchase`,
        [CUSTOMER_SANA, PRODUCT_PANEER],
      );
      return result.rows;
    });

    expect(review.is_verified_purchase).toBe(false);
  });

  it('grants it once a delivery of that dish has actually been fulfilled', async () => {
    // Give Sana a delivered meal, through the service role -- the same way a
    // scheduled job would record one.
    const [delivery] = await asService<{ id: string }>(
      db,
      `insert into public.subscription_deliveries
         (subscription_id, customer_id, scheduled_date, delivery_window_id, status, fulfilled_at)
       select s.id, s.customer_id, current_date - 1, w.id, 'fulfilled', now()
         from public.subscriptions s
         cross join public.delivery_windows w
        where s.customer_id = $1 and w.code = 'DINNER'
        limit 1
       returning id`,
      [CUSTOMER_SANA],
    );

    await asService(
      db,
      `insert into public.subscription_delivery_items (delivery_id, product_id, quantity)
       values ($1, $2, 1)`,
      [delivery.id, PRODUCT_KHICHDI],
    );

    const [review] = await actingAs(db, { role: 'authenticated', profileId: SANA }, async (tx) => {
      const result = await tx.query<{ is_verified_purchase: boolean }>(
        `insert into public.reviews (customer_id, product_id, rating, title, body)
         values ($1, $2, 4, 'Solid', 'This one I actually ate')
         returning is_verified_purchase`,
        [CUSTOMER_SANA, PRODUCT_KHICHDI],
      );
      return result.rows;
    });

    expect(review.is_verified_purchase).toBe(true);
  });

  it('leaves a trusted importer’s record alone', async () => {
    // The seed marks two reviews as verified against history the query above
    // cannot see. A migration or the service role is already trusted with far
    // more than this, so it is not second-guessed.
    const [row] = await asService<{ verified: number }>(
      db,
      `select count(*)::int as verified from public.reviews
        where is_verified_purchase and status = 'published'`,
    );

    expect(row.verified).toBeGreaterThan(0);
  });
});

/* ========================================================================== */
/* Moderation                                                                 */
/* ========================================================================== */

describe('review moderation', () => {
  /** The pending khichdi review the seed leaves in the queue. */
  async function pendingReviewId(): Promise<string> {
    const [row] = await asService<{ id: string }>(
      db,
      `select id from public.reviews
        where status = 'pending' and product_id = $1
        order by created_at limit 1`,
      [PRODUCT_KHICHDI],
    );
    return row.id;
  }

  it('does not show a pending review to the public', async () => {
    const id = await pendingReviewId();

    const rows = await actingAs(db, { role: 'anon' }, async (tx) => {
      const result = await tx.query(`select id from public.reviews where id = $1`, [id]);
      return result.rows;
    });

    expect(rows).toHaveLength(0);
  });

  it('lets a moderator publish it, and records who decided and why', async () => {
    const id = await pendingReviewId();

    await actingAs(db, { role: 'authenticated', profileId: OWNER }, async (tx) => {
      await tx.query(`select public.moderate_review($1, 'published', $2)`, [
        id,
        'Reads as genuine, verified against a delivery',
      ]);
    });

    const [review] = await asService<{ status: string }>(
      db,
      `select status from public.reviews where id = $1`,
      [id],
    );
    expect(review.status).toBe('published');

    const [record] = await asService<{
      from_status: string;
      to_status: string;
      moderator_id: string;
      reason: string;
    }>(
      db,
      `select from_status, to_status, moderator_id, reason
         from public.review_moderation
        where review_id = $1
        order by created_at desc limit 1`,
      [id],
    );

    expect(record.from_status).toBe('pending');
    expect(record.to_status).toBe('published');
    expect(record.moderator_id).toBe(OWNER);
    expect(record.reason).toMatch(/verified against a delivery/i);
  });

  it('refuses a customer', async () => {
    const [row] = await asService<{ id: string }>(
      db,
      `select id from public.reviews where status = 'published' limit 1`,
    );

    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: MEERA }, async (tx) => {
        await tx.query(`select public.moderate_review($1, 'hidden', null)`, [row.id]);
      }),
    );

    expect(message).toMatch(/may not moderate/i);
  });

  it('refuses a branch manager, who has no moderation permission', async () => {
    const [row] = await asService<{ id: string }>(
      db,
      `select id from public.reviews where status = 'published' limit 1`,
    );

    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: MANAGER }, async (tx) => {
        await tx.query(`select public.moderate_review($1, 'hidden', null)`, [row.id]);
      }),
    );

    expect(message).toMatch(/may not moderate/i);
  });

  it('records nothing for a decision that changes nothing', async () => {
    // Deliberately an already-published review: re-publishing it is a button
    // press, not a decision, and the history should not pretend otherwise.
    const [target] = await asService<{ id: string }>(
      db,
      `select id from public.reviews where status = 'published' order by created_at limit 1`,
    );

    const [before] = await asService<{ count: number }>(
      db,
      `select count(*)::int as count from public.review_moderation where review_id = $1`,
      [target.id],
    );

    await actingAs(db, { role: 'authenticated', profileId: OWNER }, async (tx) => {
      await tx.query(`select public.moderate_review($1, 'published', 'again')`, [target.id]);
    });

    const [after] = await asService<{ count: number }>(
      db,
      `select count(*)::int as count from public.review_moderation where review_id = $1`,
      [target.id],
    );

    expect(after.count).toBe(before.count);
  });
});

describe('the public rating summary', () => {
  it('counts published reviews only', async () => {
    const rows = await asService<{
      product_id: string;
      review_count: number;
      average_rating: string;
    }>(db, `select * from public.v_product_ratings`);

    const khichdi = rows.find((row) => row.product_id === PRODUCT_KHICHDI);
    expect(khichdi?.review_count).toBe(1);

    // The seed's hidden two-star review must not drag any average down.
    const [hidden] = await asService<{ product_id: string }>(
      db,
      `select product_id from public.reviews where status = 'hidden' limit 1`,
    );
    expect(rows.some((row) => row.product_id === hidden.product_id)).toBe(false);
  });

  it('is readable by a signed-out visitor, because the menu is public', async () => {
    const rows = await actingAs(db, { role: 'anon' }, async (tx) => {
      const result = await tx.query(`select product_id from public.v_product_ratings`);
      return result.rows;
    });

    expect(rows.length).toBeGreaterThan(0);
  });
});

/* ========================================================================== */
/* Management policies                                                        */
/* ========================================================================== */

describe('staff account management', () => {
  it('lets the Owner change another employee’s role', async () => {
    await actingAs(db, { role: 'authenticated', profileId: OWNER }, async (tx) => {
      await tx.query(`update public.auth_profiles set role = 'kitchen_staff' where id = $1`, [
        MANAGER,
      ]);
    });

    const [profile] = await asService<{ role: string }>(
      db,
      `select role from public.auth_profiles where id = $1`,
      [MANAGER],
    );
    expect(profile.role).toBe('kitchen_staff');

    // Put it back, so the rest of the suite sees the seeded org chart.
    await asService(db, `update public.auth_profiles set role = 'branch_manager' where id = $1`, [
      MANAGER,
    ]);
  });

  it('does not let a customer change anyone’s role', async () => {
    await actingAs(db, { role: 'authenticated', profileId: MEERA }, async (tx) => {
      // No policy admits this, so RLS filters the row out rather than raising.
      await tx.query(`update public.auth_profiles set role = 'owner' where id = $1`, [MANAGER]);
    });

    const [profile] = await asService<{ role: string }>(
      db,
      `select role from public.auth_profiles where id = $1`,
      [MANAGER],
    );
    expect(profile.role).toBe('branch_manager');
  });

  it('does not let a customer promote themselves', async () => {
    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: MEERA }, async (tx) => {
        await tx.query(`update public.auth_profiles set role = 'owner' where id = $1`, [MEERA]);
      }),
    );

    expect(message).toMatch(/may not change your own role/i);
  });
});

describe('addresses for an Owner-maintained customer', () => {
  it('lets the Owner add one on the customer’s behalf', async () => {
    const [address] = await actingAs(
      db,
      { role: 'authenticated', profileId: OWNER },
      async (tx) => {
        const result = await tx.query<{ id: string }>(
          `insert into public.customer_addresses
             (customer_id, label, recipient_name, phone, line1, city, state, postal_code)
           values ($1, 'Office', 'Sana', '9000000003', '4th Cross', 'Bengaluru', 'KA', '560001')
           returning id`,
          [CUSTOMER_SANA],
        );
        return result.rows;
      },
    );

    expect(address.id).toBeTruthy();
  });

  it('does not let one customer add an address to another’s account', async () => {
    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: MEERA }, async (tx) => {
        await tx.query(
          `insert into public.customer_addresses
             (customer_id, label, recipient_name, phone, line1, city, state, postal_code)
           values ($1, 'Mine', 'Meera', '9000000001', 'Nowhere', 'Bengaluru', 'KA', '560001')`,
          [CUSTOMER_SANA],
        );
      }),
    );

    expect(message).toMatch(/row-level security/i);
  });
});

/* ========================================================================== */
/* Refund cases                                                               */
/* ========================================================================== */

describe('refund requests', () => {
  async function raiseAsMeera(reason: string): Promise<string> {
    const [row] = await actingAs(db, { role: 'authenticated', profileId: MEERA }, async (tx) => {
      const result = await tx.query<{ id: string }>(
        `insert into public.refund_requests (customer_id, reason, requested_amount)
         values ($1, $2, 100) returning id`,
        [CUSTOMER_MEERA, reason],
      );
      return result.rows;
    });
    return row.id;
  }

  it('lets a customer raise one for themselves', async () => {
    const id = await raiseAsMeera('Delivery never arrived on Tuesday');

    const [request] = await asService<{ status: string; customer_id: string }>(
      db,
      `select status, customer_id from public.refund_requests where id = $1`,
      [id],
    );

    expect(request.status).toBe('open');
    expect(request.customer_id).toBe(CUSTOMER_MEERA);
  });

  it('does not let a customer raise one against someone else', async () => {
    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: MEERA }, async (tx) => {
        await tx.query(
          `insert into public.refund_requests (customer_id, reason) values ($1, 'Not mine')`,
          [CUSTOMER_SANA],
        );
      }),
    );

    expect(message).toMatch(/row-level security/i);
  });

  it('lets the customer withdraw their own open case', async () => {
    const id = await raiseAsMeera('Changed my mind about this one');

    await actingAs(db, { role: 'authenticated', profileId: MEERA }, async (tx) => {
      await tx.query(`select public.withdraw_refund_request($1)`, [id]);
    });

    const [request] = await asService<{ status: string; resolved_at: string | null }>(
      db,
      `select status, resolved_at from public.refund_requests where id = $1`,
      [id],
    );

    expect(request.status).toBe('withdrawn');
    expect(request.resolved_at).not.toBeNull();
  });

  it('does not let another customer withdraw it', async () => {
    const id = await raiseAsMeera('Cold food on Thursday');

    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: RAHUL }, async (tx) => {
        await tx.query(`select public.withdraw_refund_request($1)`, [id]);
      }),
    );

    expect(message).toMatch(/not yours/i);
  });

  it('refuses to withdraw a case that has already been decided', async () => {
    const id = await raiseAsMeera('Missing item on Friday');

    await actingAs(db, { role: 'authenticated', profileId: OWNER }, async (tx) => {
      await tx.query(
        `update public.refund_requests
            set status = 'rejected', resolution_note = 'Outside the window', handled_by = $2,
                resolved_at = now()
          where id = $1`,
        [id, OWNER],
      );
    });

    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: MEERA }, async (tx) => {
        await tx.query(`select public.withdraw_refund_request($1)`, [id]);
      }),
    );

    expect(message).toMatch(/already been decided/i);
  });

  it('does not let a customer decide their own case', async () => {
    const id = await raiseAsMeera('Please approve this for me');

    await actingAs(db, { role: 'authenticated', profileId: MEERA }, async (tx) => {
      // Only payments.manage may update; RLS filters the row out silently.
      await tx.query(`update public.refund_requests set status = 'approved' where id = $1`, [id]);
    });

    const [request] = await asService<{ status: string }>(
      db,
      `select status from public.refund_requests where id = $1`,
      [id],
    );

    expect(request.status).toBe('open');
  });
});
