'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AccountNav } from './account-nav';
import { HERO_NAV, SITE_NAV, SECTIONS } from './nav';
import { MenuGlyph } from './icons';
import { useActiveSection, useScrolledPast, useScrolledPastElement } from './scroll';
import { buttonClasses, cx } from '@/components/ui/button-styles';

/**
 * The storefront header.
 *
 * Three things were wrong with the version this replaces, and they are worth
 * naming because each one drove a different part of what is here now.
 *
 * **It was two rows on a phone.** The desktop nav was hidden below `md` and a
 * second horizontally-scrolling strip of the same five links was shown under
 * it instead. That cost about 45px of every mobile screen, permanently, on top
 * of the 64px header -- and it scrolled sideways, so "About" sat off the right
 * edge with nothing to say it was there. A row that hides its own contents is
 * worse than a menu: a menu at least admits there is more behind it. It is one
 * row now at every width, and the links move into a sheet.
 *
 * **It never said where you were.** Five links, none of them marked, on a site
 * with five pages. `aria-current` was missing for a screen reader and there was
 * no visual equivalent for anyone else. The active link now carries both.
 *
 * ## Three tracks, and the wordmark owns the middle one
 *
 * The bar is a three-column grid rather than a flex row, and that is the only
 * arrangement that actually centres the mark. In a flex row the logo sits
 * wherever the things either side of it leave it -- which moves as the account
 * actions change between "Sign in / Start a plan" and a name plus a dashboard
 * link, so the wordmark would shift sideways the moment somebody logged in.
 * Equal-width tracks put it on the page's centre line and hold it there
 * whatever the sides are doing.
 *
 * The sides then have to be told to stay in their lanes: the left is
 * `justify-start`, the right `justify-end`, and neither is allowed to grow past
 * its third. That is also why the header can carry only one nav item now -- see
 * `HEADER_NAV`. A five-item nav and a centred logo are both asking for the
 * middle of the bar, and only one of them can have it.
 *
 * **It drew a hard line across the top of the hero.** A border is what
 * separates a header from the content it is floating over -- but at the top of
 * the page it is not floating over anything yet, and the line was cutting the
 * first thing the visitor sees. It arrives when the header starts overlapping
 * content and not before. See `.site-header` in `globals.css`.
 *
 * ## The links scroll rather than navigate
 *
 * Every item points at a section of the home page -- `/#menu`, `/#offers` --
 * because the home page now carries one for each of them. A visitor can see
 * everything the kitchen offers without leaving the page they landed on, which
 * is the whole argument for the shape: a click that navigates asks you to
 * commit before you have seen what is behind it, and a scroll does not.
 *
 * The pages behind them are still there and still linked -- from the bottom of
 * each section and from the footer -- so a deep link, a bookmark and a search
 * result all still resolve. See `nav.ts`.
 *
 * The highlight has two meanings and they are marked differently.
 * `aria-current="page"` is for a visitor actually on `/menu`; `location` is for
 * a visitor on the home page with the menu section under their eye. They are
 * different claims -- one is where you are, the other is what you are looking
 * at -- and a screen reader should not be told the second when it means the
 * first. Both draw the same pill.
 *
 * ## Why this is a client component
 *
 * It was a server component and it is not one any more, which is a real cost on
 * a shell that was deliberately built to be static -- see the note in
 * `(site)/layout.tsx`. Three things need the browser: the pathname, for the
 * active link; the scroll position, for the line; and the menu's open state.
 * The first two have no server-side answer at all on a prerendered page, and
 * the third is an interaction.
 *
 * What it does not cost is a request or a round trip. The markup is still
 * rendered on the server and streamed as HTML; this hydrates it in place.
 * `AccountNav` inside it was already a client component, so the boundary moved
 * up the tree rather than appearing where there was none.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);

  /*
   * The menu's state is the route it was opened on, not a boolean, and that is
   * what closes it on navigation.
   *
   * The obvious version is a boolean plus an effect that sets it back to false
   * whenever the pathname changes -- and it is wrong twice. Next.js does not
   * remount this header between storefront routes, so without *something* the
   * sheet stays open over the page the visitor just asked for; but a `setState`
   * inside an effect renders the component, then renders it again to undo
   * itself, which is a cascade React now warns about by default.
   *
   * Storing the route removes the question. The menu is open only while the
   * page it was opened on is still the page you are on, so arriving anywhere
   * else closes it during the render that brings you there -- no second pass,
   * no effect, and it covers the back button as well as a tap on a link, which
   * an `onClick` on each row would not.
   */
  const [openAt, setOpenAt] = useState<string | null>(null);
  const menuOpen = openAt === pathname;

  /*
   * 4px, not 0. A phone's rubber-band overscroll reports small positive scroll
   * offsets while the page is settling back, and a threshold of exactly zero
   * turns that into a line flickering on and off under a header nobody has
   * scrolled yet.
   */
  const scrolled = useScrolledPast(4);

  /*
   * The scroll-spy runs only on the home page, because it is the only page with
   * these sections on it. Anywhere else the header falls back to marking the
   * route you are on.
   */
  const onHome = pathname === '/';
  const activeSection = useActiveSection(SECTIONS, onHome);

  /*
   * The hand-off.
   *
   * The navigation lives at the top of the hero, which is the right place for
   * it right up until somebody uses it: the links scroll you to a section, the
   * hero leaves with them, and from that point on there is nothing to navigate
   * with -- this bar deliberately carries no links of its own. So it borrows
   * them. When the hero's row goes off the top of the screen the same four
   * appear here; scroll back up to where the originals are and they hand back.
   *
   * Never both at once, which is the whole reason this watches the row itself
   * rather than a scroll offset. Any threshold that approximated "past the
   * hero" would be wrong at some window height, and being wrong here means two
   * identical sets of links on screen together.
   *
   * `!onHome` is the other half: every route except the home page has no hero
   * to borrow from, so the bar carries the links from the first frame.
   */
  const heroNavGone = useScrolledPastElement('hero-nav', pathname);
  const showNav = !onHome || heroNavGone;

  /*
   * React drives `open` through the imperative API rather than through the
   * `open` attribute, and the difference is the whole reason the sheet behaves.
   * `<dialog open>` is a *non-modal* dialog: no backdrop, no focus trap, no
   * Escape, and the page behind it stays reachable by Tab. `showModal()` is the
   * one that puts it in the top layer and hands the browser the three jobs a
   * menu overlay would otherwise need a library to do.
   */
  useEffect(() => {
    const element = sheet.current;
    if (!element) return;

    if (menuOpen && !element.open) element.showModal();
    if (!menuOpen && element.open) element.close();
  }, [menuOpen]);

  /*
   * Close the sheet if the viewport grows past the breakpoint it belongs to,
   * and this is a lockup rather than a tidiness fix.
   *
   * The sheet is `md:hidden`, so at desktop widths it stops being rendered --
   * but `display: none` does not take an element out of the top layer. A modal
   * dialog left open there keeps the focus trap and keeps the rest of the page
   * inert, so a phone rotated to landscape, or a desktop window dragged wider
   * with the menu open, lands on a page that cannot be clicked, cannot be
   * tabbed into, and has no visible menu left to close -- the toggle went with
   * the breakpoint.
   *
   * `matchMedia` rather than a resize listener: this fires twice in the life of
   * a page instead of on every frame of a drag, and the query is the same
   * number the two `md:` utilities compile to.
   */
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 48rem)');

    function closeIfWide(event: MediaQueryListEvent | MediaQueryList) {
      if (event.matches) setOpenAt(null);
    }

    // Checked once on mount as well as on change, for the case where the page
    // is loaded wide and something has restored an open menu into it.
    closeIfWide(wide);
    wide.addEventListener('change', closeIfWide);
    return () => wide.removeEventListener('change', closeIfWide);
  }, []);

  /**
   * What the header should say about one nav item, or nothing.
   *
   * `page` wins over `location` where both could apply. Being on `/menu` is a
   * stronger and more useful statement than the home page happening to be
   * scrolled to its menu section, and only one of them can be announced.
   */
  function currentState(item: (typeof SITE_NAV)[number]): 'page' | 'location' | undefined {
    // `startsWith` with the separator, so `/subscriptions/weekday-lunch` marks
    // Subscriptions without `/menus` ever matching `/menu`.
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return 'page';
    if (onHome && activeSection === item.section) return 'location';
    return undefined;
  }

  return (
    <header
      /*
       * The landing point for the back-to-top button, which moves focus here so
       * a keyboard visitor arrives at the top of the page rather than merely
       * looking at it. `tabIndex={-1}` makes it focusable by script without
       * putting a stop in the tab order.
       */
      id="site-top"
      tabIndex={-1}
      data-scrolled={scrolled ? '' : undefined}
      className="site-header sticky top-0 z-40 bg-surface/80 backdrop-blur"
    >
      <div className="site-bar mx-auto h-16 max-w-6xl px-4">
        {/* Left track, and on a desktop it is deliberately empty.

            The bar carries no navigation any more -- it all lives in the hero
            now, see `HERO_NAV`. The track stays because it is what holds the
            mark on the centre line: remove it and the grid has two columns and
            the wordmark drifts left.

            On a phone it holds the sheet toggle, which is the only navigation
            there once the hero's links have scrolled away. */}
        <div className="site-bar-side justify-start">
          <button
            type="button"
            onClick={() => setOpenAt((open) => (open === pathname ? null : pathname))}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className={buttonClasses('ghost', 'md', 'nav-toggle md:hidden')}
          >
            <MenuGlyph />
          </button>

          {/* Rendered always and shown conditionally, rather than mounted when
              it is needed. Mounting it would mean no transition on the way in
              and, worse, focus dropped on the way out for anyone who had tabbed
              into it. `data-shown` drives a fade that also flips `visibility`,
              so while it is hidden it is not a set of invisible tab stops in
              the corner of the bar either. See `.bar-nav` in `globals.css`.

              `md:` and up only: below that the sheet is the navigation, and two
              ways into the same five links on a 375px bar is one too many. */}
          <nav
            className="bar-nav hidden md:flex"
            data-shown={showNav ? '' : undefined}
            aria-hidden={showNav ? undefined : true}
            aria-label="Sections"
          >
            {HERO_NAV.map((item) => (
              <Link
                key={item.label}
                href={`/#${item.section}`}
                tabIndex={showNav ? undefined : -1}
                // `location`, not `page`: this says what you are looking at,
                // not which page you are on. See `currentState`.
                aria-current={onHome && activeSection === item.section ? 'location' : undefined}
                className="nav-link"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* The middle track, and the only thing in it. */}
        <Link
          href="/#top"
          aria-current={pathname === '/' && activeSection === 'top' ? 'page' : undefined}
          className="site-bar-mark"
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-ck bg-brand text-sm font-bold text-white"
            aria-hidden
          >
            CK
          </span>
          <span className="hidden sm:inline">Cloud Kitchen</span>
        </Link>

        <div className="site-bar-side justify-end">
          <AccountNav />
        </div>
      </div>

      {/* The sheet, and it is a `<dialog>` because the platform already solves
          the three problems a menu overlay has: focus goes in and cannot leave
          while it is open, Escape closes it, and the page behind it is inert
          rather than merely covered. Hand-rolling those is how a nav menu ends
          up letting you Tab into the page underneath it.

          `onClose` is the sync back, and it is not optional: Escape and the
          browser's own dismissal close the element without going through the
          button, so without this React would still believe the menu is open and
          the next press of the toggle would try to close an already-closed
          dialog.

          The click handler is the outside-click dismissal. A click on the
          backdrop has the dialog itself as its target -- the backdrop is a
          pseudo-element and cannot be one -- so this fires only when the press
          landed outside the panel's own box. */}
      <dialog
        ref={sheet}
        id="site-menu"
        className="nav-sheet md:hidden"
        aria-label="Main"
        onClose={() => setOpenAt(null)}
        onClick={(event) => {
          if (event.target === sheet.current) setOpenAt(null);
        }}
      >
        <nav aria-label="Main">
          <ul className="flex flex-col">
            {SITE_NAV.map((item, index) => (
              <li key={item.href}>
                <Link
                  href={item.section ? `/#${item.section}` : item.href}
                  aria-current={currentState(item)}
                  // The stagger is the sheet's, not the link's: the panel opens
                  // and the rows arrive behind it, 40ms apart. Short, because
                  // there are five and a cascade that outlasts the panel it is
                  // inside stops reading as one movement.
                  style={{ '--row-at': `${index * 40}ms` } as React.CSSProperties}
                  className={cx('nav-row', currentState(item) && 'is-current')}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </header>
  );
}
