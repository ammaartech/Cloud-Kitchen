-- =============================================================================
-- 0016  Simplify the KOT lifecycle: manager clicks stop at PICKED_UP
-- =============================================================================
-- The manager used to click through six states after accepting an order:
-- READY_FOR_PICKUP -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED -> COMPLETED.
-- Two pairs are redundant to a human operator: PICKED_UP/OUT_FOR_DELIVERY
-- (food left the counter, once) and DELIVERED/COMPLETED (order is done, once).
--
-- New shape:
--   * The manager's happy path ends at PICKED_UP (renamed "Handed off" in the
--     UI). Four clicks: Accept, Start preparing, Ready, Handed off.
--   * OUT_FOR_DELIVERY and DELIVERED still exist -- but only the marketplace
--     webhook or the reconcile sweep may enter them, never a manual UI click.
--   * COMPLETED is unreachable. Historical rows are backfilled to DELIVERED so
--     the enum value can be removed by a later migration once every reader has
--     dropped the reference.
--
-- Enforcement is data-driven: a new `origin` column on public.kot_transitions
-- distinguishes manual/webhook/auto callers, and public.transition_kot_ticket
-- refuses the post-handoff transitions unless the caller declares itself.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Backfill historical COMPLETED tickets to DELIVERED
-- -----------------------------------------------------------------------------
-- delivered_at is preferred; if a ticket completed without a delivered_at, we
-- fall back to completed_at so no timestamp is lost.
update public.kot_tickets
   set delivered_at = coalesce(delivered_at, completed_at)
 where status = 'COMPLETED';

-- Skip the trigger for this bulk retitle: no rule exists for COMPLETED ->
-- DELIVERED and we do not want to invent one just for a one-shot backfill.
alter table public.kot_tickets disable trigger kot_tickets_enforce_transition;
update public.kot_tickets set status = 'DELIVERED' where status = 'COMPLETED';
alter table public.kot_tickets enable trigger kot_tickets_enforce_transition;

-- -----------------------------------------------------------------------------
-- 2. Rework the transitions table
-- -----------------------------------------------------------------------------
-- Drop the terminal COMPLETED transition; add an origin column so the trigger
-- and the RPC can tell manager clicks apart from webhook/auto callers.
delete from public.kot_transitions where to_status = 'COMPLETED';

alter table public.kot_transitions
  add column origin text not null default 'manual'
    check (origin in ('manual', 'webhook', 'auto'));

update public.kot_transitions
   set origin = 'webhook'
 where (from_status, to_status) in (
   ('PICKED_UP',        'OUT_FOR_DELIVERY'),
   ('PICKED_UP',        'DELIVERED'),
   ('OUT_FOR_DELIVERY', 'DELIVERED')
 );

-- The manager-visible label for PICKED_UP now reflects the uniform flow: food
-- left the counter, no assumption about who took it.
update public.kot_transitions
   set label = 'Handed off'
 where from_status = 'READY_FOR_PICKUP' and to_status = 'PICKED_UP';

-- -----------------------------------------------------------------------------
-- 3. Trigger: same shape, minus the dead COMPLETED branch
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

  case new.status
    when 'ACCEPTED'         then new.accepted_at := now();  new.accepted_by := v_actor;
    when 'PREPARING'        then new.preparing_at := now(); new.preparing_by := v_actor;
    when 'READY_FOR_PICKUP' then new.ready_at := now();     new.ready_by := v_actor;
    when 'PICKED_UP'        then new.picked_up_at := now();
    when 'OUT_FOR_DELIVERY' then new.out_for_delivery_at := now();
    when 'DELIVERED'        then new.delivered_at := now();
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

-- -----------------------------------------------------------------------------
-- 4. transition_kot_ticket: gate post-handoff transitions on caller origin
-- -----------------------------------------------------------------------------
-- The trigger already enforces the state machine and the permission. This
-- function adds one policy on top: OUT_FOR_DELIVERY and DELIVERED are not
-- manager-initiated in the new flow, so a caller must declare a non-manual
-- origin to reach them. That way the API route -- which passes 'manual' -- is
-- physically incapable of driving a ticket past PICKED_UP.
--
-- Signature changes (adding p_origin) create a new overload rather than
-- replacing the old one, so the previous four-argument function is dropped
-- explicitly. The grant is re-issued below.
drop function if exists public.transition_kot_ticket(uuid, public.kot_status, text, text);

create or replace function public.transition_kot_ticket(
  p_ticket_id uuid,
  p_to_status public.kot_status,
  p_reason    text default null,
  p_notes     text default null,
  p_origin    text default 'manual'
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
  if p_origin is null or p_origin not in ('manual', 'webhook', 'auto') then
    raise exception 'unknown transition origin %', p_origin
      using errcode = 'invalid_parameter_value';
  end if;

  if p_to_status in ('OUT_FOR_DELIVERY', 'DELIVERED') and p_origin = 'manual' then
    raise exception
      'transition to % is driven by the marketplace webhook, not a manual click', p_to_status
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_ticket from public.kot_tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'ticket % not found', p_ticket_id using errcode = 'no_data_found';
  end if;

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

  -- Order-side state changes. DELIVERED is now the terminal ticket state, so
  -- that is where the order rolls over to COMPLETED and the subscription
  -- delivery is marked fulfilled.
  if p_to_status = 'PREPARING' then
    update public.orders set status = 'IN_PROGRESS'
     where id = v_ticket.order_id and status = 'CONFIRMED';
  elsif p_to_status = 'DELIVERED' then
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
    'noop', false,
    'origin', p_origin);
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 5. sync_marketplace_order_status: map rider-status events to internal states
-- -----------------------------------------------------------------------------
-- Zomato's rider webhook emits rider-assigned -> pickedup -> delivered; Swiggy
-- exposes the same shape with different spellings. We normalise here, at the
-- point where both providers converge, so no adapter has to know the internal
-- state machine.
--
-- rider-assigned is informational and does not move the ticket. pickedup /
-- in_transit advances a ticket past the manager's PICKED_UP to
-- OUT_FOR_DELIVERY; delivered lands it at DELIVERED. Cancellation is unchanged
-- from prior behaviour.
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
  v_source   public.order_source := app.provider_to_source(p_provider);
  v_order    public.orders%rowtype;
  v_ticket   public.kot_tickets%rowtype;
  v_account  uuid;
  v_norm     text := lower(coalesce(p_external_status, ''));
  v_target   public.kot_status;
  v_applied  text := 'noted';
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
    update public.integration_events
       set status = 'failed', error = 'no matching internal order', processed_at = now()
     where provider = p_provider and external_event_id = p_external_event_id;

    return jsonb_build_object('matched', false, 'external_order_id', p_external_order_id);
  end if;

  update public.orders set external_status = p_external_status where id = v_order.id;

  select * into v_ticket from public.kot_tickets where order_id = v_order.id;

  if v_ticket.id is null then
    return jsonb_build_object(
      'matched', true, 'order_id', v_order.id, 'ticket_id', null,
      'external_status', p_external_status, 'applied', 'no_ticket');
  end if;

  -- Cancellation follows the marketplace's own decision, even mid-preparation.
  if v_norm in ('cancelled', 'canceled', 'rejected')
     and v_ticket.status not in ('DELIVERED','CANCELLED','REJECTED') then

    update public.kot_tickets
       set cancellation_origin = 'marketplace'
     where id = v_ticket.id;

    perform public.transition_kot_ticket(
      v_ticket.id, 'CANCELLED',
      format('Cancelled by %s', p_provider),
      null, 'webhook');

    v_applied := 'cancelled';

  -- Rider assigned is informational: no state change, only recorded.
  elsif v_norm in ('rider-assigned', 'rider_assigned', 'assigned', 'rider-allocated') then
    v_applied := 'noted';

  -- Rider picked the food up from the counter. This can only advance a ticket
  -- the manager has already marked PICKED_UP; if the manager has not, the
  -- webhook is out of order and we leave the ticket where it is.
  elsif v_norm in ('pickedup', 'picked_up', 'picked-up', 'in_transit', 'on_the_way', 'in-transit') then
    if v_ticket.status = 'PICKED_UP' then
      perform public.transition_kot_ticket(
        v_ticket.id, 'OUT_FOR_DELIVERY', null, null, 'webhook');
      v_applied := 'out_for_delivery';
    else
      v_applied := 'ignored_wrong_state';
    end if;

  -- Delivered can come in from either PICKED_UP or OUT_FOR_DELIVERY (some
  -- providers skip the interstitial event when a rider is fast).
  elsif v_norm = 'delivered' then
    if v_ticket.status in ('PICKED_UP', 'OUT_FOR_DELIVERY') then
      perform public.transition_kot_ticket(
        v_ticket.id, 'DELIVERED', null, null, 'webhook');
      v_applied := 'delivered';
    else
      v_applied := 'ignored_wrong_state';
    end if;
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
-- 6. sweep_stale_picked_up: auto-close direct-website tickets stuck at handoff
-- -----------------------------------------------------------------------------
-- Only SX orders reach this code path: they have no aggregator to send a
-- delivered event, so we treat "handed off + grace window" as delivered. The
-- window is a business_setting so operations can tune it without a migration.
create or replace function public.sweep_stale_picked_up(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_grace   integer := coalesce(app.setting_int('kot.picked_up_auto_deliver_minutes'), 30);
  v_swept   integer := 0;
  v_ticket  uuid;
begin
  for v_ticket in
    select t.id from public.kot_tickets t
     where t.status = 'PICKED_UP'
       and t.source = 'SX'
       and t.picked_up_at is not null
       and t.picked_up_at + make_interval(mins => v_grace) <= p_now
     order by t.picked_up_at
     limit 500
  loop
    perform public.transition_kot_ticket(v_ticket, 'DELIVERED', null, null, 'auto');
    v_swept := v_swept + 1;
  end loop;

  return jsonb_build_object('swept', v_swept, 'grace_minutes', v_grace);
end;
$fn$;

insert into public.business_settings
  (key, value, value_type, group_name, label, description, is_sensitive, is_provisional)
values
  ('kot.picked_up_auto_deliver_minutes', '30'::jsonb, 'integer', 'kot',
   'Auto-deliver window for website orders',
   'Website tickets held at Handed off for this many minutes are closed to Delivered by the reconcile sweep.',
   false, false)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 7. Analytics: use delivered_at as the terminal marker, drop pickup_wait
-- -----------------------------------------------------------------------------
-- Views are recreated in dependency order (dashboard depends on daily, daily
-- depends on orders).
drop view if exists public.v_owner_dashboard;
drop view if exists public.v_kot_metrics_daily;
drop view if exists public.v_analytics_orders;

create view public.v_analytics_orders as
select
  o.id as order_id,
  o.order_number,
  o.source,
  o.business_date,
  o.status,
  o.placed_at,
  o.completed_at,

  case when o.source = 'SX' then 0 else o.grand_total end as revenue,

  o.estimated_food_cost,

  round(
    case when o.source = 'SX' then 0 else o.grand_total end
      * coalesce(cs.commission_percent, 0) / 100.0
    + case when o.source = 'SX' then 0 else o.grand_total end
      * coalesce(cs.payment_fee_percent, 0) / 100.0
    + case when o.source = 'SX' then 0 else coalesce(cs.payment_fee_fixed, 0) end
    + coalesce(cs.packaging_cost_per_order, 0)
  , 2) as channel_fees,

  extract(epoch from (t.ready_at    - t.accepted_at))::integer as prep_seconds,
  extract(epoch from (o.completed_at - o.created_at))::integer as order_seconds,
  extract(epoch from (t.delivered_at - t.picked_up_at))::integer as delivery_seconds,

  t.ticket_code,
  t.status as kot_status
from public.orders o
left join public.kot_tickets t on t.order_id = o.id
left join lateral (
  select * from public.cost_settings c
   where c.is_active
     and (c.source = o.source or c.source is null)
     and c.effective_from <= o.placed_at
     and (c.effective_to is null or c.effective_to > o.placed_at)
   order by (c.source is not null) desc, c.effective_from desc
   limit 1
) cs on true
where app.has_permission('analytics.view');

create view public.v_kot_metrics_daily as
with ops as (
  select
    business_date,
    source,
    count(*)                                                       as order_count,
    -- DELIVERED is the terminal ticket state now; COMPLETED never lands here.
    count(*) filter (where kot_status = 'DELIVERED')               as completed_count,
    count(*) filter (where kot_status in ('REJECTED','CANCELLED')) as lost_count,
    sum(coalesce(estimated_food_cost, 0))                          as estimated_food_cost,
    sum(coalesce(channel_fees, 0))                                 as channel_fees,
    round(avg(prep_seconds)     filter (where prep_seconds is not null))     as avg_prep_seconds,
    round(avg(order_seconds)    filter (where order_seconds is not null))    as avg_order_seconds,
    round(avg(delivery_seconds) filter (where delivery_seconds is not null)) as avg_delivery_seconds
  from public.v_analytics_orders
  group by business_date, source
),
rev as (
  select business_date, source, sum(revenue) as revenue, sum(transaction_count) as transaction_count
  from public.v_revenue_by_source
  group by business_date, source
)
select
  coalesce(ops.business_date, rev.business_date) as business_date,
  coalesce(ops.source, rev.source)               as source,
  coalesce(ops.order_count, 0)                   as order_count,
  coalesce(ops.completed_count, 0)               as completed_count,
  coalesce(ops.lost_count, 0)                    as lost_count,
  coalesce(rev.transaction_count, 0)             as revenue_transaction_count,
  coalesce(rev.revenue, 0)                       as revenue,
  coalesce(ops.estimated_food_cost, 0)           as estimated_food_cost,
  coalesce(ops.channel_fees, 0)                  as channel_fees,
  coalesce(rev.revenue, 0)
    - coalesce(ops.channel_fees, 0)
    - coalesce(ops.estimated_food_cost, 0)       as estimated_profit,
  ops.avg_prep_seconds,
  ops.avg_order_seconds,
  ops.avg_delivery_seconds
from ops
full outer join rev
  on rev.business_date = ops.business_date and rev.source = ops.source;

create view public.v_owner_dashboard as
select
  source,
  sum(order_count)          as order_count,
  sum(revenue)              as revenue,
  sum(estimated_food_cost)  as estimated_food_cost,
  sum(channel_fees)         as channel_fees,
  sum(estimated_profit)     as estimated_profit,
  round(avg(avg_prep_seconds))     as avg_prep_seconds,
  round(avg(avg_order_seconds))    as avg_order_seconds,
  round(avg(avg_delivery_seconds)) as avg_delivery_seconds
from public.v_kot_metrics_daily
group by source;

-- -----------------------------------------------------------------------------
-- 8. Grants for the new / re-signed functions
-- -----------------------------------------------------------------------------
grant execute on function
  public.transition_kot_ticket(uuid, public.kot_status, text, text, text)
to authenticated, service_role;

grant execute on function
  public.sweep_stale_picked_up(timestamptz)
to service_role;
