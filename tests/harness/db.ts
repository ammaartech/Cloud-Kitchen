/**
 * Test database harness.
 *
 * Runs the real migration set against PGlite (Postgres compiled to WASM), so
 * the tests exercise the actual constraints, triggers, RLS policies and RPCs
 * rather than a mock of them. Nothing here is used at runtime.
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');

export type Db = PGlite;

/** Roles a test can act as, matching the roles Supabase issues tokens for. */
export type ActAs =
  | { role: 'service_role' }
  | { role: 'authenticated'; profileId: string }
  | { role: 'anon' };

export async function createTestDb(options: { seed?: boolean } = {}): Promise<Db> {
  const db = await PGlite.create({ extensions: { pgcrypto } });

  await db.exec(readFileSync(join(HERE, 'supabase-shim.sql'), 'utf8'));

  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`migration ${file} failed: ${(error as Error).message}`);
    }
  }

  if (options.seed) {
    const seed = readFileSync(join(ROOT, 'supabase', 'seed.sql'), 'utf8');
    try {
      await db.exec(seed);
    } catch (error) {
      throw new Error(`seed failed: ${(error as Error).message}`);
    }
  }

  return db;
}

/**
 * Run a callback as a specific principal.
 *
 * Wrapped in a transaction with SET LOCAL so the role and claims never leak
 * into the next test, and so RLS is evaluated against a genuinely
 * non-superuser role -- as superuser, every policy would be bypassed and the
 * tests would prove nothing.
 */
export async function actingAs<T>(
  db: Db,
  who: ActAs,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  await db.exec('begin');
  try {
    if (who.role === 'service_role') {
      await db.query(`set local request.jwt.claims = '{"role":"service_role"}'`);
      await db.query(`set local role service_role`);
    } else if (who.role === 'authenticated') {
      await db.query(`set local request.jwt.claims = '{"role":"authenticated"}'`);
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [
        who.profileId,
      ]);
      await db.query(`set local role authenticated`);
    } else {
      await db.query(`set local request.jwt.claims = '{"role":"anon"}'`);
      await db.query(`set local role anon`);
    }

    const result = await fn(db);
    await db.exec('commit');
    return result;
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}

/** Assert that a callback fails, and return the message for further checks. */
export async function expectFailure(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('expected the operation to fail, but it succeeded');
}

/** Convenience: run SQL as the service role outside a test's own transaction. */
export async function asService<T = Record<string, unknown>>(
  db: Db,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return actingAs(db, { role: 'service_role' }, async (tx) => {
    const result = await tx.query<T>(sql, params);
    return result.rows;
  });
}
