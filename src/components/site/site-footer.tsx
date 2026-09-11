import Link from 'next/link';
import { Suspense } from 'react';
import type { Route } from 'next';
import { byPriceAscending, listPlans } from '@/lib/data/catalog';
import { CONTACT } from './contact';
import { InstagramIcon, MailIcon, WhatsAppIcon } from './icons';
import { FooterTopButton } from './scroll-top';
import { LEGAL_NAV, SITE_NAV } from './nav';

/**
 * The storefront footer.
 *
 * The one dark band on the storefront, in the green the hero's bowl panel is
 * painted in, so the page opens and closes on the same colour. Four rows, top
 * to bottom: how to reach the kitchen beside where to go next, a rule that runs
 * into the one action, the fine print, and the name set wider than the window
 * and cut off by the bottom of it.
 *
 * It is a server component with one read in it, and that read is the plans
 * column. `listPlans` is the same cached catalog read the home page makes, so
 * the column costs the shell nothing and it goes the way `OfferBar` goes: it
 * does its own read rather than being handed one, so the layout above it still
 * awaits nothing.
 *
 * Nothing here is typed out any more. The footer used to write its blurb and a
 * sign-off one letter at a time, and that was the right call for a footer that
 * was mostly prose. This one is mostly places to go, and the name across the
 * bottom is now the closing gesture -- a typewriter running above it would be
 * two endings competing for the last second of the page.
 */

/**
 * Where a customer goes once they have one.
 *
 * Separate from `SITE_NAV` for the reason `LEGAL_NAV` is: those are the
 * kitchen's pages and these are the visitor's own. Sign-in sits first because
 * it is the only one of the four an anonymous visitor can use, and anonymous is
 * most of the traffic.
 */
const ACCOUNT_NAV: readonly { href: Route; label: string }[] = [
  { href: '/sign-in', label: 'sign in' },
  { href: '/account', label: 'your account' },
  { href: '/account/addresses', label: 'delivery addresses' },
  { href: '/account/refunds', label: 'refunds' },
];

/**
 * The three ways to reach somebody, as marks.
 *
 * The accessible name carries the value as well as the channel. A screen
 * reader landing on a circle that says only "WhatsApp" has to go and find out
 * what the number is; "WhatsApp +91 98803 70731" is the whole answer.
 */
const REACH = [
  {
    href: CONTACT.whatsappHref,
    label: `WhatsApp ${CONTACT.whatsappDisplay}`,
    Icon: WhatsAppIcon,
    external: true,
  },
  {
    href: CONTACT.instagramHref,
    label: `Instagram ${CONTACT.instagramHandle}`,
    Icon: InstagramIcon,
    external: true,
  },
  {
    href: `mailto:${CONTACT.email}`,
    label: `Email ${CONTACT.email}`,
    Icon: MailIcon,
    external: false,
  },
] as const;

/**
 * One column of links, in lower case.
 *
 * Lowered here, where the footer renders them, and written into the text rather
 * than applied with `text-transform` -- for the reason the home page's headings
 * give: what a screen reader announces should be what the page shows. The
 * shared lists keep their capitals because the header's menu sheet reads
 * `SITE_NAV` too, and this is the footer's voice, not the site's.
 */
function FooterNav({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: readonly { href: Route; label: string }[];
}) {
  return (
    /* `aria-labelledby` rather than `aria-label`, so the landmark's name is
       the heading already on screen -- two names for one thing is how a screen
       reader ends up announcing "Footer navigation, explore". */
    <nav aria-labelledby={id}>
      <h2 id={id} className="footer-heading">
        {title}
      </h2>
      <ul className="footer-list">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="footer-link">
              {item.label.toLowerCase()}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The kitchen's plans by name, cheapest first.
 *
 * Four, sorted before slicing for the reason the home page's notes are: the
 * first four by `sort_order` put in price order would look like the range on
 * offer without being it. No plans, no column -- the grid it sits in is
 * `auto-fit`, so the other two close up rather than leaving a gap.
 */
async function FooterPlans() {
  const plans = byPriceAscending(await listPlans()).slice(0, 4);
  if (plans.length === 0) return null;

  return (
    <nav aria-labelledby="footer-plans">
      <h2 id="footer-plans" className="footer-heading">
        plans
      </h2>
      <ul className="footer-list">
        {plans.map((plan) => (
          <li key={plan.id}>
            <Link href={`/subscriptions/${plan.slug}`} className="footer-link">
              {plan.name.toLowerCase()}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * What the plans column shows while its read is outstanding: the heading, and
 * one link to where every plan is. The same heading and the same column, so the
 * three-across grid does not fold to two and back when the names land.
 */
function FooterPlansFallback() {
  return (
    <nav aria-labelledby="footer-plans">
      <h2 id="footer-plans" className="footer-heading">
        plans
      </h2>
      <ul className="footer-list">
        <li>
          <Link href="/subscriptions" className="footer-link">
            all plans
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="landing-container mx-auto max-w-6xl px-4 pt-16 sm:pt-20">
        <div className="footer-top">
          <div>
            <ul className="footer-socials" aria-label="Get in touch">
              {REACH.map(({ href, label, Icon, external }) => (
                <li key={href}>
                  <a
                    href={href}
                    aria-label={label}
                    className="footer-social"
                    {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                  >
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>

            {/* Written out as well as behind the circles, because a mark is
                something to tap and a number is something to read -- and to
                save, by somebody who would rather write to us later. */}
            <address className="footer-details">
              <a
                href={CONTACT.whatsappHref}
                className="footer-detail tabular"
                target="_blank"
                rel="noreferrer"
              >
                {CONTACT.whatsappDisplay}
              </a>
              <a href={`mailto:${CONTACT.email}`} className="footer-detail break-all">
                {CONTACT.email}
              </a>
            </address>
          </div>

          <div className="footer-columns">
            <FooterNav id="footer-explore" title="explore" items={SITE_NAV} />
            {/* Its own boundary, for the reason `OfferBar` has one in the
                layout: this is the layout's other data read, and on a route
                whose render waits on `params` it must not be held to that
                wait. Cached, so it is normally in the first HTML anyway. */}
            <Suspense fallback={<FooterPlansFallback />}>
              <FooterPlans />
            </Suspense>
            <FooterNav id="footer-account" title="your account" items={ACCOUNT_NAV} />
          </div>
        </div>

        {/* The same destination as the header's "Start a plan", in the
            lower case every other closing action on the home page uses. */}
        <div className="footer-rule">
          <span className="footer-rule-line" aria-hidden />
          <Link href="/subscriptions" className="footer-cta">
            start a plan
          </Link>
        </div>

        <div className="footer-base">
          <div>
            <p className="footer-blurb">
              Home food, at home&rsquo;s pace. One kitchen, one small menu, cooked fresh each
              morning and sent out while it is still warm.
            </p>
            <p className="footer-fine">
              Prices include applicable taxes shown at checkout. Delivery windows and fees
              are set by the kitchen and may change.
            </p>
          </div>

          <div className="footer-base-end">
            <nav aria-label="Legal" className="footer-legal">
              {LEGAL_NAV.map((item) => (
                <Link key={item.href} href={item.href} className="footer-legal-link">
                  {item.label.toLowerCase()}
                </Link>
              ))}
            </nav>

            {/* The floating back-to-top button hands over to this one while it
                is on screen, so nothing floats over the name below. */}
            <FooterTopButton />
          </div>
        </div>
      </div>

      {/* Decoration: the footer already says whose it is. See `.footer-giant`
          for the crop and the rise. */}
      <p className="footer-giant" aria-hidden>
        <span>infinity kitchens</span>
      </p>
    </footer>
  );
}
