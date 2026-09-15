import { describe, expect, it } from 'vitest';
import { PostgrestError } from '@supabase/supabase-js';
import {
  PAGE_SIZE,
  QueryError,
  chunk,
  fetchAll,
  rowOf,
  rowsOf,
  type RangeableQuery,
} from '../src/lib/supabase/query';
import {
  DEFAULT_RANGE,
  filterQueryString,
  parseCategory,
  parseRange,
  resolveFilters,
} from '../src/app/admin/analytics/_lib/filters';
import { isOptimisableImage } from '../src/lib/images';

/**
 * The pure helpers the admin screens lean on. None of these touch a database:
 * the PostgREST client is stood in for by a tiny fake that records the ranges
 * it was asked for, which is exactly the contract `fetchAll` has to honour.
 */

interface FakeRow {
  id: number;
}

/** A query source holding `total` rows, served in windows like PostgREST. */
function fakeSource(total: number, options: { withCount?: boolean; cap?: number } = {}) {
  const cap = options.cap ?? PAGE_SIZE;
  const ranges: Array<[number, number]> = [];

  const make = (): RangeableQuery => {
    let from = 0;
    let to = cap - 1;
    const query: RangeableQuery = {
      range(f, t) {
        from = f;
        to = t;
        return query;
      },
      then(onfulfilled, onrejected) {
        ranges.push([from, to]);
        const end = Math.min(to, from + cap - 1, total - 1);
        const data: FakeRow[] = [];
        for (let id = from; id <= end; id += 1) data.push({ id });
        return Promise.resolve({
          data,
          error: null,
          count: options.withCount ? total : null,
        }).then(onfulfilled, onrejected);
      },
    };
    return query;
  };

  return { make, ranges };
}

describe('fetchAll', () => {
  it('returns a short first page as-is with a single request', async () => {
    const source = fakeSource(42);
    const rows = await fetchAll<FakeRow>(source.make, 'test');
    expect(rows).toHaveLength(42);
    expect(source.ranges).toEqual([[0, PAGE_SIZE - 1]]);
  });

  it('pages in parallel when the first response carries a count', async () => {
    const total = PAGE_SIZE * 2 + 17;
    const source = fakeSource(total, { withCount: true });
    const rows = await fetchAll<FakeRow>(source.make, 'test');

    expect(rows).toHaveLength(total);
    expect(rows[0].id).toBe(0);
    expect(rows[total - 1].id).toBe(total - 1);
    expect(source.ranges).toEqual([
      [0, PAGE_SIZE - 1],
      [PAGE_SIZE, PAGE_SIZE * 2 - 1],
      [PAGE_SIZE * 2, PAGE_SIZE * 3 - 1],
    ]);
  });

  it('walks forward until a short page when no count is available', async () => {
    const total = PAGE_SIZE * 2;
    const source = fakeSource(total);
    const rows = await fetchAll<FakeRow>(source.make, 'test');

    expect(rows).toHaveLength(total);
    // An exact multiple needs one extra, empty page to know it is done.
    expect(source.ranges).toHaveLength(3);
  });

  it('never repeats or skips a row across pages', async () => {
    const total = PAGE_SIZE * 3 + 1;
    const source = fakeSource(total, { withCount: true });
    const rows = await fetchAll<FakeRow>(source.make, 'test');
    const ids = new Set(rows.map((row) => row.id));
    expect(ids.size).toBe(total);
  });
});

describe('rowsOf / rowOf', () => {
  const failure = new PostgrestError({
    message: 'relation does not exist',
    code: '42P01',
    details: '',
    hint: '',
  });

  it('unwraps data and substitutes an empty list for null', () => {
    expect(rowsOf<FakeRow>({ data: [{ id: 1 }], error: null }, 'x')).toEqual([{ id: 1 }]);
    expect(rowsOf<FakeRow>({ data: null, error: null }, 'x')).toEqual([]);
    expect(rowOf<FakeRow>({ data: null, error: null }, 'x')).toBeNull();
  });

  it('throws a named error carrying the context and the Postgres code', () => {
    expect(() => rowsOf({ data: null, error: failure }, 'audit_logs')).toThrowError(QueryError);
    try {
      rowOf({ data: null, error: failure }, 'audit_logs');
    } catch (error) {
      expect((error as QueryError).message).toContain('audit_logs');
      expect((error as QueryError).code).toBe('42P01');
    }
  });
});

describe('chunk', () => {
  it('slices into bounded groups and keeps order', () => {
    const values = Array.from({ length: 450 }, (_, i) => i);
    const groups = chunk(values);
    expect(groups.map((g) => g.length)).toEqual([200, 200, 50]);
    expect(groups.flat()).toEqual(values);
    expect(chunk([])).toEqual([]);
  });
});

describe('analytics filters', () => {
  it('falls back to the default range for anything unknown', () => {
    expect(parseRange('today')).toBe('today');
    expect(parseRange(['yesterday', 'today'])).toBe('yesterday');
    expect(parseRange('last_year')).toBe(DEFAULT_RANGE);
    expect(parseRange(undefined)).toBe(DEFAULT_RANGE);
  });

  it('refuses a category slug that is not lower-case dashes', () => {
    expect(parseCategory('mains')).toBe('mains');
    expect(parseCategory('all')).toBeNull();
    expect(parseCategory('Mains')).toBeNull();
    expect(parseCategory('mains,or(1=1)')).toBeNull();
    expect(parseCategory(undefined)).toBeNull();
  });

  it('produces an inclusive window of the right width', () => {
    const seven = resolveFilters({ range: 'last_7' });
    expect(seven.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(seven.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const days =
      (Date.parse(`${seven.endDate}T00:00:00Z`) - Date.parse(`${seven.startDate}T00:00:00Z`)) /
      86_400_000;
    expect(days).toBe(6);

    const all = resolveFilters({ range: 'all' });
    expect(all.startDate).toBeNull();
    expect(all.endDate).toBeNull();
  });

  it('serialises only what differs from the defaults', () => {
    expect(filterQueryString({ range: DEFAULT_RANGE, categorySlug: null })).toBe('');
    expect(filterQueryString({ range: 'today', categorySlug: null })).toBe('?range=today');
    expect(filterQueryString({ range: DEFAULT_RANGE, categorySlug: 'mains' })).toBe(
      '?category=mains',
    );
  });
});

describe('isOptimisableImage', () => {
  it('accepts the allowlisted hosts and our own public folder', () => {
    expect(isOptimisableImage('https://images.unsplash.com/photo-1')).toBe(true);
    expect(
      isOptimisableImage('https://abc.supabase.co/storage/v1/object/public/dishes/a.jpg'),
    ).toBe(true);
    expect(isOptimisableImage('/dishes/dal.jpg')).toBe(true);
  });

  it('refuses everything else rather than letting the optimizer throw', () => {
    expect(isOptimisableImage('https://example.com/a.jpg')).toBe(false);
    expect(isOptimisableImage('http://images.unsplash.com/a.jpg')).toBe(false);
    expect(isOptimisableImage('https://abc.supabase.co/storage/v1/object/sign/x.jpg')).toBe(false);
    expect(isOptimisableImage('//evil.example/a.jpg')).toBe(false);
    expect(isOptimisableImage('not a url')).toBe(false);
  });
});
