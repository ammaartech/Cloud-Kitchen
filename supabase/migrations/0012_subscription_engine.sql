-- =============================================================================
-- 0012  Subscription engine: activation, credits, schedule generation,
--       skip / pause / cancel, and release to the KOT (PRD 7, 8, 9)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ownership guard. The customer-facing RPCs below are SECURITY DEFINER, which
-- means they run with the definer's rights and RLS does not filter them. Each
-- one must therefore prove for itself that the caller is entitled to the
-- subscription it is about to act on -- otherwise passing someone else's id
-- would be enough to pause their plan.
-- -----------------------------------------------------------------------------
create or replace function app.assert_subscription_access(p_subscription_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  if app.is_service_role() or app.has_permission('subscriptions.manage') then
    return;
  end if;

  if exists (
    select 1 from public.subscriptions s
     where s.id = p_subscription_id
       and s.customer_id = app.current_customer_id()
  ) then
    return;
  end if;

  raise exception 'not permitted to act on this subscription'
    using errcode = 'insufficient_privilege';
end;
$fn$;

create or replace function app.assert_customer_access(p_customer_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  if app.is_service_role()
     or app.has_permission('customers.manage')
     or p_customer_id = app.current_customer_id() then
    return;
  end if;

  raise exception 'not permitted to act on behalf of this customer'
    using errcode = 'insufficient_privilege';
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Entitlement granted per billing cycle. Credit-plans grant credits directly;
-- meal-count plans grant one credit per meal, and each meal consumes as many
-- credits as its product says -- which is how a premium meal costs more than
-- one without a second code path (PRD 7).
-- -----------------------------------------------------------------------------
create or replace function app.plan_cycle_credits(p_plan public.subscription_plans)
returns integer
language sql
immutable
as $fn$
  select case
    when p_plan.plan_type = 'meal_credits' then p_plan.credits_per_cycle
    else p_plan.meals_per_cycle
  end;
$fn$;

-- Base KOT priority per source. Marketplace orders outrank scheduled
-- subscription deliveries because they are immediate (PRD 9) -- and the
-- numbers are a setting, not a constant.
create or replace function app.base_priority(p_source public.order_source)
returns integer
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce((app.setting('kot.base_priority') ->> p_source::text)::integer, 0);
$fn$;

create or replace function app.sla_due_at(
  p_source public.order_source,
  p_from   timestamptz default now()
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $fn$
  select p_from + make_interval(
    mins => coalesce((app.setting('kot.sla_minutes') ->> p_source::text)::integer, 45));
$fn$;

-- =============================================================================
-- confirm_subscription_payment
-- =============================================================================
-- The single door through which a subscription becomes real. Called only by
-- server-side code that has already verified the provider signature; it
-- refuses to proceed if that verification did not happen.
--
-- Idempotent: a duplicate webhook or a callback racing a webhook results in
-- one activation, one credit grant, one invoice and one schedule.
-- =============================================================================
create or replace function public.confirm_subscription_payment(
  p_payment_id          uuid,
  p_provider_payment_id text,
  p_signature_verified  boolean,
  p_verified_via        text default 'webhook',
  p_raw                 jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_payment      public.payments%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_plan         public.subscription_plans%rowtype;
  v_quote        jsonb;
  v_credits      integer;
  v_invoice_id   uuid;
  v_coupon_id    uuid;
  v_deliveries   integer := 0;
begin
  if not p_signature_verified then
    raise exception 'refusing to confirm a payment whose signature was not verified'
      using errcode = 'insufficient_privilege';
  end if;

  -- Serialise concurrent confirmations of the same payment.
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment % not found', p_payment_id using errcode = 'no_data_found';
  end if;

  if v_payment.status = 'success' then
    return jsonb_build_object(
      'replayed', true,
      'payment_id', v_payment.id,
      'subscription_id', v_payment.subscription_id,
      'status', 'success');
  end if;

  if v_payment.status in ('refunded','partially_refunded') then
    raise exception 'payment % has already been refunded', p_payment_id
      using errcode = 'check_violation';
  end if;

  update public.payments
     set status              = 'success',
         provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
         verified_at         = now(),
         verified_via        = p_verified_via,
         raw_payload         = p_raw,
         needs_reconciliation = false,
         failure_code        = null,
         failure_message     = null
   where id = p_payment_id;

  select * into v_subscription from public.subscriptions
   where id = v_payment.subscription_id for update;

  if not found then
    raise exception 'payment % is not attached to a subscription', p_payment_id
      using errcode = 'check_violation';
  end if;

  select * into v_plan from public.subscription_plans where id = v_subscription.plan_id;

  -- Activate. The trigger from 0008 re-checks that a verified payment exists.
  if v_subscription.status = 'pending_payment' then
    update public.subscriptions
       set status         = 'active',
           activated_at   = now(),
           next_renewal_at = case
             when v_plan.payment_flow = 'recurring'
             then (v_subscription.current_period_end + 1)::timestamptz
             else null end
     where id = v_subscription.id;
  end if;

  -- Grant the cycle's entitlement. The idempotency key makes a replay a no-op.
  v_credits := app.plan_cycle_credits(v_plan);
  if v_credits is not null and v_credits > 0 then
    insert into public.subscription_credit_ledger
      (subscription_id, entry_type, credits, reason, idempotency_key)
    values
      (v_subscription.id, 'grant', v_credits,
       format('Cycle grant for %s', v_plan.name),
       'grant:' || v_subscription.id::text || ':' || v_subscription.current_period_start::text)
    on conflict (subscription_id, idempotency_key) do nothing;
  end if;

  -- Record the coupon redemption exactly once.
  v_quote := v_subscription.plan_snapshot -> 'quote';
  v_coupon_id := nullif(v_quote ->> 'coupon_id', '')::uuid;

  if v_coupon_id is not null and (v_quote ->> 'coupon_applied')::boolean then
    insert into public.coupon_redemptions
      (coupon_id, customer_id, subscription_id, discount_amount)
    values
      (v_coupon_id, v_subscription.customer_id, v_subscription.id,
       (v_quote ->> 'discount_total')::numeric)
    on conflict (coupon_id, subscription_id) where subscription_id is not null do nothing;

    if found then
      update public.coupons set times_redeemed = times_redeemed + 1 where id = v_coupon_id;
    end if;
  end if;

  -- Invoice, once.
  select id into v_invoice_id from public.invoices where payment_id = p_payment_id;
  if v_invoice_id is null then
    insert into public.invoices (
      invoice_number, invoice_type, customer_id, subscription_id, payment_id,
      subtotal, discount_total, delivery_fee, tax_total, tax_breakdown, total,
      billing_snapshot
    ) values (
      app.next_invoice_number(), 'customer', v_subscription.customer_id,
      v_subscription.id, p_payment_id,
      (v_quote ->> 'subtotal')::numeric,
      (v_quote ->> 'discount_total')::numeric,
      (v_quote ->> 'delivery_fee')::numeric,
      (v_quote ->> 'tax_total')::numeric,
      coalesce(v_quote -> 'tax_breakdown', '[]'::jsonb),
      (v_quote ->> 'grand_total')::numeric,
      jsonb_build_object('plan', v_plan.name, 'subscription_number', v_subscription.subscription_number)
    )
    returning id into v_invoice_id;
  end if;

  -- Build the delivery schedule from plan rules.
  v_deliveries := public.generate_subscription_deliveries(
    v_subscription.id,
    greatest(v_subscription.current_period_start, app.business_date()),
    v_subscription.current_period_end);

  -- Notification is enqueued, never sent inline: a provider outage must not
  -- roll back an activation (PRD 15).
  insert into public.notifications
    (customer_id, channel, template_code, to_address, payload, dedupe_key)
  select v_subscription.customer_id,
         'whatsapp',
         'subscription_activated',
         c.phone,
         jsonb_build_object(
           'customer_name', c.full_name,
           'plan_name', v_plan.name,
           'subscription_number', v_subscription.subscription_number,
           'starts_on', v_subscription.starts_on),
         'subscription_activated:' || v_subscription.id::text
    from public.customers c
   where c.id = v_subscription.customer_id
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  perform public.record_audit_event(
    'state_transition', 'subscriptions', v_subscription.id::text,
    jsonb_build_object('status', 'pending_payment'),
    jsonb_build_object('status', 'active', 'payment_id', p_payment_id,
                       'credits_granted', v_credits, 'deliveries_generated', v_deliveries));

  return jsonb_build_object(
    'replayed', false,
    'payment_id', p_payment_id,
    'subscription_id', v_subscription.id,
    'subscription_number', v_subscription.subscription_number,
    'credits_granted', coalesce(v_credits, 0),
    'deliveries_generated', v_deliveries,
    'invoice_id', v_invoice_id,
    'status', 'active');
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Failure path. Leaves the subscription inactive and creates nothing
-- downstream -- no schedule, no ticket, no delivery (PRD 8).
-- -----------------------------------------------------------------------------
create or replace function public.fail_subscription_payment(
  p_payment_id  uuid,
  p_code        text,
  p_message     text,
  p_uncertain   boolean default false,
  p_raw         jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment % not found', p_payment_id using errcode = 'no_data_found';
  end if;

  -- A late failure notice must never undo a confirmed payment.
  if v_payment.status = 'success' then
    return jsonb_build_object('ignored', true, 'reason', 'payment already succeeded');
  end if;

  update public.payments
     set status = 'failed',
         failure_code = p_code,
         failure_message = p_message,
         -- "Money may have left the customer but we cannot confirm it" is its
         -- own state, routed to reconciliation rather than guessed at.
         needs_reconciliation = p_uncertain,
         raw_payload = p_raw
   where id = p_payment_id;

  perform public.record_audit_event(
    'state_transition', 'payments', p_payment_id::text,
    jsonb_build_object('status', v_payment.status),
    jsonb_build_object('status', 'failed', 'code', p_code, 'needs_reconciliation', p_uncertain));

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'status', 'failed',
    'subscription_active', false,
    'needs_reconciliation', p_uncertain);
end;
$fn$;

-- =============================================================================
-- generate_subscription_deliveries
-- =============================================================================
-- Expands plan rules into dated delivery rows. Re-running it for an
-- overlapping range is safe: the unique key on
-- (subscription_id, scheduled_date, delivery_window_id) absorbs duplicates.
-- =============================================================================
create or replace function public.generate_subscription_deliveries(
  p_subscription_id uuid,
  p_from            date,
  p_to              date
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_sub      public.subscriptions%rowtype;
  v_plan     public.subscription_plans%rowtype;
  v_date     date;
  v_dow      smallint;
  v_window   uuid;
  v_delivery_id uuid;
  v_created  integer := 0;
  v_meal     record;
  v_cost     integer;
  v_paused   boolean;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'subscription % not found', p_subscription_id using errcode = 'no_data_found';
  end if;

  select * into v_plan from public.subscription_plans where id = v_sub.plan_id;

  -- Credit plans have no fixed calendar: the customer schedules against their
  -- balance instead (see schedule_credit_delivery).
  if v_plan.plan_type = 'meal_credits' then
    return 0;
  end if;

  if v_sub.status not in ('active','paused','past_due') then
    return 0;
  end if;

  v_date := p_from;
  while v_date <= p_to loop
    v_dow := extract(dow from v_date)::smallint;

    -- Honour the subscription's delivery days; empty means every day.
    if array_length(v_sub.delivery_days, 1) is null
       or v_dow = any(v_sub.delivery_days) then

      -- Skip days covered by an active pause.
      select exists (
        select 1 from public.subscription_pauses p
         where p.subscription_id = v_sub.id
           and p.cancelled_at is null
           and v_date between p.starts_on and p.ends_on
      ) into v_paused;

      if not v_paused then
        for v_meal in
          -- customer_selected plans deliver the customer's picks; the others
          -- deliver what the plan defines.
          select m.product_id, m.quantity,
                 coalesce(m.delivery_window_id, v_sub.delivery_window_id) as window_id
            from public.subscription_selected_meals m
           where v_plan.plan_type = 'customer_selected'
             and m.subscription_id = v_sub.id
             and (m.day_of_week is null or m.day_of_week = v_dow)
          union all
          select m.product_id, m.quantity,
                 coalesce(m.delivery_window_id, v_sub.delivery_window_id) as window_id
            from public.subscription_plan_meals m
           where v_plan.plan_type <> 'customer_selected'
             and m.plan_id = v_plan.id
             and not m.is_selectable
             and (m.day_of_week is null or m.day_of_week = v_dow)
        loop
          v_window := coalesce(v_meal.window_id, v_sub.delivery_window_id);
          exit when v_window is null;

          insert into public.subscription_deliveries
            (subscription_id, customer_id, scheduled_date, delivery_window_id,
             address_id, delivery_instructions, credits_cost)
          values
            (v_sub.id, v_sub.customer_id, v_date, v_window,
             v_sub.delivery_address_id, v_sub.delivery_instructions, 0)
          on conflict (subscription_id, scheduled_date, delivery_window_id) do nothing
          returning id into v_delivery_id;

          if v_delivery_id is null then
            select id into v_delivery_id from public.subscription_deliveries
             where subscription_id = v_sub.id
               and scheduled_date = v_date
               and delivery_window_id = v_window;
          else
            v_created := v_created + 1;
          end if;

          -- Credit cost follows the product, so a premium meal really does
          -- cost more than a standard one.
          select p.credit_cost * v_meal.quantity into v_cost
            from public.products p where p.id = v_meal.product_id;

          insert into public.subscription_delivery_items
            (delivery_id, product_id, quantity, credits_cost)
          select v_delivery_id, v_meal.product_id, v_meal.quantity, coalesce(v_cost, 0)
          where not exists (
            select 1 from public.subscription_delivery_items i
             where i.delivery_id = v_delivery_id and i.product_id = v_meal.product_id
          );

          update public.subscription_deliveries d
             set credits_cost = (
               select coalesce(sum(i.credits_cost), 0)
                 from public.subscription_delivery_items i
                where i.delivery_id = d.id)
           where d.id = v_delivery_id;

          v_delivery_id := null;
        end loop;
      end if;
    end if;

    v_date := v_date + 1;
  end loop;

  return v_created;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Credit plans: the customer books a delivery against their balance. The
-- balance is checked here, on the server, against the ledger.
-- -----------------------------------------------------------------------------
create or replace function public.schedule_credit_delivery(
  p_subscription_id  uuid,
  p_date             date,
  p_delivery_window_id uuid,
  p_items            jsonb,          -- [{product_id, quantity}]
  p_address_id       uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_sub       public.subscriptions%rowtype;
  v_item      jsonb;
  v_cost      integer := 0;
  v_line      integer;
  v_balance   integer;
  v_delivery_id uuid;
begin
  perform app.assert_subscription_access(p_subscription_id);

  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'subscription % not found', p_subscription_id using errcode = 'no_data_found';
  end if;

  if v_sub.status <> 'active' then
    raise exception 'subscription is % and cannot schedule deliveries', v_sub.status
      using errcode = 'check_violation';
  end if;

  if p_date < app.business_date() then
    raise exception 'cannot schedule a delivery in the past' using errcode = 'check_violation';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if not app.product_is_orderable((v_item ->> 'product_id')::uuid) then
      raise exception 'one of the selected meals is currently unavailable'
        using errcode = 'check_violation';
    end if;

    select p.credit_cost * coalesce((v_item ->> 'quantity')::integer, 1)
      into v_line
      from public.products p where p.id = (v_item ->> 'product_id')::uuid;

    v_cost := v_cost + coalesce(v_line, 0);
  end loop;

  v_balance := public.subscription_credit_balance(p_subscription_id);
  if v_balance < v_cost then
    raise exception 'not enough credits: % available, % required', v_balance, v_cost
      using errcode = 'check_violation';
  end if;

  insert into public.subscription_deliveries
    (subscription_id, customer_id, scheduled_date, delivery_window_id,
     address_id, credits_cost)
  values
    (p_subscription_id, v_sub.customer_id, p_date, p_delivery_window_id,
     coalesce(p_address_id, v_sub.delivery_address_id), v_cost)
  returning id into v_delivery_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.subscription_delivery_items
      (delivery_id, product_id, quantity, credits_cost)
    select v_delivery_id,
           (v_item ->> 'product_id')::uuid,
           coalesce((v_item ->> 'quantity')::integer, 1),
           p.credit_cost * coalesce((v_item ->> 'quantity')::integer, 1)
      from public.products p where p.id = (v_item ->> 'product_id')::uuid;
  end loop;

  return jsonb_build_object(
    'delivery_id', v_delivery_id,
    'credits_cost', v_cost,
    'credits_remaining', v_balance - v_cost);
end;
$fn$;
