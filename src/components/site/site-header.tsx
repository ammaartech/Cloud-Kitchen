import Link from 'next/link';
import type { Route } from 'next';
import { ButtonLink } from '@/components/ui/primitives';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { SITE_NAV } from './nav';

/**
 * Storefront header.
 *
 * One register everywhere. It carried a second, brand-drenched register while
 * the home hero was a colour drench; the hero is light now, so the bar is the
 * same light bar on every route and this can go back to being a server
 * component with no pathname to read.
 *
 * The session arrives pre-flattened -- the header needs a name and a
 * destination, not the permission set the layout loaded.
 */
export function SiteHeader({
  account,
}: {
  account: { name: string; href: Route; label: string } | null;
}) {
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

        <div className="ml-auto flex items-center gap-2">
          {account ? (
            <>
              <span className="hidden text-sm text-subtle sm:inline">{account.name}</span>
              <ButtonLink href={account.href} variant="secondary" size="sm">
                {account.label}
              </ButtonLink>
              <SignOutButton />
            </>
          ) : (
            <>
              <ButtonLink
                href="/sign-in"
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
              >
                Sign in
              </ButtonLink>
              <ButtonLink href="/subscriptions" size="sm">
                Start a plan
              </ButtonLink>
            </>
          )}
        </div>
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
