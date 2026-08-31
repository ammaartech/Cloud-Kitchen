-- =============================================================================
-- 0010  Notifications and marketplace integrations (PRD 15, PRD 16)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Templates are rows so message copy is not a deploy. The provider and the
-- exact notification matrix are chosen later (PRD 15); nothing here assumes
-- WhatsApp specifically.
-- -----------------------------------------------------------------------------
create table public.notification_templates (
  code           text primary key,
  channel        public.notification_channel not null,
  name           text not null,
  subject        text,
  body_template  text not null,
  -- Documented placeholders, for the admin UI and for validation.
  variables      text[] not null default '{}',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- notifications doubles as the outbox. Core flows enqueue a row inside their
-- own transaction and return; a failed send retries here and can never roll
-- back an order or a payment (PRD 15).
-- -----------------------------------------------------------------------------
create table public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid references public.customers(id) on delete set null,
  profile_id          uuid references public.auth_profiles(id) on delete set null,
  channel             public.notification_channel not null,
  template_code       text references public.notification_templates(code) on delete set null,

  -- Destination is snapshotted: changing a phone number later must not
  -- rewrite where a message was actually sent.
  to_address          text not null,
  payload             jsonb not null default '{}'::jsonb,
  rendered_body       text,

  status              public.notification_status not null default 'queued',
  attempts            integer not null default 0 check (attempts >= 0),
  max_attempts        integer not null default 5 check (max_attempts > 0),
  next_attempt_at     timestamptz not null default now(),
  last_error          text,

  provider            text,
  provider_message_id text,

  -- Dedupe key: enqueuing "subscription activated" twice for the same
  -- subscription is a no-op.
  dedupe_key          text,

  scheduled_for       timestamptz not null default now(),
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index notifications_dedupe_idx on public.notifications(dedupe_key)
  where dedupe_key is not null;
create index notifications_queue_idx on public.notifications(status, next_attempt_at)
  where status in ('queued','failed');
create index notifications_customer_idx on public.notifications(customer_id, created_at desc);

create table public.notification_events (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  event_type      text not null,          -- queued / sent / delivered / read / failed
  payload         jsonb not null default '{}'::jsonb,
  occurred_at     timestamptz not null default now()
);

create index notification_events_notification_idx
  on public.notification_events(notification_id, occurred_at);

-- =============================================================================
-- Marketplace integration (PRD 16)
-- =============================================================================
-- Swiggy and Zomato are external order channels. Credentials are NEVER stored
-- here -- only the name of the secret to look up in secure storage.
-- =============================================================================
create table public.integration_accounts (
  id                     uuid primary key default gen_random_uuid(),
  provider               public.integration_provider not null,
  display_name           text not null,
  external_restaurant_id text,
  -- e.g. 'SWIGGY_API_KEY'. Resolved from the environment at runtime; the value
  -- never touches the database and never reaches a staff-visible response.
  credentials_ref        text,
  webhook_secret_ref     text,
  config                 jsonb not null default '{}'::jsonb,

  is_enabled             boolean not null default false,
  health                 public.integration_health not null default 'disabled',
  last_healthy_at        timestamptz,
  last_error             text,
  last_error_at          timestamptz,
  -- One marketplace failing must not stop the others (PRD 16); each account
  -- carries its own breaker state.
  consecutive_failures   integer not null default 0,
  circuit_open_until     timestamptz,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (provider)
);

-- -----------------------------------------------------------------------------
-- Capability register. Phase 1 must state, per feature, whether it is really
-- integrated, mocked, or blocked by the external API (PRD 16, PRD 23). The UI
-- reads this instead of implying capabilities we have not verified.
-- -----------------------------------------------------------------------------
create table public.integration_capabilities (
  id           uuid primary key default gen_random_uuid(),
  provider     public.integration_provider not null,
  capability   text not null,     -- order_ingestion, accept_reject, cancellation, ...
  state        public.integration_capability_state not null,
  notes        text not null default '',
  -- Link to the official documentation that justifies the state. Empty means
  -- unverified, which is itself information.
  reference_url text,
  verified_at  timestamptz,
  updated_at   timestamptz not null default now(),
  unique (provider, capability)
);

create table public.integration_events (
  id                uuid primary key default gen_random_uuid(),
  provider          public.integration_provider not null,
  account_id        uuid references public.integration_accounts(id) on delete set null,
  direction         text not null check (direction in ('inbound','outbound')),
  event_type        text not null,
  -- Unique per provider: replayed marketplace webhooks are idempotent.
  external_event_id text,
  external_order_id text,
  order_id          uuid references public.orders(id) on delete set null,
  signature_valid   boolean not null default false,
  payload           jsonb not null default '{}'::jsonb,
  status            text not null default 'received'
                    check (status in ('received','processed','ignored','failed')),
  error             text,
  received_at       timestamptz not null default now(),
  processed_at      timestamptz
);

create unique index integration_events_external_idx
  on public.integration_events(provider, external_event_id)
  where external_event_id is not null;
create index integration_events_order_idx on public.integration_events(external_order_id);
create index integration_events_provider_idx on public.integration_events(provider, received_at desc);

-- -----------------------------------------------------------------------------
-- Two-way reconciliation (PRD 16): compare what the marketplace says it sent
-- against what we hold, and record the differences rather than silently
-- trusting either side.
-- -----------------------------------------------------------------------------
create table public.integration_reconciliation (
  id               uuid primary key default gen_random_uuid(),
  provider         public.integration_provider not null,
  window_start     timestamptz not null,
  window_end       timestamptz not null,
  external_count   integer not null default 0,
  internal_count   integer not null default 0,
  missing_internal jsonb not null default '[]'::jsonb,  -- present externally, absent here
  missing_external jsonb not null default '[]'::jsonb,  -- present here, absent externally
  mismatched       jsonb not null default '[]'::jsonb,  -- present both sides, differing
  status           text not null default 'clean'
                   check (status in ('clean','discrepancies','failed')),
  notes            text,
  ran_at           timestamptz not null default now(),
  constraint integration_reconciliation_window check (window_end > window_start)
);

create index integration_reconciliation_provider_idx
  on public.integration_reconciliation(provider, ran_at desc);

create trigger notification_templates_touch  before update on public.notification_templates  for each row execute function app.touch_updated_at();
create trigger notifications_touch           before update on public.notifications           for each row execute function app.touch_updated_at();
create trigger integration_accounts_touch    before update on public.integration_accounts    for each row execute function app.touch_updated_at();
create trigger integration_capabilities_touch before update on public.integration_capabilities for each row execute function app.touch_updated_at();

create trigger notification_templates_audit
  after insert or update or delete on public.notification_templates
  for each row execute function app.audit_trigger();

-- Even the *reference* to a credential is worth keeping out of the log.
create trigger integration_accounts_audit
  after insert or update or delete on public.integration_accounts
  for each row execute function app.audit_trigger('{credentials_ref,webhook_secret_ref,config}');

create trigger integration_capabilities_audit
  after insert or update or delete on public.integration_capabilities
  for each row execute function app.audit_trigger();
