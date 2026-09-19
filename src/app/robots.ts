import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env-public';

/**
 * `/robots.txt`.
 *
 * Everything the storefront shows a signed-out visitor is crawlable. What is
 * disallowed is every route that either needs a session, is a step in a
 * purchase, or is an API -- none of which has anything a search result could
 * usefully show, and each of which would otherwise be crawled to a sign-in
 * redirect. Those routes also carry a `noindex` in their own metadata, which
 * is the directive that actually keeps a URL out of the index; this file is
 * what stops the crawl budget being spent reaching it.
 *
 * `/whatsapp` is deliberately *not* listed. It is `noindex` in its metadata,
 * and a crawler has to be allowed to fetch a page to read that.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/kot',
        '/account',
        '/checkout',
        '/cart',
        '/sign-in',
        '/forbidden',
        '/private-preview',
        '/api/',
      ],
    },
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
