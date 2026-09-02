import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Partial Prerendering, and the `use cache` directive that feeds it.
   *
   * The storefront's problem was that pages every visitor sees identically --
   * one menu, one set of plans, one offers list -- were rendered from scratch
   * per request, because a single `cookies()` read in the `(site)` layout
   * dragged every route beneath it into dynamic rendering. That read is gone
   * (see `components/site/account.ts`), and this is the other half: the page
   * becomes a prerendered static shell, and only the parts that genuinely
   * depend on *this* request -- a search query, a signed-in identity -- stream
   * in behind a Suspense boundary.
   *
   * The cost is that nothing is dynamic by accident any more. Reading
   * `cookies()`, `headers()` or `searchParams` outside a boundary is a build
   * error rather than a silent deopt, which is the point of it.
   */
  cacheComponents: true,

  cacheLife: {
    /**
     * The profile every public catalog read uses.
     *
     * `revalidate: 60` is a backstop, not the freshness mechanism -- admin
     * writes call `updateTag` and expire the affected entries immediately (see
     * `src/lib/data/catalog-cache.ts`). Sixty seconds is what covers a change
     * arriving *without* passing through a Server Action: a direct SQL edit, a
     * tweak in the Supabase dashboard. It is the value `CATALOG_TTL` carried
     * under `unstable_cache`, kept so the migration changed the mechanism
     * rather than the freshness.
     *
     * `stale: 300` is the client router's cache, and it is the lever that makes
     * browsing feel instant. A visitor going menu -> plan -> back pays nothing
     * for the return trip: the router replays it from memory with no network
     * at all. The cost is that a price changed mid-session can take up to five
     * minutes to reach a tab that is already open, which for a menu that
     * changes a few times a day is the right side of the trade.
     *
     * `expire: 3600` bounds how long an untouched entry may be served after a
     * quiet spell before someone has to wait for a fresh read.
     */
    catalog: {
      stale: 300,
      revalidate: 60,
      expire: 3600,
    },
  },

  images: {
    // Product imagery is database-driven (PRD 13), so the host allowlist is
    // what constrains it rather than any hardcoded asset path.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  typedRoutes: true,
};

export default nextConfig;
