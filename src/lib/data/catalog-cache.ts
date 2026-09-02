import { revalidatePath, updateTag } from 'next/cache';

/**
 * Cache tags for the public catalog, and the one function that clears them.
 *
 * The storefront's catalog is the same rows for every visitor, changes a few
 * times a day, and costs a round-trip to a hosted database to read. That is
 * the exact shape of thing that should be read once and shared, so the public
 * reads in `catalog.ts` are `use cache` scopes tagged with these.
 *
 * Caching without invalidation is just a slower bug, so the two live in the
 * same file: anything that adds a tag here is looking straight at the function
 * that has to clear it.
 *
 * Every cached read also carries a short TTL as a safety net. The tags are the
 * mechanism that matters -- an editor who publishes a dish expects to see it,
 * not to wonder whether enough time has passed -- but a TTL means a mutation
 * path nobody remembered to wire up goes stale for a minute rather than until
 * the next deploy. It is the difference between a missed call site being a
 * blip and being a bug report.
 */
export const CATALOG_TAGS = {
  menu: 'catalog:menu',
  plans: 'catalog:plans',
  offers: 'catalog:offers',
  windows: 'catalog:windows',
} as const;

/**
 * Drops the cached public catalog.
 *
 * Deliberately coarse. The admin screens already call `revalidatePath` for the
 * pages they know about, and that is exactly the pattern that let the home page
 * fall through the cracks -- it was never in anyone's list. A single call that
 * clears the whole catalog cannot develop that kind of hole, and re-reading
 * four small queries is far cheaper than an editor not trusting the storefront.
 *
 * Note that `revalidatePath` does *not* reach these entries. It invalidates a
 * rendered route; `use cache` entries are keyed separately and only a
 * matching tag call clears them. Admin mutations need both, which is why this
 * is called alongside the existing `revalidatePath` calls rather than instead
 * of them.
 *
 * `updateTag`, not `revalidateTag`. Under Next 16 `revalidateTag` is
 * stale-while-revalidate: it hands the *next* reader the old rows while the
 * new ones load in the background, and the next reader here is usually the
 * editor who just hit publish. Being shown the page they were looking at
 * before is exactly the outcome that makes someone press the button again.
 * `updateTag` expires the entry outright, so the redirect after the action
 * blocks for one re-read and lands on the truth. It is Server-Action-only,
 * which is where every catalog mutation in this app already lives.
 */
export function revalidateCatalog(): void {
  for (const tag of Object.values(CATALOG_TAGS)) updateTag(tag);
}

/**
 * Revalidates a storefront route *and* the catalog cache behind it.
 *
 * The two have to happen together and neither is sufficient alone:
 * `revalidatePath` drops the rendered route but leaves the cached rows it was
 * rendered from, so the re-render faithfully reproduces the stale page. Every
 * admin mutation that touches something a customer can see calls this instead
 * of `revalidatePath`, so the pairing cannot be half-remembered at one call
 * site out of thirty-nine.
 *
 * Admin-only paths keep using `revalidatePath` directly -- they render from the
 * session-scoped client and were never cached.
 */
export function revalidateStorefront(path: string): void {
  revalidatePath(path);
  revalidateCatalog();
}
