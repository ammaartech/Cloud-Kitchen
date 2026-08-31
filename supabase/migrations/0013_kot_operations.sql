-- =============================================================================
-- 0013  Releasing deliveries to the KOT, and the operational actions on a
--       ticket (PRD 9, PRD 10)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ticket creation. Allocates the daily source-prefixed number, sets the base
-- priority and the SLA deadline. Never called for an unconfirmed order -- the
-- trigger from 0008 enforces that independently.
-- -----------------------------------------------------------------------------
create or replace function app.create_kot_ticket(p_order_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_order   public.orders%rowtype;
  v_seq     integer;
  v_ticket  uuid;
  v_date    date;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order % not found', p_order_id using errcode = 'no_data_found';
  end if;

  -- One ticket per order, always.
  select id into v_ticket from public.kot_tickets where order_id = p_order_id;
  if v_ticket is not null then
    return v_ticket;
  end if;

  v_date := coalesce(v_order.business_date, app.business_date());
  v_seq  := app.next_kot_daily_number(v_order.source, v_date);

  insert into public.kot_tickets (
    order_id, source, business_date, daily_number, ticket_code,
    status, priority, sla_due_at, prep_eta_minutes, prep_eta_minutes_original
  ) values (
    p_order_id, v_order.source, v_date, v_seq,
    v_order.source::text || '-' || lpad(v_seq::text, 3, '0'),
    'NEW',
    app.base_priority(v_order.source),
    app.sla_due_at(v_order.source, coalesce(v_order.scheduled_for, now())),
    app.setting_int('kot.default_prep_minutes'),
    app.setting_int('kot.default_prep_minutes')
  )
  returning id into v_ticket;

  return v_ticket;
end;
$fn$;

-- =============================================================================
-- release_due_deliveries
-- =============================================================================
-- Turns scheduled subscription deliveries into real orders and tickets once
-- they fall inside the configurable release lead time (PRD 7, PRD 9).
-- Safe to run repeatedly and concurrently: rows are locked with SKIP LOCKED
-- and a released delivery is never picked up twice.
-- =============================================================================
create or replace function public.release_due_deliveries(
  p_now   timestamptz default now(),
  p_limit integer default 200
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_lead     integer := app.setting_int('kot.release_lead_time_minutes');
  v_rec      record;
  v_order_id uuid;
  v_ticket   uuid;
  v_balance  integer;
  v_released integer := 0;
  v_blocked  integer := 0;
  v_results  jsonb := '[]'::jsonb;
  v_cost     numeric(12,2);
begin
  for v_rec in
    select d.*, w.starts_at, s.status as sub_status, s.customer_id as sub_customer
      from public.subscription_deliveries d
      join public.delivery_windows w on w.id = d.delivery_window_id
      join public.subscriptions s     on s.id = d.subscription_id
     where d.status = 'scheduled'
       and s.status = 'active'
       -- Due when the window opens within the lead time.
       and ((d.scheduled_date + w.starts_at) at time zone app.business_timezone())
             - make_interval(mins => v_lead) <= p_now
     order by d.scheduled_date, w.starts_at
     limit p_limit
     for update of d skip locked
  loop
    -- Entitlement check against the ledger, not a cached balance.
    v_balance := public.subscription_credit_balance(v_rec.subscription_id);

    if v_rec.credits_cost > 0 and v_balance < v_rec.credits_cost then
      v_blocked := v_blocked + 1;
      perform public.record_audit_event(
        'state_transition', 'subscription_deliveries', v_rec.id::text, null,
        jsonb_build_object('blocked', 'insufficient_credits',
                           'required', v_rec.credits_cost, 'available', v_balance));
      continue;
    end if;

    -- A subscription delivery is fulfilment of an already-paid plan, so the
    -- order itself carries no charge. Revenue is attributed to the
    -- subscription payment; double-counting it here would inflate analytics.
    insert into public.orders (
      source, status, customer_id, subscription_id, subscription_delivery_id,
      business_date, scheduled_for, delivery_window_id,
      customer_name_snapshot, customer_phone_snapshot, address_snapshot,
      delivery_instructions,
      subtotal, discount_total, delivery_fee, tax_total, grand_total,
      idempotency_key
    )
    select
      -- Explicit casts: INSERT ... SELECT does not coerce bare literals to the
      -- target column's enum type the way INSERT ... VALUES does.
      'SX'::public.order_source, 'CONFIRMED'::public.order_status,
      v_rec.customer_id, v_rec.subscription_id, v_rec.id,
      v_rec.scheduled_date,
      (v_rec.scheduled_date + v_rec.starts_at) at time zone app.business_timezone(),
      v_rec.delivery_window_id,
      c.full_name, c.phone,
      to_jsonb(a.*) - 'created_at' - 'updated_at',
      coalesce(v_rec.delivery_instructions, a.delivery_instructions),
      0, 0, 0, 0, 0,
      'delivery:' || v_rec.id::text
      from public.customers c
      left join public.customer_addresses a
        on a.id = coalesce(v_rec.address_id,
                          (select delivery_address_id from public.subscriptions
                            where id = v_rec.subscription_id))
     where c.id = v_rec.customer_id
    on conflict (idempotency_key) where idempotency_key is not null do nothing
    returning id into v_order_id;

    if v_order_id is null then
      select id into v_order_id from public.orders
       where idempotency_key = 'delivery:' || v_rec.id::text;
    end if;

    -- Line items, snapshotted so later catalog edits cannot rewrite the ticket.
    insert into public.order_items (
      order_id, product_id, name_snapshot, quantity, unit_price, line_subtotal,
      variants_snapshot, add_ons_snapshot, credits_consumed, estimated_cost,
      special_instructions
    )
    select
      v_order_id, p.id, p.name, i.quantity, 0, 0,
      coalesce((
        select jsonb_agg(jsonb_build_object('group', vg.name, 'name', v.name,
                                            'price_delta', v.price_delta))
          from public.variants v
          join public.variant_groups vg on vg.id = v.variant_group_id
         where v.id = any(i.variant_ids)), '[]'::jsonb),
      coalesce((
        select jsonb_agg(jsonb_build_object('name', ao.name, 'price', ao.price))
          from public.add_ons ao where ao.id = any(i.add_on_ids)), '[]'::jsonb),
      i.credits_cost,
      coalesce(p.estimated_cost, 0) * i.quantity,
      i.special_instructions
      from public.subscription_delivery_items i
      join public.products p on p.id = i.product_id
     where i.delivery_id = v_rec.id
       and not exists (select 1 from public.order_items oi where oi.order_id = v_order_id);

    select coalesce(sum(estimated_cost), 0) into v_cost
      from public.order_items where order_id = v_order_id;

    update public.orders set estimated_food_cost = v_cost where id = v_order_id;

    -- Consume credits. The idempotency key ties the entry to this delivery, so
    -- a re-run cannot debit twice.
    if v_rec.credits_cost > 0 then
      insert into public.subscription_credit_ledger
        (subscription_id, entry_type, credits, reason, delivery_id, idempotency_key)
      values
        (v_rec.subscription_id, 'consume', -v_rec.credits_cost,
         'Delivery released to kitchen', v_rec.id,
         'consume:' || v_rec.id::text)
      on conflict (subscription_id, idempotency_key) do nothing;
    end if;

    v_ticket := app.create_kot_ticket(v_order_id);

    update public.subscription_deliveries
       set status = 'released', released_at = now(), order_id = v_order_id
     where id = v_rec.id;

    v_released := v_released + 1;
    v_results := v_results || jsonb_build_object(
      'delivery_id', v_rec.id, 'order_id', v_order_id, 'ticket_id', v_ticket);
  end loop;

  return jsonb_build_object(
    'released', v_released,
    'blocked_insufficient_credits', v_blocked,
    'lead_time_minutes', v_lead,
    'details', v_results);
end;
$fn$;

-- =============================================================================
-- Operational actions on a ticket
-- =============================================================================
-- All of them go through the same door. The trigger in 0007 decides whether
-- the transition is legal and whether this actor may make it, so no caller can
-- reach an unauthorised state by writing the column directly.
-- =============================================================================
create or replace function public.transition_kot_ticket(
  p_ticket_id uuid,
  p_to_status public.kot_status,
  p_reason    text default null,
  p_notes     text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_ticket public.kot_tickets%rowtype;
  v_from   public.kot_status;
begin
  select * into v_ticket from public.kot_tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'ticket % not found', p_ticket_id using errcode = 'no_data_found';
  end if;

  -- Replaying the same transition is a no-op rather than an error: a double
  -- tap on a tablet under rush conditions should not surface a failure.
  if v_ticket.status = p_to_status then
    return jsonb_build_object('ticket_id', p_ticket_id, 'status', p_to_status, 'noop', true);
  end if;

  v_from := v_ticket.status;

  update public.kot_tickets
     set status = p_to_status,
         rejection_reason = case when p_to_status = 'REJECTED' then p_reason else rejection_reason end,
         cancellation_reason = case when p_to_status = 'CANCELLED' then p_reason else cancellation_reason end,
         notes = coalesce(p_notes, notes)
   where id = p_ticket_id;

  -- Keep the order's own machine in step without letting either one own the
  -- other's columns.
  if p_to_status = 'PREPARING' then
    update public.orders set status = 'IN_PROGRESS'
     where id = v_ticket.order_id and status = 'CONFIRMED';
  elsif p_to_status = 'COMPLETED' then
    update public.orders set status = 'COMPLETED' where id = v_ticket.order_id;
    update public.subscription_deliveries
       set status = 'fulfilled', fulfilled_at = now()
     where order_id = v_ticket.order_id;
  elsif p_to_status in ('REJECTED','CANCELLED') then
    update public.orders
       set status = case when p_to_status = 'REJECTED'
                         then 'REJECTED'::public.order_status
                         else 'CANCELLED'::public.order_status end,
           cancellation_reason = p_reason
     where id = v_ticket.order_id;
  end if;

  return jsonb_build_object(
    'ticket_id', p_ticket_id,
    'from', v_from,
    'status', p_to_status,
    'noop', false);
end;
$fn$;

-- Manager-only ETA override (PRD 9). The original estimate is preserved so the
-- override is visible in history rather than overwriting the kitchen's number.
create or replace function public.override_prep_eta(
  p_ticket_id uuid,
  p_minutes   integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
begin
  if not app.has_permission('kot.override_eta') then
    raise exception 'not permitted to override preparation ETA'
      using errcode = 'insufficient_privilege';
  end if;

  if p_minutes is null or p_minutes <= 0 then
    raise exception 'ETA must be a positive number of minutes'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.kot_tickets
     set prep_eta_minutes = p_minutes,
         eta_overridden_by = app.current_actor_id(),
         eta_overridden_at = now()
   where id = p_ticket_id;

  if not found then
    raise exception 'ticket % not found', p_ticket_id using errcode = 'no_data_found';
  end if;

  perform public.record_audit_event(
    'update', 'kot_tickets', p_ticket_id::text, null,
    jsonb_build_object('prep_eta_minutes', p_minutes));

  return jsonb_build_object('ticket_id', p_ticket_id, 'prep_eta_minutes', p_minutes);
end;
$fn$;

-- =============================================================================
-- Skip, pause and cancel (PRD 7)
-- =============================================================================
-- Skipping returns the entitlement by default; the rule is a setting, and the
-- return is a compensating ledger entry rather than an edit to the debit.
-- =============================================================================
create or replace function public.skip_subscription_delivery(
  p_delivery_id uuid,
  p_reason      text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_delivery public.subscription_deliveries%rowtype;
  v_plan     public.subscription_plans%rowtype;
  v_returns  boolean;
  v_returned integer := 0;
begin
  select * into v_delivery from public.subscription_deliveries
   where id = p_delivery_id for update;

  if not found then
    raise exception 'delivery % not found', p_delivery_id using errcode = 'no_data_found';
  end if;

  perform app.assert_subscription_access(v_delivery.subscription_id);

  if v_delivery.status = 'skipped' then
    return jsonb_build_object('delivery_id', p_delivery_id, 'status', 'skipped', 'noop', true);
  end if;

  -- Once a ticket exists the kitchen may already be cooking; skipping then is
  -- an operational decision, not a customer self-service one.
  if v_delivery.status <> 'scheduled' then
    raise exception 'delivery is % and can no longer be skipped', v_delivery.status
      using errcode = 'check_violation';
  end if;

  select p.* into v_plan
    from public.subscription_plans p
    join public.subscriptions s on s.plan_id = p.id
   where s.id = v_delivery.subscription_id;

  v_returns := coalesce(v_plan.skip_returns_credit,
                        app.setting_bool('subscription.skip_returns_credit'));

  update public.subscription_deliveries
     set status = 'skipped',
         skipped_at = now(),
         skip_reason = p_reason,
         skipped_by = app.current_actor_id()
   where id = p_delivery_id;

  if v_returns and v_delivery.credits_cost > 0 then
    insert into public.subscription_credit_ledger
      (subscription_id, entry_type, credits, reason, delivery_id, idempotency_key, created_by)
    values
      (v_delivery.subscription_id, 'reverse', v_delivery.credits_cost,
       'Skipped delivery', p_delivery_id,
       'reverse-skip:' || p_delivery_id::text, app.current_actor_id())
    on conflict (subscription_id, idempotency_key) do nothing;

    v_returned := v_delivery.credits_cost;
  end if;

  return jsonb_build_object(
    'delivery_id', p_delivery_id,
    'status', 'skipped',
    'credits_returned', v_returned,
    'credits_remaining', public.subscription_credit_balance(v_delivery.subscription_id));
end;
$fn$;

create or replace function public.pause_subscription(
  p_subscription_id uuid,
  p_starts_on       date,
  p_ends_on         date,
  p_reason          text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_sub        public.subscriptions%rowtype;
  v_plan       public.subscription_plans%rowtype;
  v_max_pauses integer;
  v_max_days   integer;
  v_used       integer;
  v_days       integer;
  v_pause_id   uuid;
begin
  perform app.assert_subscription_access(p_subscription_id);

  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'subscription % not found', p_subscription_id using errcode = 'no_data_found';
  end if;

  if v_sub.status not in ('active','past_due') then
    raise exception 'subscription is % and cannot be paused', v_sub.status
      using errcode = 'check_violation';
  end if;

  if p_ends_on < p_starts_on then
    raise exception 'pause end date is before its start date' using errcode = 'check_violation';
  end if;

  if p_starts_on < app.business_date() then
    raise exception 'a pause cannot start in the past' using errcode = 'check_violation';
  end if;

  select * into v_plan from public.subscription_plans where id = v_sub.plan_id;

  -- Both limits are configurable and still pending owner sign-off (PRD 22);
  -- nothing here hardcodes "2 pauses" or "3-5 days".
  v_max_pauses := coalesce(v_plan.max_pauses_per_period,
                           app.setting_int('subscription.max_pauses_per_period'));
  v_max_days   := coalesce(v_plan.max_pause_days,
                           app.setting_int('subscription.max_pause_days'));

  v_days := (p_ends_on - p_starts_on) + 1;
  if v_days > v_max_days then
    raise exception 'a pause may not exceed % days', v_max_days using errcode = 'check_violation';
  end if;

  select count(*) into v_used
    from public.subscription_pauses
   where subscription_id = p_subscription_id
     and cancelled_at is null
     and starts_on >= coalesce(v_sub.current_period_start, v_sub.starts_on);

  if v_used >= v_max_pauses then
    raise exception 'pause limit reached for this period (% allowed)', v_max_pauses
      using errcode = 'check_violation';
  end if;

  insert into public.subscription_pauses
    (subscription_id, starts_on, ends_on, reason, created_by)
  values
    (p_subscription_id, p_starts_on, p_ends_on, p_reason, app.current_actor_id())
  returning id into v_pause_id;

  update public.subscriptions
     set status = case when p_starts_on <= app.business_date() then 'paused' else status end,
         paused_until = p_ends_on,
         pauses_used_this_period = v_used + 1
   where id = p_subscription_id;

  -- Deliveries inside the pause window are skipped, returning entitlement by
  -- the same rule as a manual skip.
  perform public.skip_subscription_delivery(d.id, 'Subscription paused')
     from public.subscription_deliveries d
    where d.subscription_id = p_subscription_id
      and d.status = 'scheduled'
      and d.scheduled_date between p_starts_on and p_ends_on;

  return jsonb_build_object(
    'pause_id', v_pause_id,
    'starts_on', p_starts_on,
    'ends_on', p_ends_on,
    'pauses_used', v_used + 1,
    'pauses_allowed', v_max_pauses);
end;
$fn$;

-- Cancellation stops future deliveries but preserves the historical and
-- current-period record (PRD 7). Refund handling is a separate, pending policy.
create or replace function public.cancel_subscription(
  p_subscription_id uuid,
  p_reason          text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_sub       public.subscriptions%rowtype;
  v_cancelled integer;
begin
  perform app.assert_subscription_access(p_subscription_id);

  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'subscription % not found', p_subscription_id using errcode = 'no_data_found';
  end if;

  if v_sub.status = 'cancelled' then
    return jsonb_build_object('subscription_id', p_subscription_id, 'status', 'cancelled', 'noop', true);
  end if;

  update public.subscriptions
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = p_reason,
         cancelled_by = app.current_actor_id(),
         next_renewal_at = null
   where id = p_subscription_id;

  -- Only future, not-yet-released deliveries are withdrawn; anything already
  -- in the kitchen stays in the kitchen.
  with cancelled as (
    update public.subscription_deliveries
       set status = 'cancelled', cancelled_at = now()
     where subscription_id = p_subscription_id
       and status = 'scheduled'
    returning 1)
  select count(*) into v_cancelled from cancelled;

  return jsonb_build_object(
    'subscription_id', p_subscription_id,
    'status', 'cancelled',
    'future_deliveries_cancelled', v_cancelled,
    'credits_remaining', public.subscription_credit_balance(p_subscription_id));
end;
$fn$;
