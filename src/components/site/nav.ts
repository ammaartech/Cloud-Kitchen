import type { Route } from 'next';

/**
 * Storefront navigation, exactly as the PRD specifies: Logo, Home, Menu, Meal
 * Plans, Subscriptions, Offers, About (PRD 6). Shared by the header and the
 * footer so the two can never disagree about what the site contains.
 */
export const SITE_NAV: ReadonlyArray<{ href: Route; label: string }> = [
  { href: '/menu', label: 'Menu' },
  { href: '/meal-plans', label: 'Meal Plans' },
  { href: '/subscriptions', label: 'Subscriptions' },
  { href: '/offers', label: 'Offers' },
  { href: '/about', label: 'About' },
];
