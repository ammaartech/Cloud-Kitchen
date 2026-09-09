'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { cx } from '@/components/ui/primitives';
import { RANGE_KEYS, RANGE_LABELS, DEFAULT_RANGE, type RangeKey } from '@/app/admin/analytics/_lib/filters';

/**
 * Date-range filter as a row of chip-shaped links. Each chip is a real `<a>`,
 * so click-through, deep-links and open-in-new-tab all behave. The active
 * chip is derived from the URL, not from state, so hitting Back returns the
 * page to the range you were looking at.
 */
export function RangeChips() {
  const pathname = usePathname() ?? '/admin/analytics';
  const params = useSearchParams();
  const activeRange = (params?.get('range') ?? DEFAULT_RANGE) as RangeKey;
  const category = params?.get('category');

  return (
    <nav aria-label="Date range" className="flex flex-wrap items-center gap-2">
      {RANGE_KEYS.map((key) => {
        const isActive =
          key === activeRange ||
          (activeRange === DEFAULT_RANGE && !RANGE_KEYS.includes(activeRange));

        const search = new URLSearchParams();
        if (key !== DEFAULT_RANGE) search.set('range', key);
        if (category && category !== 'all') search.set('category', category);
        const href = (
          search.toString() ? `${pathname}?${search.toString()}` : pathname
        ) as Route;

        return (
          <Link
            key={key}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cx(
              'inline-flex h-8 items-center rounded-ck-sm border px-3.5 text-sm font-medium',
              'transition-colors duration-150 ease-ck',
              isActive
                ? 'border-transparent bg-brand text-white'
                : 'border-line bg-surface text-muted hover:bg-sunken hover:text-ink',
            )}
          >
            {RANGE_LABELS[key]}
          </Link>
        );
      })}
    </nav>
  );
}
