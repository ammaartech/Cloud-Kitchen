/**
 * Business-day arithmetic for the KOT screens.
 *
 * The business timezone is Asia/Kolkata (PRD 10). Lives in a plain module --
 * not a `'use client'` one -- so it can be called from both server components
 * and client components without Next's boundary checker mistaking it for a
 * client reference.
 */

const BUSINESS_TIMEZONE = 'Asia/Kolkata';

/** `YYYY-MM-DD`, and nothing else: the only shape a date in a URL may take. */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** IST-today as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  // `en-CA` is the locale whose short date is already ISO ordered.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * A single IST calendar day expressed as a half-open UTC range, so a
 * `[start, end)` filter matches every timestamp that belongs to the business
 * day the manager picked, regardless of the Postgres session timezone or the
 * browser's own.
 */
export function istDayRange(dateISO: string): { startUtc: string; endUtc: string } {
  const start = new Date(`${dateISO}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}
