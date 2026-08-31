-- =============================================================================
-- 0005  Customers and addresses (PRD 6, PRD 14)
-- =============================================================================
-- Customers normally arrive through a website order, but the Owner can create
-- one by hand for edge cases -- so profile_id is nullable and a customer can
-- exist without a login.
-- =============================================================================

create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  -- Null for Owner-created records that have never signed in.
  profile_id     uuid unique references public.auth_profiles(id) on delete set null,
  full_name      text not null,
  email          text,
  phone          text not null,
  phone_verified boolean not null default false,

  -- Marketing consent is deliberately independent of account status (PRD 14):
  -- deleting an account must not be read as permission to keep marketing, and
  -- withdrawing marketing consent must not disable the account.
  marketing_consent            boolean not null default false,
  marketing_consent_updated_at timestamptz,
  marketing_consent_source     text,

  created_source text not null default 'website'
    check (created_source in ('website','owner','marketplace','import')),
  notes          text,

  -- Account deletion disables login while legitimate business records
  -- (orders, invoices, payments) are preserved (PRD 14). This is never a
  -- hard delete.
  is_active      boolean not null default true,
  deleted_at     timestamptz,
  deletion_reason text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index customers_phone_key on public.customers(phone) where deleted_at is null;
create unique index customers_email_key on public.customers(lower(email))
  where email is not null and deleted_at is null;
create index customers_profile_idx on public.customers(profile_id);

create table public.customer_addresses (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references public.customers(id) on delete cascade,
  label                text not null default 'Home',
  recipient_name       text not null,
  phone                text not null,
  line1                text not null,
  line2                text,
  landmark             text,
  city                 text not null,
  state                text not null,
  postal_code          text not null,
  country              text not null default 'IN',
  latitude             numeric(9,6),
  longitude            numeric(9,6),
  -- Free-text notes for the rider/kitchen (PRD 6).
  delivery_instructions text,
  is_default           boolean not null default false,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index customer_addresses_customer_idx on public.customer_addresses(customer_id)
  where is_active;
create unique index customer_addresses_one_default_idx
  on public.customer_addresses(customer_id) where is_default and is_active;

-- Resolve the caller's own customer row. Customer-facing RLS policies compare
-- against this rather than trusting any client-supplied customer_id.
create or replace function app.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select c.id
    from public.customers c
   where c.profile_id = app.current_actor_id()
     and c.deleted_at is null;
$fn$;

create trigger customers_touch          before update on public.customers          for each row execute function app.touch_updated_at();
create trigger customer_addresses_touch before update on public.customer_addresses for each row execute function app.touch_updated_at();

-- Customer records carry PII; the audit trail keeps the change history but
-- redacts contact details it does not need to prove who changed what.
create trigger customers_audit
  after insert or update or delete on public.customers
  for each row execute function app.audit_trigger('{email,phone}');

create trigger customer_addresses_audit
  after insert or update or delete on public.customer_addresses
  for each row execute function app.audit_trigger('{phone,line1,line2,landmark,latitude,longitude}');
