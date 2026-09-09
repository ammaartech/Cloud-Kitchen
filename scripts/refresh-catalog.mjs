/**
 * Replaces a live database's catalogue with the one in supabase/seed.sql,
 * without dropping anything a customer has already been promised.
 *
 * `supabase db reset` is the right tool for a database you are willing to lose.
 * This is for the other case: a deployed demo whose customers, subscriptions,
 * payments, KOT history and audit trail must survive a menu change.
 *
 * What it does, in order:
 *
 *   1. Reads the *new* catalogue by running the real migrations and the real
 *      seed inside PGlite. Nothing about the menu is written twice: seed.sql
 *      stays the single source of truth, and this script is a transport.
 *   2. Archives the old products rather than deleting them. `products_read`
 *      (migration 0090) hides archived rows from the storefront, so they leave
 *      the menu; order lines, reviews and tickets that reference them keep
 *      pointing at a row that still says what it was (PRD 17).
 *   3. Inserts the new catalogue under a fresh id range, because the seed's own
 *      product ids are already spent on the dishes being retired.
 *   4. Repoints the subscription plans, and the delivery items of deliveries
 *      that have not gone to the kitchen yet -- and only where the replacement
 *      costs the same number of credits, so the credit ledger stays true. A
 *      released or fulfilled delivery is left exactly as it is: it was ordered
 *      against the old menu and that is what it was.
 *
 * It writes as the service role, so RLS is bypassed and the catalogue audit
 * rows carry no named actor -- the same footing as the webhook and job code
 * that `lib/supabase/admin.ts` reserves that key for.
 *
 * Dry run (default):   node scripts/refresh-catalog.mjs
 * Apply:               node scripts/refresh-catalog.mjs --apply
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 * or the environment, and never prints either.
 *
 * NOTE: the new rows point at /menu/<slug>.jpg, which are files in `public/`.
 * A deployed site shows them only once it has been redeployed with those files.
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const APPLY = process.argv.includes('--apply');

/* -------------------------------------------------------------------------- */
/* Connection                                                                 */
/* -------------------------------------------------------------------------- */

function env() {
  const fromFile = existsSync('.env.local')
    ? Object.fromEntries(
        readFileSync('.env.local', 'utf8')
          .split(/\r?\n/)
          .filter((line) => /^[A-Z0-9_]+=/.test(line))
          .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]),
      )
    : {};
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fromFile.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? fromFile.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    process.exit(1);
  }
  return { url: url.replace(/\/$/, ''), key };
}

const { url: SUPABASE_URL, key: SERVICE_KEY } = env();

async function rest(method, path, { body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer ?? 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path.split('?')[0]} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const read = (path) => rest('GET', path);

/** Every write goes through here, so --apply is enforced in exactly one place. */
async function write(label, method, path, body) {
  if (!APPLY) {
    const n = Array.isArray(body) ? body.length : body ? 1 : '';
    console.log(`  would ${label}${n === '' ? '' : ` (${n} row${n === 1 ? '' : 's'})`}`);
    return null;
  }
  const result = await rest(method, path, { body, prefer: 'return=minimal' });
  console.log(`  ${label}`);
  return result;
}

/* -------------------------------------------------------------------------- */
/* The new catalogue, read out of the seed rather than restated here          */
/* -------------------------------------------------------------------------- */

async function catalogueFromSeed() {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(readFileSync('tests/harness/supabase-shim.sql', 'utf8'));
  for (const file of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join('supabase/migrations', file), 'utf8'));
  }
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));

  const q = async (sql) => (await db.query(sql)).rows;
  const catalogue = {
    categories: await q(`select id, slug, name, description, sort_order, is_active from categories order by sort_order`),
    collections: await q(`select id, slug, name, description, sort_order, is_published from collections order by sort_order`),
    products: await q(`select id, slug, name, short_description, description, category_id, base_price,
                              calories, protein_grams, is_vegetarian, allergens, credit_cost, estimated_cost,
                              is_available, unavailable_reason, is_published, allows_special_instructions,
                              max_quantity_per_order, sort_order
                         from products order by sort_order`),
    productImages: await q(`select product_id, url, alt_text, sort_order, is_primary from product_images`),
    collectionProducts: await q(`select collection_id, product_id, sort_order from collection_products`),
    variants: await q(`select variant_group_id, code, name, price_delta, credit_delta, calorie_delta,
                              is_default, is_available, sort_order from variants`),
    productVariantGroups: await q(`select product_id, variant_group_id, sort_order, is_required_override
                                     from product_variant_groups`),
    addOns: await q(`select id, code, name, description, price, credit_cost, calories, estimated_cost,
                            image_url, is_available, is_active, sort_order from add_ons order by sort_order`),
    productAddOns: await q(`select product_id, add_on_id, max_quantity, sort_order from product_add_ons`),
    planMeals: await q(`select plan_id, product_id, day_of_week, quantity, is_selectable, sort_order
                          from subscription_plan_meals`),
    reviews: await q(`select customer_id, product_id, rating, title, body, status, is_verified_purchase
                        from reviews order by created_at`),
  };
  await db.close();
  return catalogue;
}

/* -------------------------------------------------------------------------- */
/* Id remapping                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The seed's product, category and add-on ids are already taken in a live
 * database -- by the very rows this is retiring. Shifting the fourth hex digit
 * of the prefix gives a range that is obviously "the second generation" when
 * someone reads it later, and leaves the per-row suffix alone so a dish keeps
 * the position it has in the seed.
 */
const remap = (id, from, to) => (id.startsWith(from) ? to + id.slice(from.length) : id);
const newCategoryId = (id) => remap(id, 'c0000001', 'c0000002');
const newProductId = (id) => remap(id, '40000001', '40000002');
const newAddOnId = (id) => remap(id, '60000001', '60000002');

/* -------------------------------------------------------------------------- */

async function main() {
  console.log(APPLY ? 'APPLYING to' : 'DRY RUN against', SUPABASE_URL.replace(/^https:\/\/([a-z0-9]{4}).*/, 'https://$1***'));

  console.log('\nReading the new catalogue out of supabase/seed.sql (PGlite)...');
  const next = await catalogueFromSeed();
  console.log(`  ${next.products.length} products, ${next.productImages.length} images,` +
              ` ${next.categories.length} categories, ${next.addOns.length} add-ons`);

  for (const image of next.productImages) {
    const file = join('public', image.url.replace(/^\//, ''));
    if (image.url.startsWith('/') && !existsSync(file)) {
      throw new Error(`seed references ${image.url} but ${file} does not exist`);
    }
  }
  console.log('  every image url resolves to a file in public/');

  /* ---- Preflight ------------------------------------------------------- */

  const live = await read('products?select=id,slug,archived_at&order=sort_order');
  const liveActive = live.filter((p) => !p.archived_at);
  const incoming = new Set(next.products.map((p) => newProductId(p.id)));
  const alreadyDone = liveActive.filter((p) => incoming.has(p.id));

  console.log(`\nLive catalogue: ${live.length} products, ${liveActive.length} not archived.`);
  if (alreadyDone.length === next.products.length) {
    console.log('The new catalogue is already live. Nothing to do.');
    return;
  }
  if (alreadyDone.length > 0) {
    throw new Error(`${alreadyDone.length} of the new products already exist -- refusing a half-applied run.`);
  }

  const retiring = liveActive.map((p) => p.id);
  console.log(`Retiring ${retiring.length}: ${liveActive.map((p) => p.slug).join(', ')}`);

  /* ---- 1. Retire the old catalogue ------------------------------------- */

  console.log('\n1. Retire the old catalogue');
  await write(`archive ${retiring.length} products`, 'PATCH',
    `products?id=in.(${retiring.join(',')})`,
    { is_published: false, is_available: false, archived_at: new Date().toISOString() });

  const liveCategories = await read('categories?select=id');
  await write('deactivate old categories', 'PATCH',
    `categories?id=in.(${liveCategories.map((c) => c.id).join(',')})`, { is_active: false });

  const liveAddOns = await read('add_ons?select=id');
  await write('deactivate old add-ons', 'PATCH',
    `add_ons?id=in.(${liveAddOns.map((a) => a.id).join(',')})`, { is_active: false });

  // Merchandising joins carry no history: a collection is a browse grouping,
  // not something anybody ordered. Same for the variant and add-on links of
  // products nobody can order any more.
  await write('clear collection links', 'DELETE',
    `collection_products?product_id=in.(${retiring.join(',')})`);
  await write('clear variant links', 'DELETE',
    `product_variant_groups?product_id=in.(${retiring.join(',')})`);
  await write('clear add-on links', 'DELETE',
    `product_add_ons?product_id=in.(${retiring.join(',')})`);

  /* ---- 2. Bring the new catalogue in ----------------------------------- */

  console.log('\n2. Insert the new catalogue');

  await write('categories', 'POST', 'categories',
    next.categories.map((c) => ({ ...c, id: newCategoryId(c.id) })));

  await write('products', 'POST', 'products',
    next.products.map((p) => ({
      ...p,
      id: newProductId(p.id),
      category_id: p.category_id ? newCategoryId(p.category_id) : null,
    })));

  const productBySeedId = new Map(next.products.map((p) => [p.id, p]));
  await write('product images', 'POST', 'product_images',
    next.productImages.map((i) => ({ ...i, product_id: newProductId(i.product_id) }))
      .sort((a, b) => (productBySeedId.get(a.product_id)?.sort_order ?? 0) - (productBySeedId.get(b.product_id)?.sort_order ?? 0)));

  await write('add-ons', 'POST', 'add_ons',
    next.addOns.map((a) => ({ ...a, id: newAddOnId(a.id) })));

  // Collections and variant groups keep their ids: they are containers, and
  // the seed's are the ones already in the database. Updating them in place is
  // what keeps a live database converging on what a fresh seed would produce.
  for (const collection of next.collections) {
    await write(`collection ${collection.slug}`, 'PATCH', `collections?id=eq.${collection.id}`,
      { slug: collection.slug, name: collection.name, description: collection.description,
        sort_order: collection.sort_order, is_published: collection.is_published });
  }
  for (const variant of next.variants) {
    await write(`variant ${variant.code}`, 'PATCH',
      `variants?variant_group_id=eq.${variant.variant_group_id}&code=eq.${variant.code}`,
      { name: variant.name, price_delta: variant.price_delta, credit_delta: variant.credit_delta,
        calorie_delta: variant.calorie_delta, is_default: variant.is_default,
        is_available: variant.is_available, sort_order: variant.sort_order });
  }

  await write('collection links', 'POST', 'collection_products',
    next.collectionProducts.map((r) => ({ ...r, product_id: newProductId(r.product_id) })));
  await write('variant links', 'POST', 'product_variant_groups',
    next.productVariantGroups.map((r) => ({ ...r, product_id: newProductId(r.product_id) })));
  await write('add-on links', 'POST', 'product_add_ons',
    next.productAddOns.map((r) => ({
      ...r, product_id: newProductId(r.product_id), add_on_id: newAddOnId(r.add_on_id),
    })));

  /* ---- 3. Repoint the plans -------------------------------------------- */

  console.log('\n3. Repoint the subscription plans');
  const planIds = [...new Set(next.planMeals.map((m) => m.plan_id))];
  await write('clear old plan meals', 'DELETE', `subscription_plan_meals?plan_id=in.(${planIds.join(',')})`);
  await write('plan meals', 'POST', 'subscription_plan_meals',
    next.planMeals.map((m) => ({ ...m, product_id: newProductId(m.product_id) })));

  /* ---- 4. Deliveries not yet sent to the kitchen ------------------------ */

  console.log('\n4. Repoint deliveries that have not reached the kitchen');

  // What each retired dish becomes. A scheduled delivery is only moved when the
  // replacement costs the same credits, because those credits have already been
  // consumed from the ledger and the ledger is append-only.
  const SUCCESSION = {
    'paneer-tikka-bowl': 'banana-leaf-thali',
    'dal-khichdi-bowl': 'mixed-vegetable-rice-bath',
    'chicken-biryani': 'paneer-butter-masala-dosa',
    'rajma-chawal': 'ghee-rice',
    'grilled-fish-thali': 'vangi-bath',
    'quinoa-salad-bowl': 'lemon-rice',
    'tandoori-roti': 'chapati',
    'butter-naan': 'parotta',
    'boondi-raita': 'bombay-curry',
    'masala-chaas': 'kesari-bath',
  };

  const oldById = new Map(live.map((p) => [p.id, p]));
  const oldCosts = new Map((await read(`products?select=id,credit_cost`)).map((p) => [p.id, p.credit_cost]));
  const newBySlug = new Map(next.products.map((p) => [p.slug, p]));

  const scheduled = await read('subscription_deliveries?select=id&status=eq.scheduled');
  const scheduledIds = new Set(scheduled.map((d) => d.id));
  const items = await read('subscription_delivery_items?select=delivery_id,product_id');

  const moves = new Map();
  const skipped = [];
  for (const item of items) {
    if (!scheduledIds.has(item.delivery_id)) continue;
    const from = oldById.get(item.product_id);
    if (!from || !SUCCESSION[from.slug]) continue;
    const to = newBySlug.get(SUCCESSION[from.slug]);
    if (!to) continue;
    if (oldCosts.get(from.id) !== to.credit_cost) {
      skipped.push(`${from.slug} -> ${to.slug} (${oldCosts.get(from.id)} vs ${to.credit_cost} credits)`);
      continue;
    }
    if (!moves.has(from.id)) moves.set(from.id, { to, n: 0 });
    moves.get(from.id).n += 1;
  }

  if (moves.size === 0) console.log('  nothing scheduled points at a retired dish');
  for (const [fromId, { to, n }] of moves) {
    await write(`${oldById.get(fromId).slug} -> ${to.slug} on ${n} scheduled item${n === 1 ? '' : 's'}`,
      'PATCH',
      `subscription_delivery_items?product_id=eq.${fromId}&delivery_id=in.(${[...scheduledIds].join(',')})`,
      { product_id: newProductId(to.id) });
  }
  for (const note of [...new Set(skipped)]) console.log(`  left alone, credits differ: ${note}`);

  /* ---- 5. The seed's reviews for the new dishes ------------------------- */

  // Added rather than moved. A review is somebody's sentence about a dish they
  // ate; repointing one at a different dish would put words in their mouth, so
  // the old reviews stay on the archived products where they belong and these
  // arrive alongside them.
  console.log('\n5. Reviews for the new dishes');
  await write(`${next.reviews.length} reviews`, 'POST', 'reviews',
    next.reviews.map((r) => ({ ...r, product_id: newProductId(r.product_id) })));

  /* ---- Verify ---------------------------------------------------------- */

  if (!APPLY) {
    console.log('\nDry run. Nothing was written. Re-run with --apply.');
    return;
  }

  console.log('\nVerifying, as an anonymous visitor sees it...');
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])).NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=slug,is_available,categories(name),product_images(url)&order=sort_order`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
  );
  const visible = await res.json();
  const byCategory = {};
  let missingImage = 0;
  for (const p of visible) {
    const name = p.categories?.name ?? 'uncategorised';
    byCategory[name] = (byCategory[name] ?? 0) + 1;
    if (!p.product_images?.length) missingImage += 1;
  }
  console.log(`  ${visible.length} products on the public menu`);
  for (const [name, n] of Object.entries(byCategory)) console.log(`    ${name}: ${n}`);
  console.log(`  unavailable today: ${visible.filter((p) => !p.is_available).length}`);
  console.log(`  without a photograph: ${missingImage}`);
  console.log('\nDone. Redeploy so public/menu/*.jpg is served alongside these rows.');
}

await main();
