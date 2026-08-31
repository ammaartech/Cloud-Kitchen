-- =============================================================================
-- 0004  Catalog (PRD 13)
-- =============================================================================
-- Shopify-like: products, images, categories, collections, shared variant
-- groups, add-ons, availability and calories are all rows. No product name,
-- image, price or badge is ever written in application code.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- categories: the single taxonomy a product belongs to (Mains, Breads, ...).
-- -----------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text not null default '',
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- collections: merchandising groupings a product may belong to many of
-- ("High Protein", "Chef's Picks"). Drives the website browse experience.
-- -----------------------------------------------------------------------------
create table public.collections (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  description   text not null default '',
  image_url     text,
  sort_order    integer not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table public.products (
  id                       uuid primary key default gen_random_uuid(),
  slug                     text not null unique,
  name                     text not null,
  short_description        text not null default '',
  description              text not null default '',
  category_id              uuid references public.categories(id) on delete set null,
  base_price               numeric(12,2) not null check (base_price >= 0),

  -- Nutrition / dietary facts shown on the menu.
  calories                 integer check (calories >= 0),
  protein_grams            numeric(6,2) check (protein_grams >= 0),
  is_vegetarian            boolean not null default true,
  allergens                text[] not null default '{}',

  -- Subscription economics: a premium meal may cost more than one credit
  -- (PRD 7). Never assume 1 credit == 1 meal. Zero is valid too -- a side or a
  -- bread can ride along with a plan meal without consuming entitlement.
  credit_cost              integer not null default 1 check (credit_cost >= 0),

  -- Profit estimation input (PRD 12). Null falls back to the channel's
  -- default_food_cost_percent in cost_settings.
  estimated_cost           numeric(12,2) check (estimated_cost >= 0),

  -- Availability. Unavailable products render grayscale with a badge and
  -- cannot be selected (PRD 6, PRD 19) -- enforced server-side as well.
  is_available             boolean not null default true,
  unavailable_reason       text,
  available_from           timestamptz,
  available_until          timestamptz,

  -- Visibility is separate from availability: a hidden product disappears
  -- entirely, an unavailable one is shown but not orderable.
  is_published             boolean not null default true,
  -- Soft delete keeps historical order lines meaningful (PRD 17).
  archived_at              timestamptz,

  allows_special_instructions boolean not null default true,
  max_quantity_per_order   integer check (max_quantity_per_order is null or max_quantity_per_order > 0),
  sort_order               integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index products_category_idx  on public.products(category_id);
create index products_browse_idx    on public.products(is_published, sort_order)
  where archived_at is null;

-- A product is orderable only when published, available, not archived and
-- inside any configured availability window. Both the API and RLS use this,
-- so the "cannot be selected" rule is never only a frontend concern.
create or replace function app.product_is_orderable(
  p_product_id uuid,
  p_at         timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.products p
     where p.id = p_product_id
       and p.is_published
       and p.is_available
       and p.archived_at is null
       and (p.available_from  is null or p.available_from  <= p_at)
       and (p.available_until is null or p.available_until >  p_at)
  );
$fn$;

create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  url         text not null,
  alt_text    text not null default '',
  sort_order  integer not null default 0,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index product_images_product_idx on public.product_images(product_id, sort_order);
create unique index product_images_one_primary_idx
  on public.product_images(product_id) where is_primary;

create table public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  sort_order    integer not null default 0,
  primary key (collection_id, product_id)
);

-- -----------------------------------------------------------------------------
-- Variant groups are defined once and attached to many products, so "Portion"
-- does not have to be re-created per meal.
-- -----------------------------------------------------------------------------
create table public.variant_groups (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  selection_type  text not null default 'single' check (selection_type in ('single','multiple')),
  is_required     boolean not null default true,
  min_selections  integer not null default 1 check (min_selections >= 0),
  -- Null = unbounded. Phase 1 leaves room for the quantity constraints the
  -- PRD anticipates (PRD 13) without inventing rules for them yet.
  max_selections  integer check (max_selections is null or max_selections >= 1),
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint variant_groups_selection_bounds
    check (max_selections is null or max_selections >= min_selections)
);

create table public.variants (
  id               uuid primary key default gen_random_uuid(),
  variant_group_id uuid not null references public.variant_groups(id) on delete cascade,
  code             text not null,
  name             text not null,
  price_delta      numeric(12,2) not null default 0,
  -- A larger portion can legitimately cost an extra credit.
  credit_delta     integer not null default 0,
  calorie_delta    integer not null default 0,
  is_default       boolean not null default false,
  is_available     boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (variant_group_id, code)
);

create index variants_group_idx on public.variants(variant_group_id, sort_order);

create table public.product_variant_groups (
  product_id       uuid not null references public.products(id) on delete cascade,
  variant_group_id uuid not null references public.variant_groups(id) on delete cascade,
  sort_order       integer not null default 0,
  -- A product may make a normally optional group required, or vice versa.
  is_required_override boolean,
  primary key (product_id, variant_group_id)
);

-- -----------------------------------------------------------------------------
-- Add-ons: priced extras attachable to products.
-- -----------------------------------------------------------------------------
create table public.add_ons (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           text not null,
  description    text not null default '',
  price          numeric(12,2) not null default 0 check (price >= 0),
  credit_cost    integer not null default 0 check (credit_cost >= 0),
  calories       integer check (calories >= 0),
  estimated_cost numeric(12,2) check (estimated_cost >= 0),
  image_url      text,
  is_available   boolean not null default true,
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.product_add_ons (
  product_id  uuid not null references public.products(id) on delete cascade,
  add_on_id   uuid not null references public.add_ons(id) on delete cascade,
  max_quantity integer not null default 1 check (max_quantity >= 1),
  sort_order  integer not null default 0,
  primary key (product_id, add_on_id)
);

-- -----------------------------------------------------------------------------
-- Timestamps + audit on everything an Owner can change (PRD 17).
-- -----------------------------------------------------------------------------
create trigger categories_touch      before update on public.categories      for each row execute function app.touch_updated_at();
create trigger collections_touch     before update on public.collections     for each row execute function app.touch_updated_at();
create trigger products_touch        before update on public.products        for each row execute function app.touch_updated_at();
create trigger variant_groups_touch  before update on public.variant_groups  for each row execute function app.touch_updated_at();
create trigger variants_touch        before update on public.variants        for each row execute function app.touch_updated_at();
create trigger add_ons_touch         before update on public.add_ons         for each row execute function app.touch_updated_at();

create trigger categories_audit          after insert or update or delete on public.categories          for each row execute function app.audit_trigger();
create trigger collections_audit         after insert or update or delete on public.collections         for each row execute function app.audit_trigger();
create trigger products_audit            after insert or update or delete on public.products            for each row execute function app.audit_trigger();
create trigger product_images_audit      after insert or update or delete on public.product_images      for each row execute function app.audit_trigger();
create trigger collection_products_audit after insert or update or delete on public.collection_products for each row execute function app.audit_trigger();
create trigger variant_groups_audit      after insert or update or delete on public.variant_groups      for each row execute function app.audit_trigger();
create trigger variants_audit            after insert or update or delete on public.variants            for each row execute function app.audit_trigger();
create trigger add_ons_audit             after insert or update or delete on public.add_ons             for each row execute function app.audit_trigger();
