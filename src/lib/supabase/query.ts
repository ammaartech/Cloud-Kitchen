import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Small, dependency-free helpers for reading through PostgREST correctly.
 *
 * They exist because of one number: the API caps every response at 1,000 rows
 * (`max_rows` in `supabase/config.toml`, and the hosted default). A query that
 * asks for "all orders in the last 30 days" gets the first thousand and no
 * indication that anything was left out. For a screen that sums those rows
 * into revenue, that is not a slow bug -- it is a wrong number presented with
 * confidence, and it only starts happening once the business is doing well
 * enough for it to matter.
 */

/** What PostgREST hands back from a select: the shape every helper accepts. */
export interface QueryResult {
  data: unknown;
  error: PostgrestError | null;
  count?: number | null;
}

/** A query builder after `.select()`: rangeable, and awaitable. */
export interface RangeableQuery extends PromiseLike<QueryResult> {
  range(from: number, to: number): RangeableQuery;
}

/** Rows per page. Equal to the API's cap so each page is one full response. */
export const PAGE_SIZE = 1000;

export class QueryError extends Error {
  readonly code: string | undefined;

  constructor(context: string, error: PostgrestError) {
    super(`${context}: ${error.message}`);
    this.name = 'QueryError';
    this.code = error.code;
  }
}

/**
 * Unwraps a query result, or throws.
 *
 * Reads on the admin screens used to be written as `result.data ?? []`, which
 * turned a missing view or a broken column into an empty state that looked
 * like "no trading yet". A refused write is reported and never swallowed
 * elsewhere in this app; a failed read is now held to the same rule. The
 * route-level error boundary shows the retry, and the server log carries the
 * message.
 *
 * Note that RLS never produces an error: a caller who may not see a row simply
 * does not get it. So this only ever fires on a genuine failure.
 */
export function rowsOf<Row>(result: QueryResult, context: string): Row[] {
  if (result.error) throw new QueryError(context, result.error);
  return (result.data ?? []) as Row[];
}

/** The `.maybeSingle()` counterpart of `rowsOf`. */
export function rowOf<Row>(result: QueryResult, context: string): Row | null {
  if (result.error) throw new QueryError(context, result.error);
  return (result.data ?? null) as Row | null;
}

/**
 * Reads every row a query matches, however many there are.
 *
 * `makeQuery` must build a *fresh* query each time it is called -- a builder
 * is consumed by the request it makes. Adding `{ count: 'exact' }` to its
 * `.select()` is what lets the pages after the first go out in parallel: the
 * first response says how many rows exist, and the rest are requested at once.
 * Without a count the pages are fetched one after another until a short page
 * arrives, which is still correct, just serial.
 *
 * Always pair the query with a stable `.order()`. Paging an unordered result
 * can repeat or skip rows between pages.
 */
export async function fetchAll<Row>(
  makeQuery: () => RangeableQuery,
  context: string,
): Promise<Row[]> {
  const first = await makeQuery().range(0, PAGE_SIZE - 1);
  const rows = rowsOf<Row>(first, context);

  if (rows.length < PAGE_SIZE) return rows;

  if (typeof first.count === 'number') {
    const pages = Math.ceil(first.count / PAGE_SIZE);
    if (pages <= 1) return rows;

    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, index) => {
        const from = (index + 1) * PAGE_SIZE;
        return makeQuery().range(from, from + PAGE_SIZE - 1);
      }),
    );

    for (const page of rest) rows.push(...rowsOf<Row>(page, context));
    return rows;
  }

  // No count available: walk forward until a page comes back short.
  let from = PAGE_SIZE;
  for (;;) {
    const page = rowsOf<Row>(await makeQuery().range(from, from + PAGE_SIZE - 1), context);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    from += PAGE_SIZE;
  }
}

/**
 * Splits a list into slices small enough to go into an `.in()` filter.
 *
 * PostgREST filters travel in the URL, and a thousand UUIDs is a 40KB query
 * string that a proxy somewhere will refuse. Two hundred is ~7KB, which every
 * hop in front of the database accepts.
 */
export const IN_CHUNK_SIZE = 200;

export function chunk<T>(values: readonly T[], size = IN_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    out.push(values.slice(index, index + size));
  }
  return out;
}
