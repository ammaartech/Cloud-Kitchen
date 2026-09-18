import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env-public';
import { listPlans } from '@/lib/data/catalog';

/**
 * `/sitemap.xml`: every public, indexable URL.
 *
 * The static pages are listed by hand because there are six of them and no
 * mechanism that would enumerate them more reliably than reading this file.
 * The plan pages come from the catalog, through the same `use cache` read the
 * storefront uses, so a plan the kitchen publishes appears here when it
 * appears on the site and costs no extra query.
 *
 * Nothing behind a session is listed, and neither is `/whatsapp`, which is
 * `noindex` on purpose (see its page). `lastModified` is left off: the
 * catalog carries no timestamps the public read exposes, and a sitemap that
 * claims every page changed today is one crawlers learn to ignore.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/menu`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/subscriptions`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const plans = await listPlans();
  const planPages: MetadataRoute.Sitemap = plans.map((plan) => ({
    url: `${base}/subscriptions/${plan.slug}`,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticPages, ...planPages];
}
