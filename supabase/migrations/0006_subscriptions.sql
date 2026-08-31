-- =============================================================================
-- 0006  Subscription plans, subscriptions, credit ledger and deliveries
--       (PRD 7)
-- =============================================================================
-- The Owner creates real commercial plans; customers buy published, active
-- ones. Four plan shapes are supported and none of them is privileged in code:
-- fixed meals, meal credits, scheduled meals and customer-selected meals.
-- =============================================================================

create table public.subscription_plans (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  tagline           text not null default '',
  description       text not null default '',
  image_url         text,
  plan_type         public.plan_type not null,

  price             numeric(12,2) not null check (price >= 0),
  -- 'one_time' plans expire at the end of their cycle; 'recurring' plans renew
  -- until cancelled (PRD 7).
  payment_flow      public.payment_flow not null default 'one_time',
  billing_period_days integer not null check (billing_period_days > 0),

  -- Entitlement, interpreted per plan_type:
  --   fixed_meals / scheduled_meals / customer_selected -> meals_per_cycle
  --   meal_credits                                      -> credits_per_cycle
  meals_per_cycle   integer check (meals_per_cycle is null or meals_per_cycle > 0),
  credits_per_cycle integer check (credits_per_cycle is null or credits_per_cycle > 0),

  -- How many distinct meals a customer_selected plan lets the customer pick.
  selectable_meal_count integer check (selectable_meal_count is null or selectable_meal_count > 0),

  allows_variants   boolean not null default true,
  allows_add_ons    boolean not null default true,
  -- Per-delivery address override exists in the model but is gated on business
  -- approval (PRD 7, PRD 22); default off until the Owner confirms.
  allows_address_override boolean not null default false,

  -- Plan-level overrides of the global rules in business_settings. Null means
  -- "use the global setting" -- so the default lives in exactly one place.
  grace_period_days      integer check (grace_period_days is null or grace_period_days >= 0),
  max_pauses_per_period  integer check (max_pauses_per_period is null or max_pauses_per_period >= 0),
  max_pause_days         integer check (max_pause_days is null or max_pause_days >= 0),
  skip_returns_credit    boolean,

  is_published      boolean not null default false,
  is_active         boolean not null default true,
  archived_at       timestamptz,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Each plan shape must carry the entitlement it is meaningless without.
  constraint subscription_plans_entitlement check (
    (plan_type = 'meal_credits' and credits_per_cycle is not null)
    or (plan_type <> 'meal_credits' and meals_per_cycle is not null)
  )
);

create index subscription_plans_public_idx on public.subscription_plans(is_published, sort_order)
  where is_active and archived_at is null;

-- Which delivery windows a plan may be taken in.
create table public.subscription_plan_windows (
  plan_id           uuid not null references public.subscription_plans(id) on delete cascade,
  delivery_window_id uuid not null references public.delivery_windows(id) on delete restrict,
  primary key (plan_id, delivery_window_id)
);

-- -----------------------------------------------------------------------------
-- subscription_plan_meals: the plan's menu.
--   fixed_meals      -> the exact meals, optionally per weekday
--   scheduled_meals  -> meals bound to a day_of_week / window
--   customer_selected-> the pool the customer chooses from (is_selectable)
-- -----------------------------------------------------------------------------
create table public.subscription_plan_meals (
  id                 uuid primary key default gen_random_uuid(),
  plan_id            uuid not null references public.subscription_plans(id) on delete cascade,
  product_id         uuid not null references public.products(id) on delete restrict,
  -- 0 = Sunday .. 6 = Saturday, matching Postgres extract(dow). Null = any day.
  day_of_week        smallint check (day_of_week between 0 and 6),
  delivery_window_id uuid references public.delivery_windows(id) on delete set null,
  quantity           integer not null default 1 check (quantity > 0),
  -- True for the customer_selected pool; false for meals the plan fixes.
  is_selectable      boolean not null default false,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now()
);

create index subscription_plan_meals_plan_idx on public.subscription_plan_meals(plan_id, day_of_week);

-- =============================================================================
-- subscriptions
-- =============================================================================
create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  subscription_number   text not null unique,
  customer_id           uuid not null references public.customers(id) on delete restrict,
  plan_id               uuid not null references public.subscription_plans(id) on delete restrict,

  -- A subscription is created pending_payment and only becomes active after
  -- server-side payment verification (PRD 7, PRD 8). Nothing downstream reads
  -- a pending subscription as an entitlement.
  status                public.subscription_status not null default 'pending_payment',

  -- Frozen copy of the plan's commercial terms at purchase time. Editing a
  -- plan later must never silently restate what an existing customer bought.
  plan_snapshot         jsonb not null,
  price_paid            numeric(12,2) not null check (price_paid >= 0),

  payment_flow          public.payment_flow not null default 'one_time',

  starts_on             date,
  ends_on               date,
  current_period_start  date,
  current_period_end    date,
  next_renewal_at       timestamptz,

  delivery_address_id   uuid references public.customer_addresses(id) on delete restrict,
  delivery_window_id    uuid references public.delivery_windows(id) on delete restrict,
  -- Weekdays this subscription delivers on; empty = every day.
  delivery_days         smallint[] not null default '{}',
  delivery_instructions text,

  -- Resolved at purchase from plan override or global setting, then frozen so
  -- a later settings change cannot retroactively expire someone.
  grace_period_days     integer not null,
  past_due_since        timestamptz,

  paused_until          date,
  pauses_used_this_period integer not null default 0,

  activated_at          timestamptz,
  cancelled_at          timestamptz,
  cancellation_reason   text,
  cancelled_by          uuid references public.auth_profiles(id) on delete set null,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint subscriptions_active_needs_activation
    check (status <> 'active' or activated_at is not null),
  constraint subscriptions_period check (
    current_period_end is null or current_period_start is null
    or current_period_end >= current_period_start
  )
);

create index subscriptions_customer_idx on public.subscriptions(customer_id, status);
create index subscriptions_status_idx   on public.subscriptions(status)
  where status in ('active', 'paused', 'past_due');

-- -----------------------------------------------------------------------------
-- Customer-selected meals for a subscription (PRD 7).
-- -----------------------------------------------------------------------------
create table public.subscription_selected_meals (
  id                 uuid primary key default gen_random_uuid(),
  subscription_id    uuid not null references public.subscriptions(id) on delete cascade,
  product_id         uuid not null references public.products(id) on delete restrict,
  day_of_week        smallint check (day_of_week between 0 and 6),
  delivery_window_id uuid references public.delivery_windows(id) on delete set null,
  quantity           integer not null default 1 check (quantity > 0),
  created_at         timestamptz not null default now()
);

create index subscription_selected_meals_sub_idx on public.subscription_selected_meals(subscription_id);

-- =============================================================================
-- subscription_credit_ledger  (PRD 7: "a credit ledger, not only a mutable
-- balance")
-- =============================================================================
-- Append-only. The balance is always sum(credits); no row is ever updated, so
-- a reversal is a new compensating entry and the history stays truthful.
-- =============================================================================
create table public.subscription_credit_ledger (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  entry_type      public.credit_entry_type not null,
  -- Signed: grants are positive, consumption negative, reversals positive.
  credits         integer not null,
  reason          text not null default '',
  delivery_id     uuid,          -- FK added in 0007 once deliveries exist
  -- Retrying a credit operation must not double-charge (PRD 7, PRD 11).
  idempotency_key text not null,
  created_by      uuid references public.auth_profiles(id) on delete set null,
  created_at      timestamptz not null default now(),

  constraint credit_ledger_sign check (
    (entry_type in ('grant','reverse') and credits > 0)
    or (entry_type in ('consume','expire') and credits < 0)
    or (entry_type = 'adjust')
  )
);

create unique index subscription_credit_ledger_idem_idx
  on public.subscription_credit_ledger(subscription_id, idempotency_key);
create index subscription_credit_ledger_sub_idx
  on public.subscription_credit_ledger(subscription_id, created_at);

-- Append-only, enforced by trigger. A correction is a new compensating entry,
-- never an edit to an existing one -- which is the whole point of a ledger.
create trigger subscription_credit_ledger_append_only
  before update or delete on public.subscription_credit_ledger
  for each row execute function app.forbid_mutation();

create or replace function public.subscription_credit_balance(p_subscription_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(sum(l.credits), 0)::integer
    from public.subscription_credit_ledger l
   where l.subscription_id = p_subscription_id;
$fn$;

-- =============================================================================
-- subscription_deliveries: the schedule generated from plan rules. A delivery
-- becomes an operational order only when it is released to the KOT inside the
-- configurable lead time (PRD 7, PRD 9).
-- =============================================================================
create table public.subscription_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  subscription_id     uuid not null references public.subscriptions(id) on delete cascade,
  customer_id         uuid not null references public.customers(id) on delete restrict,
  scheduled_date      date not null,
  delivery_window_id  uuid not null references public.delivery_windows(id) on delete restrict,
  status              public.subscription_delivery_status not null default 'scheduled',

  -- Per-delivery address override (PRD 7); null means use the subscription's
  -- address. Whether customers may set this is gated by the plan flag.
  address_id          uuid references public.customer_addresses(id) on delete restrict,
  delivery_instructions text,

  credits_cost        integer not null default 0 check (credits_cost >= 0),

  released_at         timestamptz,
  order_id            uuid,          -- FK added in 0007
  skipped_at          timestamptz,
  skip_reason         text,
  skipped_by          uuid references public.auth_profiles(id) on delete set null,
  cancelled_at        timestamptz,
  fulfilled_at        timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One delivery per subscription per date per window; the generator is
  -- idempotent because a re-run collides with this constraint (PRD 7).
  unique (subscription_id, scheduled_date, delivery_window_id)
);

create index subscription_deliveries_due_idx
  on public.subscription_deliveries(scheduled_date, status)
  where status = 'scheduled';
create index subscription_deliveries_sub_idx
  on public.subscription_deliveries(subscription_id, scheduled_date);
create index subscription_deliveries_customer_idx
  on public.subscription_deliveries(customer_id, scheduled_date desc);

create table public.subscription_delivery_items (
  id                 uuid primary key default gen_random_uuid(),
  delivery_id        uuid not null references public.subscription_deliveries(id) on delete cascade,
  product_id         uuid not null references public.products(id) on delete restrict,
  quantity           integer not null default 1 check (quantity > 0),
  -- Chosen variant ids; resolved to names/prices when the order is built.
  variant_ids        uuid[] not null default '{}',
  add_on_ids         uuid[] not null default '{}',
  credits_cost       integer not null default 0 check (credits_cost >= 0),
  special_instructions text,
  created_at         timestamptz not null default now()
);

create index subscription_delivery_items_delivery_idx
  on public.subscription_delivery_items(delivery_id);

-- -----------------------------------------------------------------------------
-- subscription_pauses: an explicit history rather than a mutable "paused"
-- flag, so pause quotas can be counted and audited (PRD 7).
-- -----------------------------------------------------------------------------
create table public.subscription_pauses (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  starts_on       date not null,
  ends_on         date not null,
  reason          text,
  created_by      uuid references public.auth_profiles(id) on delete set null,
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now(),
  constraint subscription_pauses_span check (ends_on >= starts_on)
);

create index subscription_pauses_sub_idx on public.subscription_pauses(subscription_id, starts_on desc);

create trigger subscription_plans_touch          before update on public.subscription_plans          for each row execute function app.touch_updated_at();
create trigger subscriptions_touch               before update on public.subscriptions               for each row execute function app.touch_updated_at();
create trigger subscription_deliveries_touch     before update on public.subscription_deliveries     for each row execute function app.touch_updated_at();

create trigger subscription_plans_audit      after insert or update or delete on public.subscription_plans      for each row execute function app.audit_trigger();
create trigger subscription_plan_meals_audit after insert or update or delete on public.subscription_plan_meals for each row execute function app.audit_trigger();
create trigger subscriptions_audit           after insert or update or delete on public.subscriptions           for each row execute function app.audit_trigger();
create trigger subscription_credit_ledger_audit after insert on public.subscription_credit_ledger              for each row execute function app.audit_trigger();
create trigger subscription_deliveries_audit after insert or update or delete on public.subscription_deliveries for each row execute function app.audit_trigger();
create trigger subscription_pauses_audit     after insert or update or delete on public.subscription_pauses     for each row execute function app.audit_trigger();
