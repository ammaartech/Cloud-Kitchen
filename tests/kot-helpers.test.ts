import { describe, expect, it } from 'vitest';
import { istDayRange, todayISO } from '../src/lib/kot/date';
import { sortTickets, urgencyScore } from '../src/lib/kot/urgency';
import { loadTicketItems } from '../src/lib/kot/items';
import { safeNextPath } from '../src/lib/auth/redirect';
import type { BoardTicket } from '../src/lib/realtime/kot-board-shared';

/**
 * The pure helpers the KOT screens lean on. They run without a database, so
 * they are the fast path of the suite; what they check is that the browser's
 * arithmetic agrees with the database's.
 */

describe('business-day arithmetic', () => {
  it('reports the IST calendar day, not the UTC one', () => {
    // 20:00 UTC on the 15th is 01:30 IST on the 16th.
    expect(todayISO(new Date('2026-09-15T20:00:00Z'))).toBe('2026-09-16');
    expect(todayISO(new Date('2026-09-15T18:29:59Z'))).toBe('2026-09-15');
  });

  it('expresses an IST day as a half-open UTC range', () => {
    expect(istDayRange('2026-09-16')).toEqual({
      startUtc: '2026-09-15T18:30:00.000Z',
      endUtc: '2026-09-16T18:30:00.000Z',
    });
  });
});

describe('urgency mirrors v_kot_tickets', () => {
  const now = Date.parse('2026-09-16T10:00:00Z');
  const at = (secondsFromNow: number) => new Date(now + secondsFromNow * 1000).toISOString();

  it('is zero with no deadline', () => {
    expect(urgencyScore(null, now)).toBe(0);
    expect(urgencyScore(undefined, now)).toBe(0);
    expect(urgencyScore('not a date', now)).toBe(0);
  });

  it('is 1000 once the deadline has passed', () => {
    expect(urgencyScore(at(0), now)).toBe(1000);
    expect(urgencyScore(at(-300), now)).toBe(1000);
  });

  it('ramps over the last ten minutes with integer division', () => {
    // 600 - 600/6
    expect(urgencyScore(at(600), now)).toBe(500);
    // 600 - trunc(59/6) = 600 - 9
    expect(urgencyScore(at(59), now)).toBe(591);
    // Beyond an hour there is no urgency to add.
    expect(urgencyScore(at(3600), now)).toBe(0);
    expect(urgencyScore(at(7200), now)).toBe(0);
  });

  it('sorts by priority plus urgency, then by arrival', () => {
    const ticket = (id: string, priority: number, sla: string | null, created: string) =>
      ({ id, priority, sla_due_at: sla, created_at: created }) as BoardTicket;

    const sorted = sortTickets(
      [
        ticket('old-sub', 10, null, '2026-09-16T09:00:00Z'),
        ticket('new-sub', 10, null, '2026-09-16T09:30:00Z'),
        ticket('swiggy', 50, null, '2026-09-16T09:45:00Z'),
        ticket('overdue-sub', 10, at(-60), '2026-09-16T09:50:00Z'),
      ],
      now,
    );

    expect(sorted.map((row) => row.id)).toEqual(['overdue-sub', 'swiggy', 'old-sub', 'new-sub']);
  });
});

describe('ticket items are read in bulk', () => {
  interface Call {
    ids: string[];
  }

  /** A stand-in for the Supabase client that answers `in('order_id', ...)`. */
  function fakeClient(answer: (ids: string[]) => Array<{ id: string; order_id: string }>) {
    const calls: Call[] = [];
    const client = {
      from: () => ({
        select: () => ({
          in: (_column: string, ids: string[]) => ({
            order: () => {
              calls.push({ ids });
              return Promise.resolve({ data: answer(ids), error: null });
            },
          }),
        }),
      }),
    };
    return { calls, client: client as unknown as Parameters<typeof loadTicketItems>[0] };
  }

  it('groups rows by order and asks once per hundred orders', async () => {
    const orders = Array.from({ length: 250 }, (_, index) => `order-${index}`);
    const { calls, client } = fakeClient((ids) =>
      ids.flatMap((orderId) => [
        { id: `${orderId}-a`, order_id: orderId },
        { id: `${orderId}-b`, order_id: orderId },
      ]),
    );

    const items = await loadTicketItems(client, [...orders, orders[0]]);

    expect(calls).toHaveLength(3);
    expect(items.size).toBe(250);
    expect(items.get('order-7')?.map((row) => row.id)).toEqual(['order-7-a', 'order-7-b']);
  });

  it('gives an order with no lines an empty list rather than nothing', async () => {
    const { client } = fakeClient(() => []);
    const items = await loadTicketItems(client, ['lonely']);
    expect(items.get('lonely')).toEqual([]);
  });

  it('splits a response that hit the API cap and reads both halves', async () => {
    const { calls, client } = fakeClient((ids) =>
      // Two orders together look capped; either alone does not.
      ids.length > 1
        ? Array.from({ length: 1000 }, (_, index) => ({ id: `x-${index}`, order_id: ids[0] }))
        : [{ id: `${ids[0]}-only`, order_id: ids[0] }],
    );

    const items = await loadTicketItems(client, ['a', 'b']);

    expect(calls.map((call) => call.ids)).toEqual([['a', 'b'], ['a'], ['b']]);
    expect(items.get('a')?.map((row) => row.id)).toEqual(['a-only']);
    expect(items.get('b')?.map((row) => row.id)).toEqual(['b-only']);
  });
});

describe('post-sign-in destinations stay on this site', () => {
  it('accepts a path', () => {
    expect(safeNextPath('/account')).toBe('/account');
    expect(safeNextPath('/kot/manager?tab=all&date=2026-09-16')).toBe(
      '/kot/manager?tab=all&date=2026-09-16',
    );
  });

  it('refuses anything that would leave the origin', () => {
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(safeNextPath('javascript:alert(1)')).toBeNull();
    expect(safeNextPath('/ok\nSet-Cookie: x')).toBeNull();
  });

  it('refuses the wrong shape', () => {
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(['/a', '/b'])).toBeNull();
    expect(safeNextPath('')).toBeNull();
  });
});
