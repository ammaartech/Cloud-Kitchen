-- =============================================================================
-- 0001  Extensions, schemas and enumerated types
-- =============================================================================
-- Every internal identifier in this system is a UUID (PRD 17). Human-facing
-- numbers (order number, daily KOT number) are generated separately in 0011.
-- =============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()

-- Email is stored as plain text with a lower() unique index rather than
-- citext, so the schema depends on no optional contrib module.

-- Internal helper schema: nothing in here is exposed through PostgREST.
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Roles (PRD 5). Role *quantities* are never hardcoded; this enumerates the
-- kinds of role that exist, not how many people hold them.
-- -----------------------------------------------------------------------------
create type public.app_role as enum (
  'developer_admin',
  'owner',
  'branch_manager',
  'kitchen_staff',
  'customer'
);

-- -----------------------------------------------------------------------------
-- Order sources (PRD 4). Prefixes: SW = Swiggy, ZM = Zomato, SX = subscription.
-- -----------------------------------------------------------------------------
create type public.order_source as enum ('SX', 'SW', 'ZM');

-- -----------------------------------------------------------------------------
-- KOT lifecycle (PRD 9).
--   NEW -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP
--       -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED -> COMPLETED
-- REJECTED and CANCELLED are terminal side-exits, not part of the happy path.
-- -----------------------------------------------------------------------------
create type public.kot_status as enum (
  'NEW',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED'
);

-- -----------------------------------------------------------------------------
-- Order state is kept deliberately separate from payment state and from KOT
-- state (PRD 8, PRD 20). An order can be CONFIRMED while its ticket is still
-- NEW, and a payment can be REFUNDED long after the order is COMPLETED.
-- -----------------------------------------------------------------------------
create type public.order_status as enum (
  'DRAFT',            -- built, not yet paid for / not yet ingested
  'AWAITING_PAYMENT', -- website order waiting on verified payment
  'CONFIRMED',        -- payment verified (or marketplace-accepted) -> KOT eligible
  'IN_PROGRESS',      -- ticket is moving through the kitchen
  'COMPLETED',
  'CANCELLED',
  'REJECTED'
);

create type public.payment_status as enum (
  'pending',
  'processing',
  'success',
  'failed',
  'refunded',
  'partially_refunded'
);

-- COD exists in the model but is paused (PRD 3, PRD 8). Enabling it is a
-- settings change, not a code change.
create type public.payment_provider as enum ('razorpay', 'cashfree', 'cod');

create type public.payment_flow as enum ('one_time', 'recurring');

create type public.subscription_status as enum (
  'pending_payment',  -- created but NOT active; creates no KOT
  'active',
  'paused',
  'past_due',         -- inside the configurable grace period
  'cancelled',
  'expired'
);

-- PRD 7: fixed meals, meal credits, scheduled meals, customer-selected meals.
create type public.plan_type as enum (
  'fixed_meals',
  'meal_credits',
  'scheduled_meals',
  'customer_selected'
);

create type public.subscription_delivery_status as enum (
  'scheduled',   -- generated from plan rules, not yet due
  'released',    -- inside the KOT release lead time; ticket created
  'skipped',     -- customer skipped; entitlement returned per settings
  'cancelled',
  'fulfilled'
);

-- The credit ledger is append-only (PRD 7: "a credit ledger, not only a
-- mutable balance"). Balance is always derived from these entries.
create type public.credit_entry_type as enum (
  'grant',      -- plan purchase / renewal granted credits
  'consume',    -- a delivery consumed credits
  'reverse',    -- a skip/cancellation returned credits
  'expire',
  'adjust'      -- manual owner correction, always audited
);

create type public.review_status as enum ('pending', 'published', 'hidden', 'rejected');

create type public.coupon_discount_type as enum ('percent', 'fixed_amount');

create type public.notification_channel as enum ('whatsapp', 'sms', 'email');

create type public.notification_status as enum ('queued', 'sending', 'sent', 'failed', 'dead_letter');

create type public.integration_provider as enum ('swiggy', 'zomato');

-- Integration capability state (PRD 16 / PRD 23): every marketplace feature is
-- explicitly labelled so the UI never implies more than the API really offers.
create type public.integration_capability_state as enum ('integrated', 'mocked', 'blocked');

create type public.integration_health as enum ('connected', 'degraded', 'down', 'disabled');

create type public.audit_action as enum (
  'insert', 'update', 'delete', 'login', 'logout',
  'state_transition', 'permission_change', 'config_change'
);
