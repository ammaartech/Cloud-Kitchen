import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, actingAs, asService, expectFailure, type Db } from './harness/db';

/**
 * Creating the customer record, which is what the first save in checkout does.
 *
 * The seeded accounts all have one already, which is exactly why this went
 * unnoticed: a brand new sign-up was refused by RLS at the first delivery
 * address and could not buy anything. These tests act as an account that has
 * just been created and has no customer row, which is the state every real
 * first purchase starts from.
 */

const NEW_PROFILE = 'cccccccc-0000-4000-8000-000000000001';
const OTHER_PROFILE = 'cccccccc-0000-4000-8000-000000000002';

/** Meera's, from the seed: a number that is already taken. */
const TAKEN_PHONE = '+919810000001';

let db: Db;

/**
 * A brand new sign-up, made the way Supabase makes one: a row in `auth.users`,
 * which the provisioning trigger turns into an `auth_profiles` row. Run on the
 * harness connection rather than through `asService`, because `service_role`
 * is only granted `select` on the auth schema -- creating accounts is GoTrue's
 * job, and the seed does it the same way.
 */
async function signUp(profileId: string, email: string, name: string) {
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
     values ($1, $2, jsonb_build_object('full_name', $3::text), now(), now())
     on conflict (id) do nothing`,
    [profileId, email, name],
  );
  // The trigger has created the profile; make sure it carries the details the
  // rest of the test reads, whatever the trigger chose to copy.
  await db.query(
    `update public.auth_profiles set full_name = $2, email = $3 where id = $1`,
    [profileId, name, email],
  );
}

beforeAll(async () => {
  db = await createTestDb({ seed: true });
  await signUp(NEW_PROFILE, 'new@example.test', 'New Customer');
  await signUp(OTHER_PROFILE, 'other@example.test', 'Other Customer');
});

afterAll(async () => {
  await db?.close();
});

describe('creating your own customer record', () => {
  it('is refused as a direct insert, which is why the RPC exists', async () => {
    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: OTHER_PROFILE }, (tx) =>
        tx.query(
          `insert into public.customers (profile_id, full_name, phone)
           values ($1, 'Other Customer', '+917000000009')`,
          [OTHER_PROFILE],
        ),
      ),
    );

    expect(message).toMatch(/row-level security|violates/i);
  });

  it('creates the record for the caller, and decides the untrusted columns itself', async () => {
    const id = await actingAs(db, { role: 'authenticated', profileId: NEW_PROFILE }, async (tx) => {
      const result = await tx.query<{ ensure_customer_record: string }>(
        `select public.ensure_customer_record($1, $2, $3) as ensure_customer_record`,
        ['New Customer', '+917000000001', true],
      );
      return result.rows[0].ensure_customer_record;
    });

    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const [row] = await asService<{
      profile_id: string;
      email: string;
      phone: string;
      phone_verified: boolean;
      marketing_consent: boolean;
      marketing_consent_source: string;
      created_source: string;
    }>(db, `select * from public.customers where id = $1`, [id]);

    expect(row.profile_id).toBe(NEW_PROFILE);
    // The account's email, not anything the form could have supplied.
    expect(row.email).toBe('new@example.test');
    expect(row.phone).toBe('+917000000001');
    // Verification is the kitchen's to claim, never the customer's.
    expect(row.phone_verified).toBe(false);
    expect(row.marketing_consent).toBe(true);
    expect(row.marketing_consent_source).toBe('checkout');
    expect(row.created_source).toBe('website');
  });

  it('is idempotent: a second call returns the same record, unchanged', async () => {
    const again = await actingAs(db, { role: 'authenticated', profileId: NEW_PROFILE }, async (tx) => {
      const result = await tx.query<{ id: string }>(
        `select public.ensure_customer_record($1, $2, $3) as id`,
        ['Someone Else Entirely', '+917000000777', false],
      );
      return result.rows[0].id;
    });

    const rows = await asService<{ id: string; full_name: string; phone: string }>(
      db,
      `select id, full_name, phone from public.customers where profile_id = $1`,
      [NEW_PROFILE],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(again);
    expect(rows[0].full_name).toBe('New Customer');
    expect(rows[0].phone).toBe('+917000000001');
  });

  it('lets that customer save their first address, which RLS had blocked', async () => {
    const saved = await actingAs(db, { role: 'authenticated', profileId: NEW_PROFILE }, async (tx) => {
      const customer = await tx.query<{ id: string }>(
        `select id from public.customers where profile_id = $1`,
        [NEW_PROFILE],
      );

      await tx.query(
        `insert into public.customer_addresses
           (customer_id, label, recipient_name, phone, line1, city, state, postal_code, is_default)
         values ($1, 'Home', 'New Customer', '+917000000001', '12, First Street', 'Bengaluru', 'Karnataka', '560001', true)`,
        [customer.rows[0].id],
      );

      const result = await tx.query<{ count: string }>(
        `select count(*)::text as count from public.customer_addresses where customer_id = $1`,
        [customer.rows[0].id],
      );
      return result.rows[0].count;
    });

    expect(saved).toBe('1');
  });

  it('refuses a mobile number that is already on another account', async () => {
    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: OTHER_PROFILE }, (tx) =>
        tx.query(`select public.ensure_customer_record($1, $2, $3)`, [
          'Other Customer',
          TAKEN_PHONE,
          false,
        ]),
      ),
    );

    expect(message).toMatch(/already on another account/i);
  });

  it('refuses a caller with no session at all', async () => {
    const message = await expectFailure(() =>
      actingAs(db, { role: 'anon' }, (tx) =>
        tx.query(`select public.ensure_customer_record($1, $2, $3)`, [
          'Nobody',
          '+917000000002',
          false,
        ]),
      ),
    );

    expect(message).toMatch(/sign in/i);
  });

  it('refuses a record with no name or number', async () => {
    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: OTHER_PROFILE }, (tx) =>
        tx.query(`select public.ensure_customer_record($1, $2, $3)`, ['  ', '  ', false]),
      ),
    );

    expect(message).toMatch(/needs a name and a mobile number/i);
  });
});
