import Link from 'next/link';
import { OfferBar } from '@/components/site/offer-bar';
import { SiteHeader } from '@/components/site/site-header';
import { ScrollTopButton } from '@/components/site/scroll-top';
import { SITE_NAV } from '@/components/site/nav';

/**
 * Public storefront shell.
 *
 * Navigation is exactly what the PRD specifies: Logo, Home, Menu, Meal Plans,
 * Subscriptions, Offers, About (PRD 6). Menu and Meal Plans are browsing and
 * acquisition surfaces -- there is deliberately no standalone meal checkout.
 *
 * This shell awaits nothing, and that is load-bearing rather than incidental.
 * It used to resolve the session here, and that single `cookies()` read was the
 * only reason no storefront route could ever be prerendered -- a cookie read in
 * a layout makes every route beneath it per-request, however static the page
 * below happens to be. `/about` fetches nothing at all and was still rendered
 * from scratch for every visitor because of this function.
 *
 * The header now asks for the identity from the browser after hydration
 * (`components/site/account.ts`), which costs a signed-in visitor one small
 * request and buys every visitor a shell that is already HTML.
 */
export default function SiteLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      {/* Above the header and outside it: it scrolls away, the header does not.
          It is an async server component doing its own read rather than
          something this layout awaits -- see the note above about why this
          function stays synchronous. `listPublicOffers` is cached, so the
          strip costs the route nothing and renders no markup at all when the
          kitchen has no offer running. */}
      <OfferBar />

      <SiteHeader />

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

      {/* Last in the shell, and outside `<main>` on purpose: it is a control
          for the page rather than part of its content, so it belongs after the
          landmark in the reading order the same way it sits over the corner in
          the visual one. It renders on every storefront route because every one
          of them is long enough to need it. */}
      <ScrollTopButton />
    </>
  );
}
