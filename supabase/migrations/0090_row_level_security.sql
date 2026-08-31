-- =============================================================================
-- 0090  Row Level Security (PRD 17, PRD 20)
-- =============================================================================
-- Posture:
--   * Reads are governed by RLS on the base tables.
--   * Operational writes (orders, payments, subscriptions, KOT) have NO client
--     write policy at all. They happen only through the SECURITY DEFINER
--     functions in 0011-0014, which validate state, permission and idempotency
--     first. A compromised browser token cannot move a ticket or mint a
--     subscription by writing a column directly.
--   * Catalog and configuration writes are permission-gated policies, because
--     they are ordinary CRUD performed by the Owner.
-- =============================================================================

alter table public.auth_profiles              enable row level security;
alter table public.permissions                enable row level security;
alter table public.role_permissions           enable row level security;
alter table public.employees                  enable row level security;
alter table public.audit_logs                 enable row level security;
alter table public.business_settings          enable row level security;
alter table public.delivery_settings          enable row level security;
alter table public.tax_settings               enable row level security;
alter table public.cost_settings              enable row level security;
alter table public.delivery_windows           enable row level security;
alter table public.categories                 enable row level security;
alter table public.collections                enable row level security;
alter table public.products                   enable row level security;
alter table public.product_images             enable row level security;
alter table public.collection_products        enable row level security;
alter table public.variant_groups             enable row level security;
alter table public.variants                   enable row level security;
alter table public.product_variant_groups     enable row level security;
alter table public.add_ons                    enable row level security;
alter table public.product_add_ons            enable row level security;
alter table public.customers                  enable row level security;
alter table public.customer_addresses         enable row level security;
alter table public.subscription_plans         enable row level security;
alter table public.subscription_plan_windows  enable row level security;
alter table public.subscription_plan_meals    enable row level security;
alter table public.subscriptions              enable row level security;
alter table public.subscription_selected_meals enable row level security;
alter table public.subscription_credit_ledger enable row level security;
alter table public.subscription_deliveries    enable row level security;
alter table public.subscription_delivery_items enable row level security;
alter table public.subscription_pauses        enable row level security;
alter table public.orders                     enable row level security;
alter table public.order_items                enable row level security;
alter table public.order_status_events        enable row level security;
alter table public.kot_tickets                enable row level security;
alter table public.kot_status_events          enable row level security;
alter table public.kot_transitions            enable row level security;
alter table public.kot_daily_counters         enable row level security;
alter table public.payments                   enable row level security;
alter table public.payment_events             enable row level security;
alter table public.refunds                    enable row level security;
alter table public.refund_requests            enable row level security;
alter table public.invoices                   enable row level security;
alter table public.idempotency_keys           enable row level security;
alter table public.coupons                    enable row level security;
alter table public.coupon_rules               enable row level security;
alter table public.coupon_redemptions         enable row level security;
alter table public.reviews                    enable row level security;
alter table public.review_moderation          enable row level security;
alter table public.notification_templates     enable row level security;
alter table public.notifications              enable row level security;
alter table public.notification_events        enable row level security;
alter table public.integration_accounts       enable row level security;
alter table public.integration_capabilities   enable row level security;
alter table public.integration_events         enable row level security;
alter table public.integration_reconciliation enable row level security;

-- =============================================================================
-- Identity
-- =============================================================================
create policy auth_profiles_self_read on public.auth_profiles
  for select using (id = app.current_actor_id() or app.has_permission('employees.view'));

create policy auth_profiles_self_update on public.auth_profiles
  for update using (id = app.current_actor_id())
  with check (id = app.current_actor_id());

-- A user may edit their own name and contact details but never their own role
-- or active flag -- that is the privilege-escalation path. This is a trigger
-- rather than a policy predicate because a policy on auth_profiles that reads
-- auth_profiles would recurse.
create or replace function app.guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if app.is_direct_connection()
     or app.is_service_role()
     or app.has_permission('employees.manage') then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active then
    raise exception 'you may not change your own role or account status'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$fn$;

create trigger auth_profiles_guard_privileges
  before update on public.auth_profiles
  for each row execute function app.guard_profile_privilege_columns();

create policy permissions_read on public.permissions
  for select using (app.is_staff());

create policy role_permissions_read on public.role_permissions
  for select using (app.is_staff());

create policy role_permissions_manage on public.role_permissions
  for all using (app.has_permission('permissions.manage'))
  with check (app.has_permission('permissions.manage'));

create policy employees_read on public.employees
  for select using (app.has_permission('employees.view') or profile_id = app.current_actor_id());

create policy employees_manage on public.employees
  for all using (app.has_permission('employees.manage'))
  with check (app.has_permission('employees.manage'));

-- Audit logs are readable only by Developer Admin and Owner (PRD 17), and the
-- append-only rules in 0002 stop anyone from rewriting them.
create policy audit_logs_read on public.audit_logs
  for select using (app.has_permission('audit.view'));

-- =============================================================================
-- Configuration
-- =============================================================================
-- Fees, taxes and delivery windows are shown on the storefront, so they are
-- publicly readable. Sensitive keys in business_settings are not.
-- =============================================================================
create policy business_settings_read on public.business_settings
  for select using (not is_sensitive or app.has_permission('settings.manage'));

create policy business_settings_manage on public.business_settings
  for all using (app.has_permission('settings.manage'))
  with check (app.has_permission('settings.manage'));

create policy delivery_settings_read on public.delivery_settings for select using (true);
create policy delivery_settings_manage on public.delivery_settings
  for all using (app.has_permission('settings.manage'))
  with check (app.has_permission('settings.manage'));

create policy tax_settings_read on public.tax_settings for select using (true);
create policy tax_settings_manage on public.tax_settings
  for all using (app.has_permission('settings.manage'))
  with check (app.has_permission('settings.manage'));

-- Cost assumptions are commercially sensitive: staff who cannot see profit
-- cannot see the inputs to it either.
create policy cost_settings_read on public.cost_settings
  for select using (app.has_permission('analytics.view'));
create policy cost_settings_manage on public.cost_settings
  for all using (app.has_permission('settings.manage'))
  with check (app.has_permission('settings.manage'));

create policy delivery_windows_read on public.delivery_windows for select using (true);
create policy delivery_windows_manage on public.delivery_windows
  for all using (app.has_permission('settings.manage'))
  with check (app.has_permission('settings.manage'));

-- =============================================================================
-- Catalog: public reads, permission-gated writes
-- =============================================================================
create policy categories_read on public.categories
  for select using (is_active or app.has_permission('catalog.manage'));
create policy categories_manage on public.categories
  for all using (app.has_permission('catalog.manage'))
  with check (app.has_permission('catalog.manage'));

create policy collections_read on public.collections
  for select using (is_published or app.has_permission('catalog.manage'));
create policy collections_manage on public.collections
  for all using (app.has_permission('catalog.manage'))
  with check (app.has_permission('catalog.manage'));

-- Unavailable products are still readable: the storefront has to render them
-- grayscale with a badge (PRD 19). Unpublished and archived ones are not.
create policy products_read on public.products
  for select using ((is_published and archived_at is null) or app.has_permission('catalog.manage'));
create policy products_manage on public.products
  for all using (app.has_permission('catalog.manage'))
  with check (app.has_permission('catalog.manage'));

create policy product_images_read on public.product_images for select using (true);
create policy product_images_manage on public.product_images
  for all using (app.has_permission('catalog.manage'))
  with check (app.has_permission('catalog.manage'));

create policy collection_products_read on public.collection_products for select using (true);
create policy collection_products_manage on public.collection_products
  for all using (app.has_permission('catalog.manage'))
  with check (app.has_permission('catalog.manage'));

create policy variant_groups_read on public.variant_groups for select using (true);
create policy variant_groups_manage on public.variant_groups
  for all using (app.has_permission('catalog.manage'))
  with check (app.has_permission('catalog.manage'));

create policy variants_read on public.variants for select using (true);
create policy variants_manage on public.variants
  for all using (app.has_permission('catalog.manage'))
  with check (app.has_permission('catalog.manage'));

create policy product_variant_groups_read on public.product_variant_groups for select using (true);
create policy product_variant_groups_manage on public.product_variant_groups
  for all using (app.has_permission('catalog.manage'))
  with check (app.has_permission('catalog.manage'));

create policy add_ons_read on public.add_ons
  for select using (is_active or app.has_permission('catalog.manage'));
create policy add_ons_manage on public.add_ons
  for all using (app.has_permission('catalog.manage'))
  with check (app.has_permission('catalog.manage'));

create policy product_add_ons_read on public.product_add_ons for select using (true);
create policy product_add_ons_manage on public.product_add_ons
  for all using (app.has_permission('catalog.manage'))
  with check (app.has_permission('catalog.manage'));

-- =============================================================================
-- Plans
-- =============================================================================
create policy subscription_plans_read on public.subscription_plans
  for select using (
    (is_published and is_active and archived_at is null)
    or app.has_permission('plans.manage'));
create policy subscription_plans_manage on public.subscription_plans
  for all using (app.has_permission('plans.manage'))
  with check (app.has_permission('plans.manage'));

create policy subscription_plan_windows_read on public.subscription_plan_windows for select using (true);
create policy subscription_plan_windows_manage on public.subscription_plan_windows
  for all using (app.has_permission('plans.manage'))
  with check (app.has_permission('plans.manage'));

create policy subscription_plan_meals_read on public.subscription_plan_meals for select using (true);
create policy subscription_plan_meals_manage on public.subscription_plan_meals
  for all using (app.has_permission('plans.manage'))
  with check (app.has_permission('plans.manage'));

-- =============================================================================
-- Customers
-- =============================================================================
create policy customers_self_read on public.customers
  for select using (profile_id = app.current_actor_id() or app.has_permission('customers.view'));

create policy customers_self_update on public.customers
  for update using (profile_id = app.current_actor_id())
  with check (profile_id = app.current_actor_id());

create policy customers_manage on public.customers
  for all using (app.has_permission('customers.manage'))
  with check (app.has_permission('customers.manage'));

create policy customer_addresses_own on public.customer_addresses
  for all using (customer_id = app.current_customer_id())
  with check (customer_id = app.current_customer_id());

create policy customer_addresses_staff_read on public.customer_addresses
  for select using (app.has_permission('customers.view'));

-- =============================================================================
-- Subscriptions: readable by their owner and by staff who may see them.
-- Writes go exclusively through the RPCs.
-- =============================================================================
create policy subscriptions_read on public.subscriptions
  for select using (
    customer_id = app.current_customer_id() or app.has_permission('subscriptions.view_all'));

create policy subscription_selected_meals_read on public.subscription_selected_meals
  for select using (exists (
    select 1 from public.subscriptions s
     where s.id = subscription_id
       and (s.customer_id = app.current_customer_id()
            or app.has_permission('subscriptions.view_all'))));

create policy subscription_credit_ledger_read on public.subscription_credit_ledger
  for select using (exists (
    select 1 from public.subscriptions s
     where s.id = subscription_id
       and (s.customer_id = app.current_customer_id()
            or app.has_permission('subscriptions.view_all'))));

create policy subscription_deliveries_read on public.subscription_deliveries
  for select using (
    customer_id = app.current_customer_id()
    or app.has_permission('subscriptions.view_all')
    or app.has_permission('kot.view'));

create policy subscription_delivery_items_read on public.subscription_delivery_items
  for select using (exists (
    select 1 from public.subscription_deliveries d
     where d.id = delivery_id
       and (d.customer_id = app.current_customer_id()
            or app.has_permission('subscriptions.view_all')
            or app.has_permission('kot.view'))));

create policy subscription_pauses_read on public.subscription_pauses
  for select using (exists (
    select 1 from public.subscriptions s
     where s.id = subscription_id
       and (s.customer_id = app.current_customer_id()
            or app.has_permission('subscriptions.view_all'))));

-- =============================================================================
-- Orders and the KOT
-- =============================================================================
-- Kitchen Staff deliberately do NOT hold 'orders.view'. They work from
-- v_kot_tickets / v_kot_ticket_items, which mask money (PRD 5.4, PRD 17).
-- =============================================================================
create policy orders_read on public.orders
  for select using (
    customer_id = app.current_customer_id() or app.has_permission('orders.view'));

create policy order_items_read on public.order_items
  for select using (exists (
    select 1 from public.orders o
     where o.id = order_id
       and (o.customer_id = app.current_customer_id() or app.has_permission('orders.view'))));

create policy order_status_events_read on public.order_status_events
  for select using (exists (
    select 1 from public.orders o
     where o.id = order_id
       and (o.customer_id = app.current_customer_id() or app.has_permission('orders.view'))));

-- Realtime for the operational screens rides on this policy.
create policy kot_tickets_read on public.kot_tickets
  for select using (app.has_permission('kot.view'));

create policy kot_status_events_read on public.kot_status_events
  for select using (app.has_permission('kot.view'));

create policy kot_transitions_read on public.kot_transitions
  for select using (app.is_staff());

create policy kot_daily_counters_read on public.kot_daily_counters
  for select using (app.is_staff());

-- =============================================================================
-- Money
-- =============================================================================
create policy payments_read on public.payments
  for select using (
    customer_id = app.current_customer_id() or app.has_permission('payments.view'));

create policy payment_events_read on public.payment_events
  for select using (app.has_permission('payments.view'));

create policy refunds_read on public.refunds
  for select using (app.has_permission('payments.view'));

create policy refund_requests_own on public.refund_requests
  for select using (
    customer_id = app.current_customer_id() or app.has_permission('payments.view'));

create policy refund_requests_create on public.refund_requests
  for insert with check (customer_id = app.current_customer_id());

create policy refund_requests_manage on public.refund_requests
  for update using (app.has_permission('payments.manage'))
  with check (app.has_permission('payments.manage'));

create policy invoices_read on public.invoices
  for select using (
    customer_id = app.current_customer_id() or app.has_permission('payments.view'));

-- Idempotency records belong to the server; no client ever needs them.
create policy idempotency_keys_none on public.idempotency_keys
  for select using (app.is_service_role());

-- =============================================================================
-- Coupons: only the offers meant to be shown are visible without permission.
-- =============================================================================
create policy coupons_read on public.coupons
  for select using (
    (is_active and is_auto_visible
      and valid_from <= now()
      and (valid_until is null or valid_until > now()))
    or app.has_permission('coupons.manage'));

create policy coupons_manage on public.coupons
  for all using (app.has_permission('coupons.manage'))
  with check (app.has_permission('coupons.manage'));

create policy coupon_rules_read on public.coupon_rules
  for select using (app.has_permission('coupons.manage'));
create policy coupon_rules_manage on public.coupon_rules
  for all using (app.has_permission('coupons.manage'))
  with check (app.has_permission('coupons.manage'));

create policy coupon_redemptions_read on public.coupon_redemptions
  for select using (
    customer_id = app.current_customer_id() or app.has_permission('coupons.manage'));

-- =============================================================================
-- Reviews
-- =============================================================================
create policy reviews_public_read on public.reviews
  for select using (
    (status = 'published' and deleted_at is null)
    or customer_id = app.current_customer_id()
    or app.has_permission('reviews.moderate'));

create policy reviews_own_insert on public.reviews
  for insert with check (customer_id = app.current_customer_id());

-- A customer may edit or withdraw their own review, but cannot publish it --
-- status changes belong to moderation, enforced by the trigger below.
create policy reviews_own_update on public.reviews
  for update using (customer_id = app.current_customer_id() and deleted_at is null)
  with check (customer_id = app.current_customer_id());

create or replace function app.guard_review_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.status is distinct from old.status
     and not (app.is_direct_connection()
              or app.is_service_role()
              or app.has_permission('reviews.moderate')) then
    raise exception 'only a moderator may change a review''s status'
      using errcode = 'insufficient_privilege';
  end if;

  if new.body is distinct from old.body or new.title is distinct from old.title
     or new.rating is distinct from old.rating then
    new.edited_at := now();
    -- An edited review re-enters moderation rather than staying published.
    if not app.has_permission('reviews.moderate') then
      new.status := 'pending';
    end if;
  end if;

  return new;
end;
$fn$;

create trigger reviews_guard_status
  before update on public.reviews
  for each row execute function app.guard_review_status();

create policy reviews_moderate on public.reviews
  for update using (app.has_permission('reviews.moderate'))
  with check (app.has_permission('reviews.moderate'));

create policy review_moderation_read on public.review_moderation
  for select using (app.has_permission('reviews.moderate'));

-- =============================================================================
-- Notifications and integrations
-- =============================================================================
create policy notification_templates_read on public.notification_templates
  for select using (app.has_permission('notifications.view'));
create policy notification_templates_manage on public.notification_templates
  for all using (app.has_permission('notifications.manage'))
  with check (app.has_permission('notifications.manage'));

create policy notifications_read on public.notifications
  for select using (
    customer_id = app.current_customer_id() or app.has_permission('notifications.view'));

create policy notification_events_read on public.notification_events
  for select using (app.has_permission('notifications.view'));

-- Credential *references* are visible to integration managers only, and the
-- credentials themselves never live in the database at all (PRD 16, PRD 17).
create policy integration_accounts_read on public.integration_accounts
  for select using (app.has_permission('integrations.view'));
create policy integration_accounts_manage on public.integration_accounts
  for all using (app.has_permission('integrations.manage'))
  with check (app.has_permission('integrations.manage'));

create policy integration_capabilities_read on public.integration_capabilities
  for select using (app.is_staff());
create policy integration_capabilities_manage on public.integration_capabilities
  for all using (app.has_permission('integrations.manage'))
  with check (app.has_permission('integrations.manage'));

create policy integration_events_read on public.integration_events
  for select using (app.has_permission('integrations.view'));

create policy integration_reconciliation_read on public.integration_reconciliation
  for select using (app.has_permission('integrations.view'));
