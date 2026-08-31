-- =============================================================================
-- 0002  Identity, RBAC and the audit trail
-- =============================================================================
-- Authorization is data, not code: which role may do what lives in
-- role_permissions, so permissions can be retuned without a deploy (PRD 20).
-- Every policy in 0090_rls.sql resolves through the helpers defined here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shared trigger helpers
-- -----------------------------------------------------------------------------
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- auth_profiles: one row per authenticated principal, keyed to Supabase auth.
-- Customers get a profile too, with role = 'customer'.
-- -----------------------------------------------------------------------------
create table public.auth_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text        not null default '',
  email           text,
  phone           text,
  phone_verified  boolean     not null default false,
  role            public.app_role not null default 'customer',
  is_active       boolean     not null default true,
  -- Account deletion disables login but preserves historical business records
  -- (PRD 14). We never hard-delete a profile that has orders against it.
  disabled_at     timestamptz,
  disabled_reason text,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index auth_profiles_role_idx on public.auth_profiles(role) where is_active;
create unique index auth_profiles_email_key on public.auth_profiles(lower(email)) where email is not null;

create trigger auth_profiles_touch
  before update on public.auth_profiles
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Permission catalogue. Codes are '<domain>.<action>' and are referenced by
-- both RLS policies and the server-side API guard.
-- -----------------------------------------------------------------------------
create table public.permissions (
  code        text primary key,
  domain      text not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table public.role_permissions (
  role            public.app_role not null,
  permission_code text not null references public.permissions(code) on delete cascade,
  granted_at      timestamptz not null default now(),
  primary key (role, permission_code)
);

create index role_permissions_role_idx on public.role_permissions(role);

-- -----------------------------------------------------------------------------
-- employees: staffing records. Counts are configurable data, never constants
-- (PRD 5) -- add a fourth kitchen hand by inserting a row.
-- -----------------------------------------------------------------------------
create table public.employees (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null unique references public.auth_profiles(id) on delete cascade,
  employee_code text not null unique,
  display_name  text not null,
  role          public.app_role not null,
  hired_on      date,
  is_active     boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint employees_role_is_staff
    check (role in ('developer_admin', 'owner', 'branch_manager', 'kitchen_staff'))
);

create trigger employees_touch
  before update on public.employees
  for each row execute function app.touch_updated_at();

-- =============================================================================
-- Authorization helpers
-- =============================================================================
-- These are SECURITY DEFINER so that reading a caller's own role from inside an
-- RLS policy does not itself re-enter RLS on auth_profiles (infinite recursion).
-- search_path is pinned to defeat search-path hijacking.
-- =============================================================================

-- Server-side jobs (webhooks, schedulers, seeds) run as the service role with
-- no JWT. They announce who they are acting for via a session GUC so the audit
-- trail still names a real actor instead of "system".
create or replace function app.current_actor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    nullif(current_setting('app.actor_id', true), '')::uuid,
    auth.uid()
  );
$fn$;

create or replace function app.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $fn$
  select p.role
  from public.auth_profiles p
  where p.id = app.current_actor_id()
    and p.is_active;
$fn$;

-- The service role bypasses RLS anyway; this makes the intent explicit in
-- policies that also need to admit trusted server code.
create or replace function app.is_service_role()
returns boolean
language sql
stable
as $fn$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''
  ) = 'service_role';
$fn$;

-- True when there is no PostgREST request context at all -- a migration, the
-- seed, or a psql session. Such a connection is already fully trusted (it can
-- ALTER TABLE), so the privilege guards below exempt it rather than blocking
-- the bootstrap that grants the very first administrator their role.
create or replace function app.is_direct_connection()
returns boolean
language sql
stable
as $fn$
  select nullif(current_setting('request.jwt.claims', true), '') is null;
$fn$;

create or replace function app.has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select app.is_service_role()
      or exists (
        select 1
        from public.role_permissions rp
        where rp.role = app.current_role()
          and rp.permission_code = p_code
      );
$fn$;

create or replace function app.has_any_permission(p_codes text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select app.is_service_role()
      or exists (
        select 1
        from public.role_permissions rp
        where rp.role = app.current_role()
          and rp.permission_code = any(p_codes)
      );
$fn$;

create or replace function app.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select app.current_role() in
    ('developer_admin', 'owner', 'branch_manager', 'kitchen_staff');
$fn$;

-- Owner and Developer Admin are the only audit-log readers (PRD 17).
create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select app.current_role() in ('developer_admin', 'owner');
$fn$;

grant usage on schema app to authenticated, anon, service_role;
grant execute on all functions in schema app to authenticated, anon, service_role;

-- =============================================================================
-- Audit log (PRD 17)
-- =============================================================================
create table public.audit_logs (
  id           bigserial primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid references public.auth_profiles(id) on delete set null,
  actor_role   public.app_role,
  actor_label  text,                    -- survives actor deletion
  action       public.audit_action not null,
  entity_type  text not null,
  entity_id    text,
  old_values   jsonb,
  new_values   jsonb,
  changed_keys text[],
  context      jsonb not null default '{}'::jsonb,
  request_id   text,
  ip_address   inet,
  user_agent   text
);

create index audit_logs_entity_idx    on public.audit_logs(entity_type, entity_id, occurred_at desc);
create index audit_logs_actor_idx     on public.audit_logs(actor_id, occurred_at desc);
create index audit_logs_occurred_idx  on public.audit_logs(occurred_at desc);

-- Append-only: nobody, including Owner, may rewrite history.
--
-- A trigger rather than a RULE: rules would silently discard the write (so a
-- caller would believe it succeeded), and any table carrying a rule cannot be
-- the target of INSERT ... ON CONFLICT, which the ledger in 0006 depends on.
create or replace function app.forbid_mutation()
returns trigger
language plpgsql
as $fn$
begin
  raise exception '% is append-only; % is not permitted', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$fn$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function app.forbid_mutation();

-- -----------------------------------------------------------------------------
-- Generic audit trigger. Attach to any table whose changes must be traceable;
-- records only the keys that actually changed so the log stays readable.
-- Pass a Postgres array literal of column names to redact, e.g.
--   execute function app.audit_trigger('{credentials,webhook_secret}')
-- -----------------------------------------------------------------------------
create or replace function app.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_old       jsonb;
  v_new       jsonb;
  v_changed   text[];
  v_action    public.audit_action;
  v_entity_id text;
  v_actor     uuid := app.current_actor_id();
  v_redact    text[] := case when tg_nargs > 0 then tg_argv[0]::text[] else '{}'::text[] end;
  v_key       text;
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
    v_new := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_action := 'update';
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  else
    v_action := 'delete';
    v_old := to_jsonb(old);
  end if;

  -- Never let secrets or PII the log does not need reach the audit trail.
  foreach v_key in array v_redact loop
    if v_old ? v_key then v_old := jsonb_set(v_old, array[v_key], to_jsonb('[redacted]'::text)); end if;
    if v_new ? v_key then v_new := jsonb_set(v_new, array[v_key], to_jsonb('[redacted]'::text)); end if;
  end loop;

  if tg_op = 'UPDATE' then
    select array_agg(n.key)
      into v_changed
      from jsonb_each(v_new) as n(key, value)
     where v_old -> n.key is distinct from n.value
       and n.key <> 'updated_at';

    -- A no-op update is not worth a row.
    if v_changed is null then
      return new;
    end if;
  end if;

  -- Join tables have no surrogate id; fall back to the owning entity so the
  -- log entry still points somewhere useful.
  v_entity_id := coalesce(
    v_new ->> 'id',         v_old ->> 'id',
    v_new ->> 'product_id', v_old ->> 'product_id',
    v_new ->> 'key',        v_old ->> 'key'
  );

  insert into public.audit_logs
    (actor_id, actor_role, actor_label, action, entity_type, entity_id,
     old_values, new_values, changed_keys, request_id)
  values
    (v_actor,
     app.current_role(),
     (select coalesce(nullif(p.full_name, ''), p.email, p.id::text)
        from public.auth_profiles p where p.id = v_actor),
     v_action,
     tg_table_name,
     v_entity_id,
     v_old,
     v_new,
     v_changed,
     nullif(current_setting('app.request_id', true), ''));

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$fn$;

-- Convenience wrapper for explicit, non-row-shaped audit events written by
-- application code (logins, config changes, state transitions).
create or replace function public.record_audit_event(
  p_action      public.audit_action,
  p_entity_type text,
  p_entity_id   text,
  p_old         jsonb default null,
  p_new         jsonb default null,
  p_context     jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_id    bigint;
  v_actor uuid := app.current_actor_id();
begin
  insert into public.audit_logs
    (actor_id, actor_role, actor_label, action, entity_type, entity_id,
     old_values, new_values, context, request_id)
  values
    (v_actor,
     app.current_role(),
     (select coalesce(nullif(p.full_name, ''), p.email, p.id::text)
        from public.auth_profiles p where p.id = v_actor),
     p_action, p_entity_type, p_entity_id, p_old, p_new, p_context,
     nullif(current_setting('app.request_id', true), ''))
  returning id into v_id;

  return v_id;
end;
$fn$;

create trigger auth_profiles_audit
  after insert or update or delete on public.auth_profiles
  for each row execute function app.audit_trigger();

create trigger employees_audit
  after insert or update or delete on public.employees
  for each row execute function app.audit_trigger();

create trigger role_permissions_audit
  after insert or update or delete on public.role_permissions
  for each row execute function app.audit_trigger();
