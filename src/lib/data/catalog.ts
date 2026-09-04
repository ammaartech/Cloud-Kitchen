import { cacheLife, cacheTag } from "next/cache";
import { publicClient } from "@/lib/supabase/public";
import { CATALOG_TAGS } from "./catalog-cache";

/**
 * Read models for the storefront.
 *
 * All of these run through the user's (or anonymous) client, so RLS decides
 * what comes back. An unpublished product is invisible here without this file
 * knowing anything about publication rules.
 */

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  basePrice: string;
  calories: number | null;
  proteinGrams: string | null;
  isVegetarian: boolean;
  creditCost: number;
  isAvailable: boolean;
  unavailableReason: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  imageAlt: string;
  /** Published reviews only -- v_product_ratings excludes everything else. */
  ratingAverage: number | null;
  ratingCount: number;
}

interface RawProduct {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  base_price: string;
  calories: number | null;
  protein_grams: string | null;
  is_vegetarian: boolean;
  credit_cost: number;
  is_available: boolean;
  unavailable_reason: string | null;
  sort_order: number;
  categories: { name: string } | null;
  product_images: Array<{ url: string; alt_text: string; is_primary: boolean }>;
}

export interface Rating {
  average: number;
  count: number;
}

/**
 * Ratings are looked up separately rather than embedded, because they come from
 * a view. Callers that do not care about them (a plan's meal list, a
 * collection tile) simply pass nothing and get a card with no rating on it.
 */
async function loadRatings(): Promise<Map<string, Rating>> {
  const supabase = publicClient();
  const { data } = await supabase
    .from("v_product_ratings")
    .select("product_id, review_count, average_rating");

  return new Map(
    (
      (data ?? []) as Array<{
        product_id: string;
        review_count: number;
        average_rating: string;
      }>
    ).map((row) => [
      row.product_id,
      { average: Number(row.average_rating), count: row.review_count },
    ]),
  );
}

function toCard(row: RawProduct, ratings?: Map<string, Rating>): ProductCard {
  const primary =
    row.product_images?.find((image) => image.is_primary) ??
    row.product_images?.[0] ??
    null;
  const rating = ratings?.get(row.id) ?? null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description,
    basePrice: row.base_price,
    calories: row.calories,
    proteinGrams: row.protein_grams,
    isVegetarian: row.is_vegetarian,
    creditCost: row.credit_cost,
    isAvailable: row.is_available,
    unavailableReason: row.unavailable_reason,
    categoryName: row.categories?.name ?? null,
    imageUrl: primary?.url ?? null,
    imageAlt: primary?.alt_text || row.name,
    ratingAverage: rating?.average ?? null,
    ratingCount: rating?.count ?? 0,
  };
}

const PRODUCT_SELECT = `
  id, slug, name, short_description, description, base_price, calories,
  protein_grams, is_vegetarian, credit_cost, is_available, unavailable_reason,
  sort_order,
  categories ( name ),
  product_images ( url, alt_text, is_primary )
`;

export async function listMenu(): Promise<ProductCard[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CATALOG_TAGS.menu);

  const supabase = publicClient();

  const [{ data }, ratings] = await Promise.all([
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      // Unavailable products are still returned: the menu shows them grayscale
      // with a badge rather than hiding them (PRD 6, PRD 19).
      .order("sort_order", { ascending: true }),
    loadRatings(),
  ]);

  return ((data ?? []) as unknown as RawProduct[]).map((row) =>
    toCard(row, ratings),
  );
}

export interface CategoryGroup {
  name: string;
  slug: string;
  products: ProductCard[];
}

export async function listMenuByCategory(): Promise<CategoryGroup[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CATALOG_TAGS.menu);

  const supabase = publicClient();

  const [{ data: categories }, products] = await Promise.all([
    supabase
      .from("categories")
      .select("slug, name, sort_order")
      .order("sort_order"),
    listMenu(),
  ]);

  return ((categories ?? []) as Array<{ slug: string; name: string }>)
    .map((category) => ({
      name: category.name,
      slug: category.slug,
      products: products.filter(
        (product) => product.categoryName === category.name,
      ),
    }))
    .filter((group) => group.products.length > 0);
}

/* Collections had one reader, `/meal-plans`, and that page is gone -- its
   delivery windows duplicated the hero's and its dish grid duplicated the
   menu's. `listCollections` and its `CollectionSummary` went with it rather
   than staying behind as a cached query nothing calls: a join across three
   tables that no route can reach is not a spare part, it is something the next
   person has to read and rule out. The admin still edits collections, and if
   the storefront ever surfaces them again this comes back from git with the
   page that needs it. */

/* ========================================================================== */
/* Plans                                                                      */
/* ========================================================================== */

export interface PlanSummary {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  planType: string;
  price: string;
  paymentFlow: string;
  billingPeriodDays: number;
  mealsPerCycle: number | null;
  creditsPerCycle: number | null;
  selectableMealCount: number | null;
  allowsVariants: boolean;
  allowsAddOns: boolean;
  windows: Array<{
    id: string;
    code: string;
    label: string;
    startsAt: string;
    endsAt: string;
  }>;
}

interface RawPlan {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  plan_type: string;
  price: string;
  payment_flow: string;
  billing_period_days: number;
  meals_per_cycle: number | null;
  credits_per_cycle: number | null;
  selectable_meal_count: number | null;
  allows_variants: boolean;
  allows_add_ons: boolean;
  sort_order: number;
  subscription_plan_windows: Array<{
    delivery_windows: {
      id: string;
      code: string;
      label: string;
      starts_at: string;
      ends_at: string;
    } | null;
  }>;
}

const PLAN_SELECT = `
  id, slug, name, tagline, description, plan_type, price, payment_flow,
  billing_period_days, meals_per_cycle, credits_per_cycle, selectable_meal_count,
  allows_variants, allows_add_ons, sort_order,
  subscription_plan_windows (
    delivery_windows ( id, code, label, starts_at, ends_at )
  )
`;

function toPlan(row: RawPlan): PlanSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    planType: row.plan_type,
    price: row.price,
    paymentFlow: row.payment_flow,
    billingPeriodDays: row.billing_period_days,
    mealsPerCycle: row.meals_per_cycle,
    creditsPerCycle: row.credits_per_cycle,
    selectableMealCount: row.selectable_meal_count,
    allowsVariants: row.allows_variants,
    allowsAddOns: row.allows_add_ons,
    windows: row.subscription_plan_windows
      .map((link) => link.delivery_windows)
      .filter((window): window is NonNullable<typeof window> => Boolean(window))
      .map((window) => ({
        id: window.id,
        code: window.code,
        label: window.label,
        startsAt: window.starts_at,
        endsAt: window.ends_at,
      })),
  };
}

/**
 * Plans cheapest first.
 *
 * `listPlans` returns them in `sort_order`, which is the kitchen's own
 * arrangement and stays the default -- it is how they choose to lead. But a row
 * of plans with a price on each is not a list, it is a comparison, and a
 * comparison the reader has to re-sort in their head before they can make it is
 * a comparison that has not been offered. Four notes reading 4,499 / 3,999 /
 * 5,299 / 4,699 make someone check every one of them twice to find out which is
 * the cheapest; in ascending order that answer is the leftmost card and costs
 * nothing to read.
 *
 * So this is applied where plans are *rendered priced and side by side*, and
 * nowhere else. `sort_order` still decides everything the reader is not being
 * asked to compare on price.
 *
 * It copies before sorting, and that is not defensive style. `listPlans` is a
 * `"use cache"` function, so every caller is handed the *same* array instance
 * out of the cache -- an in-place `sort()` would reorder it for every other
 * route in the process, permanently, and the bug would show up as a page
 * mysteriously changing order depending on which page was rendered first.
 *
 * Equal prices keep their `sort_order`: `Array.prototype.sort` is stable, so a
 * tie falls through to the order the kitchen set rather than to chance.
 */
export function byPriceAscending(plans: PlanSummary[]): PlanSummary[] {
  return [...plans].sort((a, b) => Number(a.price) - Number(b.price));
}

export async function listPlans(): Promise<PlanSummary[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CATALOG_TAGS.plans);

  const supabase = publicClient();
  const { data } = await supabase
    .from("subscription_plans")
    .select(PLAN_SELECT)
    .order("sort_order");
  return ((data ?? []) as unknown as RawPlan[]).map(toPlan);
}

export async function getPlan(slug: string): Promise<PlanSummary | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CATALOG_TAGS.plans);

  const supabase = publicClient();
  const { data } = await supabase
    .from("subscription_plans")
    .select(PLAN_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  return data ? toPlan(data as unknown as RawPlan) : null;
}

/** The meals a plan includes, or -- for a customer-selected plan -- offers. */
export async function getPlanMeals(planId: string): Promise<{
  fixed: ProductCard[];
  selectable: ProductCard[];
}> {
  "use cache";
  cacheLife("catalog");
  // Reads both halves: which meals a plan offers, and the meals themselves.
  cacheTag(CATALOG_TAGS.plans);
  cacheTag(CATALOG_TAGS.menu);

  const supabase = publicClient();

  const { data } = await supabase
    .from("subscription_plan_meals")
    .select(
      `is_selectable, quantity, sort_order, products ( ${PRODUCT_SELECT} )`,
    )
    .eq("plan_id", planId)
    .order("sort_order");

  type Row = { is_selectable: boolean; products: RawProduct | null };
  const rows = (data ?? []) as unknown as Row[];

  return {
    fixed: rows
      .filter((row) => !row.is_selectable && row.products)
      .map((row) => toCard(row.products as RawProduct)),
    selectable: rows
      .filter((row) => row.is_selectable && row.products)
      .map((row) => toCard(row.products as RawProduct)),
  };
}

/* ========================================================================== */
/* Offers and settings                                                        */
/* ========================================================================== */

export interface PublicOffer {
  code: string;
  name: string;
  description: string;
  discountType: string;
  discountValue: string;
  maxDiscountAmount: string | null;
  minOrderAmount: string;
  validUntil: string | null;
}

/** Only offers flagged publicly visible come back -- RLS enforces that. */
export async function listPublicOffers(): Promise<PublicOffer[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CATALOG_TAGS.offers);

  const supabase = publicClient();

  const { data } = await supabase
    .from("coupons")
    .select(
      "code, name, description, discount_type, discount_value, max_discount_amount, min_order_amount, valid_until",
    )
    .order("created_at");

  return ((data ?? []) as Array<Record<string, string | null>>).map((row) => ({
    code: row.code as string,
    name: row.name as string,
    description: row.description as string,
    discountType: row.discount_type as string,
    discountValue: row.discount_value as string,
    maxDiscountAmount: row.max_discount_amount,
    minOrderAmount: row.min_order_amount as string,
    validUntil: row.valid_until,
  }));
}

export interface DeliveryWindow {
  id: string;
  code: string;
  label: string;
  starts_at: string;
  ends_at: string;
  cutoff_minutes_before: number;
}

export async function listDeliveryWindows(): Promise<DeliveryWindow[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CATALOG_TAGS.windows);

  const supabase = publicClient();
  const { data } = await supabase
    .from("delivery_windows")
    .select("id, code, label, starts_at, ends_at, cutoff_minutes_before")
    .eq("is_active", true)
    .order("sort_order");

  return (data ?? []) as DeliveryWindow[];
}
