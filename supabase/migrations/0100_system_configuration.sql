-- =============================================================================
-- 0100  System configuration
-- =============================================================================
-- This is structural data the application cannot run without: the permission
-- catalogue, the role grants, the legal KOT transitions, and the default
-- business rules. It is deliberately part of the migration set rather than the
-- seed file -- the seed contains demo *business* data, this contains the
-- system's own wiring.
--
-- Values the Owner has not yet confirmed are flagged is_provisional so the
-- admin UI can show them as pending validation rather than as policy (PRD 22).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permission catalogue
-- -----------------------------------------------------------------------------
insert into public.permissions (code, domain, description) values
  ('audit.view',              'audit',        'Read the audit log'),
  ('settings.manage',         'settings',     'Change business settings, fees, taxes and windows'),
  ('employees.view',          'employees',    'See staff accounts'),
  ('employees.manage',        'employees',    'Create and modify staff accounts'),
  ('permissions.manage',      'employees',    'Change what each role may do'),
  ('catalog.manage',          'catalog',      'Create, edit, hide and delete catalog entities'),
  ('plans.manage',            'plans',        'Create and publish subscription plans'),
  ('coupons.manage',          'coupons',      'Create and manage coupons and offers'),
  ('customers.view',          'customers',    'See customer records'),
  ('customers.manage',        'customers',    'Create and edit customer records'),
  ('subscriptions.view_all',  'subscriptions','See every subscription, not just your own'),
  ('subscriptions.manage',    'subscriptions','Pause, cancel or adjust subscriptions on behalf of customers'),
  ('orders.view',             'orders',       'Read order records'),
  ('orders.view_financial',   'orders',       'See order money: prices, totals and discounts'),
  ('orders.view_contact',     'orders',       'See customer contact details on an order'),
  ('payments.view',           'payments',     'See payments, refunds and invoices'),
  ('payments.manage',         'payments',     'Act on refunds and refund requests'),
  ('analytics.view',          'analytics',    'See revenue, cost and profit analytics'),
  ('kot.view',                'kot',          'See the KOT board'),
  ('kot.accept',              'kot',          'Accept an incoming ticket'),
  ('kot.reject',              'kot',          'Reject an incoming ticket'),
  ('kot.start_prep',          'kot',          'Start preparing a ticket'),
  ('kot.mark_ready',          'kot',          'Mark a ticket ready for pickup'),
  ('kot.handoff',             'kot',          'Record pickup, dispatch, delivery and completion'),
  ('kot.cancel',              'kot',          'Cancel a ticket'),
  ('kot.override_eta',        'kot',          'Override the preparation ETA'),
  ('reviews.moderate',        'reviews',      'Publish, hide or reject customer reviews'),
  ('notifications.view',      'notifications','See notification history and templates'),
  ('notifications.manage',    'notifications','Edit templates and retry notifications'),
  ('integrations.view',       'integrations', 'See marketplace integration health'),
  ('integrations.manage',     'integrations', 'Configure marketplace integrations');

-- -----------------------------------------------------------------------------
-- Role grants (PRD 5)
-- -----------------------------------------------------------------------------

-- Developer Admin: maximum Phase 1 access.
insert into public.role_permissions (role, permission_code)
select 'developer_admin', code from public.permissions;

-- Owner: business-wide oversight, full catalog/plan/customer/config control,
-- audit access -- and a KOT they can watch but not touch (PRD 5.2, PRD 9).
insert into public.role_permissions (role, permission_code)
select 'owner', code from public.permissions
 where code in (
   'audit.view', 'settings.manage',
   'employees.view', 'employees.manage',
   'catalog.manage', 'plans.manage', 'coupons.manage',
   'customers.view', 'customers.manage',
   'subscriptions.view_all', 'subscriptions.manage',
   'orders.view', 'orders.view_financial', 'orders.view_contact',
   'payments.view', 'payments.manage',
   'analytics.view',
   'kot.view',                      -- read-only: no transition permissions
   'reviews.moderate',
   'notifications.view', 'notifications.manage',
   'integrations.view'
 );

-- Branch Manager: the operational controller. Accept/reject, ETA override,
-- ready and handoff -- and explicitly no pricing, payment, profit, customer
-- administration, plan configuration or developer controls (PRD 5.3).
insert into public.role_permissions (role, permission_code)
select 'branch_manager', code from public.permissions
 where code in (
   'kot.view', 'kot.accept', 'kot.reject', 'kot.mark_ready',
   'kot.handoff', 'kot.cancel', 'kot.override_eta',
   'orders.view', 'orders.view_contact'
 );

-- Kitchen Staff: see the board, start cooking. Nothing financial, nothing
-- administrative (PRD 5.4). Marking ready stays with the Manager, who does it
-- after the kitchen's verbal confirmation (PRD 9).
insert into public.role_permissions (role, permission_code)
select 'kitchen_staff', code from public.permissions
 where code in ('kot.view', 'kot.start_prep');

-- Customers hold no permissions; their access is ownership-based in RLS.

-- -----------------------------------------------------------------------------
-- The legal KOT transitions (PRD 9)
-- -----------------------------------------------------------------------------
insert into public.kot_transitions
  (from_status, to_status, required_permission, requires_reason, requires_confirmation, label, sort_order) values
  ('NEW',              'ACCEPTED',         'kot.accept',     false, false, 'Accept',            10),
  ('NEW',              'REJECTED',         'kot.reject',     true,  true,  'Reject',            20),
  ('NEW',              'CANCELLED',        'kot.cancel',     true,  true,  'Cancel',            30),
  ('ACCEPTED',         'PREPARING',        'kot.start_prep', false, false, 'Start preparing',   10),
  ('ACCEPTED',         'CANCELLED',        'kot.cancel',     true,  true,  'Cancel',            30),
  ('PREPARING',        'READY_FOR_PICKUP', 'kot.mark_ready', false, false, 'Ready for pickup',  10),
  ('PREPARING',        'CANCELLED',        'kot.cancel',     true,  true,  'Cancel',            30),
  ('READY_FOR_PICKUP', 'PICKED_UP',        'kot.handoff',    false, false, 'Picked up',         10),
  ('READY_FOR_PICKUP', 'CANCELLED',        'kot.cancel',     true,  true,  'Cancel',            30),
  ('PICKED_UP',        'OUT_FOR_DELIVERY', 'kot.handoff',    false, false, 'Out for delivery',  10),
  ('PICKED_UP',        'DELIVERED',        'kot.handoff',    false, false, 'Delivered',         20),
  ('OUT_FOR_DELIVERY', 'DELIVERED',        'kot.handoff',    false, false, 'Delivered',         10),
  ('DELIVERED',        'COMPLETED',        'kot.handoff',    false, false, 'Complete',          10);

-- -----------------------------------------------------------------------------
-- Default business rules
-- -----------------------------------------------------------------------------
insert into public.business_settings
  (key, value, value_type, group_name, label, description, is_sensitive, is_provisional) values

  ('business.name', '"Cloud Kitchen"'::jsonb, 'string', 'business',
   'Business name', 'Shown on the storefront and on invoices.', false, true),

  ('business.timezone', '"Asia/Kolkata"'::jsonb, 'string', 'business',
   'Business timezone',
   'Defines the business day on which daily KOT numbers reset (PRD 10).', false, false),

  ('business.currency', '"INR"'::jsonb, 'string', 'business',
   'Currency', 'ISO currency code used for all amounts.', false, false),

  -- Subscription rules -------------------------------------------------------
  ('subscription.grace_period_days', '7'::jsonb, 'integer', 'subscription',
   'Payment grace period (days)',
   'How long a past-due subscription keeps delivering before it lapses. PRD default is 7.',
   false, false),

  ('subscription.max_pauses_per_period', '2'::jsonb, 'integer', 'subscription',
   'Maximum pauses per billing period',
   'Proposed rule pending owner approval (PRD 7, PRD 22).', false, true),

  ('subscription.max_pause_days', '5'::jsonb, 'integer', 'subscription',
   'Maximum days per pause',
   'Proposed rule pending owner approval; PRD suggests 3-5 days.', false, true),

  ('subscription.skip_returns_credit', 'true'::jsonb, 'boolean', 'subscription',
   'Skipping returns the entitlement',
   'PRD default: a skipped delivery returns its credit to the ledger.', false, false),

  ('subscription.charge_delivery_fee_at_checkout', 'false'::jsonb, 'boolean', 'subscription',
   'Charge delivery fee at subscription checkout',
   'Whether the delivery fee is billed once with the plan. Pending owner decision.',
   false, true),

  -- KOT rules ----------------------------------------------------------------
  ('kot.release_lead_time_minutes', '120'::jsonb, 'integer', 'kot',
   'KOT release lead time (minutes)',
   'How long before its delivery window a scheduled delivery enters the active KOT (PRD 7, PRD 22).',
   false, true),

  ('kot.default_prep_minutes', '25'::jsonb, 'integer', 'kot',
   'Default preparation estimate (minutes)',
   'Starting ETA on a new ticket; the Manager may override it per ticket.', false, true),

  ('kot.base_priority', '{"SW": 100, "ZM": 100, "SX": 50}'::jsonb, 'json', 'kot',
   'Baseline priority by source',
   'Marketplace orders outrank scheduled subscription deliveries because they are immediate (PRD 9).',
   false, false),

  ('kot.sla_minutes', '{"SW": 40, "ZM": 40, "SX": 60}'::jsonb, 'json', 'kot',
   'Service deadline by source (minutes)',
   'Drives urgency escalation on the board; any ticket can be escalated by its deadline.',
   false, true),

  -- Payments -----------------------------------------------------------------
  ('payments.default_provider', '"razorpay"'::jsonb, 'string', 'payments',
   'Default payment provider',
   'Either provider can serve any checkout; this is only the default offered.', false, true),

  ('payments.cod_enabled', 'false'::jsonb, 'boolean', 'payments',
   'Cash on delivery enabled',
   'COD exists in the data model but is paused pending policy (PRD 3, PRD 8).', false, false),

  -- Offers -------------------------------------------------------------------
  ('offers.first_subscription_code', '"FIRST5"'::jsonb, 'string', 'offers',
   'First-subscription offer code',
   'The coupon row is the source of truth for the discount; this is the code the storefront surfaces as already unlocked (PRD 6).',
   false, false),

  -- Integrations -------------------------------------------------------------
  ('integration.failure_threshold', '5'::jsonb, 'integer', 'integrations',
   'Consecutive failures before a marketplace circuit opens',
   'Isolates one failing marketplace from the others (PRD 16).', false, false),

  ('integration.circuit_cooldown_minutes', '10'::jsonb, 'integer', 'integrations',
   'Circuit breaker cooldown (minutes)', '', false, false);

-- -----------------------------------------------------------------------------
-- Phase 1 tax assumption: 5% split CGST 2.5% + SGST 2.5% (PRD 6).
-- Both rows are provisional: production GST treatment needs validation.
-- -----------------------------------------------------------------------------
insert into public.tax_settings (code, label, rate_percent, applies_to, is_provisional) values
  ('CGST', 'CGST 2.5%', 2.5, 'food', true),
  ('SGST', 'SGST 2.5%', 2.5, 'food', true);

-- Delivery fee: a single flat rule, free above a threshold. Final fee is an
-- open owner-validation item (PRD 22).
insert into public.delivery_settings (name, base_fee, free_above_subtotal, priority) values
  ('Standard delivery', 40.00, 499.00, 0);

-- Cost and fee assumptions behind estimated profit. Explicitly dummy data
-- (PRD 12), replaceable without a code change.
insert into public.cost_settings
  (source, label, commission_percent, payment_fee_percent, payment_fee_fixed,
   packaging_cost_per_order, default_food_cost_percent, is_dummy_data) values
  (null, 'Default assumptions',      0.0,  2.0, 0.00, 12.00, 35.0, true),
  ('SW',  'Swiggy commission (est.)', 22.0, 0.0, 0.00, 12.00, 35.0, true),
  ('ZM',  'Zomato commission (est.)', 21.0, 0.0, 0.00, 12.00, 35.0, true);

-- Delivery windows (PRD 7): configurable rows, not an enum.
insert into public.delivery_windows (code, label, starts_at, ends_at, cutoff_minutes_before, sort_order) values
  ('BREAKFAST', 'Breakfast', '07:30', '09:30', 720, 10),
  ('LUNCH',     'Lunch',     '12:00', '14:30', 240, 20),
  ('DINNER',    'Dinner',    '19:00', '21:30', 240, 30);

-- -----------------------------------------------------------------------------
-- Notification templates. Channel and copy are data; the provider is chosen
-- later (PRD 15).
-- -----------------------------------------------------------------------------
insert into public.notification_templates (code, channel, name, body_template, variables) values
  ('subscription_activated', 'whatsapp', 'Subscription activated',
   'Hi {{customer_name}}, your {{plan_name}} subscription ({{subscription_number}}) is active. First delivery: {{starts_on}}.',
   '{customer_name,plan_name,subscription_number,starts_on}'),
  ('payment_failed', 'sms', 'Payment failed',
   'Hi {{customer_name}}, we could not confirm your payment, so your subscription is NOT active. No amount has been captured. Reply HELP if you were charged.',
   '{customer_name}'),
  ('delivery_out', 'whatsapp', 'Delivery on the way',
   'Hi {{customer_name}}, your {{window_label}} meal is on the way.',
   '{customer_name,window_label}'),
  ('delivery_skipped', 'whatsapp', 'Delivery skipped',
   'Hi {{customer_name}}, your delivery on {{scheduled_date}} was skipped and {{credits_returned}} credit(s) returned.',
   '{customer_name,scheduled_date,credits_returned}');

-- -----------------------------------------------------------------------------
-- Marketplace capability register (PRD 16, PRD 23)
-- -----------------------------------------------------------------------------
-- Swiggy and Zomato do not publish open partner APIs; access is granted per
-- merchant under contract. Nothing here claims an endpoint we have not been
-- given documentation for. Every capability starts 'blocked' -- meaning
-- "pending verified partner API access" -- and the adapters run against the
-- mock transport until an integration is confirmed and this register is
-- updated to 'integrated'.
-- -----------------------------------------------------------------------------
insert into public.integration_accounts (provider, display_name, credentials_ref, webhook_secret_ref, is_enabled, health) values
  ('swiggy', 'Swiggy', 'SWIGGY_API_KEY', 'SWIGGY_WEBHOOK_SECRET', false, 'disabled'),
  ('zomato', 'Zomato', 'ZOMATO_API_KEY', 'ZOMATO_WEBHOOK_SECRET', false, 'disabled');

insert into public.integration_capabilities (provider, capability, state, notes) values
  ('swiggy', 'order_ingestion',     'blocked', 'Requires merchant partner API onboarding; mock transport in use.'),
  ('swiggy', 'accept_reject',       'blocked', 'Not implemented against a real endpoint.'),
  ('swiggy', 'cancellation',        'blocked', 'Cancellation rules follow the marketplace once connected.'),
  ('swiggy', 'status_sync',         'blocked', 'Awaiting partner API access.'),
  ('swiggy', 'menu_availability_sync','blocked','Awaiting partner API access.'),
  ('swiggy', 'reconciliation',      'mocked',  'Reconciliation logic is implemented and testable against the mock transport.'),
  ('zomato', 'order_ingestion',     'blocked', 'Requires merchant partner API onboarding; mock transport in use.'),
  ('zomato', 'accept_reject',       'blocked', 'Not implemented against a real endpoint.'),
  ('zomato', 'cancellation',        'blocked', 'Cancellation rules follow the marketplace once connected.'),
  ('zomato', 'status_sync',         'blocked', 'Awaiting partner API access.'),
  ('zomato', 'menu_availability_sync','blocked','Awaiting partner API access.'),
  ('zomato', 'reconciliation',      'mocked',  'Reconciliation logic is implemented and testable against the mock transport.');
