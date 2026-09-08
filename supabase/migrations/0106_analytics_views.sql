-- =============================================================================
-- 0106  Deeper analytics views for the owner Analytics page
-- =============================================================================
-- The Overview dashboard answers "how are the channels doing". The Analytics
-- page needs to answer "what did we sell, when, to whom, and how were we
-- paid" -- questions the existing views don't cover because they only expose
-- order-level facts, no items, no payment method, no per-customer history.
--
-- This migration adds:
--   * customer_id + customer_name_snapshot appended to v_analytics_orders
--     (append-only, so dependent views keep working under CREATE OR REPLACE)
--   * v_analytics_order_items       -- per-line-item facts joined to category
--   * v_analytics_payments          -- verified payments with method + date
--   * v_analytics_customer_first_order -- for New vs Returning classification
--
-- All new views gate on `app.has_permission('analytics.view')` in the same
-- style as v_analytics_orders itself.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- v_analytics_orders: append customer identity so the retention donut and
-- recent-transactions table don't need a second round trip to `orders`.
--
-- Column *append* is deliberate: CREATE OR REPLACE VIEW forbids re-ordering
-- or renaming existing columns, so the two new fields sit at the end. This
-- keeps v_kot_metrics_daily (which sums by name) unaffected.
-- -----------------------------------------------------------------------------
create or replace view public.v_analytics_orders as
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
  t.status as kot_status,

  -- Appended columns for the Analytics page.
  o.customer_id,
  o.customer_name_snapshot
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

-- -----------------------------------------------------------------------------
-- v_analytics_order_items: per-line-item facts, joined to product + category.
--
-- Subscription (SX) orders keep their line items -- the item names and
-- retail-equivalent prices are what "food value shipped" is derived from --
-- even though their revenue is 0 at the order level (recognised at payment).
-- Callers that want channel-level revenue should still use v_analytics_orders.
--
-- Draft / rejected / cancelled orders are excluded so top-item and category
-- rankings reflect food that actually left the kitchen.
-- -----------------------------------------------------------------------------
create view public.v_analytics_order_items as
select
  i.id                       as order_item_id,
  o.id                       as order_id,
  o.order_number,
  o.source,
  o.business_date,
  o.placed_at,
  i.product_id,
  i.name_snapshot            as product_name,
  p.category_id,
  c.slug                     as category_slug,
  c.name                     as category_name,
  i.quantity,
  -- Financial columns masked for readers without financial visibility, to
  -- match the same pattern used by v_kot_ticket_items in 0015.
  case when app.has_permission('orders.view_financial') then i.unit_price     end as unit_price,
  case when app.has_permission('orders.view_financial') then i.line_subtotal  end as line_subtotal,
  case when app.has_permission('orders.view_financial') then i.estimated_cost end as estimated_cost
from public.order_items i
join public.orders o     on o.id = i.order_id
left join public.products p    on p.id = i.product_id
left join public.categories c  on c.id = p.category_id
where o.status not in ('DRAFT','REJECTED','CANCELLED')
  and app.has_permission('analytics.view');

-- -----------------------------------------------------------------------------
-- v_analytics_payments: successful, verified payments with their method and
-- business date. Powers the payment-methods donut and the daily-revenue split
-- between subscription and marketplace in the workbook export.
-- -----------------------------------------------------------------------------
create view public.v_analytics_payments as
select
  p.id                             as payment_id,
  p.order_id,
  p.subscription_id,
  p.customer_id,
  p.provider,
  p.method,
  p.flow,
  p.amount,
  p.verified_at,
  app.business_date(p.verified_at) as business_date
from public.payments p
where p.status = 'success'
  and p.verified_at is not null
  and app.has_permission('analytics.view');

-- -----------------------------------------------------------------------------
-- v_analytics_customer_first_order: one row per customer with the date and
-- timestamp of their very first (non-void) order. Joined against the visible
-- customer set in the range to classify New vs Returning.
--
-- Marketplace orders with no customer_id are excluded here on purpose; the
-- Analytics page counts them separately as "marketplace guests" so they never
-- get mislabelled as either bucket.
-- -----------------------------------------------------------------------------
create view public.v_analytics_customer_first_order as
select
  o.customer_id,
  min(o.business_date) as first_order_business_date,
  min(o.placed_at)     as first_order_at
from public.orders o
where o.customer_id is not null
  and o.status not in ('DRAFT','REJECTED','CANCELLED')
  and app.has_permission('analytics.view')
group by o.customer_id;

grant select on
  public.v_analytics_order_items,
  public.v_analytics_payments,
  public.v_analytics_customer_first_order
to authenticated, service_role;
