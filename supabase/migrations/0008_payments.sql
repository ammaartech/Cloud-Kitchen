-- =============================================================================
-- 0008  Payments, refunds, invoices and idempotency (PRD 8)
-- =============================================================================
--   PAYMENT VERIFIED   -> SUBSCRIPTION / ORDER CREATED -> KOT ELIGIBLE
--   PAYMENT FAILED     -> NO ACTIVE SUBSCRIPTION -> NO KOT -> NO DELIVERY
--
-- That invariant is enforced here by a trigger, not merely respected by the
-- application layer.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Generic API idempotency store. Any financial or order-creating endpoint
-- records its key here first; a retry replays the stored response instead of
-- doing the work twice (PRD 7, PRD 11).
-- -----------------------------------------------------------------------------
create table public.idempotency_keys (
  key            text not null,
  scope          text not null,          -- 'checkout', 'webhook:razorpay', ...
  request_hash   text not null,
  status         text not null default 'in_progress'
                 check (status in ('in_progress','completed','failed')),
  response       jsonb,
  actor_id       uuid references public.auth_profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz,
  expires_at     timestamptz not null default now() + interval '7 days',
  primary key (scope, key)
);

create index idempotency_keys_expiry_idx on public.idempotency_keys(expires_at);

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  -- A subscription purchase pays for a subscription, not for a single order,
  -- so exactly one of these is set.
  order_id            uuid references public.orders(id) on delete restrict,
  subscription_id     uuid references public.subscriptions(id) on delete restrict,
  customer_id         uuid not null references public.customers(id) on delete restrict,

  provider            public.payment_provider not null,
  flow                public.payment_flow not null default 'one_time',
  status              public.payment_status not null default 'pending',

  amount              numeric(12,2) not null check (amount > 0),
  currency            text not null default 'INR',

  -- Provider-side identifiers. Kept separate so a provider swap is a row
  -- shape change, not a schema migration (PRD 20).
  provider_order_id   text,
  provider_payment_id text,
  provider_signature  text,
  method              text,              -- upi / card / netbanking, as reported

  attempt_number      integer not null default 1 check (attempt_number > 0),
  idempotency_key     text not null,

  -- Set only by server-side verification or a verified webhook. The browser
  -- can never write this column (PRD 8).
  verified_at         timestamptz,
  verified_via        text check (verified_via in ('callback','webhook','reconciliation','manual')),

  failure_code        text,
  failure_message     text,

  -- Uncertain outcomes (debited but unconfirmed) are routed to support rather
  -- than guessed at.
  needs_reconciliation boolean not null default false,
  reconciliation_note  text,

  raw_payload         jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint payments_target check (
    (order_id is not null)::int + (subscription_id is not null)::int = 1
  ),
  constraint payments_success_is_verified check (
    status <> 'success' or verified_at is not null
  )
);

create unique index payments_idempotency_idx on public.payments(idempotency_key);
create unique index payments_provider_payment_idx
  on public.payments(provider, provider_payment_id) where provider_payment_id is not null;
create unique index payments_provider_order_idx
  on public.payments(provider, provider_order_id) where provider_order_id is not null;
create index payments_subscription_idx on public.payments(subscription_id);
create index payments_status_idx on public.payments(status);

-- -----------------------------------------------------------------------------
-- payment_events: the raw webhook/callback log. provider_event_id is unique,
-- which is what makes duplicate webhook delivery a no-op (PRD 8, PRD 11).
-- -----------------------------------------------------------------------------
create table public.payment_events (
  id                uuid primary key default gen_random_uuid(),
  payment_id        uuid references public.payments(id) on delete set null,
  provider          public.payment_provider not null,
  provider_event_id text not null,
  event_type        text not null,
  signature_valid   boolean not null default false,
  payload           jsonb not null,
  received_at       timestamptz not null default now(),
  processed_at      timestamptz,
  processing_error  text
);

create unique index payment_events_provider_event_idx
  on public.payment_events(provider, provider_event_id);
create index payment_events_payment_idx on public.payment_events(payment_id, received_at);

create table public.refunds (
  id                 uuid primary key default gen_random_uuid(),
  payment_id         uuid not null references public.payments(id) on delete restrict,
  amount             numeric(12,2) not null check (amount > 0),
  status             public.payment_status not null default 'pending',
  provider_refund_id text,
  reason             text not null default '',
  idempotency_key    text not null,
  requested_by       uuid references public.auth_profiles(id) on delete set null,
  processed_at       timestamptz,
  raw_payload        jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index refunds_idempotency_idx on public.refunds(idempotency_key);
create index refunds_payment_idx on public.refunds(payment_id);

-- -----------------------------------------------------------------------------
-- refund_requests: the ticket workflow the PRD asks for while the actual
-- refund policy is still pending owner approval (PRD 7, PRD 22). Creating a
-- request never moves money; it opens a case.
-- -----------------------------------------------------------------------------
create table public.refund_requests (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  order_id        uuid references public.orders(id) on delete set null,
  payment_id      uuid references public.payments(id) on delete set null,
  reason          text not null,
  requested_amount numeric(12,2) check (requested_amount is null or requested_amount > 0),
  status          text not null default 'open'
                  check (status in ('open','under_review','approved','rejected','completed','withdrawn')),
  resolution_note text,
  handled_by      uuid references public.auth_profiles(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index refund_requests_status_idx on public.refund_requests(status, created_at desc);
create index refund_requests_customer_idx on public.refund_requests(customer_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Invoices (PRD 6). Numbering is its own sequence, independent of orders.
-- -----------------------------------------------------------------------------
create sequence public.invoice_number_seq as bigint start with 1 increment by 1;

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_number  text not null unique,
  invoice_type    text not null default 'customer' check (invoice_type in ('customer','business')),
  customer_id     uuid not null references public.customers(id) on delete restrict,
  order_id        uuid references public.orders(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete restrict,
  payment_id      uuid references public.payments(id) on delete set null,

  issued_at       timestamptz not null default now(),
  currency        text not null default 'INR',
  subtotal        numeric(12,2) not null check (subtotal >= 0),
  discount_total  numeric(12,2) not null default 0 check (discount_total >= 0),
  delivery_fee    numeric(12,2) not null default 0 check (delivery_fee >= 0),
  tax_total       numeric(12,2) not null default 0 check (tax_total >= 0),
  tax_breakdown   jsonb not null default '[]'::jsonb,
  total           numeric(12,2) not null check (total >= 0),

  -- Snapshot of seller/buyer details as they stood when issued.
  billing_snapshot jsonb not null default '{}'::jsonb,
  document_url    text,
  created_at      timestamptz not null default now()
);

create index invoices_customer_idx on public.invoices(customer_id, issued_at desc);

-- =============================================================================
-- The core payment invariant, enforced in the database
-- =============================================================================
-- A subscription may only reach 'active' when a verified, successful payment
-- exists against it. Free plans (price 0) are exempt; COD is exempt only while
-- it is enabled, and it is paused by default.
-- =============================================================================
create or replace function app.subscription_requires_verified_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_paid boolean;
begin
  if new.status <> 'active' or old.status = 'active' then
    return new;
  end if;

  if new.price_paid = 0 then
    return new;   -- a genuinely free plan needs no payment
  end if;

  select exists (
    select 1 from public.payments p
     where p.subscription_id = new.id
       and p.status = 'success'
       and p.verified_at is not null
  ) into v_paid;

  if not v_paid then
    raise exception
      'subscription % cannot be activated without a verified successful payment',
      new.subscription_number
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger subscriptions_require_verified_payment
  before update of status on public.subscriptions
  for each row execute function app.subscription_requires_verified_payment();

-- A KOT ticket may only exist for an order that is confirmed. An unpaid or
-- unverified order therefore cannot reach the kitchen at all.
create or replace function app.kot_requires_confirmed_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_status public.order_status;
begin
  select o.status into v_status from public.orders o where o.id = new.order_id;

  if v_status is null then
    raise exception 'KOT ticket references a missing order' using errcode = 'foreign_key_violation';
  end if;

  if v_status not in ('CONFIRMED','IN_PROGRESS') then
    raise exception 'order % is % and is not KOT eligible', new.order_id, v_status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger kot_tickets_require_confirmed_order
  before insert on public.kot_tickets
  for each row execute function app.kot_requires_confirmed_order();

create trigger payments_touch        before update on public.payments        for each row execute function app.touch_updated_at();
create trigger refunds_touch         before update on public.refunds         for each row execute function app.touch_updated_at();
create trigger refund_requests_touch before update on public.refund_requests for each row execute function app.touch_updated_at();

-- Provider signatures and raw payloads are secrets-adjacent; keep them out of
-- the audit trail (PRD 17).
create trigger payments_audit
  after insert or update or delete on public.payments
  for each row execute function app.audit_trigger('{provider_signature,raw_payload}');

create trigger refunds_audit
  after insert or update or delete on public.refunds
  for each row execute function app.audit_trigger('{raw_payload}');

create trigger refund_requests_audit
  after insert or update or delete on public.refund_requests
  for each row execute function app.audit_trigger();

create trigger invoices_audit
  after insert or update or delete on public.invoices
  for each row execute function app.audit_trigger();
