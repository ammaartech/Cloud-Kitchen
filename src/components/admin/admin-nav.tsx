'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { cx } from '@/components/ui/primitives';

/**
 * Admin section nav.
 *
 * Client-side only so the current section can be highlighted -- with eleven
 * destinations, "where am I" stops being obvious from the page heading alone.
 * The list it renders has already been filtered by permission on the server;
 * this component never decides what anyone may reach.
 */
export function AdminNav({
  sections,
  orientation = 'vertical',
}: {
  sections: Array<{ href: Route; label: string }>;
  orientation?: 'vertical' | 'horizontal';
}) {
  const pathname = usePathname() ?? '';
  const isVertical = orientation === 'vertical';

  return (
    <nav
      className={cx(
        isVertical
          ? 'flex w-full flex-col items-stretch gap-0.5'
          : 'flex flex-1 flex-wrap gap-1',
      )}
      aria-label="Admin sections"
    >
      {sections.map((section) => {
        // '/admin' is a prefix of everything, so the overview matches exactly.
        const active =
          section.href === '/admin' ? pathname === '/admin' : pathname.startsWith(section.href);

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'rounded-ck text-sm font-medium transition-colors',
              isVertical ? 'block w-full px-3 py-2' : 'px-3 py-1.5',
              active
                ? 'bg-brand-soft text-brand'
                : 'text-muted hover:bg-sunken hover:text-ink',
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
