import type { Route } from 'next';

type NavItem = {
  /** The full page behind the section. What the footer links to. */
  href: Route;
  label: string;
  /**
   * The id of the matching section on the home page, where there is one.
   *
   * Optional again, and Offers is why. Its section is gone -- the strip above
   * the header already carries the running discount and the code, so a band
   * further down repeating it in a card was the same offer twice on one page.
   * The page behind it is still there, still linked from the strip and the
   * footer, and it is now the only way to that content: an item with no
   * `section` navigates rather than scrolls.
   */
  section?: string;
};

/**
 * Everywhere the storefront goes.
 *
 * The full list, and the footer's list. It is no longer the header's -- see
 * `HEADER_NAV` and `HERO_NAV` below for why those are two smaller lists now
 * rather than this one rendered twice.
 *
 * `section` is the part of the home page that answers the same question, where
 * the home page has one. Offers does not any more -- see the type above.
 *
 * The pages did not go anywhere and that is deliberate. A single page is the
 * better *first* visit: everything the kitchen offers is one scroll away and
 * nothing asks the visitor to commit to a click before they have seen what is
 * behind it. It is a worse home for the detail -- the full menu is a searchable
 * grid of everything cooked, and folding that into the front page would bury
 * the plans under it. So the section is the summary and the page is the whole
 * thing, the section links onward to it, and every existing URL, deep link and
 * search result still resolves.
 */
export const SITE_NAV: readonly NavItem[] = [
  { href: '/menu', label: 'Menu', section: 'menu' },
  { href: '/subscriptions', label: 'Subscriptions', section: 'plans' },
  { href: '/offers', label: 'Offers' },
  { href: '/about', label: 'About', section: 'about' },
];

/**
 * The four that live in the hero, and the one list here that is purely anchors.
 *
 * The header carries no navigation at all now. It used to hold all five, which
 * on a site whose entire content is one scrollable page is five ways of saying
 * "scroll down"; then one, when the wordmark took the middle of the bar; now
 * none. What is left up there is the mark and the two account actions -- who
 * you are and what you can do -- and "Start a plan" is a better link to the
 * plans than the word "Subscriptions" was, because it says what pressing it
 * does.
 *
 * Offers is the exception that went somewhere else again: it is the strip above
 * the header, which says the same thing with the actual discount in it instead
 * of the word "Offers".
 *
 * Above the headline, which is a stronger position than the header gave them
 * and a quieter one at the same time: a visitor reads down from the top, so the
 * first line they meet is three words rather than a bar of five they have to
 * scan and dismiss before reaching the sentence that says what this is.
 *
 * These carry a `section` and no `href`, which is a different shape from
 * `SITE_NAV` on purpose rather than by omission. Every one of them scrolls, so
 * there is no page for them to name -- and "Meal Plans" in particular has no
 * page at all any more. It used to have one; that page's front half was the
 * delivery windows, which the hero already ends on, and its back half was a
 * second grid of the same dishes the menu section shows. What was left worth
 * reading was the plans, and the plans have their own section. So the label
 * survives as the word people look for and points at the section that answers
 * it.
 *
 * That does mean "Meal Plans" here and "Subscriptions" in the header both land
 * on `#plans`. They are two names for one thing and this site has always used
 * both; having each appear once, in a different part of the page, is better
 * than picking a winner and leaving half the visitors searching for a word that
 * is not there.
 */
export const HERO_NAV: readonly { label: string; section: string }[] = [
  { label: 'Menu', section: 'menu' },
  { label: 'Meal Plans', section: 'plans' },
  { label: 'Subscriptions', section: 'plans' },
  { label: 'About', section: 'about' },
];

/**
 * Every section the home page can be scrolled to, in the order they appear on
 * it.
 *
 * Neither nav list can stand in for this. They are in their own orders rather
 * than the page's, and the page has a section no nav item points at -- "How a
 * subscription works" is worth scrolling past and not worth a link, because
 * nobody arrives looking for it by name.
 *
 * The scroll-spy in `site-header.tsx` observes this list; the header and the
 * hero light up whichever of their items shares a `section` with the one in
 * view.
 */
export const SECTIONS: readonly string[] = [
  'top',
  'plans',
  'how-it-works',
  'menu',
  'about',
];
