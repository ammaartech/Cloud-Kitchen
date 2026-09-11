import { Suspense } from 'react';
import '@/components/site/landing.css';
import { OfferBar } from '@/components/site/offer-bar';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { ScrollTopButton } from '@/components/site/scroll-top';

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
          kitchen has no offer running.

          Its own `<Suspense>`, because this layout sits above every storefront
          route, the plan pages included, and a plan page's render waits on its
          `params`. A read the layout awaits outside any boundary is held to that
          wait too, and Next's instant-navigation check reports it as uncached
          data blocking the route. The boundary lets the shell go without it.
          The read is cached, so wherever the cache is warm the strip is still
          in the first HTML and the fallback -- nothing -- never shows. */}
      <Suspense fallback={null}>
        <OfferBar />
      </Suspense>

      <SiteHeader />

      <main className="flex-1">{children}</main>

      {/* Its plans column reads the catalog the way `OfferBar` reads offers:
          on its own, cached, so this function still has nothing to await. */}
      <SiteFooter />

      {/* Last in the shell, and outside `<main>` on purpose: it is a control
          for the page rather than part of its content, so it belongs after the
          landmark in the reading order the same way it sits over the corner in
          the visual one. It renders on every storefront route because every one
          of them is long enough to need it. */}
      <ScrollTopButton />
    </>
  );
}
