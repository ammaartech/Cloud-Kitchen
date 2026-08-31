'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui/primitives';

/**
 * Sub-navigation for the catalog.
 *
 * Products are the daily work; categories, collections, variant groups and
 * add-ons are the scaffolding a product is assembled from. Keeping them on
 * separate screens means the product editor can stay about one dish.
 */
const TABS = [
  { href: '/admin/catalog', label: 'Products' },
  { href: '/admin/catalog/categories', label: 'Categories' },
  { href: '/admin/catalog/collections', label: 'Collections' },
  { href: '/admin/catalog/variants', label: 'Variant groups' },
  { href: '/admin/catalog/add-ons', label: 'Add-ons' },
] as const;

export function CatalogNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-line pb-3" aria-label="Catalog">
      {TABS.map((tab) => {
        // The product editor lives under /admin/catalog/products/…, which
        // still belongs to the Products tab.
        const active =
          tab.href === '/admin/catalog'
            ? pathname === '/admin/catalog' || pathname.startsWith('/admin/catalog/products')
            : pathname.startsWith(tab.href);

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
