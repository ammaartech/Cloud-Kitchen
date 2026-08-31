/**
 * Presentation helpers.
 *
 * The business timezone is Asia/Kolkata (PRD 10) and the database computes the
 * business day. These formatters render in that zone so a ticket created at
 * 00:30 IST never displays under the previous day.
 */

export const BUSINESS_TIMEZONE = 'Asia/Kolkata';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const currencyWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/**
 * Formats money. Accepts the strings Postgres returns for `numeric` -- passing
 * those through Number() at the call site is where rounding bugs start.
 */
export function money(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  return Number.isInteger(n) ? currencyWhole.format(n) : currency.format(n);
}

/** For a column of figures where the decimals should align. */
export function moneyExact(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isNaN(n) ? '—' : currency.format(n);
}

export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: BUSINESS_TIMEZONE,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

export function dateOnly(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: BUSINESS_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

export function timeOnly(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: BUSINESS_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

/** "07:30:00" from a Postgres `time` column -> "7:30 am". */
export function clockTime(value: string | null | undefined): string {
  if (!value) return '—';
  const [h, m] = value.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Durations from the analytics views, which report whole seconds. */
export function duration(seconds: number | string | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  const total = Math.round(typeof seconds === 'string' ? Number(seconds) : seconds);
  if (Number.isNaN(total)) return '—';
  if (total < 60) return `${total}s`;

  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/**
 * Relative time for the operational screens: how long a ticket has been
 * waiting is more useful mid-rush than the clock time it arrived.
 */
export function elapsedSince(value: string | Date | null | undefined, now = Date.now()): string {
  if (!value) return '—';
  const then = new Date(value).getTime();
  const seconds = Math.max(0, Math.round((now - then) / 1000));

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** Signed countdown to a deadline; negative means overdue. */
export function untilDeadline(
  value: string | Date | null | undefined,
  now = Date.now(),
): { label: string; overdue: boolean; minutes: number } | null {
  if (!value) return null;
  const target = new Date(value).getTime();
  const minutes = Math.round((target - now) / 60000);

  if (minutes < 0) return { label: `${Math.abs(minutes)} min over`, overdue: true, minutes };
  if (minutes === 0) return { label: 'due now', overdue: true, minutes };
  return { label: `${minutes} min left`, overdue: false, minutes };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Postgres `extract(dow)` ordering: 0 = Sunday. */
export function weekdayName(dow: number): string {
  return WEEKDAYS[dow] ?? '';
}

export function weekdayList(days: number[] | null | undefined): string {
  if (!days?.length) return 'Every day';
  if (days.length === 7) return 'Every day';

  const sorted = [...days].sort((a, b) => a - b);
  const isWeekdays = sorted.join(',') === '1,2,3,4,5';
  if (isWeekdays) return 'Weekdays';

  return sorted.map(weekdayName).join(', ');
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Source labels. The prefix is always shown; colour is never the only cue. */
export const SOURCE_LABELS: Record<string, string> = {
  SX: 'Website',
  SW: 'Swiggy',
  ZM: 'Zomato',
};

export const KOT_STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for pickup',
  PICKED_UP: 'Picked up',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  active: 'Active',
  paused: 'Paused',
  past_due: 'Payment overdue',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const PLAN_TYPE_LABELS: Record<string, string> = {
  fixed_meals: 'Fixed menu',
  meal_credits: 'Meal credits',
  scheduled_meals: 'Scheduled menu',
  customer_selected: 'You choose',
};
