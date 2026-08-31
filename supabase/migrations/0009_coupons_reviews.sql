-- =============================================================================
-- 0009  Coupons and reviews (PRD 14)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- coupons. The 5% first-subscription offer is one row here, not a constant --
-- its percentage, eligibility and lifetime are all editable (PRD 6, PRD 14).
-- -----------------------------------------------------------------------------
create table public.coupons (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null,
  name                text not null,
  description         text not null default '',

  discount_type       public.coupon_discount_type not null,
  discount_value      numeric(12,2) not null check (discount_value > 0),
  -- Caps a percentage discount. Null = uncapped.
  max_discount_amount numeric(12,2) check (max_discount_amount is null or max_discount_amount > 0),
  min_order_amount    numeric(12,2) not null default 0 check (min_order_amount >= 0),

  applies_to          text not null default 'subscription'
                      check (applies_to in ('subscription','order','all')),

  -- Usage limits. Null = unlimited.
  per_customer_limit  integer check (per_customer_limit is null or per_customer_limit > 0),
  total_usage_limit   integer check (total_usage_limit is null or total_usage_limit > 0),
  times_redeemed      integer not null default 0 check (times_redeemed >= 0),

  -- Shown to the customer as already unlocked rather than hidden behind a
  -- code box (PRD 6). It still has to pass server validation to be applied.
  is_auto_visible     boolean not null default false,

  valid_from          timestamptz not null default now(),
  valid_until         timestamptz,
  is_active           boolean not null default true,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint coupons_window check (valid_until is null or valid_until > valid_from),
  constraint coupons_percent_range
    check (discount_type <> 'percent' or discount_value <= 100)
);

create unique index coupons_code_idx on public.coupons(upper(code));

-- -----------------------------------------------------------------------------
-- coupon_rules: additional eligibility predicates, kept as rows so a new
-- campaign shape does not need a schema change.
-- -----------------------------------------------------------------------------
create table public.coupon_rules (
  id         uuid primary key default gen_random_uuid(),
  coupon_id  uuid not null references public.coupons(id) on delete cascade,
  rule_type  text not null check (rule_type in
               ('first_subscription','plan_in','source_in','customer_in','new_customer_only')),
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index coupon_rules_coupon_idx on public.coupon_rules(coupon_id);

create table public.coupon_redemptions (
  id              uuid primary key default gen_random_uuid(),
  coupon_id       uuid not null references public.coupons(id) on delete restrict,
  customer_id     uuid not null references public.customers(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  order_id        uuid references public.orders(id) on delete set null,
  discount_amount numeric(12,2) not null check (discount_amount >= 0),
  redeemed_at     timestamptz not null default now()
);

create index coupon_redemptions_customer_idx on public.coupon_redemptions(coupon_id, customer_id);
-- A single subscription can consume a coupon exactly once, even under retry.
create unique index coupon_redemptions_subscription_idx
  on public.coupon_redemptions(coupon_id, subscription_id) where subscription_id is not null;

alter table public.orders
  add constraint orders_coupon_fk
  foreign key (coupon_id) references public.coupons(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Server-side coupon validation (PRD 6, PRD 14). The browser may *show* an
-- offer as unlocked; only this decides whether it applies.
-- Returns one row: is_valid, reason, discount_amount.
-- -----------------------------------------------------------------------------
create or replace function public.validate_coupon(
  p_code        text,
  p_customer_id uuid,
  p_subtotal    numeric,
  p_plan_id     uuid default null,
  p_source      public.order_source default 'SX',
  p_at          timestamptz default now()
)
returns table (is_valid boolean, reason text, discount_amount numeric, coupon_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  c            public.coupons%rowtype;
  v_rule       public.coupon_rules%rowtype;
  v_used       integer;
  v_discount   numeric(12,2);
  v_has_prior  boolean;
begin
  select * into c from public.coupons
   where upper(code) = upper(p_code) and is_active;

  if not found then
    return query select false, 'Coupon not found', 0::numeric, null::uuid; return;
  end if;

  if c.valid_from > p_at then
    return query select false, 'Coupon is not active yet', 0::numeric, c.id; return;
  end if;

  if c.valid_until is not null and c.valid_until <= p_at then
    return query select false, 'Coupon has expired', 0::numeric, c.id; return;
  end if;

  if c.applies_to = 'subscription' and p_plan_id is null then
    return query select false, 'Coupon applies to subscriptions only', 0::numeric, c.id; return;
  end if;

  if p_subtotal < c.min_order_amount then
    return query select false,
      format('Requires a minimum of %s', c.min_order_amount), 0::numeric, c.id; return;
  end if;

  if c.total_usage_limit is not null and c.times_redeemed >= c.total_usage_limit then
    return query select false, 'Coupon usage limit reached', 0::numeric, c.id; return;
  end if;

  if c.per_customer_limit is not null then
    select count(*) into v_used
      from public.coupon_redemptions r
     where r.coupon_id = c.id and r.customer_id = p_customer_id;

    if v_used >= c.per_customer_limit then
      return query select false, 'You have already used this offer', 0::numeric, c.id; return;
    end if;
  end if;

  -- Extra eligibility predicates. The column is qualified because this
  -- function also returns an output column called coupon_id.
  for v_rule in select cr.* from public.coupon_rules cr where cr.coupon_id = c.id loop
    if v_rule.rule_type = 'first_subscription' then
      -- "First subscription" means no subscription has ever been activated for
      -- this customer -- checked on the server, never inferred from the client.
      select exists (
        select 1 from public.subscriptions s
         where s.customer_id = p_customer_id
           and s.activated_at is not null
      ) into v_has_prior;

      if v_has_prior then
        return query select false, 'Offer is for your first subscription only',
                            0::numeric, c.id; return;
      end if;

    elsif v_rule.rule_type = 'plan_in' then
      if p_plan_id is null
         or not (v_rule.config -> 'plan_ids' ? p_plan_id::text) then
        return query select false, 'Offer does not apply to this plan', 0::numeric, c.id; return;
      end if;

    elsif v_rule.rule_type = 'source_in' then
      if not (v_rule.config -> 'sources' ? p_source::text) then
        return query select false, 'Offer does not apply to this channel', 0::numeric, c.id; return;
      end if;

    elsif v_rule.rule_type = 'customer_in' then
      if not (v_rule.config -> 'customer_ids' ? p_customer_id::text) then
        return query select false, 'Offer is not available on this account', 0::numeric, c.id; return;
      end if;

    elsif v_rule.rule_type = 'new_customer_only' then
      select exists (
        select 1 from public.orders o
         where o.customer_id = p_customer_id and o.status <> 'DRAFT'
      ) into v_has_prior;

      if v_has_prior then
        return query select false, 'Offer is for new customers only', 0::numeric, c.id; return;
      end if;
    end if;
  end loop;

  if c.discount_type = 'percent' then
    v_discount := round(p_subtotal * c.discount_value / 100.0, 2);
    if c.max_discount_amount is not null then
      v_discount := least(v_discount, c.max_discount_amount);
    end if;
  else
    v_discount := least(c.discount_value, p_subtotal);
  end if;

  return query select true, 'ok'::text, v_discount, c.id;
end;
$fn$;

-- =============================================================================
-- Reviews with moderation (PRD 14)
-- =============================================================================
create table public.reviews (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references public.customers(id) on delete cascade,
  product_id          uuid references public.products(id) on delete cascade,
  subscription_id     uuid references public.subscriptions(id) on delete set null,
  order_id            uuid references public.orders(id) on delete set null,

  rating              smallint not null check (rating between 1 and 5),
  title               text not null default '',
  body                text not null default '',

  -- Reviews start pending and are published by moderation policy, so nothing
  -- unmoderated ever renders publicly.
  status              public.review_status not null default 'pending',
  is_verified_purchase boolean not null default false,

  edited_at           timestamptz,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index reviews_product_idx on public.reviews(product_id, status, created_at desc);
create index reviews_customer_idx on public.reviews(customer_id, created_at desc);
create index reviews_moderation_queue_idx on public.reviews(status, created_at)
  where status = 'pending';

create table public.review_moderation (
  id            uuid primary key default gen_random_uuid(),
  review_id     uuid not null references public.reviews(id) on delete cascade,
  from_status   public.review_status,
  to_status     public.review_status not null,
  moderator_id  uuid references public.auth_profiles(id) on delete set null,
  reason        text,
  created_at    timestamptz not null default now()
);

create index review_moderation_review_idx on public.review_moderation(review_id, created_at);

-- Every status change is recorded, so hiding a review is itself auditable.
create or replace function app.review_record_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.status is distinct from old.status then
    insert into public.review_moderation (review_id, from_status, to_status, moderator_id)
    values (new.id, old.status, new.status, app.current_actor_id());
  end if;
  return new;
end;
$fn$;

create trigger reviews_record_moderation
  after update of status on public.reviews
  for each row execute function app.review_record_moderation();

create trigger coupons_touch  before update on public.coupons  for each row execute function app.touch_updated_at();
create trigger reviews_touch  before update on public.reviews  for each row execute function app.touch_updated_at();

create trigger coupons_audit            after insert or update or delete on public.coupons            for each row execute function app.audit_trigger();
create trigger coupon_rules_audit       after insert or update or delete on public.coupon_rules       for each row execute function app.audit_trigger();
create trigger coupon_redemptions_audit after insert or update or delete on public.coupon_redemptions for each row execute function app.audit_trigger();
create trigger reviews_audit            after insert or update or delete on public.reviews            for each row execute function app.audit_trigger();
