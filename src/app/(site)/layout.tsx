import Link from 'next/link';
import '@/components/site/landing.css';
import { OfferBar } from '@/components/site/offer-bar';
import { SiteHeader } from '@/components/site/site-header';
import { ScrollTopButton } from '@/components/site/scroll-top';
import { LEGAL_NAV, SITE_NAV } from '@/components/site/nav';
import { CONTACT } from '@/components/site/contact';
import { Typewriter } from '@/components/site/step-flow';
import { typedLengthOf } from '@/components/site/typing';
import { InstagramIcon, MailIcon, WhatsAppIcon } from '@/components/site/icons';

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
/**
 * The footer's three typed lines, and the pace they are typed at.
 *
 * Held here rather than inline because the delays are a sum: each line has to
 * wait for the ones above it to finish, and that arithmetic only works if the
 * strings and the step are in one place. Editing a sentence changes how long
 * the next one waits, which is a thing that should happen automatically rather
 * than by remembering to update a number.
 *
 * `BODY_STEP` is roughly half the heading pace `Typewriter` defaults to. Two
 * hundred and thirty characters at the heading's 46ms is ten seconds of
 * somebody watching a paragraph they could have read in three, and the point of
 * typing the footer out is that it reads like a note being written, not that it
 * is slow.
 *
 * The sign-off keeps the slower default. It is six words, it is the line the
 * whole band is built around, and it is the one place a deliberate pace is the
 * effect rather than a delay.
 */
const BODY_STEP = 24;

const FOOTER_LINES = [
  "Home food, at home's pace. One kitchen, one small menu, cooked fresh each morning and sent out while it is still warm.",
  'No central warehouse, no reheating. Just the same food we cook for ourselves, made for a few more people.',
] as const;

const SIGN_OFF = 'Cooked this morning. Eaten today.';

/* Where each line starts, measured from the moment the band is seen. */
const LINE_AT = [
  0,
  typedLengthOf(FOOTER_LINES[0]) * BODY_STEP,
] as const;

const SIGN_OFF_AT = LINE_AT[1] + typedLengthOf(FOOTER_LINES[1]) * BODY_STEP;

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

      {/* --------------------------------------------------------------- */}
      {/* The closing note                                                  */}
      {/* --------------------------------------------------------------- */}
      {/* Three columns and a rule, and the copy is where the work went.

          What was here read like a company describing its category: "no
          dark-store sprawl, no thousand-item catalogue" is an argument against
          competitors, made in their vocabulary, at the bottom of a page whose
          whole claim is that the food tastes like somebody made it at home.
          Nobody ends a meal thinking about dark stores. The footer is the last
          thing read and it should sound like the kitchen, not like a pitch
          deck -- so it says what the kitchen does, in the words a person would
          use, and the sign-off above the rule is the thing you would actually
          say handing over a tiffin.

          Contact is a column rather than a line, because three ways to reach
          somebody written as a sentence is three things nobody can tap. */}
      <footer className="site-footer border-t border-line bg-surface">
        <div className="landing-container mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <div className="grid gap-10 sm:grid-cols-2 sm:gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <p className="wordmark">INFINITY KITCHENS</p>
              {/* Typed out rather than simply present, and the footer is the
                  one place on the site where that is not a gimmick: somebody
                  who has scrolled this far has read everything else, so there
                  is no cost to making the last thing they see take a few
                  seconds to arrive. `Typewriter` keeps an `sr-only` copy of
                  each line, so nothing here is hidden from a reader who is not
                  watching it happen.

                  The delays chain -- see `LINE_AT` above. Without them all
                  three cross their own thresholds in the same frame and type
                  at once, which reads as three machines rather than one. */}
              <p className="footer-blurb mt-4">
                <Typewriter text={FOOTER_LINES[0]} delay={LINE_AT[0]} step={BODY_STEP} />
              </p>
              <p className="footer-blurb mt-3">
                <Typewriter text={FOOTER_LINES[1]} delay={LINE_AT[1]} step={BODY_STEP} />
              </p>
            </div>

            {/* `aria-labelledby` rather than `aria-label`, so the accessible
                name of the landmark is the heading that is already on screen.
                Two names for one thing is how a screen reader ends up
                announcing "Footer navigation, Explore". */}
            <nav aria-labelledby="footer-explore">
              <h2 id="footer-explore" className="footer-heading">
                Explore
              </h2>
              <ul className="footer-list">
                {SITE_NAV.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="footer-link">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <h2 className="footer-heading">Contact us</h2>
              <ul className="footer-list">
                <li>
                  {/* The number is the label. "Message us on WhatsApp" would
                      be one more thing to tap through to find out what it is,
                      and a number on screen can be saved by somebody who would
                      rather write to us later. */}
                  <a
                    href={CONTACT.whatsappHref}
                    className="footer-contact"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <WhatsAppIcon className="footer-contact-icon" />
                    <span className="tabular">{CONTACT.whatsappDisplay}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={CONTACT.instagramHref}
                    className="footer-contact"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <InstagramIcon className="footer-contact-icon" />
                    <span>{CONTACT.instagramHandle}</span>
                  </a>
                </li>
                <li>
                  <a href={`mailto:${CONTACT.email}`} className="footer-contact">
                    <MailIcon className="footer-contact-icon" />
                    <span className="break-all">{CONTACT.email}</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* The sign-off sits above the rule, with the food, rather than
              below it with the tax notice. Everything under that line is the
              company talking; everything above it is the kitchen. */}
          <div className="mt-12">
            <p className="footer-signoff">
              <Typewriter text={SIGN_OFF} delay={SIGN_OFF_AT} />
            </p>
            {/* Signed the way the kitchen signs everything else: the wordmark,
                not the words. A dash and a name would be a fourth typeface
                decision at the bottom of a band that already has three, and
                the mark is the signature -- it is on the bar, on the poster and
                on the packaging. Set small and muted so it closes the note
                rather than reopening it. */}
            <p className="footer-signature">INFINITY KITCHENS</p>
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <p className="text-xs text-subtle text-pretty">
              Prices include applicable taxes shown at checkout. Delivery
              windows and fees are set by the kitchen and may change.
            </p>

            <nav aria-label="Legal" className="flex shrink-0 items-center gap-5">
              {LEGAL_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-xs whitespace-nowrap text-subtle hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
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
