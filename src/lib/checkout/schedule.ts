/**
 * When a new subscription's first delivery lands, worked out the way the
 * database will work it out.
 *
 * `begin_subscription_checkout` starts every subscription on the business day
 * after checkout (`app.business_date() + 1`, where the business day is the
 * calendar date in Asia/Kolkata), and `generate_subscription_deliveries` walks
 * forward from that date keeping only the days the customer picked -- an empty
 * list meaning every day. Checkout promises a date rather than a duration,
 * because "Thu, 17 Sept" is something a person can plan a week around and
 * "starts soon" is not. That promise is only honest if this is the same
 * arithmetic, so it is kept here, small and tested, rather than inline in a
 * page.
 *
 * Credit plans have no calendar -- the customer books meals against a balance
 * -- so for them the start date is when the credits become usable, and the
 * caller words it that way.
 */

export const BUSINESS_TIMEZONE = 'Asia/Kolkata';

/** Today's date in the business timezone, as `YYYY-MM-DD`. */
export function businessDate(now: Date = new Date()): string {
  // `en-CA` is the locale whose short date is already ISO ordered.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Calendar arithmetic on a `YYYY-MM-DD` string, done in UTC so no local
 * timezone or daylight-saving rule can move the answer by a day.
 */
function parts(isoDate: string): [number, number, number] {
  const [year, month, day] = isoDate.split('-').map(Number);
  return [year, month, day];
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = parts(isoDate);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Postgres `extract(dow)` ordering: 0 = Sunday. */
export function dayOfWeek(isoDate: string): number {
  const [year, month, day] = parts(isoDate);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The date `begin_subscription_checkout` will write as `starts_on`. */
export function subscriptionStartDate(now: Date = new Date()): string {
  return addDays(businessDate(now), 1);
}

/** The first date on or after the start that is one of the chosen days. */
export function firstDeliveryDate(deliveryDays: number[], now: Date = new Date()): string {
  const start = subscriptionStartDate(now);
  if (deliveryDays.length === 0) return start;

  for (let offset = 0; offset < 7; offset++) {
    const candidate = addDays(start, offset);
    if (deliveryDays.includes(dayOfWeek(candidate))) return candidate;
  }

  // Unreachable with valid days (0-6); the start is the least wrong answer.
  return start;
}

/** "Thu, 17 Sept" for a `YYYY-MM-DD` date, in the site's date locale. */
export function calendarDate(isoDate: string): string {
  const [year, month, day] = parts(isoDate);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
