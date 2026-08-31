/**
 * Applies supabase/migrations to a live database, in order, one transaction
 * per file, recording each in supabase_migrations.schema_migrations so the
 * Supabase CLI recognises them later.
 *
 * Reads the connection string from DATABASE_URL and never prints it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const onlySeed = process.argv.includes('--seed-only');
const withSeed = onlySeed || process.argv.includes('--seed');

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 120_000,
});

await client.connect();
console.log('connected');

await client.query(`create schema if not exists supabase_migrations`);
await client.query(`
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[],
    name text
  )`);

const { rows: applied } = await client.query(
  'select version from supabase_migrations.schema_migrations',
);
const done = new Set(applied.map((r) => r.version));

if (!onlySeed) {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const version = file.split('_')[0];

    if (done.has(version)) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }

    const sql = readFileSync(join(dir, file), 'utf8');

    try {
      await client.query('begin');
      await client.query(sql);
      await client.query(
        'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2) on conflict do nothing',
        [version, file],
      );
      await client.query('commit');
      console.log(`ok    ${file}`);
    } catch (error) {
      await client.query('rollback');
      console.error(`FAIL  ${file}`);
      console.error(`      ${error.message}`);
      if (error.where) console.error(`      where: ${error.where}`);
      if (error.detail) console.error(`      detail: ${error.detail}`);
      await client.end();
      process.exit(1);
    }
  }
}

if (withSeed) {
  const seed = readFileSync(join(process.cwd(), 'supabase', 'seed.sql'), 'utf8');
  try {
    await client.query(seed);
    console.log('ok    seed.sql');
  } catch (error) {
    console.error('FAIL  seed.sql');
    console.error(`      ${error.message}`);
    if (error.where) console.error(`      where: ${error.where}`);
    await client.end();
    process.exit(1);
  }
}

const summary = await client.query(`
  select
    (select count(*) from information_schema.tables
      where table_schema='public' and table_type='BASE TABLE') as tables,
    (select count(*) from pg_policies where schemaname='public') as policies,
    (select count(*) from information_schema.views where table_schema='public') as views
`);

console.log('\nschema now holds:', summary.rows[0]);
await client.end();
