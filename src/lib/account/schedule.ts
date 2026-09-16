import { addDays, calendarDate, dayOfWeek } from '@/lib/checkout/schedule';
import { weekdayName } from '@/lib/format';

/**
 * The customer's delivery calendar, as the account overview reads it.
 *
 * Everything here is arithmetic on rows the database already returned -- no
 * clock of its own, no guesses. Dates are `YYYY-MM-DD` business dates (the
 * kitchen's, in IST) and instants are ISO strings, and every function takes
 * "today" or "now" as an argument so the whole module can be tested at a fixed
 * moment and cannot drift from the server that rendered the page.
 *
 * Kept free of React and of Supabase so the page, its client islands and the
 * tests all read the same answers.
 */

/** The kitchen's fixed offset. India has no daylight saving, so this never moves. */
const BUSINESS_OFFSET = '+05:30';

export type UpcomingDelivery = {
  id: string;
  date: string;
  status: 'scheduled' | 'released' | 'skipped';
  windowLabel: string;
  /** `HH:MM:SS`, the window's opening. */
  windowStartsAt: string;
  creditsCost: number;
  items: Array<{ name: string; quantity: number }>;
  kitchenStatus: string | null;
  ticketCode: string | null;
  prepEtaMinutes: number | null;
  /**
   * When the kitchen takes the delivery and it can no longer be skipped. Only
   * set while it is still `scheduled`; null once there is nothing to lock.
   */
  locksAt: string | null;
};

export type PauseRange = { startsOn: string; endsOn: string };

export type ScheduleDayKind = 'kitchen' | 'delivery' | 'skipped' | 'paused' | 'rest';

export type ScheduleDay = {
  date: string;
  /** "Thu" */
  weekday: string;
  dayOfMonth: number;
  isToday: boolean;
  kind: ScheduleDayKind;
  /** The deliveries on this date that are still going to arrive. */
  deliveryIds: string[];
  /** The last day of the paid cycle, marked so the strip can say where it stops. */
  isCycleEnd: boolean;
};

/**
 * The moment a scheduled delivery is released to the kitchen.
 *
 * `release_due_deliveries` takes a delivery once its window opens within the
 * release lead time, so this is the same sum the server does:
 * `(date + window start) at IST - lead`. After it, a skip is refused.
 */
export function lockInstant(date: string, windowStartsAt: string, leadMinutes: number): string {
  const opens = new Date(`${date}T${windowStartsAt.slice(0, 8)}${BUSINESS_OFFSET}`).getTime();
  return new Date(opens - leadMinutes * 60_000).toISOString();
}

/** "Today", "Tomorrow", or "Thu, 17 Sept" -- relative only where it is unambiguous. */
export function relativeDay(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return calendarDate(date);
}

/** "10:30 am" for an instant, on the kitchen's clock. */
export function kitchenTime(instant: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(instant))
    .replace(/\s?([AP])M$/i, (_, m: string) => ` ${m.toLowerCase()}m`);
}

/** The business date an instant falls on. */
function kitchenDate(instant: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}

/**
 * How long a delivery can still be skipped, as a sentence fragment:
 * "until 10:30 am today", "until 10:30 am tomorrow", "until 10:30 am, Thu 17 Sept".
 * Null once the moment has passed, so the caller can stop offering the skip
 * rather than offering one the server will refuse.
 */
export function skipDeadline(locksAt: string | null, now: Date, today: string): string | null {
  if (!locksAt) return null;
  if (new Date(locksAt).getTime() <= now.getTime()) return null;

  const day = kitchenDate(locksAt);
  const time = kitchenTime(locksAt);
  if (day === today) return `until ${time} today`;
  if (day === addDays(today, 1)) return `until ${time} tomorrow`;
  return `until ${time}, ${calendarDate(day)}`;
}

function inPause(date: string, pauses: PauseRange[]): boolean {
  return pauses.some((pause) => date >= pause.startsOn && date <= pause.endsOn);
}

/**
 * The next `span` days from today, each classified by what happens on it.
 *
 * Precedence is by what the customer most needs to know: a meal already with
 * the kitchen, then one still coming, then a skip, then a pause, then nothing.
 * A skipped delivery inside a pause is shown as the pause -- the customer did
 * one thing, and the calendar should say that thing, not its side effect.
 */
export function buildSchedule({
  today,
  span = 14,
  deliveries,
  pauses,
  cycleEnd,
}: {
  today: string;
  span?: number;
  deliveries: UpcomingDelivery[];
  pauses: PauseRange[];
  cycleEnd: string | null;
}): ScheduleDay[] {
  return Array.from({ length: span }, (_, offset) => {
    const date = addDays(today, offset);
    const onDay = deliveries.filter((delivery) => delivery.date === date);
    const live = onDay.filter((delivery) => delivery.status !== 'skipped');
    const paused = inPause(date, pauses);

    let kind: ScheduleDayKind = 'rest';
    if (onDay.some((delivery) => delivery.status === 'released')) kind = 'kitchen';
    else if (live.length > 0) kind = 'delivery';
    else if (paused) kind = 'paused';
    else if (onDay.length > 0) kind = 'skipped';

    return {
      date,
      weekday: weekdayName(dayOfWeek(date)).slice(0, 3),
      dayOfMonth: Number(date.slice(8, 10)),
      isToday: offset === 0,
      kind,
      deliveryIds: live.map((delivery) => delivery.id),
      isCycleEnd: date === cycleEnd,
    };
  });
}

/** Whole days from `from` to `to`, counting both ends. */
export function daysInclusive(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * What a pause over `[from, to]` would do, read off the deliveries on screen:
 * how many would be skipped, the credits that would come back, and the first
 * delivery after it. The server does the real work -- this is the preview the
 * customer checks before asking for it.
 */
export type ImpactDelivery = Pick<UpcomingDelivery, 'date' | 'status' | 'creditsCost'>;

export function pauseImpact(
  deliveries: ImpactDelivery[],
  from: string,
  to: string,
  returnsCredits: boolean,
): { skipped: number; credits: number; resumesOn: string | null } {
  const hit = deliveries.filter(
    (delivery) => delivery.status === 'scheduled' && delivery.date >= from && delivery.date <= to,
  );
  const next = deliveries.find((delivery) => delivery.status !== 'skipped' && delivery.date > to);

  return {
    skipped: hit.length,
    credits: returnsCredits ? hit.reduce((sum, delivery) => sum + delivery.creditsCost, 0) : 0,
    resumesOn: next?.date ?? null,
  };
}

/** How far through the paid cycle today is. */
export function cycleProgress(
  start: string | null,
  end: string | null,
  today: string,
): { ratio: number; daysLeft: number; totalDays: number } | null {
  if (!start || !end) return null;
  const totalDays = daysInclusive(start, end);
  if (totalDays <= 0) return null;

  const elapsed = Math.min(Math.max(daysInclusive(start, today) - 1, 0), totalDays);
  return {
    ratio: elapsed / totalDays,
    daysLeft: Math.max(daysInclusive(today, end), 0),
    totalDays,
  };
}

/**
 * Where a released delivery is, as one of five steps a customer understands.
 * The KOT's own states are an operational vocabulary; "handed off" and "ready
 * for pickup" are the same moment to somebody waiting for lunch.
 */
export const KITCHEN_STEPS = ['With the kitchen', 'Cooking', 'Packed', 'On the way', 'Delivered'] as const;

export function kitchenStep(status: string | null): number | null {
  switch (status) {
    case 'NEW':
    case 'ACCEPTED':
      return 0;
    case 'PREPARING':
      return 1;
    case 'READY_FOR_PICKUP':
    case 'PICKED_UP':
      return 2;
    case 'OUT_FOR_DELIVERY':
      return 3;
    case 'DELIVERED':
      return 4;
    default:
      return null;
  }
}
