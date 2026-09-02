import Link from 'next/link';
import { AccountNav } from './account-nav';
import { SITE_NAV } from './nav';

/**
 * Storefront header.
 *
 * One register everywhere. It carried a second, brand-drenched register while
 * the home hero was a colour drench; the hero is light now, so the bar is the
 * same light bar on every route and this can go back to being a server
 * component with no pathname to read.
 *
 * The account controls are a client island. Everything else here -- the mark,
 * both navigations -- is the same markup for every visitor and prerenders into
 * the static shell; only the one corner that depends on *who is asking* waits
 * for the browser. See `account.ts` for why that read moved off the server.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            className="grid h-8 w-8 place-items-center rounded-ck bg-brand text-sm font-bold text-white"
            aria-hidden
          >
            CK
          </span>
          <span className="hidden sm:inline">Cloud Kitchen</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
          {SITE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 ease-ck hover:bg-sunken hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <AccountNav />
      </div>

      {/* Mobile navigation: a scrollable row rather than a hidden menu, so
          every destination stays one tap away. */}
      <nav
        className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 md:hidden"
        aria-label="Main"
      >
        {SITE_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors duration-150 ease-ck hover:bg-sunken hover:text-ink"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
