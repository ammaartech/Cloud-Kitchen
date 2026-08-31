-- =============================================================================
-- Test-only shim: the parts of a Supabase instance the schema depends on.
-- =============================================================================
-- On a real project Supabase provides auth.users, auth.uid(), and the anon /
-- authenticated / service_role database roles. PGlite is a bare Postgres, so
-- the harness creates just enough of them for the migrations to run and for
-- RLS to be exercised against real, non-superuser roles.
--
-- This file is NEVER applied to a real environment -- it lives under tests/.
-- =============================================================================

create schema if not exists auth;

-- Mirrors the subset of Supabase's auth.users that the seed writes to, so the
-- same seed file runs unchanged against a real project.
create table if not exists auth.users (
  instance_id        uuid,
  id                 uuid primary key default gen_random_uuid(),
  aud                text,
  role               text,
  email              text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  phone              text,
  -- GoTrue scans these into non-nullable Go strings, so a NULL here breaks
  -- login with "Database error querying schema". They must be '' not null.
  confirmation_token       text default '',
  recovery_token           text default '',
  email_change_token_new   text default '',
  email_change             text default '',
  email_change_token_current text default '',
  phone_change             text default '',
  phone_change_token       text default '',
  reauthentication_token   text default '',
  raw_app_meta_data  jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  -- Deliberately NO default, matching Supabase: GoTrue always supplies these,
  -- and a NULL here makes it fail to scan the row into a time.Time, breaking
  -- every login with "Database error querying schema". The shim mirrors that
  -- so a seed which forgets them fails here rather than in production.
  created_at         timestamptz,
  updated_at         timestamptz
);

create table if not exists auth.identities (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider_id     text not null,
  provider        text not null,
  identity_data   jsonb not null default '{}'::jsonb,
  last_sign_in_at timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz,
  unique (provider, provider_id)
);

-- Supabase derives this from the request JWT. Here it reads the same session
-- GUC that server-side code sets, which is exactly how the real helpers behave
-- when the service role acts on a user's behalf.
create or replace function auth.uid()
returns uuid
language sql
stable
as $fn$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$fn$;

do $do$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$do$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
