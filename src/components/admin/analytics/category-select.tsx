'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { Select } from '@/components/ui/primitives';

/**
 * Category filter. A `<select>` that navigates the page on change, so filter
 * state lives on the URL and the server component re-renders with the new
 * scope. `router.replace` (not `push`) keeps the browser history clean.
 */
export function CategorySelect({ options }: { options: Array<{ slug: string; name: string }> }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/admin/analytics';
  const params = useSearchParams();
  const current = params?.get('category') ?? 'all';

  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="sr-only">Category</span>
      <Select
        className="h-8 py-0"
        value={current}
        onChange={(event) => {
          const next = event.target.value;
          const search = new URLSearchParams(params?.toString() ?? '');
          if (next === 'all') search.delete('category');
          else search.set('category', next);
          const qs = search.toString();
          router.replace((qs ? `${pathname}?${qs}` : pathname) as Route, { scroll: false });
        }}
      >
        {options.map((option) => (
          <option key={option.slug} value={option.slug}>
            {option.name}
          </option>
        ))}
      </Select>
    </label>
  );
}
