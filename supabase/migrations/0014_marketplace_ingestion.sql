-- =============================================================================
-- 0014  Marketplace ingestion, status sync and failure isolation (PRD 16)
-- =============================================================================
-- Swiggy and Zomato are order channels, not separate systems. Everything they
-- send lands in the same orders/kot_tickets tables as a website subscription
-- delivery; only the source prefix and the priority differ.
--
-- Nothing here calls a marketplace API. The adapters in the application layer
-- do that, and only for capabilities recorded as 'integrated' in
-- integration_capabilities. This file is the ingestion boundary.
-- =============================================================================

create or replace function app.provider_to_source(p_provider public.integration_provider)
returns public.order_source
language sql
immutable
as $fn$
  select case p_provider when 'swiggy' then 'SW'::public.order_source
                         when 'zomato' then 'ZM'::public.order_source end;
$fn$;

-- -----------------------------------------------------------------------------
-- Circuit breaker. One marketplace failing must never stop the others
-- (PRD 16), so health is tracked per account and read before any outbound call.
-- -----------------------------------------------------------------------------
create or replace function public.record_integration_failure(
  p_provider public.integration_provider,
  p_error    text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_threshold integer := coalesce(app.setting_int('integration.failure_threshold'), 5);
  v_cooldown  integer := coalesce(app.setting_int('integration.circuit_cooldown_minutes'), 10);
  v_acct      public.integration_accounts%rowtype;
begin
  update public.integration_accounts
     set consecutive_failures = consecutive_failures + 1,
         last_error = p_error,
         last_error_at = now(),
         health = case
           when consecutive_failures + 1 >= v_threshold then 'down'::public.integration_health
           else 'degraded'::public.integration_health end,
         circuit_open_until = case
           when consecutive_failures + 1 >= v_threshold
           then now() + make_interval(mins => v_cooldown)
           else circuit_open_until end
   where provider = p_provider
  returning * into v_acct;

  return jsonb_build_object(
    'provider', p_provider,
    'health', v_acct.health,
    'consecutive_failures', v_acct.consecutive_failures,
    'circuit_open_until', v_acct.circuit_open_until);
end;
$fn$;

create or replace function public.record_integration_success(
  p_provider public.integration_provider
)
returns void
language sql
volatile
security definer
set search_path = ''
as $fn$
  update public.integration_accounts
     set consecutive_failures = 0,
         health = case when is_enabled then 'connected'::public.integration_health
                       else 'disabled'::public.integration_health end,
         last_healthy_at = now(),
         circuit_open_until = null,
         last_error = null
   where provider = p_provider;
$fn$;

-- =============================================================================
-- ingest_marketplace_order
-- =============================================================================
-- Idempotent on (source, external_order_id): a replayed webhook returns the
-- existing order instead of creating a second ticket.
--
-- Marketplace orders are settled by the marketplace, so no payment row is
-- created here; their revenue is attributed from the order totals the platform
-- reports, and reconciled against the platform later.
-- =============================================================================
create or replace function public.ingest_marketplace_order(
  p_provider          public.integration_provider,
  p_external_order_id text,
  p_items             jsonb,              -- [{name, quantity, unit_price, variants, add_ons, instructions, product_id?}]
  p_totals            jsonb default '{}'::jsonb,
  p_customer          jsonb default '{}'::jsonb,
  p_payload           jsonb default '{}'::jsonb,
  p_external_event_id text default null,
  p_placed_at         timestamptz default now()
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_source   public.order_source := app.provider_to_source(p_provider);
  v_order_id uuid;
  v_ticket   uuid;
  v_item     jsonb;
  v_existing uuid;
  v_subtotal numeric(12,2) := 0;
  v_cost     numeric(12,2) := 0;
  v_account  uuid;
begin
  if v_source is null then
    raise exception 'unknown marketplace provider %', p_provider
      using errcode = 'invalid_parameter_value';
  end if;

  select id into v_account from public.integration_accounts where provider = p_provider;

  -- Duplicate webhook: recorded, then ignored.
  if p_external_event_id is not null then
    insert into public.integration_events
      (provider, account_id, direction, event_type, external_event_id,
       external_order_id, payload, signature_valid, status)
    values
      (p_provider, v_account, 'inbound', 'order.received', p_external_event_id,
       p_external_order_id, p_payload, true, 'received')
    on conflict (provider, external_event_id) where external_event_id is not null do nothing;

    if not found then
      select o.id into v_existing from public.orders o
       where o.source = v_source and o.external_order_id = p_external_order_id;

      return jsonb_build_object(
        'duplicate', true, 'order_id', v_existing, 'external_order_id', p_external_order_id);
    end if;
  end if;

  -- Duplicate order id, arriving without an event id.
  select o.id into v_existing from public.orders o
   where o.source = v_source and o.external_order_id = p_external_order_id;

  if v_existing is not null then
    select id into v_ticket from public.kot_tickets where order_id = v_existing;
    return jsonb_build_object(
      'duplicate', true, 'order_id', v_existing, 'ticket_id', v_ticket);
  end if;

  insert into public.orders (
    source, status, external_order_id, external_status, external_payload,
    placed_at, business_date, scheduled_for,
    customer_name_snapshot, customer_phone_snapshot, address_snapshot,
    delivery_instructions, special_instructions,
    subtotal, discount_total, delivery_fee, tax_total, grand_total
  ) values (
    v_source, 'CONFIRMED', p_external_order_id,
    coalesce(p_payload ->> 'status', 'placed'), p_payload,
    p_placed_at, app.business_date(p_placed_at), p_placed_at,
    nullif(p_customer ->> 'name', ''),
    nullif(p_customer ->> 'phone', ''),
    case when p_customer ? 'address' then p_customer -> 'address' end,
    nullif(p_customer ->> 'delivery_instructions', ''),
    nullif(p_payload ->> 'special_instructions', ''),
    coalesce((p_totals ->> 'subtotal')::numeric, 0),
    coalesce((p_totals ->> 'discount_total')::numeric, 0),
    coalesce((p_totals ->> 'delivery_fee')::numeric, 0),
    coalesce((p_totals ->> 'tax_total')::numeric, 0),
    coalesce((p_totals ->> 'grand_total')::numeric, 0)
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (
      order_id, product_id, name_snapshot, quantity, unit_price, line_subtotal,
      variants_snapshot, add_ons_snapshot, estimated_cost, special_instructions
    )
    select
      v_order_id,
      nullif(v_item ->> 'product_id', '')::uuid,
      v_item ->> 'name',
      coalesce((v_item ->> 'quantity')::integer, 1),
      coalesce((v_item ->> 'unit_price')::numeric, 0),
      coalesce((v_item ->> 'unit_price')::numeric, 0) * coalesce((v_item ->> 'quantity')::integer, 1),
      coalesce(v_item -> 'variants', '[]'::jsonb),
      coalesce(v_item -> 'add_ons', '[]'::jsonb),
      -- Estimated cost falls back to the channel's default food-cost percent
      -- when the item is not mapped to one of our products.
      coalesce(
        (select p.estimated_cost * coalesce((v_item ->> 'quantity')::integer, 1)
           from public.products p where p.id = nullif(v_item ->> 'product_id', '')::uuid),
        coalesce((v_item ->> 'unit_price')::numeric, 0)
          * coalesce((v_item ->> 'quantity')::integer, 1)
          * coalesce((select default_food_cost_percent from public.cost_settings
                       where is_active and (source = v_source or source is null)
                       order by (source is not null) desc limit 1), 0) / 100.0),
      nullif(v_item ->> 'instructions', '');
  end loop;

  select coalesce(sum(line_subtotal), 0), coalesce(sum(estimated_cost), 0)
    into v_subtotal, v_cost
    from public.order_items where order_id = v_order_id;

  -- Trust the platform's own totals when it sends them; fall back to the sum
  -- of the lines when it does not.
  update public.orders
     set subtotal = case when subtotal = 0 then v_subtotal else subtotal end,
         grand_total = case when grand_total = 0 then v_subtotal else grand_total end,
         estimated_food_cost = v_cost
   where id = v_order_id;

  v_ticket := app.create_kot_ticket(v_order_id);

  if p_external_event_id is not null then
    update public.integration_events
       set status = 'processed', processed_at = now(), order_id = v_order_id
     where provider = p_provider and external_event_id = p_external_event_id;
  end if;

  perform public.record_integration_success(p_provider);

  return jsonb_build_object(
    'duplicate', false,
    'order_id', v_order_id,
    'ticket_id', v_ticket,
    'source', v_source,
    'external_order_id', p_external_order_id);
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Status coming back from the marketplace. Cancellation rules follow the
-- marketplace (PRD 9), so a platform cancellation cancels our ticket even
-- mid-preparation -- and says so in the history.
-- -----------------------------------------------------------------------------
create or replace function public.sync_marketplace_order_status(
  p_provider          public.integration_provider,
  p_external_order_id text,
  p_external_status   text,
  p_external_event_id text default null,
  p_payload           jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_source public.order_source := app.provider_to_source(p_provider);
  v_order  public.orders%rowtype;
  v_ticket public.kot_tickets%rowtype;
  v_account uuid;
  v_applied text := 'noted';
begin
  select id into v_account from public.integration_accounts where provider = p_provider;

  if p_external_event_id is not null then
    insert into public.integration_events
      (provider, account_id, direction, event_type, external_event_id,
       external_order_id, payload, signature_valid, status)
    values
      (p_provider, v_account, 'inbound', 'order.status', p_external_event_id,
       p_external_order_id, p_payload, true, 'received')
    on conflict (provider, external_event_id) where external_event_id is not null do nothing;

    if not found then
      return jsonb_build_object('duplicate', true, 'external_order_id', p_external_order_id);
    end if;
  end if;

  select * into v_order from public.orders
   where source = v_source and external_order_id = p_external_order_id;

  if not found then
    -- A status for an order we never ingested is a real discrepancy, not
    -- something to invent an order for.
    update public.integration_events
       set status = 'failed', error = 'no matching internal order', processed_at = now()
     where provider = p_provider and external_event_id = p_external_event_id;

    return jsonb_build_object('matched', false, 'external_order_id', p_external_order_id);
  end if;

  update public.orders set external_status = p_external_status where id = v_order.id;

  select * into v_ticket from public.kot_tickets where order_id = v_order.id;

  if lower(p_external_status) in ('cancelled','canceled','rejected')
     and v_ticket.id is not null
     and v_ticket.status not in ('COMPLETED','CANCELLED','REJECTED') then

    update public.kot_tickets
       set cancellation_origin = 'marketplace'
     where id = v_ticket.id;

    perform public.transition_kot_ticket(
      v_ticket.id, 'CANCELLED',
      format('Cancelled by %s', p_provider));

    v_applied := 'cancelled';
  end if;

  if p_external_event_id is not null then
    update public.integration_events
       set status = 'processed', processed_at = now(), order_id = v_order.id
     where provider = p_provider and external_event_id = p_external_event_id;
  end if;

  return jsonb_build_object(
    'matched', true,
    'order_id', v_order.id,
    'ticket_id', v_ticket.id,
    'external_status', p_external_status,
    'applied', v_applied);
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Two-way reconciliation (PRD 16). Compares a batch of external order ids for
-- a window against what we hold and records the differences; it never quietly
-- creates or deletes anything.
-- -----------------------------------------------------------------------------
create or replace function public.reconcile_marketplace_orders(
  p_provider     public.integration_provider,
  p_window_start timestamptz,
  p_window_end   timestamptz,
  p_external_ids text[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_source           public.order_source := app.provider_to_source(p_provider);
  v_missing_internal jsonb;
  v_missing_external jsonb;
  v_internal_count   integer;
  v_status           text;
  v_run_id           uuid;
begin
  select coalesce(jsonb_agg(x.id), '[]'::jsonb) into v_missing_internal
    from unnest(p_external_ids) as x(id)
   where not exists (
     select 1 from public.orders o
      where o.source = v_source and o.external_order_id = x.id);

  -- Held here but not reported by the platform for this window.
  select coalesce(jsonb_agg(o.external_order_id), '[]'::jsonb)
    into v_missing_external
    from public.orders o
   where o.source = v_source
     and o.placed_at >= p_window_start
     and o.placed_at <  p_window_end
     and not (o.external_order_id = any(p_external_ids));

  select count(*) into v_internal_count
    from public.orders o
   where o.source = v_source
     and o.placed_at >= p_window_start
     and o.placed_at <  p_window_end;

  v_status := case
    when jsonb_array_length(v_missing_internal) = 0
     and jsonb_array_length(v_missing_external) = 0 then 'clean'
    else 'discrepancies' end;

  insert into public.integration_reconciliation
    (provider, window_start, window_end, external_count, internal_count,
     missing_internal, missing_external, status)
  values
    (p_provider, p_window_start, p_window_end,
     coalesce(array_length(p_external_ids, 1), 0), v_internal_count,
     v_missing_internal, v_missing_external, v_status)
  returning id into v_run_id;

  return jsonb_build_object(
    'run_id', v_run_id,
    'status', v_status,
    'external_count', coalesce(array_length(p_external_ids, 1), 0),
    'internal_count', v_internal_count,
    'missing_internal', v_missing_internal,
    'missing_external', v_missing_external);
end;
$fn$;
