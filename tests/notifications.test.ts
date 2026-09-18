import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createTestDb, asService, expectFailure, actingAs, type Db } from './harness/db';

let db: Db;

/** Enqueue a notification directly, as the core flows' triggers would. */
async function enqueue(fields: Partial<{
  status: string;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
}> = {}): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into notifications (channel, to_address, template_code, payload,
                                status, attempts, max_attempts, next_attempt_at)
     values ('whatsapp', '+919000000000', 'subscription_activated', '{}'::jsonb,
             $1::notification_status, $2, $3, $4)
     returning id`,
    [
      fields.status ?? 'queued',
      fields.attempts ?? 0,
      fields.max_attempts ?? 5,
      fields.next_attempt_at ?? new Date(Date.now() - 1000).toISOString(),
    ],
  );
  return rows[0].id;
}

async function claim(limit = 50): Promise<string[]> {
  const rows = await asService<{ id: string }>(db, 'select id from claim_notifications($1)', [limit]);
  return rows.map((r) => r.id);
}

async function complete(results: unknown[]): Promise<void> {
  await asService(db, `select complete_notifications('console', $1::jsonb)`, [
    JSON.stringify(results),
  ]);
}

async function row(id: string) {
  const { rows } = await db.query<{
    status: string;
    attempts: number;
    next_attempt_at: Date;
    sent_at: Date | null;
    provider: string | null;
    provider_message_id: string | null;
    last_error: string | null;
    rendered_body: string | null;
  }>('select * from notifications where id = $1', [id]);
  return rows[0];
}

beforeAll(async () => {
  db = await createTestDb({ seed: true });
});

afterAll(async () => {
  await db?.close();
});

describe('claim_notifications', () => {
  it('claims due rows once, and a second run gets none of them', async () => {
    await db.query('delete from notifications');
    const a = await enqueue();
    const b = await enqueue({ status: 'failed' });
    await enqueue({ next_attempt_at: new Date(Date.now() + 3_600_000).toISOString() });

    const first = await claim();
    expect(first.sort()).toEqual([a, b].sort());
    expect((await row(a)).status).toBe('sending');

    expect(await claim()).toEqual([]);
  });

  it('respects the limit', async () => {
    await db.query('delete from notifications');
    for (let i = 0; i < 4; i += 1) await enqueue();
    expect(await claim(3)).toHaveLength(3);
    expect(await claim(3)).toHaveLength(1);
  });

  it('reclaims a row left in sending by a run that died', async () => {
    await db.query('delete from notifications');
    const id = await enqueue();
    await claim();
    // Age the claim past the stale window. The touch trigger would reset
    // updated_at on a normal update, so bypass it for the test.
    await db.exec('alter table notifications disable trigger notifications_touch');
    await db.query(`update notifications set updated_at = now() - interval '11 minutes' where id = $1`, [id]);
    await db.exec('alter table notifications enable trigger notifications_touch');

    expect(await claim()).toEqual([id]);
  });

  it('is not callable by a browser token', async () => {
    const message = await expectFailure(() =>
      actingAs(db, { role: 'anon' }, (tx) => tx.query('select * from claim_notifications(1)')),
    );
    expect(message).toMatch(/permission denied/);
  });
});

describe('complete_notifications', () => {
  it('records a send, a retryable failure, and a permanent failure in one call', async () => {
    await db.query('delete from notifications');
    const ok = await enqueue();
    const retry = await enqueue({ attempts: 1 });
    const permanent = await enqueue();
    await claim();

    const before = Date.now();
    await complete([
      { id: ok, sent: true, body: 'hello', provider_message_id: 'msg-1' },
      { id: retry, sent: false, body: 'hello', error: 'timeout', retryable: true },
      { id: permanent, sent: false, body: 'hello', error: 'bad number', retryable: false },
    ]);

    const sent = await row(ok);
    expect(sent).toMatchObject({
      status: 'sent',
      attempts: 1,
      provider: 'console',
      provider_message_id: 'msg-1',
      last_error: null,
      rendered_body: 'hello',
    });
    expect(sent.sent_at).not.toBeNull();

    const failed = await row(retry);
    expect(failed).toMatchObject({ status: 'failed', attempts: 2, last_error: 'timeout' });
    // Second attempt backs off 2^2 = 4 minutes.
    const delay = failed.next_attempt_at.getTime() - before;
    expect(delay).toBeGreaterThan(3.5 * 60_000);
    expect(delay).toBeLessThan(4.5 * 60_000);

    expect(await row(permanent)).toMatchObject({ status: 'dead_letter', attempts: 1 });

    const { rows: events } = await db.query<{ event_type: string }>(
      'select event_type from notification_events where notification_id = any($1) order by event_type',
      [[ok, retry, permanent]],
    );
    expect(events.map((e) => e.event_type)).toEqual(['failed', 'failed', 'sent']);
  });

  it('parks a row in dead_letter once attempts reach max_attempts', async () => {
    await db.query('delete from notifications');
    const id = await enqueue({ attempts: 2, max_attempts: 3 });
    await claim();
    await complete([{ id, sent: false, body: 'x', error: 'timeout', retryable: true }]);
    expect(await row(id)).toMatchObject({ status: 'dead_letter', attempts: 3 });
  });

  it('caps the backoff at an hour', async () => {
    await db.query('delete from notifications');
    const id = await enqueue({ attempts: 8, max_attempts: 20 });
    await claim();
    const before = Date.now();
    await complete([{ id, sent: false, body: 'x', error: 'timeout', retryable: true }]);
    const delay = (await row(id)).next_attempt_at.getTime() - before;
    expect(delay).toBeLessThan(61 * 60_000);
    expect(delay).toBeGreaterThan(59 * 60_000);
  });
});
