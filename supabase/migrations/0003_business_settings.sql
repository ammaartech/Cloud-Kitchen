-- =============================================================================
-- 0003  Configurable business settings (PRD 6, 7, 10, 12, 20)
-- =============================================================================
-- Nothing business-critical is a constant in application code. Fees, taxes,
-- delivery windows, grace periods, pause/skip rules, the KOT release lead time
-- and every cost assumption live here and are read at request time.
--
-- Money is stored as numeric(12,2) in rupees. Payment adapters convert to the
-- gateway's minor units at the boundary; nothing else needs to know about paise.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- business_settings: typed key/value store for scalar business rules.
-- -----------------------------------------------------------------------------
create table public.business_settings (
  key           text primary key,
  value         jsonb       not null,
  value_type    text        not null check (value_type in ('string','number','integer','boolean','json')),
  group_name    text        not null default 'general',
  label         text        not null,
  description   text        not null default '',
  -- Settings a Branch Manager or Kitchen account must never read (PRD 17).
  is_sensitive  boolean     not null default false,
  -- Marks a value the owner still has to confirm (PRD 22). The UI surfaces
  -- these as "pending owner validation" rather than pretending they are policy.
  is_provisional boolean    not null default false,
  updated_by    uuid references public.auth_profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index business_settings_group_idx on public.business_settings(group_name);

create trigger business_settings_touch
  before update on public.business_settings
  for each row execute function app.touch_updated_at();

create trigger business_settings_audit
  after insert or update or delete on public.business_settings
  for each row execute function app.audit_trigger();

-- -----------------------------------------------------------------------------
-- Typed accessors. Application code and SQL both read settings through these,
-- so a missing key fails loudly instead of silently defaulting to zero.
-- -----------------------------------------------------------------------------
create or replace function app.setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  select s.value from public.business_settings s where s.key = p_key;
$fn$;

create or replace function app.setting_numeric(p_key text)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare v jsonb := app.setting(p_key);
begin
  if v is null then
    raise exception 'business setting % is not configured', p_key
      using errcode = 'no_data_found';
  end if;
  return (v #>> '{}')::numeric;
end;
$fn$;

create or replace function app.setting_int(p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $fn$
  select app.setting_numeric(p_key)::integer;
$fn$;

create or replace function app.setting_bool(p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare v jsonb := app.setting(p_key);
begin
  if v is null then
    raise exception 'business setting % is not configured', p_key
      using errcode = 'no_data_found';
  end if;
  return (v #>> '{}')::boolean;
end;
$fn$;

create or replace function app.setting_text(p_key text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare v jsonb := app.setting(p_key);
begin
  if v is null then
    raise exception 'business setting % is not configured', p_key
      using errcode = 'no_data_found';
  end if;
  return v #>> '{}';
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Business clock. The branch operates on Asia/Kolkata (PRD 10) but the zone is
-- a setting, so a second branch in another zone would not need a code change.
-- -----------------------------------------------------------------------------
create or replace function app.business_timezone()
returns text
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(app.setting('business.timezone') #>> '{}', 'Asia/Kolkata');
$fn$;

create or replace function app.business_now()
returns timestamp
language sql
stable
security definer
set search_path = ''
as $fn$
  select (now() at time zone app.business_timezone());
$fn$;

-- The business day that a given instant belongs to. Daily KOT sequences reset
-- on this boundary (PRD 10), not on UTC midnight.
create or replace function app.business_date(p_at timestamptz default now())
returns date
language sql
stable
security definer
set search_path = ''
as $fn$
  select (p_at at time zone app.business_timezone())::date;
$fn$;

-- -----------------------------------------------------------------------------
-- delivery_settings: delivery fee rules. Row-per-rule so tiers ("free above
-- N") can be added without touching pricing code. Highest priority match wins.
-- -----------------------------------------------------------------------------
create table public.delivery_settings (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  base_fee                 numeric(12,2) not null default 0 check (base_fee >= 0),
  -- Null means "never free on subtotal alone".
  free_above_subtotal      numeric(12,2) check (free_above_subtotal >= 0),
  -- Reserved for a future distance-based provider; unused in Phase 1.
  per_km_fee               numeric(12,2) check (per_km_fee >= 0),
  applies_to_source        public.order_source,   -- null = all sources
  priority                 integer not null default 0,
  effective_from           timestamptz not null default now(),
  effective_to             timestamptz,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint delivery_settings_window check (effective_to is null or effective_to > effective_from)
);

create index delivery_settings_lookup_idx
  on public.delivery_settings(is_active, priority desc, effective_from desc);

create trigger delivery_settings_touch
  before update on public.delivery_settings
  for each row execute function app.touch_updated_at();

create trigger delivery_settings_audit
  after insert or update or delete on public.delivery_settings
  for each row execute function app.audit_trigger();

-- -----------------------------------------------------------------------------
-- tax_settings: Phase 1 assumption is 5% food tax split CGST 2.5% + SGST 2.5%
-- (PRD 6). Stored as two rows so the real GST treatment, once validated, is a
-- data change. Nothing in code assumes two components or 5%.
-- -----------------------------------------------------------------------------
create table public.tax_settings (
  id             uuid primary key default gen_random_uuid(),
  code           text not null,                  -- CGST, SGST, IGST, ...
  label          text not null,
  rate_percent   numeric(6,3) not null check (rate_percent >= 0 and rate_percent <= 100),
  applies_to     text not null default 'food' check (applies_to in ('food','delivery','packaging','all')),
  is_inclusive   boolean not null default false,
  effective_from timestamptz not null default now(),
  effective_to   timestamptz,
  is_active      boolean not null default true,
  -- The PRD flags production GST treatment as unvalidated (PRD 3, PRD 22).
  is_provisional boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint tax_settings_window check (effective_to is null or effective_to > effective_from)
);

create index tax_settings_lookup_idx on public.tax_settings(is_active, applies_to, effective_from desc);

create trigger tax_settings_touch
  before update on public.tax_settings
  for each row execute function app.touch_updated_at();

create trigger tax_settings_audit
  after insert or update or delete on public.tax_settings
  for each row execute function app.audit_trigger();

-- -----------------------------------------------------------------------------
-- cost_settings: fee and cost assumptions behind estimated profit (PRD 12).
-- Initially dummy data, explicitly flagged as such, and replaceable without a
-- code change.
-- -----------------------------------------------------------------------------
create table public.cost_settings (
  id                          uuid primary key default gen_random_uuid(),
  source                      public.order_source,  -- null = applies to all channels
  label                       text not null,
  -- Marketplace commission on gross order value.
  commission_percent          numeric(6,3) not null default 0 check (commission_percent >= 0),
  -- Payment gateway take: percent + fixed, both provider-configurable.
  payment_fee_percent         numeric(6,3) not null default 0 check (payment_fee_percent >= 0),
  payment_fee_fixed           numeric(12,2) not null default 0 check (payment_fee_fixed >= 0),
  packaging_cost_per_order    numeric(12,2) not null default 0 check (packaging_cost_per_order >= 0),
  -- Fallback when a product has no explicit estimated_cost.
  default_food_cost_percent   numeric(6,3) not null default 0
    check (default_food_cost_percent >= 0 and default_food_cost_percent <= 100),
  effective_from              timestamptz not null default now(),
  effective_to                timestamptz,
  is_active                   boolean not null default true,
  is_dummy_data               boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint cost_settings_window check (effective_to is null or effective_to > effective_from)
);

-- At most one open-ended active row per channel, and one for the "all
-- channels" fallback. NULLS NOT DISTINCT is what makes the fallback row
-- unique too -- without it, several null-source rows could coexist.
create unique index cost_settings_active_source_idx
  on public.cost_settings(source)
  nulls not distinct
  where is_active and effective_to is null;

create trigger cost_settings_touch
  before update on public.cost_settings
  for each row execute function app.touch_updated_at();

create trigger cost_settings_audit
  after insert or update or delete on public.cost_settings
  for each row execute function app.audit_trigger();

-- -----------------------------------------------------------------------------
-- delivery_windows: breakfast / lunch / dinner are configurable rows, not an
-- enum (PRD 7). Each window carries its own ordering cut-off.
-- -----------------------------------------------------------------------------
create table public.delivery_windows (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,          -- BREAKFAST, LUNCH, DINNER, ...
  label                 text not null,
  starts_at             time not null,
  ends_at               time not null,
  -- How long before starts_at the kitchen stops accepting changes.
  cutoff_minutes_before integer not null default 0 check (cutoff_minutes_before >= 0),
  sort_order            integer not null default 0,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint delivery_windows_span check (ends_at > starts_at)
);

create trigger delivery_windows_touch
  before update on public.delivery_windows
  for each row execute function app.touch_updated_at();

create trigger delivery_windows_audit
  after insert or update or delete on public.delivery_windows
  for each row execute function app.audit_trigger();

-- -----------------------------------------------------------------------------
-- Resolved-fee helpers. Pricing code calls these so a fee change is a row edit.
-- -----------------------------------------------------------------------------
create or replace function app.resolve_delivery_fee(
  p_subtotal numeric,
  p_source   public.order_source default 'SX',
  p_at       timestamptz default now()
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  r public.delivery_settings%rowtype;
begin
  select *
    into r
    from public.delivery_settings d
   where d.is_active
     and (d.applies_to_source is null or d.applies_to_source = p_source)
     and d.effective_from <= p_at
     and (d.effective_to is null or d.effective_to > p_at)
   order by (d.applies_to_source is not null) desc, d.priority desc, d.effective_from desc
   limit 1;

  if not found then
    return 0;
  end if;

  if r.free_above_subtotal is not null and p_subtotal >= r.free_above_subtotal then
    return 0;
  end if;

  return r.base_fee;
end;
$fn$;

-- Returns one row per active tax component so invoices can show the split
-- (CGST 2.5% / SGST 2.5%) rather than a single opaque "tax" line.
create or replace function app.resolve_tax_components(
  p_applies_to text default 'food',
  p_at         timestamptz default now()
)
returns table (code text, label text, rate_percent numeric)
language sql
stable
security definer
set search_path = ''
as $fn$
  select t.code, t.label, t.rate_percent
    from public.tax_settings t
   where t.is_active
     and t.applies_to in (p_applies_to, 'all')
     and t.effective_from <= p_at
     and (t.effective_to is null or t.effective_to > p_at)
   order by t.code;
$fn$;
