-- =============================================================================
-- 0011  Server-authoritative pricing and subscription checkout (PRD 6, 7, 8)
-- =============================================================================
-- The browser never decides what anything costs. It asks for a quote, shows
-- it, and submits a choice; this file recomputes the same numbers server-side
-- before a payment is ever created.
-- =============================================================================

create sequence public.subscription_number_seq as bigint start with 1 increment by 1;

create or replace function app.next_subscription_number()
returns text
language sql
volatile
security definer
set search_path = ''
as $fn$
  select 'SUB-' || lpad(nextval('public.subscription_number_seq')::text, 6, '0');
$fn$;

create or replace function app.next_invoice_number()
returns text
language sql
volatile
security definer
set search_path = ''
as $fn$
  select 'INV-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
$fn$;

-- =============================================================================
-- quote_subscription
-- =============================================================================
-- Returns the full price breakdown for buying a plan, including the CGST/SGST
-- split and whether a requested coupon actually applies. This is the only
-- place subscription pricing is computed.
-- =============================================================================
create or replace function public.quote_subscription(
  p_plan_id     uuid,
  p_customer_id uuid default null,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_plan        public.subscription_plans%rowtype;
  v_subtotal    numeric(12,2);
  v_discount    numeric(12,2) := 0;
  v_coupon_id   uuid;
  v_coupon_ok   boolean := false;
  v_coupon_msg  text := null;
  v_delivery    numeric(12,2) := 0;
  v_taxable     numeric(12,2);
  v_tax_total   numeric(12,2) := 0;
  v_breakdown   jsonb := '[]'::jsonb;
  v_component   record;
  v_amount      numeric(12,2);
  v_charge_delivery boolean;
begin
  select * into v_plan
    from public.subscription_plans
   where id = p_plan_id
     and is_active
     and is_published
     and archived_at is null;

  if not found then
    raise exception 'plan % is not available for purchase', p_plan_id
      using errcode = 'no_data_found';
  end if;

  v_subtotal := v_plan.price;

  -- Coupon. An invalid code is not an error -- the caller gets a reason to
  -- show, and the quote simply carries no discount.
  if p_coupon_code is not null and p_customer_id is not null then
    select vc.is_valid, vc.reason, vc.discount_amount, vc.coupon_id
      into v_coupon_ok, v_coupon_msg, v_discount, v_coupon_id
      from public.validate_coupon(p_coupon_code, p_customer_id, v_subtotal, p_plan_id, 'SX') vc;

    if not v_coupon_ok then
      v_discount := 0;
      v_coupon_id := null;
    end if;
  end if;

  v_charge_delivery := coalesce(
    (app.setting('subscription.charge_delivery_fee_at_checkout') #>> '{}')::boolean, false);

  if v_charge_delivery then
    v_delivery := app.resolve_delivery_fee(v_subtotal - v_discount, 'SX');
  end if;

  v_taxable := greatest(v_subtotal - v_discount, 0);

  -- One row per active tax component, so the invoice can show CGST and SGST
  -- separately instead of a single opaque line (PRD 6).
  for v_component in select * from app.resolve_tax_components('food') loop
    v_amount := round(v_taxable * v_component.rate_percent / 100.0, 2);
    v_tax_total := v_tax_total + v_amount;
    v_breakdown := v_breakdown || jsonb_build_object(
      'code',   v_component.code,
      'label',  v_component.label,
      'rate',   v_component.rate_percent,
      'amount', v_amount
    );
  end loop;

  return jsonb_build_object(
    'plan_id',        v_plan.id,
    'plan_name',      v_plan.name,
    'currency',       'INR',
    'subtotal',       v_subtotal,
    'discount_total', v_discount,
    'coupon_code',    case when v_coupon_id is not null then upper(p_coupon_code) end,
    'coupon_id',      v_coupon_id,
    'coupon_applied', v_coupon_ok,
    'coupon_message', v_coupon_msg,
    'delivery_fee',   v_delivery,
    'tax_total',      v_tax_total,
    'tax_breakdown',  v_breakdown,
    'grand_total',    round(v_taxable + v_delivery + v_tax_total, 2)
  );
end;
$fn$;

-- =============================================================================
-- begin_subscription_checkout
-- =============================================================================
-- Creates a subscription in 'pending_payment' plus a 'pending' payment row,
-- and returns the amount the gateway should be asked for. It grants nothing,
-- schedules nothing and produces no KOT -- a subscription only becomes real
-- once the payment is verified.
--
-- Idempotent on p_idempotency_key: a retried checkout returns the original
-- subscription and payment rather than creating a second one (PRD 7).
-- =============================================================================
create or replace function public.begin_subscription_checkout(
  p_customer_id      uuid,
  p_plan_id          uuid,
  p_address_id       uuid,
  p_delivery_window_id uuid,
  p_provider         public.payment_provider,
  p_idempotency_key  text,
  p_delivery_days    smallint[] default '{}',
  p_selected_meals   jsonb default '[]'::jsonb,
  p_coupon_code      text default null,
  p_delivery_instructions text default null,
  p_starts_on        date default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_existing      public.payments%rowtype;
  v_plan          public.subscription_plans%rowtype;
  v_quote         jsonb;
  v_subscription  public.subscriptions%rowtype;
  v_payment_id    uuid;
  v_grace         integer;
  v_starts_on     date;
  v_meal          jsonb;
  v_sub_id        uuid;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'a checkout idempotency key is required' using errcode = 'invalid_parameter_value';
  end if;

  perform app.assert_customer_access(p_customer_id);

  -- Replay: hand back exactly what the first call produced.
  select * into v_existing from public.payments where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'replayed',        true,
      'subscription_id', v_existing.subscription_id,
      'payment_id',      v_existing.id,
      'amount',          v_existing.amount,
      'status',          v_existing.status
    );
  end if;

  select * into v_plan from public.subscription_plans where id = p_plan_id;
  if not found then
    raise exception 'plan % not found', p_plan_id using errcode = 'no_data_found';
  end if;

  -- Address must belong to this customer. Never trust a client-supplied id.
  if p_address_id is not null and not exists (
    select 1 from public.customer_addresses
     where id = p_address_id and customer_id = p_customer_id and is_active
  ) then
    raise exception 'delivery address does not belong to this customer'
      using errcode = 'insufficient_privilege';
  end if;

  -- The plan must actually offer the requested window.
  if p_delivery_window_id is not null and exists (
       select 1 from public.subscription_plan_windows where plan_id = p_plan_id
     ) and not exists (
       select 1 from public.subscription_plan_windows
        where plan_id = p_plan_id and delivery_window_id = p_delivery_window_id
     ) then
    raise exception 'this plan is not offered in the selected delivery window'
      using errcode = 'check_violation';
  end if;

  v_quote := public.quote_subscription(p_plan_id, p_customer_id, p_coupon_code);

  v_grace := coalesce(v_plan.grace_period_days, app.setting_int('subscription.grace_period_days'));
  v_starts_on := coalesce(p_starts_on, app.business_date() + 1);

  insert into public.subscriptions (
    subscription_number, customer_id, plan_id, status,
    plan_snapshot, price_paid, payment_flow,
    starts_on, current_period_start, current_period_end,
    delivery_address_id, delivery_window_id, delivery_days, delivery_instructions,
    grace_period_days
  ) values (
    app.next_subscription_number(), p_customer_id, p_plan_id, 'pending_payment',
    -- Freeze the commercial terms and the quote that produced this price.
    jsonb_build_object('plan', to_jsonb(v_plan), 'quote', v_quote),
    (v_quote ->> 'grand_total')::numeric,
    v_plan.payment_flow,
    v_starts_on, v_starts_on, v_starts_on + (v_plan.billing_period_days - 1),
    p_address_id, p_delivery_window_id, coalesce(p_delivery_days, '{}'), p_delivery_instructions,
    v_grace
  )
  returning * into v_subscription;

  v_sub_id := v_subscription.id;

  -- Customer-selected plans record the customer's picks now; they are
  -- validated against the plan's selectable pool.
  if v_plan.plan_type = 'customer_selected' and jsonb_array_length(coalesce(p_selected_meals, '[]'::jsonb)) > 0 then
    for v_meal in select * from jsonb_array_elements(p_selected_meals) loop
      if not exists (
        select 1 from public.subscription_plan_meals m
         where m.plan_id = p_plan_id
           and m.product_id = (v_meal ->> 'product_id')::uuid
           and m.is_selectable
      ) then
        raise exception 'meal % is not selectable on this plan', v_meal ->> 'product_id'
          using errcode = 'check_violation';
      end if;

      if not app.product_is_orderable((v_meal ->> 'product_id')::uuid) then
        raise exception 'meal % is currently unavailable', v_meal ->> 'product_id'
          using errcode = 'check_violation';
      end if;

      insert into public.subscription_selected_meals
        (subscription_id, product_id, day_of_week, delivery_window_id, quantity)
      values (
        v_sub_id,
        (v_meal ->> 'product_id')::uuid,
        nullif(v_meal ->> 'day_of_week', '')::smallint,
        coalesce(nullif(v_meal ->> 'delivery_window_id', '')::uuid, p_delivery_window_id),
        coalesce((v_meal ->> 'quantity')::integer, 1)
      );
    end loop;
  end if;

  insert into public.payments (
    subscription_id, customer_id, provider, flow, status,
    amount, currency, idempotency_key
  ) values (
    v_sub_id, p_customer_id, p_provider, v_plan.payment_flow, 'pending',
    (v_quote ->> 'grand_total')::numeric, 'INR', p_idempotency_key
  )
  returning id into v_payment_id;

  perform public.record_audit_event(
    'insert', 'subscription_checkout', v_sub_id::text, null,
    jsonb_build_object('payment_id', v_payment_id, 'quote', v_quote));

  return jsonb_build_object(
    'replayed',            false,
    'subscription_id',     v_sub_id,
    'subscription_number', v_subscription.subscription_number,
    'payment_id',          v_payment_id,
    'amount',              (v_quote ->> 'grand_total')::numeric,
    'currency',            'INR',
    'quote',               v_quote
  );
end;
$fn$;
