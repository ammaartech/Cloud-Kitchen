import type { ProductCard } from '@/lib/data/catalog';

/**
 * Which products the storefront can actually show a photograph of.
 *
 * This lives on its own because two surfaces on the home page draw from the
 * same pool and must not draw the same pictures: the hero spends the first two
 * on its gateway cards, and the mission band takes what is left. Keeping the
 * filter in one place is what lets the page slice a single ordered list rather
 * than have each section guess at what the other one used.
 *
 * Unavailable products are excluded rather than greyed out here. The grayscale
 * treatment (`.is-unavailable`) is for the menu, where a visitor is being told
 * what is off today; on a marketing surface a dish nobody can order is simply
 * the wrong photograph to lead with.
 */

/** A product we can actually show a photograph of. */
export type Photo = ProductCard & { imageUrl: string };

export function withPhotos(menu: ProductCard[]): Photo[] {
  return menu.filter(
    (product): product is Photo => Boolean(product.imageUrl) && product.isAvailable,
  );
}
