'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui/primitives';

/**
 * Customer account navigation (PRD 6).
 *
 * The dashboard itself carries the subscription, deliveries, credits and
 * invoices. Addresses, reviews and refund requests each get their own page so
 * none of them is buried under a plan someone may not even have yet.
 */
const TABS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/reviews', label: 'Reviews' },
  { href: '/account/refunds', label: 'Refunds' },
] as const;

export function AccountNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav className="flex flex-wrap gap-1" aria-label="Account">
      {TABS.map((tab) => {
        const active = tab.href === '/account' ? pathname === '/account' : pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'rounded-ck px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-sunken hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
