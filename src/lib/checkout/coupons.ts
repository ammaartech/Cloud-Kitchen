import { money } from '@/lib/format';

/**
 * `validate_coupon` explains a refusal in the database's words ("Coupon usage
 * limit reached"). They are accurate and they are written for a log. This turns
 * each into a sentence addressed to the person holding the code, and keeps the
 * part that matters -- *why* it did not apply -- because "invalid code" on a
 * code someone was handed by the kitchen reads as the kitchen breaking a
 * promise.
 *
 * An unrecognised reason passes through untouched rather than being swallowed
 * into something generic: a new rule in the database should still say what it
 * is, even before this list learns to phrase it.
 */
export function couponReason(reason: string | null | undefined): string {
  if (!reason) return 'That code does not apply to this plan.';

  const minimum = /^Requires a minimum of ([\d.]+)/.exec(reason);
  if (minimum) return `That code needs an order of at least ${money(Number(minimum[1]))}.`;

  switch (reason) {
    case 'Coupon not found':
      return 'We do not recognise that code. Check the spelling and try again.';
    case 'Coupon is not active yet':
      return 'That code is not active yet.';
    case 'Coupon has expired':
      return 'That code has expired.';
    case 'Coupon applies to subscriptions only':
      return 'That code is for subscriptions only.';
    case 'Coupon usage limit reached':
      return 'That code has been fully redeemed.';
    case 'You have already used this offer':
      return 'You have already used this offer on this account.';
    case 'Offer is for your first subscription only':
      return 'That offer is for a first subscription, and this account already has one.';
    case 'Offer does not apply to this plan':
      return 'That offer does not cover this plan.';
    case 'Offer does not apply to this channel':
      return 'That offer is not valid on the website.';
    case 'Offer is not available on this account':
      return 'That offer is not available on this account.';
    case 'Offer is for new customers only':
      return 'That offer is for new customers only.';
    default:
      return reason;
  }
}

/** One code, as the customer types it: case and spaces do not matter. */
export function normaliseCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}
