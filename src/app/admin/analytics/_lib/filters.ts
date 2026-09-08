/**
 * Analytics filter resolution.
 *
 * The Analytics page and its export route both take the same two query
 * parameters (`range` and `category`) and must translate them into the same
 * business-date window in Asia/Kolkata. Any drift between page and export
 * would let the user download something different from what's on screen -- so
 * both call through here.
 */

const BUSINESS_TIMEZONE = 'Asia/Kolkata';

export const RANGE_KEYS = ['today', 'yesterday', 'last_7', 'last_30', 'all'] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_7: 'Last 7 Days',
  last_30: 'Last 30 Days',
  all: 'All Time',
};

export const DEFAULT_RANGE: RangeKey = 'last_30';

export interface AnalyticsFilters {
  range: RangeKey;
  categorySlug: string | null;
  /** Inclusive business date lower bound, YYYY-MM-DD in IST. `null` = unbounded. */
  startDate: string | null;
  /** Inclusive business date upper bound, YYYY-MM-DD in IST. `null` = unbounded. */
  endDate: string | null;
}

export function parseRange(raw: string | string[] | undefined): RangeKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (RANGE_KEYS as readonly string[]).includes(value ?? '')
    ? (value as RangeKey)
    : DEFAULT_RANGE;
}

export function parseCategory(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value === 'all') return null;
  // Sanity: category slugs are lower-case dashes; refuse anything else so a
  // stray query string can't reach the DB unfiltered.
  return /^[a-z0-9-]+$/.test(value) ? value : null;
}

/**
 * "Today" is the current business date in Asia/Kolkata. All ranges except
 * `all` land on an inclusive [start, end] pair of YYYY-MM-DD strings so the
 * `.gte`/`.lte` filters on `business_date` are one query hop away.
 */
export function resolveFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AnalyticsFilters {
  const range = parseRange(searchParams.range);
  const categorySlug = parseCategory(searchParams.category);

  const today = businessDateIn(BUSINESS_TIMEZONE);
  const yesterday = addDays(today, -1);

  let startDate: string | null;
  let endDate: string | null;

  switch (range) {
    case 'today':
      startDate = today;
      endDate = today;
      break;
    case 'yesterday':
      startDate = yesterday;
      endDate = yesterday;
      break;
    case 'last_7':
      startDate = addDays(today, -6);
      endDate = today;
      break;
    case 'last_30':
      startDate = addDays(today, -29);
      endDate = today;
      break;
    case 'all':
    default:
      startDate = null;
      endDate = null;
      break;
  }

  return { range, categorySlug, startDate, endDate };
}

/** Today's YYYY-MM-DD in the given IANA timezone. */
function businessDateIn(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

function addDays(yyyyMmDd: string, delta: number): string {
  // Parse as UTC so daylight-saving edges don't shift the wall-clock date.
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

/**
 * Serialise filters back to a `?range=…&category=…` fragment for building
 * self-referential links (chip navigation, export button, etc.). Omits `range`
 * when it's the default and `category` when it's `all` so the URL stays clean.
 */
export function filterQueryString(
  filters: Pick<AnalyticsFilters, 'range' | 'categorySlug'>,
): string {
  const parts: string[] = [];
  if (filters.range !== DEFAULT_RANGE) parts.push(`range=${filters.range}`);
  if (filters.categorySlug) parts.push(`category=${encodeURIComponent(filters.categorySlug)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
