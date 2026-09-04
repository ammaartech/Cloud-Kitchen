import type { PublicOffer } from '@/lib/data/catalog';
import { money } from '@/lib/format';

/**
 * Which offer to lead with, and how to say it.
 *
 * These lived inside `storefront-hero.tsx` and were private to it, back when
 * the hero's gateway card carried a discount pill. That pill is gone -- the
 * strip above the header says the same thing better and there is no reason for
 * the page to say it twice -- so the strip is the only caller today.
 *
 * They stay here rather than moving into `offer-bar.tsx` because the question
 * they answer is the kitchen's, not the bar's: *which* offer leads, and how a
 * discount is worded. The next surface that needs an offer -- a plan page, a
 * checkout line -- has to give the same answer as the strip or the site
 * contradicts itself, and that is a shared rule rather than one component's
 * private business.
 *
 * The rule is the deepest percentage, falling back to whatever is first. A
 * percentage is the claim a visitor can act on without knowing their basket;
 * a flat amount off is only meaningful once they do.
 */
export function headlineOffer(offers: PublicOffer[]): PublicOffer | null {
  const percent = offers
    .filter((offer) => offer.discountType === 'percent')
    .sort((a, b) => Number(b.discountValue) - Number(a.discountValue));

  return percent[0] ?? offers[0] ?? null;
}

/**
 * The offer as a phrase, or nothing.
 *
 * Nothing is a real answer here. A zero or a missing value returns `null` and
 * the surface renders no pill and no bar rather than "Up to 0% off" -- this
 * page does not invent a number, and it does not print a meaningless one
 * either.
 */
export function offerLabel(offer: PublicOffer): string | null {
  const value = Number(offer.discountValue);
  if (!Number.isFinite(value) || value <= 0) return null;

  return offer.discountType === 'percent'
    ? `Up to ${Math.round(value)}% off`
    : `${money(value)} off`;
}
