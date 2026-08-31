import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, actingAs, expectFailure, asService, type Db } from './harness/db';
import { OWNER, MANAGER, KITCHEN } from './harness/ids';

let db: Db;

/** Ingest a marketplace order and return its fresh NEW ticket. */
async function newTicket(externalId: string) {
  const [row] = await asService<{ result: { ticket_id: string; order_id: string } }>(
    db,
    `select ingest_marketplace_order(
       'swiggy', $1,
       '[{"name":"Test Bowl","quantity":1,"unit_price":250}]'::jsonb,
       '{"subtotal":250,"grand_total":262.5}'::jsonb
     ) as result`,
    [externalId],
  );
  return row.result;
}

async function ticketStatus(ticketId: string) {
  const [row] = await asService<{ status: string }>(
    db,
    'select status from kot_tickets where id = $1',
    [ticketId],
  );
  return row.status;
}

/** Call the transition RPC as a specific staff member. */
async function transition(
  profileId: string,
  ticketId: string,
  to: string,
  reason: string | null = null,
) {
  return actingAs(db, { role: 'authenticated', profileId }, (tx) =>
    tx.query('select transition_kot_ticket($1, $2, $3) as result', [ticketId, to, reason]),
  );
}

beforeAll(async () => {
  db = await createTestDb({ seed: true });
});

afterAll(async () => {
  await db?.close();
});

describe('the KOT state machine is enforced by the database', () => {
  it('walks the full happy path with the right role at each step', async () => {
    const { ticket_id } = await newTicket('SM-HAPPY-1');

    await transition(MANAGER, ticket_id, 'ACCEPTED');
    expect(await ticketStatus(ticket_id)).toBe('ACCEPTED');

    // Kitchen starts preparing -- the Manager cannot, by design.
    await transition(KITCHEN, ticket_id, 'PREPARING');
    expect(await ticketStatus(ticket_id)).toBe('PREPARING');

    // The kitchen tells the Manager verbally; the Manager marks it ready.
    await transition(MANAGER, ticket_id, 'READY_FOR_PICKUP');
    await transition(MANAGER, ticket_id, 'PICKED_UP');
    await transition(MANAGER, ticket_id, 'OUT_FOR_DELIVERY');
    await transition(MANAGER, ticket_id, 'DELIVERED');
    await transition(MANAGER, ticket_id, 'COMPLETED');

    expect(await ticketStatus(ticket_id)).toBe('COMPLETED');
  });

  it('rejects a transition that skips a step', async () => {
    const { ticket_id } = await newTicket('SM-SKIP-1');

    const message = await expectFailure(() =>
      transition(MANAGER, ticket_id, 'READY_FOR_PICKUP'),
    );
    expect(message).toMatch(/illegal KOT transition NEW -> READY_FOR_PICKUP/);
    expect(await ticketStatus(ticket_id)).toBe('NEW');
  });

  it('rejects a transition backwards', async () => {
    const { ticket_id } = await newTicket('SM-BACK-1');
    await transition(MANAGER, ticket_id, 'ACCEPTED');

    const message = await expectFailure(() => transition(MANAGER, ticket_id, 'NEW'));
    expect(message).toMatch(/illegal KOT transition ACCEPTED -> NEW/);
  });

  it('treats a repeated transition as a no-op rather than an error', async () => {
    // A double tap on a kitchen tablet under rush should not surface a failure.
    const { ticket_id } = await newTicket('SM-DOUBLE-1');
    await transition(MANAGER, ticket_id, 'ACCEPTED');

    const result = await actingAs(
      db,
      { role: 'authenticated', profileId: MANAGER },
      async (tx) => {
        const r = await tx.query<{ result: { noop: boolean } }>(
          `select transition_kot_ticket($1, 'ACCEPTED') as result`,
          [ticket_id],
        );
        return r.rows[0].result;
      },
    );

    expect(result.noop).toBe(true);
    expect(await ticketStatus(ticket_id)).toBe('ACCEPTED');
  });

  it('requires a reason before a rejection is accepted', async () => {
    const { ticket_id } = await newTicket('SM-REJECT-1');

    const message = await expectFailure(() => transition(MANAGER, ticket_id, 'REJECTED'));
    expect(message).toMatch(/requires a reason/i);

    await transition(MANAGER, ticket_id, 'REJECTED', 'Out of an ingredient');
    expect(await ticketStatus(ticket_id)).toBe('REJECTED');
  });

  it('marks the rejection as requiring confirmation in the transition table', async () => {
    const [rule] = await asService<{ requires_confirmation: boolean }>(
      db,
      `select requires_confirmation from kot_transitions
        where from_status = 'NEW' and to_status = 'REJECTED'`,
    );
    expect(rule.requires_confirmation).toBe(true);
  });
});

describe('role boundaries on the board', () => {
  it('keeps the Owner"s KOT strictly read-only', async () => {
    const { ticket_id } = await newTicket('SM-OWNER-1');

    for (const target of ['ACCEPTED', 'PREPARING', 'CANCELLED']) {
      const message = await expectFailure(() =>
        transition(OWNER, ticket_id, target, 'owner attempt'),
      );
      expect(message, `owner should not reach ${target}`).toMatch(
        /may not perform transition|illegal KOT transition/i,
      );
    }

    expect(await ticketStatus(ticket_id)).toBe('NEW');
  });

  it('stops Kitchen Staff accepting or marking ready', async () => {
    const { ticket_id } = await newTicket('SM-KITCHEN-1');

    const acceptFailure = await expectFailure(() => transition(KITCHEN, ticket_id, 'ACCEPTED'));
    expect(acceptFailure).toMatch(/may not perform transition/i);

    await transition(MANAGER, ticket_id, 'ACCEPTED');
    await transition(KITCHEN, ticket_id, 'PREPARING');

    const readyFailure = await expectFailure(() =>
      transition(KITCHEN, ticket_id, 'READY_FOR_PICKUP'),
    );
    expect(readyFailure).toMatch(/may not perform transition/i);
  });

  it('lets only the Manager override a preparation ETA', async () => {
    const { ticket_id } = await newTicket('SM-ETA-1');

    const message = await expectFailure(() =>
      actingAs(db, { role: 'authenticated', profileId: KITCHEN }, (tx) =>
        tx.query('select override_prep_eta($1, 45)', [ticket_id]),
      ),
    );
    expect(message).toMatch(/not permitted to override/i);

    await actingAs(db, { role: 'authenticated', profileId: MANAGER }, (tx) =>
      tx.query('select override_prep_eta($1, 45)', [ticket_id]),
    );

    const [ticket] = await asService<{
      prep_eta_minutes: number;
      prep_eta_minutes_original: number;
      eta_overridden_by: string;
    }>(
      db,
      `select prep_eta_minutes, prep_eta_minutes_original, eta_overridden_by
         from kot_tickets where id = $1`,
      [ticket_id],
    );

    expect(ticket.prep_eta_minutes).toBe(45);
    // The kitchen's original estimate survives the override.
    expect(ticket.prep_eta_minutes_original).toBe(25);
    expect(ticket.eta_overridden_by).toBe(MANAGER);
  });
});

describe('history and timestamps', () => {
  it('writes a status event for every move, including creation', async () => {
    const { ticket_id } = await newTicket('SM-HISTORY-1');
    await transition(MANAGER, ticket_id, 'ACCEPTED');
    await transition(KITCHEN, ticket_id, 'PREPARING');

    const events = await asService<{ from_status: string | null; to_status: string; actor_role: string }>(
      db,
      `select from_status, to_status, actor_role from kot_status_events
        where ticket_id = $1 order by occurred_at, to_status`,
      [ticket_id],
    );

    expect(events).toHaveLength(3);
    expect(events[0].from_status).toBeNull();
    expect(events[0].to_status).toBe('NEW');
    expect(events.map((e) => e.to_status)).toContain('PREPARING');
    expect(events.find((e) => e.to_status === 'PREPARING')?.actor_role).toBe('kitchen_staff');
  });

  it('stamps the timestamps that prep time is measured from', async () => {
    const { ticket_id } = await newTicket('SM-TIMING-1');
    await transition(MANAGER, ticket_id, 'ACCEPTED');
    await transition(KITCHEN, ticket_id, 'PREPARING');
    await transition(MANAGER, ticket_id, 'READY_FOR_PICKUP');

    const [ticket] = await asService<{
      accepted_at: string | null;
      ready_at: string | null;
      accepted_by: string | null;
      ready_by: string | null;
    }>(
      db,
      'select accepted_at, ready_at, accepted_by, ready_by from kot_tickets where id = $1',
      [ticket_id],
    );

    // prep time = accepted -> ready (PRD 10)
    expect(ticket.accepted_at).not.toBeNull();
    expect(ticket.ready_at).not.toBeNull();
    expect(ticket.accepted_by).toBe(MANAGER);
    expect(ticket.ready_by).toBe(MANAGER);
  });
});

describe('numbering', () => {
  it('uses a source prefix and resets the sequence each business day', async () => {
    const rows = await asService<{ source: string; business_date: string; codes: string[] }>(
      db,
      `select source, business_date::text, array_agg(ticket_code order by daily_number) codes
         from kot_tickets group by source, business_date
        having count(*) > 1
        order by business_date desc limit 3`,
    );

    for (const group of rows) {
      const prefix = group.source;
      expect(group.codes[0]).toBe(`${prefix}-001`);
      // Numbers within a business day are contiguous from 001.
      group.codes.forEach((code, index) => {
        expect(code).toBe(`${prefix}-${String(index + 1).padStart(3, '0')}`);
      });
    }
  });

  it('numbers each source independently on the same day', async () => {
    const [row] = await asService<{ n: number }>(
      db,
      `select count(*)::int n from kot_tickets
        where ticket_code in ('SW-001','ZM-001')
          and business_date = (select max(business_date) from kot_tickets)`,
    );
    expect(row.n).toBeGreaterThan(0);
  });

  it('keeps the overall order number separate from the daily KOT number', async () => {
    const [row] = await asService<{ order_number: number; ticket_code: string }>(
      db,
      `select o.order_number, t.ticket_code
         from orders o join kot_tickets t on t.order_id = o.id
        order by o.order_number desc limit 1`,
    );

    expect(row.order_number).toBeGreaterThan(1);
    expect(row.ticket_code).toMatch(/^(SW|ZM|SX)-\d{3}$/);
  });
});

describe('priority', () => {
  it('gives marketplace orders a higher baseline than subscription deliveries', async () => {
    const rows = await asService<{ source: string; priority: number }>(
      db,
      'select distinct source, priority from kot_tickets order by source',
    );
    const bySource = Object.fromEntries(rows.map((r) => [r.source, r.priority]));

    expect(bySource.SW).toBeGreaterThan(bySource.SX);
    expect(bySource.ZM).toBeGreaterThan(bySource.SX);
  });

  it('escalates urgency as a ticket approaches its deadline', async () => {
    const { ticket_id } = await newTicket('SM-URGENT-1');
    await asService(db, `update kot_tickets set sla_due_at = now() - interval '5 min' where id = $1`, [
      ticket_id,
    ]);

    const score = await actingAs(
      db,
      { role: 'authenticated', profileId: MANAGER },
      async (tx) => {
        const r = await tx.query<{ urgency_score: number }>(
          'select urgency_score from v_kot_tickets where id = $1',
          [ticket_id],
        );
        return r.rows[0].urgency_score;
      },
    );

    expect(score).toBe(1000);
  });
});

describe('a ticket cannot exist without a confirmed order', () => {
  it('refuses to create one for a draft order', async () => {
    const [order] = await asService<{ id: string }>(
      db,
      `insert into orders (source, status, external_order_id)
       values ('SW', 'DRAFT', 'SM-DRAFT-1') returning id`,
    );

    // Written straight into the table, bypassing every helper, because the
    // trigger is what has to hold.
    const message = await expectFailure(() =>
      asService(
        db,
        `insert into kot_tickets
           (order_id, source, business_date, daily_number, ticket_code, status)
         values ($1, 'SW', app.business_date(), 999, 'SW-999', 'NEW')`,
        [order.id],
      ),
    );
    expect(message).toMatch(/not KOT eligible/i);
  });
});
