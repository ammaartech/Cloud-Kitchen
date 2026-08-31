-- =============================================================================
-- 0015  Read surfaces: the KOT board, the kitchen display, and owner analytics
--       (PRD 9, 12, 17)
-- =============================================================================
-- Kitchen staff must not receive financial data. Rather than trusting each
-- caller to select the right columns, the money columns are masked in the view
-- itself: a reader without the permission gets nulls, whatever they ask for.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- v_kot_tickets: the one board every operational screen reads.
-- Manager and Owner see everything; Owner's write access is separately denied
-- by RLS, which is what makes their KOT read-only (PRD 9).
-- -----------------------------------------------------------------------------
create view public.v_kot_tickets as
select
  t.id,
  t.order_id,
  t.ticket_code,
  t.source,
  t.status,
  t.business_date,
  t.daily_number,
  t.priority,
  t.sla_due_at,
  -- Urgency escalates any ticket as its deadline approaches, regardless of
  -- the source's baseline priority (PRD 9).
  case
    when t.sla_due_at is null then 0
    when t.sla_due_at <= now() then 1000
    else greatest(0, 600 - extract(epoch from (t.sla_due_at - now()))::integer / 6)
  end as urgency_score,
  t.prep_eta_minutes,
  t.prep_eta_minutes_original,
  t.eta_overridden_at,
  t.accepted_at,
  t.preparing_at,
  t.ready_at,
  t.picked_up_at,
  t.out_for_delivery_at,
  t.delivered_at,
  t.completed_at,
  t.rejected_at,
  t.rejection_reason,
  t.cancelled_at,
  t.cancellation_reason,
  t.cancellation_origin,
  t.notes,
  t.created_at,

  o.order_number,
  o.external_order_id,
  o.scheduled_for,
  o.special_instructions,
  o.delivery_instructions,
  o.customer_name_snapshot as customer_name,
  -- Contact details are operational, but only for roles that need them.
  case when app.has_permission('orders.view_contact')
       then o.customer_phone_snapshot end as customer_phone,
  w.code  as delivery_window_code,
  w.label as delivery_window_label,
  w.starts_at as window_starts_at,
  w.ends_at   as window_ends_at,

  -- Financial columns, masked unless the reader is allowed them (PRD 17).
  case when app.has_permission('orders.view_financial') then o.grand_total end as order_total,
  case when app.has_permission('orders.view_financial') then o.subtotal    end as order_subtotal,

  s.subscription_number,
  (select count(*) from public.order_items oi where oi.order_id = o.id) as item_count
from public.kot_tickets t
join public.orders o on o.id = t.order_id
left join public.delivery_windows w on w.id = o.delivery_window_id
left join public.subscriptions s on s.id = o.subscription_id
where app.is_staff();

-- -----------------------------------------------------------------------------
-- v_kot_ticket_items: what the kitchen actually cooks. Prices are masked the
-- same way; the kitchen sees names, quantities, variants, add-ons and
-- instructions and nothing else (PRD 5.4, PRD 17).
-- -----------------------------------------------------------------------------
create view public.v_kot_ticket_items as
select
  i.id,
  t.id as ticket_id,
  i.order_id,
  i.product_id,
  i.name_snapshot as name,
  i.quantity,
  i.variants_snapshot as variants,
  i.add_ons_snapshot  as add_ons,
  i.special_instructions,
  case when app.has_permission('orders.view_financial') then i.unit_price   end as unit_price,
  case when app.has_permission('orders.view_financial') then i.line_subtotal end as line_subtotal
from public.order_items i
join public.kot_tickets t on t.order_id = i.order_id
where app.is_staff();

-- -----------------------------------------------------------------------------
-- v_customer_deliveries: the customer's own upcoming and past deliveries.
-- -----------------------------------------------------------------------------
create view public.v_customer_deliveries as
select
  d.id,
  d.subscription_id,
  d.customer_id,
  d.scheduled_date,
  d.status,
  d.credits_cost,
  d.skipped_at,
  d.skip_reason,
  w.code  as window_code,
  w.label as window_label,
  w.starts_at as window_starts_at,
  s.subscription_number,
  t.status      as kitchen_status,
  t.ticket_code,
  t.prep_eta_minutes,
  coalesce((
    select jsonb_agg(jsonb_build_object('name', p.name, 'quantity', i.quantity))
      from public.subscription_delivery_items i
      join public.products p on p.id = i.product_id
     where i.delivery_id = d.id), '[]'::jsonb) as items
from public.subscription_deliveries d
join public.subscriptions s on s.id = d.subscription_id
join public.delivery_windows w on w.id = d.delivery_window_id
left join public.kot_tickets t on t.order_id = d.order_id
where d.customer_id = app.current_customer_id()
   or app.has_permission('subscriptions.view_all');

-- =============================================================================
-- Analytics (PRD 12)
-- =============================================================================
-- Every metric derives from the timestamps and events the operational tables
-- already record, so the numbers reconcile with the audit history rather than
-- being accumulated separately.
-- =============================================================================

-- Per-order operational and financial facts.
create view public.v_analytics_orders as
select
  o.id as order_id,
  o.order_number,
  o.source,
  o.business_date,
  o.status,
  o.placed_at,
  o.completed_at,

  -- Website revenue is recognised on the subscription payment, not on each
  -- prepaid delivery, so subscription fulfilment orders contribute zero here
  -- and are not double counted.
  case when o.source = 'SX' then 0 else o.grand_total end as revenue,

  o.estimated_food_cost,

  -- Channel fees resolved from the configurable (initially dummy) assumptions.
  round(
    case when o.source = 'SX' then 0 else o.grand_total end
      * coalesce(cs.commission_percent, 0) / 100.0
    + case when o.source = 'SX' then 0 else o.grand_total end
      * coalesce(cs.payment_fee_percent, 0) / 100.0
    + case when o.source = 'SX' then 0 else coalesce(cs.payment_fee_fixed, 0) end
    + coalesce(cs.packaging_cost_per_order, 0)
  , 2) as channel_fees,

  -- Durations, in seconds, only where the timestamps really exist (PRD 10).
  extract(epoch from (t.ready_at    - t.accepted_at))::integer as prep_seconds,
  extract(epoch from (o.completed_at - o.created_at))::integer as order_seconds,
  extract(epoch from (t.picked_up_at - t.ready_at))::integer   as pickup_wait_seconds,
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

-- Revenue separated by source (PRD 12). Website revenue comes from verified
-- subscription payments; marketplace revenue from the platform order totals.
create view public.v_revenue_by_source as
select
  'SX'::public.order_source as source,
  'Website - Subscriptions'  as source_label,
  app.business_date(p.verified_at) as business_date,
  count(*)                   as transaction_count,
  sum(p.amount)              as revenue
from public.payments p
where p.status = 'success'
  and p.verified_at is not null
  and p.subscription_id is not null
  and app.has_permission('analytics.view')
group by 3

union all

select
  o.source,
  case o.source when 'SW' then 'Swiggy' when 'ZM' then 'Zomato' else 'Other' end,
  o.business_date,
  count(*),
  sum(o.grand_total)
from public.orders o
where o.source in ('SW','ZM')
  and o.status not in ('CANCELLED','REJECTED','DRAFT')
  and app.has_permission('analytics.view')
group by 1, 2, 3;

-- -----------------------------------------------------------------------------
-- Daily operational metrics by source.
--
-- Revenue and cost are deliberately taken from different places and joined
-- here. Subscription revenue is recognised when the payment is verified, while
-- the cost of a subscription meal lands on the fulfilment order days later. If
-- this view summed order totals alone, the website channel would show its
-- costs with none of its income and report a permanent loss.
-- -----------------------------------------------------------------------------
create view public.v_kot_metrics_daily as
with ops as (
  select
    business_date,
    source,
    count(*)                                                      as order_count,
    count(*) filter (where kot_status = 'COMPLETED')              as completed_count,
    count(*) filter (where kot_status in ('REJECTED','CANCELLED')) as lost_count,
    sum(coalesce(estimated_food_cost, 0))                         as estimated_food_cost,
    sum(coalesce(channel_fees, 0))                                as channel_fees,
    round(avg(prep_seconds)        filter (where prep_seconds is not null))        as avg_prep_seconds,
    round(avg(order_seconds)       filter (where order_seconds is not null))       as avg_order_seconds,
    round(avg(pickup_wait_seconds) filter (where pickup_wait_seconds is not null)) as avg_pickup_wait_seconds,
    round(avg(delivery_seconds)    filter (where delivery_seconds is not null))    as avg_delivery_seconds
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
  -- Estimated profit = selling price - fees - estimated product cost (PRD 12).
  coalesce(rev.revenue, 0)
    - coalesce(ops.channel_fees, 0)
    - coalesce(ops.estimated_food_cost, 0)       as estimated_profit,
  ops.avg_prep_seconds,
  ops.avg_order_seconds,
  ops.avg_pickup_wait_seconds,
  ops.avg_delivery_seconds
from ops
full outer join rev
  on rev.business_date = ops.business_date and rev.source = ops.source;

-- One-row-per-source rollup for the owner dashboard header.
create view public.v_owner_dashboard as
select
  source,
  sum(order_count)          as order_count,
  sum(revenue)              as revenue,
  sum(estimated_food_cost)  as estimated_food_cost,
  sum(channel_fees)         as channel_fees,
  sum(estimated_profit)     as estimated_profit,
  -- Averages of daily averages are weighted by day, not by order; good enough
  -- for a dashboard headline, and the per-day view is there for detail.
  round(avg(avg_prep_seconds))        as avg_prep_seconds,
  round(avg(avg_order_seconds))       as avg_order_seconds,
  round(avg(avg_pickup_wait_seconds)) as avg_pickup_wait_seconds,
  round(avg(avg_delivery_seconds))    as avg_delivery_seconds
from public.v_kot_metrics_daily
group by source;

-- Integration health, for the Owner/Developer view required by PRD 16, with
-- each capability's honest state attached.
create view public.v_integration_health as
select
  a.provider,
  a.display_name,
  a.is_enabled,
  a.health,
  a.last_healthy_at,
  a.last_error_at,
  a.consecutive_failures,
  a.circuit_open_until,
  (a.credentials_ref is not null) as has_credentials_configured,
  coalesce((
    select jsonb_agg(jsonb_build_object(
             'capability', c.capability,
             'state', c.state,
             'notes', c.notes,
             'reference_url', c.reference_url)
           order by c.capability)
      from public.integration_capabilities c
     where c.provider = a.provider), '[]'::jsonb) as capabilities,
  (select count(*) from public.integration_events e
    where e.provider = a.provider and e.status = 'failed'
      and e.received_at > now() - interval '24 hours') as failed_events_24h,
  (select r.status from public.integration_reconciliation r
    where r.provider = a.provider order by r.ran_at desc limit 1) as last_reconciliation_status
from public.integration_accounts a
where app.has_permission('integrations.view');

grant select on
  public.v_kot_tickets,
  public.v_kot_ticket_items,
  public.v_customer_deliveries,
  public.v_analytics_orders,
  public.v_revenue_by_source,
  public.v_kot_metrics_daily,
  public.v_owner_dashboard,
  public.v_integration_health
to authenticated, service_role;
