-- =============================================================================
-- 0007  Orders, KOT tickets, numbering and the server-side state machine
--       (PRD 8, 9, 10)
-- =============================================================================
-- Every channel converges on one internal KOT. Order state, payment state and
-- ticket state are three separate machines that never write each other's
-- columns.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Overall order number: a single sequence across all sources, 1..99,999,999
-- (PRD 10). Distinct from the daily, source-prefixed KOT number.
-- -----------------------------------------------------------------------------
create sequence public.order_number_seq
  as bigint start with 1 increment by 1 minvalue 1 maxvalue 99999999 no cycle;

create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         bigint not null unique default nextval('public.order_number_seq'),
  source               public.order_source not null,
  status               public.order_status not null default 'DRAFT',

  -- Marketplace orders may have no local customer record; website orders always do.
  customer_id          uuid references public.customers(id) on delete restrict,
  subscription_id      uuid references public.subscriptions(id) on delete restrict,
  subscription_delivery_id uuid references public.subscription_deliveries(id) on delete restrict,

  -- Marketplace identity kept alongside our own (PRD 16).
  external_order_id    text,
  external_status      text,
  external_payload     jsonb,

  placed_at            timestamptz not null default now(),
  business_date        date not null default app.business_date(),
  -- When the food is due. For subscriptions this comes from the delivery
  -- window; for marketplace orders it is "as soon as possible".
  scheduled_for        timestamptz,
  delivery_window_id   uuid references public.delivery_windows(id) on delete set null,

  -- Snapshots. A customer editing their address later must not rewrite what
  -- was delivered last month (PRD 17).
  customer_name_snapshot text,
  customer_phone_snapshot text,
  address_snapshot     jsonb,
  delivery_instructions text,
  special_instructions text,

  -- Money. All amounts in rupees; tax_breakdown keeps the CGST/SGST split.
  currency             text not null default 'INR',
  subtotal             numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_total       numeric(12,2) not null default 0 check (discount_total >= 0),
  delivery_fee         numeric(12,2) not null default 0 check (delivery_fee >= 0),
  tax_total            numeric(12,2) not null default 0 check (tax_total >= 0),
  tax_breakdown        jsonb not null default '[]'::jsonb,
  grand_total          numeric(12,2) not null default 0 check (grand_total >= 0),

  coupon_id            uuid,   -- FK added in 0009
  coupon_code          text,

  -- Analytics inputs, resolved from cost_settings at completion (PRD 12).
  estimated_food_cost  numeric(12,2),
  channel_fee_total    numeric(12,2),

  -- Retrying a checkout or replaying a marketplace webhook must not create a
  -- second order (PRD 8, PRD 11).
  idempotency_key      text,

  confirmed_at         timestamptz,
  completed_at         timestamptz,
  cancelled_at         timestamptz,
  cancellation_reason  text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- A subscription order exists only against a real subscription delivery.
  constraint orders_subscription_shape check (
    source <> 'SX' or (subscription_id is not null and subscription_delivery_id is not null)
  ),
  constraint orders_marketplace_shape check (
    source = 'SX' or external_order_id is not null
  )
);

-- One internal order per marketplace order id, per marketplace. This is what
-- makes duplicate webhook delivery harmless.
create unique index orders_external_idx
  on public.orders(source, external_order_id) where external_order_id is not null;
create unique index orders_idempotency_idx
  on public.orders(idempotency_key) where idempotency_key is not null;
create index orders_business_date_idx on public.orders(business_date, source);
create index orders_customer_idx      on public.orders(customer_id, placed_at desc);
create index orders_status_idx        on public.orders(status) where status in ('CONFIRMED','IN_PROGRESS');

-- Close the circular references left open in 0006.
alter table public.subscription_deliveries
  add constraint subscription_deliveries_order_fk
  foreign key (order_id) references public.orders(id) on delete set null;

alter table public.subscription_credit_ledger
  add constraint subscription_credit_ledger_delivery_fk
  foreign key (delivery_id) references public.subscription_deliveries(id) on delete set null;

create table public.order_items (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders(id) on delete cascade,
  product_id           uuid references public.products(id) on delete set null,

  -- Name and price are snapshotted: renaming or repricing a product must not
  -- alter a historical ticket or invoice.
  name_snapshot        text not null,
  quantity             integer not null check (quantity > 0),
  unit_price           numeric(12,2) not null check (unit_price >= 0),
  line_subtotal        numeric(12,2) not null check (line_subtotal >= 0),

  -- [{group, name, price_delta}, ...] resolved at order time.
  variants_snapshot    jsonb not null default '[]'::jsonb,
  add_ons_snapshot     jsonb not null default '[]'::jsonb,

  credits_consumed     integer not null default 0 check (credits_consumed >= 0),
  estimated_cost       numeric(12,2),
  special_instructions text,
  created_at           timestamptz not null default now()
);

create index order_items_order_idx on public.order_items(order_id);

create table public.order_status_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status not null,
  actor_id    uuid references public.auth_profiles(id) on delete set null,
  actor_role  public.app_role,
  reason      text,
  context     jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index order_status_events_order_idx on public.order_status_events(order_id, occurred_at);

-- =============================================================================
-- Daily, source-prefixed KOT numbering (PRD 9, PRD 10)
-- =============================================================================
-- SW-001 / ZM-001 / SX-001, reset every business day. The counter row is
-- locked per (business_date, source) so concurrent inserts cannot collide.
-- =============================================================================
create table public.kot_daily_counters (
  business_date date not null,
  source        public.order_source not null,
  last_number   integer not null default 0,
  primary key (business_date, source)
);

create or replace function app.next_kot_daily_number(
  p_source public.order_source,
  p_date   date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_next integer;
begin
  insert into public.kot_daily_counters (business_date, source, last_number)
  values (p_date, p_source, 1)
  on conflict (business_date, source)
    do update set last_number = public.kot_daily_counters.last_number + 1
  returning last_number into v_next;

  return v_next;
end;
$fn$;

-- =============================================================================
-- kot_tickets
-- =============================================================================
create table public.kot_tickets (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null unique references public.orders(id) on delete cascade,
  source         public.order_source not null,
  business_date  date not null,
  daily_number   integer not null,
  -- Denormalised display code (SW-001). Colour is never the only signal --
  -- the prefix is always rendered too (PRD 19).
  ticket_code    text not null,

  status         public.kot_status not null default 'NEW',

  -- Higher runs first. Marketplace orders start above subscription deliveries
  -- because they are immediate (PRD 9); SLA pressure can escalate anything.
  priority       integer not null default 0,
  sla_due_at     timestamptz,

  -- Manager may override the kitchen's ETA (PRD 9); the original estimate is
  -- kept so the override is visible rather than silent.
  prep_eta_minutes          integer check (prep_eta_minutes is null or prep_eta_minutes > 0),
  prep_eta_minutes_original integer,
  eta_overridden_by         uuid references public.auth_profiles(id) on delete set null,
  eta_overridden_at         timestamptz,

  -- Lifecycle timestamps. prep time = accepted -> ready (PRD 10).
  accepted_at       timestamptz,
  accepted_by       uuid references public.auth_profiles(id) on delete set null,
  preparing_at      timestamptz,
  preparing_by      uuid references public.auth_profiles(id) on delete set null,
  ready_at          timestamptz,
  ready_by          uuid references public.auth_profiles(id) on delete set null,
  picked_up_at      timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at      timestamptz,
  completed_at      timestamptz,
  rejected_at       timestamptz,
  rejected_by       uuid references public.auth_profiles(id) on delete set null,
  rejection_reason  text,
  cancelled_at      timestamptz,
  cancellation_reason text,
  cancellation_origin text check (cancellation_origin in ('internal','marketplace','customer')),

  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (business_date, source, daily_number),
  -- Rejection must always carry a reason; the UI confirms it (PRD 9).
  constraint kot_tickets_rejection_reason
    check (status <> 'REJECTED' or rejection_reason is not null)
);

create index kot_tickets_board_idx
  on public.kot_tickets(status, priority desc, created_at)
  where status not in ('COMPLETED','REJECTED','CANCELLED');
create index kot_tickets_date_idx on public.kot_tickets(business_date, source);

create table public.kot_status_events (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.kot_tickets(id) on delete cascade,
  from_status public.kot_status,
  to_status   public.kot_status not null,
  actor_id    uuid references public.auth_profiles(id) on delete set null,
  actor_role  public.app_role,
  notes       text,
  context     jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index kot_status_events_ticket_idx on public.kot_status_events(ticket_id, occurred_at);

-- =============================================================================
-- The KOT state machine, as data
-- =============================================================================
-- Which transitions exist, and which permission each one needs, are rows. That
-- is what makes "Owner KOT is read-only" and "Kitchen may start preparing but
-- not mark ready" enforceable server-side without a code branch per role.
-- =============================================================================
create table public.kot_transitions (
  from_status          public.kot_status not null,
  to_status            public.kot_status not null,
  required_permission  text not null references public.permissions(code) on delete restrict,
  requires_reason      boolean not null default false,
  requires_confirmation boolean not null default false,
  label                text not null,
  sort_order           integer not null default 0,
  primary key (from_status, to_status)
);

create or replace function app.kot_transition(
  p_from public.kot_status,
  p_to   public.kot_status
)
returns public.kot_transitions
language sql
stable
security definer
set search_path = ''
as $fn$
  select t.* from public.kot_transitions t
   where t.from_status = p_from and t.to_status = p_to;
$fn$;

-- -----------------------------------------------------------------------------
-- Enforcement trigger. Rejects illegal transitions and unauthorised actors,
-- stamps the matching timestamp, and records the event -- so history cannot be
-- skipped by a client that forgets to write it.
-- -----------------------------------------------------------------------------
create or replace function app.kot_enforce_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_rule  public.kot_transitions%rowtype;
  v_actor uuid := app.current_actor_id();
  v_role  public.app_role := app.current_role();
begin
  if new.status = old.status then
    return new;
  end if;

  select * into v_rule
    from public.kot_transitions t
   where t.from_status = old.status and t.to_status = new.status;

  if not found then
    raise exception 'illegal KOT transition % -> % for ticket %',
      old.status, new.status, old.ticket_code
      using errcode = 'check_violation';
  end if;

  -- Service-role callers are trusted server code that has already run its own
  -- permission check; everyone else must actually hold the permission.
  if not app.has_permission(v_rule.required_permission) then
    raise exception 'role % may not perform transition % -> %',
      coalesce(v_role::text, 'anonymous'), old.status, new.status
      using errcode = 'insufficient_privilege';
  end if;

  if v_rule.requires_reason
     and coalesce(nullif(new.rejection_reason, ''), nullif(new.cancellation_reason, '')) is null then
    raise exception 'transition % -> % requires a reason', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- Stamp the lifecycle timestamp for the state being entered.
  case new.status
    when 'ACCEPTED'         then new.accepted_at := now();  new.accepted_by := v_actor;
    when 'PREPARING'        then new.preparing_at := now(); new.preparing_by := v_actor;
    when 'READY_FOR_PICKUP' then new.ready_at := now();     new.ready_by := v_actor;
    when 'PICKED_UP'        then new.picked_up_at := now();
    when 'OUT_FOR_DELIVERY' then new.out_for_delivery_at := now();
    when 'DELIVERED'        then new.delivered_at := now();
    when 'COMPLETED'        then new.completed_at := now();
    when 'REJECTED'         then new.rejected_at := now();  new.rejected_by := v_actor;
    when 'CANCELLED'        then new.cancelled_at := now();
    else null;
  end case;

  insert into public.kot_status_events (ticket_id, from_status, to_status, actor_id, actor_role, notes)
  values (new.id, old.status, new.status, v_actor, v_role,
          coalesce(new.rejection_reason, new.cancellation_reason));

  return new;
end;
$fn$;

create trigger kot_tickets_enforce_transition
  before update of status on public.kot_tickets
  for each row execute function app.kot_enforce_transition();

-- Record the ticket's birth as an event too, so the history has no gap.
create or replace function app.kot_record_creation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.kot_status_events (ticket_id, from_status, to_status, actor_id, actor_role)
  values (new.id, null, new.status, app.current_actor_id(), app.current_role());
  return new;
end;
$fn$;

create trigger kot_tickets_record_creation
  after insert on public.kot_tickets
  for each row execute function app.kot_record_creation();

-- -----------------------------------------------------------------------------
-- Order state machine: same idea, lighter touch. Orders move under server
-- control only, and every move leaves an event.
-- -----------------------------------------------------------------------------
create or replace function app.order_record_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_events (order_id, from_status, to_status, actor_id, actor_role)
    values (new.id, null, new.status, app.current_actor_id(), app.current_role());
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.order_status_events
      (order_id, from_status, to_status, actor_id, actor_role, reason)
    values (new.id, old.status, new.status, app.current_actor_id(), app.current_role(),
            new.cancellation_reason);

    if new.status = 'CONFIRMED' and new.confirmed_at is null then
      new.confirmed_at := now();
    elsif new.status = 'COMPLETED' and new.completed_at is null then
      new.completed_at := now();
    elsif new.status in ('CANCELLED','REJECTED') and new.cancelled_at is null then
      new.cancelled_at := now();
    end if;
  end if;

  return new;
end;
$fn$;

-- BEFORE for the timestamp stamping, AFTER-style event write happens in the
-- same function because the row is already assigned by then.
create trigger orders_record_transition_ins
  after insert on public.orders
  for each row execute function app.order_record_transition();

create trigger orders_record_transition_upd
  before update of status on public.orders
  for each row execute function app.order_record_transition();

create trigger orders_touch      before update on public.orders      for each row execute function app.touch_updated_at();
create trigger kot_tickets_touch before update on public.kot_tickets for each row execute function app.touch_updated_at();

create trigger orders_audit      after insert or update or delete on public.orders      for each row execute function app.audit_trigger();
create trigger order_items_audit after insert or update or delete on public.order_items for each row execute function app.audit_trigger();
create trigger kot_tickets_audit after insert or update or delete on public.kot_tickets for each row execute function app.audit_trigger();
create trigger kot_transitions_audit after insert or update or delete on public.kot_transitions for each row execute function app.audit_trigger();
