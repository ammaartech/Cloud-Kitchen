import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { landingPathForRole } from '@/lib/auth/permissions';
import { SiteHeader } from '@/components/site/site-header';
import { SITE_NAV } from '@/components/site/nav';

/**
 * Public storefront shell.
 *
 * Navigation is exactly what the PRD specifies: Logo, Home, Menu, Meal Plans,
 * Subscriptions, Offers, About (PRD 6). Menu and Meal Plans are browsing and
 * acquisition surfaces -- there is deliberately no standalone meal checkout.
 *
 * The session is flattened here rather than handed down whole: the header has
 * no business receiving a permission set in order to render a name and a link.
 */
export default async function SiteLayout({ children }: LayoutProps<'/'>) {
  const session = await getSession();

  return (
    <>
      <SiteHeader
        account={
          session
            ? {
                name: session.fullName || session.email || 'Account',
                href: landingPathForRole(session.role),
                label: session.role === 'customer' ? 'My account' : 'Dashboard',
              }
            : null
        }
      />

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
              {SITE_NAV.map((item) => (
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
