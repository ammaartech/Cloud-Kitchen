import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { landingPathForRole } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/primitives';
import { SignOutButton } from '@/components/auth/sign-out-button';

/**
 * Public storefront shell.
 *
 * Navigation is exactly what the PRD specifies: Logo, Home, Menu, Meal Plans,
 * Subscriptions, Offers, About (PRD 6). Menu and Meal Plans are browsing and
 * acquisition surfaces -- there is deliberately no standalone meal checkout.
 */

const NAV = [
  { href: '/menu', label: 'Menu' },
  { href: '/meal-plans', label: 'Meal Plans' },
  { href: '/subscriptions', label: 'Subscriptions' },
  { href: '/offers', label: 'Offers' },
  { href: '/about', label: 'About' },
] as const;

export default async function SiteLayout({ children }: LayoutProps<'/'>) {
  const session = await getSession();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
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
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-ck px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {session ? (
              <>
                <span className="hidden text-sm text-subtle sm:inline">
                  {session.fullName || session.email}
                </span>
                <Link href={landingPathForRole(session.role)}>
                  <Button variant="secondary" size="sm">
                    {session.role === 'customer' ? 'My account' : 'Dashboard'}
                  </Button>
                </Link>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link href="/sign-in" className="hidden sm:block">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/subscriptions">
                  <Button size="sm">Start a plan</Button>
                </Link>
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
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-ck px-3 py-1.5 text-sm font-medium text-muted hover:bg-sunken hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-xs">
              <p className="font-semibold">Cloud Kitchen</p>
              <p className="mt-2 text-sm text-muted">
                One kitchen, cooking a fixed menu each day. No dark-store sprawl, no
                thousand-item catalogue.
              </p>
            </div>

            <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="text-muted hover:text-ink">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <p className="mt-8 border-t border-line pt-6 text-xs text-subtle">
            Prices include applicable taxes shown at checkout. Delivery windows and fees are
            set by the kitchen and may change.
          </p>
        </div>
      </footer>
    </>
  );
}
