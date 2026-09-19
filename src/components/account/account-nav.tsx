'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';

/**
 * Customer account navigation (PRD 6).
 *
 * The dashboard itself carries the subscription, deliveries, credits and
 * invoices. Addresses, reviews and refund requests each get their own page so
 * none of them is buried under a plan someone may not even have yet.
 */
const TABS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/reviews', label: 'Reviews' },
  { href: '/account/refunds', label: 'Refunds' },
] as const;

type Href = (typeof TABS)[number]['href'];

function activeHref(pathname: string): Href | null {
  return TABS.find((tab) => pathname === tab.href)?.href ?? null;
}

/**
 * How long the direction stays on `<html>` after the new page commits: the
 * slide in `account.css` runs 340ms from when the browser has both pages
 * captured, which is a frame or two after the commit, and this leaves room
 * for a slow frame on top.
 */
const SLIDE_SETTLE_MS = 600;

function setDirection(direction: 'forward' | 'back') {
  document.documentElement.dataset.acctNav = direction;
}

function clearDirection() {
  delete document.documentElement.dataset.acctNav;
}

/**
 * The account's tabs, in the header's voice: tracked capitals on a hairline,
 * with the current one marked by a bar that travels rather than a pill that
 * blinks from one word to the next.
 *
 * ## Two moving parts, both CSS
 *
 * - **The bar** sits under the current tab. It moves the moment a tab is
 *   pressed -- not when the route commits -- so the answer to the press is on
 *   screen in the same frame, whatever the network is doing.
 * - **The highlight** follows the pointer from tab to tab instead of each tab
 *   lighting up on its own, so sweeping across the row reads as one object
 *   gliding rather than four flickering.
 *
 * This component only measures. It writes each position into custom properties
 * on the row, and the transitions in `account.css` do the moving, so a pointer
 * sweeping across the tabs never re-renders React. Before the first
 * measurement -- server HTML, or no JavaScript at all -- the current tab draws
 * its own static underline, so the row is correct from the first paint.
 *
 * ## Direction
 *
 * A tab to the right slides the page forward and one to the left slides it
 * back, so the page underneath moves the way the bar is travelling. The
 * direction goes on `<html>` as `data-acct-nav` rather than on the link as a
 * transition type -- see `account/template.tsx` for why the types did not
 * survive -- and comes off once the new page has landed and its slide has run.
 */
export function AccountNav() {
  const pathname = usePathname() ?? '';
  const current = activeHref(pathname);

  // The tab just pressed, tagged with the path it was pressed from. It stops
  // counting the moment the path changes -- the router has caught up -- which
  // is derived here rather than cleared in an effect.
  const [pressed, setPressed] = useState<{ href: Href; from: string } | null>(null);
  const shown = pressed && pressed.from === pathname ? pressed.href : current;

  const rowRef = useRef<HTMLDivElement>(null);

  // The slide's direction outlives the press by as long as the router takes to
  // commit, and no longer: once the path has changed, give the slide time to
  // run and take the direction off, so a later swap nobody pressed a tab for
  // does not slide. Not in the cleanup -- that runs the moment the path
  // changes, which is before the slide has read it. A press cancels a removal
  // still pending from the last one, so quick presses keep their direction.
  const settle = useRef(0);

  useEffect(() => {
    settle.current = window.setTimeout(clearDirection, SLIDE_SETTLE_MS);
    return () => window.clearTimeout(settle.current);
  }, [pathname]);

  // Leaving the account takes it off at once.
  useEffect(() => clearDirection, []);

  // Place the bar under whichever tab is shown, and keep it there as the row
  // reflows (fonts landing, a phone rotating).
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const place = () => {
      const tab = shown ? row.querySelector<HTMLElement>(`[data-href="${shown}"]`) : null;
      if (!tab) {
        row.style.setProperty('--bar-w', '0px');
        return;
      }
      row.style.setProperty('--bar-x', `${tab.offsetLeft}px`);
      row.style.setProperty('--bar-w', `${tab.offsetWidth}px`);
      // On a phone the row scrolls sideways; keep the current tab on screen.
      // By hand rather than `scrollIntoView`, which would also scroll the page
      // vertically to the nav if a resize fired while it was out of view.
      const overflowRight = tab.offsetLeft + tab.offsetWidth - (row.scrollLeft + row.clientWidth);
      if (overflowRight > 0) row.scrollLeft += overflowRight + 16;
      else if (tab.offsetLeft < row.scrollLeft) row.scrollLeft = Math.max(0, tab.offsetLeft - 16);
    };

    place();

    // The first placement lands without travelling in from the left edge.
    // After it, every move animates.
    if (!row.dataset.ready) {
      requestAnimationFrame(() => {
        row.dataset.ready = '';
      });
    }

    const observer = new ResizeObserver(place);
    observer.observe(row);
    return () => observer.disconnect();
  }, [shown]);

  function hoverTo(tab: HTMLElement) {
    const row = rowRef.current;
    if (!row) return;

    // Entering the row from outside, the highlight appears where the pointer
    // is; only moving *between* tabs makes it glide.
    const arriving = !('hover' in row.dataset);
    if (arriving) row.dataset.snap = '';

    row.style.setProperty('--hover-x', `${tab.offsetLeft}px`);
    row.style.setProperty('--hover-w', `${tab.offsetWidth}px`);
    row.dataset.hover = '';

    if (arriving) {
      // Commit the snapped position before transitions come back on.
      void row.offsetWidth;
      delete row.dataset.snap;
    }
  }

  function leave() {
    const row = rowRef.current;
    if (row) delete row.dataset.hover;
  }

  const from = TABS.findIndex((tab) => tab.href === (shown ?? current));

  function press(event: MouseEvent<HTMLAnchorElement>, href: Href, index: number) {
    // A new tab or window is not a navigation of this one.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    setPressed({ href, from: pathname });

    // The tab already shown goes nowhere, and a page that is not one of the
    // tabs has no side to slide from.
    if (from === -1 || index === from) return;
    window.clearTimeout(settle.current);
    setDirection(index > from ? 'forward' : 'back');
  }

  return (
    <nav aria-label="Account" className="acct-tabs-nav">
      <div ref={rowRef} className="acct-tabs" onPointerLeave={leave}>
        <span aria-hidden className="acct-tabs-hover" />
        {TABS.map((tab, index) => {
          const active = tab.href === current;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-href={tab.href}
              aria-current={active ? 'page' : undefined}
              data-shown={tab.href === shown ? '' : undefined}
              className="acct-tab"
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') hoverTo(event.currentTarget);
              }}
              onFocus={(event) => hoverTo(event.currentTarget)}
              onBlur={leave}
              onClick={(event) => press(event, tab.href, index)}
            >
              {tab.label}
            </Link>
          );
        })}
        <span aria-hidden className="acct-tabs-bar" />
      </div>
    </nav>
  );
}
