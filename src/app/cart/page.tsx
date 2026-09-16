import { redirect } from 'next/navigation';

/**
 * `/cart`, which this product does not have.
 *
 * Website orders are subscription deliveries by design -- the database refuses
 * an SX order that is not one -- so there is no basket of dishes to show. What
 * plays the cart's part is the plan being configured, carried into checkout in
 * a cookie. People still type `/cart`, and browsers still autocomplete it, so
 * it lands on the checkout: the plan being bought, or a page saying there is
 * nothing to check out yet.
 *
 * A route rather than a `redirects()` entry in `next.config.ts`, so the rule
 * lives with the routes it is about and is prerendered like any other page.
 */
export default function CartPage() {
  redirect('/checkout');
}
