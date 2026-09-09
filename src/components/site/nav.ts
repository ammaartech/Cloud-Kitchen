import type { Route } from 'next';

type NavItem = {
  /** The full page behind the section. What the footer links to. */
  href: Route;
  label: string;
  /**
   * The id of the matching section on the home page, where there is one.
   *
   * Optional, though nothing in this list uses that any more -- Offers was the
   * one item with no section and it has left the list entirely. It is kept
   * optional because the shape is right: an item with no `section` navigates
   * rather than scrolls, and the next page-without-a-section should not have to
   * reintroduce the idea.
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
 * `section` is the part of the home page that answers the same question, and
 * every item here now has one.
 *
 * Offers is not in it. It has no section, it has no place in a footer of four
 * destinations, and the strip above the header says the same thing with the
 * actual discount in it rather than the word "Offers" -- so the word was the
 * weakest of the five links in every list it appeared in. `/offers` is still a
 * route and the strip is still how visitors reach it; that strip only renders
 * when there is an offer running, which is also the only time the page has
 * anything on it.
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
  { href: '/about', label: 'About', section: 'about' },
];

/**
 * The two pages nobody navigates to and every site has to have.
 *
 * A separate list from `SITE_NAV` rather than two more entries in it, because
 * they are a different kind of destination: `SITE_NAV` is where the kitchen
 * wants you to go, and this is where you go when you need to check something.
 * Mixing them puts "Terms" at the same weight as "Menu" in every list that
 * renders `SITE_NAV`, which is how a footer ends up with seven equal links and
 * no order to them. The footer sets these smaller, in the bottom row, beside
 * the line about taxes -- which is the company talking about itself, and so is
 * this.
 */
export const LEGAL_NAV: readonly { href: Route; label: string }[] = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms & Conditions' },
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
  { label: 'How it works', section: 'how-it-works' },
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
