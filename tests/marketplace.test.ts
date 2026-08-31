import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, asService, type Db } from './harness/db';

let db: Db;

const ITEMS = `'[{"name":"Paneer Tikka Bowl","quantity":2,"unit_price":289}]'::jsonb`;
const TOTALS = `'{"subtotal":578,"tax_total":28.9,"grand_total":606.9}'::jsonb`;

async function ingest(
  provider: 'swiggy' | 'zomato',
  externalOrderId: string,
  eventId: string | null = null,
) {
  const [row] = await asService<{
    result: { duplicate: boolean; order_id: string; ticket_id: string; source: string };
  }>(
    db,
    `select ingest_marketplace_order(
       $1::integration_provider, $2, ${ITEMS}, ${TOTALS},
       '{"name":"Test Buyer","phone":"+919000012345"}'::jsonb,
       '{"status":"placed"}'::jsonb, $3) as result`,
    [provider, externalOrderId, eventId],
  );
  return row.result;
}

beforeAll(async () => {
  db = await createTestDb({ seed: true });
});

afterAll(async () => {
  await db?.close();
});

describe('marketplace orders join the same KOT', () => {
  it('creates a ticket with the source prefix and marketplace priority', async () => {
    const swiggy = await ingest('swiggy', 'MP-SW-1', 'MP-SW-1-EVT');
    const zomato = await ingest('zomato', 'MP-ZM-1', 'MP-ZM-1-EVT');

    const rows = await asService<{ ticket_code: string; source: string; priority: number; status: string }>(
      db,
      'select ticket_code, source, priority, status from kot_tickets where id = any($1)',
      [[swiggy.ticket_id, zomato.ticket_id]],
    );

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.status).toBe('NEW');
      expect(row.ticket_code.startsWith(row.source)).toBe(true);
      expect(row.priority).toBe(100);
    }
  });

  it('stores the external id alongside our own', async () => {
    const result = await ingest('swiggy', 'MP-SW-2', 'MP-SW-2-EVT');
    const [order] = await asService<{ external_order_id: string; order_number: number }>(
      db,
      'select external_order_id, order_number from orders where id = $1',
      [result.order_id],
    );

    expect(order.external_order_id).toBe('MP-SW-2');
    expect(order.order_number).toBeGreaterThan(0);
  });
});

describe('duplicate delivery is harmless', () => {
  it('ignores a replayed webhook event', async () => {
    const first = await ingest('zomato', 'MP-ZM-DUP', 'MP-ZM-DUP-EVT');
    const second = await ingest('zomato', 'MP-ZM-DUP', 'MP-ZM-DUP-EVT');

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.order_id).toBe(first.order_id);

    const [count] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from orders where external_order_id = 'MP-ZM-DUP'`,
    );
    expect(count.n).toBe(1);
  });

  it('ignores a repeat of the same order arriving without an event id', async () => {
    const first = await ingest('swiggy', 'MP-SW-NOEVT');
    const second = await ingest('swiggy', 'MP-SW-NOEVT');

    expect(second.duplicate).toBe(true);
    expect(second.ticket_id).toBe(first.ticket_id);
  });

  it('keeps one ticket per order even across both paths', async () => {
    const [count] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from kot_tickets t
        join orders o on o.id = t.order_id
       where o.external_order_id = 'MP-SW-NOEVT'`,
    );
    expect(count.n).toBe(1);
  });
});

describe('status synchronisation follows the marketplace', () => {
  it('cancels our ticket when the platform cancels the order', async () => {
    const order = await ingest('swiggy', 'MP-SW-CANCEL', 'MP-SW-CANCEL-EVT');

    // Mid-preparation, so this proves the marketplace can override our flow.
    await asService(db, `select transition_kot_ticket($1, 'ACCEPTED')`, [order.ticket_id]);
    await asService(db, `select transition_kot_ticket($1, 'PREPARING')`, [order.ticket_id]);

    const [result] = await asService<{ result: { applied: string } }>(
      db,
      `select sync_marketplace_order_status(
         'swiggy', 'MP-SW-CANCEL', 'CANCELLED', 'MP-SW-CANCEL-EVT-2') as result`,
    );
    expect(result.result.applied).toBe('cancelled');

    const [ticket] = await asService<{ status: string; cancellation_origin: string }>(
      db,
      'select status, cancellation_origin from kot_tickets where id = $1',
      [order.ticket_id],
    );
    expect(ticket.status).toBe('CANCELLED');
    expect(ticket.cancellation_origin).toBe('marketplace');
  });

  it('records a status for an unknown order as a discrepancy, not a new order', async () => {
    const [result] = await asService<{ result: { matched: boolean } }>(
      db,
      `select sync_marketplace_order_status(
         'zomato', 'MP-NEVER-SEEN', 'DELIVERED', 'MP-NEVER-SEEN-EVT') as result`,
    );
    expect(result.result.matched).toBe(false);

    const [orders] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from orders where external_order_id = 'MP-NEVER-SEEN'`,
    );
    expect(orders.n).toBe(0);

    const [event] = await asService<{ status: string; error: string }>(
      db,
      `select status, error from integration_events where external_event_id = 'MP-NEVER-SEEN-EVT'`,
    );
    expect(event.status).toBe('failed');
    expect(event.error).toMatch(/no matching internal order/i);
  });
});

describe('one marketplace failing does not stop the other', () => {
  it('opens the circuit for the failing provider only', async () => {
    const [threshold] = await asService<{ n: number }>(
      db,
      `select app.setting_int('integration.failure_threshold') n`,
    );

    for (let i = 0; i < threshold.n; i += 1) {
      await asService(db, `select record_integration_failure('swiggy', 'connection refused')`);
    }

    const rows = await asService<{ provider: string; health: string; circuit_open_until: string | null }>(
      db,
      'select provider, health, circuit_open_until from integration_accounts order by provider',
    );
    const byProvider = Object.fromEntries(rows.map((r) => [r.provider, r]));

    expect(byProvider.swiggy.health).toBe('down');
    expect(byProvider.swiggy.circuit_open_until).not.toBeNull();
    expect(byProvider.zomato.health).not.toBe('down');
  });

  it('still ingests Zomato orders while Swiggy is down', async () => {
    const result = await ingest('zomato', 'MP-ZM-WHILE-SW-DOWN', 'MP-ZM-WHILE-SW-DOWN-EVT');
    expect(result.duplicate).toBe(false);
    expect(result.ticket_id).toBeTruthy();
  });

  it('closes the circuit again on a success', async () => {
    await asService(db, `select record_integration_success('swiggy')`);

    const [account] = await asService<{
      health: string;
      consecutive_failures: number;
      circuit_open_until: string | null;
    }>(
      db,
      `select health, consecutive_failures, circuit_open_until
         from integration_accounts where provider = 'swiggy'`,
    );

    expect(account.consecutive_failures).toBe(0);
    expect(account.circuit_open_until).toBeNull();
    // Still 'disabled' rather than 'connected', because the account has no
    // verified credentials and is not enabled -- which is the honest state.
    expect(account.health).toBe('disabled');
  });
});

describe('two-way reconciliation', () => {
  it('reports orders the platform has that we do not, and vice versa', async () => {
    const [result] = await asService<{
      result: {
        status: string;
        missing_internal: string[];
        missing_external: string[];
      };
    }>(
      db,
      `select reconcile_marketplace_orders(
         'swiggy',
         now() - interval '1 hour',
         now() + interval '1 hour',
         array['MP-SW-1','MP-PLATFORM-ONLY']) as result`,
    );

    expect(result.result.status).toBe('discrepancies');
    expect(result.result.missing_internal).toContain('MP-PLATFORM-ONLY');
    // MP-SW-2 exists here but was not in the platform's list.
    expect(result.result.missing_external).toContain('MP-SW-2');
  });

  it('reports clean when both sides agree', async () => {
    const ids = await asService<{ external_order_id: string }>(
      db,
      `select external_order_id from orders
        where source = 'ZM' and placed_at > now() - interval '1 hour'`,
    );

    const [result] = await asService<{ result: { status: string } }>(
      db,
      `select reconcile_marketplace_orders(
         'zomato', now() - interval '1 hour', now() + interval '1 hour', $1) as result`,
      [ids.map((r) => r.external_order_id)],
    );

    expect(result.result.status).toBe('clean');
  });
});

describe('capability honesty', () => {
  it('labels every marketplace capability as integrated, mocked or blocked', async () => {
    const rows = await asService<{ provider: string; capability: string; state: string }>(
      db,
      'select provider, capability, state from integration_capabilities order by provider, capability',
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(['integrated', 'mocked', 'blocked']).toContain(row.state);
    }
  });

  it('does not claim a live integration that has not been verified', async () => {
    const [row] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from integration_capabilities
        where state = 'integrated' and verified_at is null`,
    );
    expect(row.n).toBe(0);
  });

  it('never stores a credential value, only a reference to one', async () => {
    const rows = await asService<{ credentials_ref: string; webhook_secret_ref: string }>(
      db,
      'select credentials_ref, webhook_secret_ref from integration_accounts',
    );

    for (const row of rows) {
      // A reference is the NAME of an environment variable, never a secret.
      expect(row.credentials_ref).toMatch(/^[A-Z0-9_]+$/);
      expect(row.webhook_secret_ref).toMatch(/^[A-Z0-9_]+$/);
    }
  });
});
