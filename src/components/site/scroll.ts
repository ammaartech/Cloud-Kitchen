'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Where the page is scrolled to, as a subscription rather than as state.
 *
 * Two things on the storefront need to know: the header, which grows a line
 * under itself once it stops being part of the page, and the back-to-top
 * button, which has nothing to say until you are a screen down. They are in
 * different corners of the layout and neither owns the other, so the reading
 * lives here and both subscribe to it.
 *
 * One listener for the whole document, not one per consumer. `scroll` fires at
 * whatever rate the input device produces -- a trackpad flick is dozens of
 * events -- so the handler does nothing but schedule a frame, and every
 * subscriber is notified once per frame at most. Nothing here reads layout, so
 * no frame can be forced into a synchronous reflow by this file.
 *
 * The listeners are `passive`. Without that flag the browser has to wait and
 * see whether the handler calls `preventDefault` before it can start scrolling,
 * which is how a scroll listener ends up costing scroll performance. This one
 * never will, and says so.
 *
 * `useSyncExternalStore` is what keeps the per-frame notification from becoming
 * a per-frame React render. The hooks below return a *boolean*, and React bails
 * out of rendering when a snapshot is `Object.is`-equal to the last one -- so a
 * subscriber re-renders when it crosses its threshold and at no other time. A
 * hook returning `scrollY` itself would render on every frame of every scroll;
 * that is the whole reason these are written as predicates.
 *
 * The server snapshot is `false` everywhere, which is also the truth: a page
 * has not been scrolled when it arrives. Nothing here can produce a hydration
 * mismatch, and a visitor landing on a deep-linked scroll position gets the
 * correct answer on the first frame after hydration rather than a flash of the
 * wrong one, because the browser restores the scroll position before then.
 */

const listeners = new Set<() => void>();
let scheduled = false;

function onScroll() {
  if (scheduled) return;
  scheduled = true;

  requestAnimationFrame(() => {
    scheduled = false;
    for (const listener of listeners) listener();
  });
}

function subscribe(listener: () => void): () => void {
  // The listener is attached with the first subscriber and removed with the
  // last, so a page carrying neither of these components pays nothing.
  if (listeners.size === 0) {
    window.addEventListener('scroll', onScroll, { passive: true });
    // A resize changes what `useScrolledPastViewport` is comparing against, and
    // on a phone it fires when the address bar retracts -- which is a change of
    // viewport height with no scroll event behind it.
    window.addEventListener('resize', onScroll, { passive: true });
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    }
  };
}

/** Has the page scrolled more than `threshold` pixels from the top? */
export function useScrolledPast(threshold: number): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > threshold,
    () => false,
  );
}

/**
 * Has the page scrolled a whole screen?
 *
 * Measured against the viewport rather than a fixed pixel count, because the
 * question the back-to-top button is really asking is "is the top out of
 * sight" -- and that is one screen on a phone and one screen on a monitor, not
 * 800px on both.
 */
export function useScrolledPastViewport(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > window.innerHeight,
    () => false,
  );
}

/**
 * Which of the page's sections is the one being read.
 *
 * The header lights up the section you are in as you scroll past it, which is
 * the whole reason a one-page site needs a nav at all: without it the links are
 * five ways to jump and no way to know where you landed.
 *
 * An `IntersectionObserver` rather than arithmetic on scroll offsets. Comparing
 * `scrollY` against each section's `offsetTop` means measuring every section on
 * every frame -- and reading `offsetTop` forces the browser to flush layout, so
 * the naive version of this is a synchronous reflow per frame per section. The
 * observer is told once where the sections are and reports only when one
 * crosses the line.
 *
 * The line is a band a quarter of the way down the viewport, set by
 * `rootMargin`: 25% is shaved off the top of the root and 65% off the bottom,
 * leaving a horizontal strip about a tenth of a screen tall. A section is
 * "current" while it is crossing that strip. Anchoring it near the top rather
 * than at the middle matters on the long sections -- with a mid-viewport line,
 * a section taller than the window becomes current only once you are halfway
 * through it, so the header spends the first half still pointing at the section
 * above.
 *
 * More than one can be in the band at a boundary, so the answer is the first in
 * `ids` -- document order -- rather than whichever entry the observer happened
 * to report last. Without that the highlight flickers between neighbours as you
 * cross from one to the next.
 *
 * `enabled` is how a route that has none of these sections opts out: the
 * observer never starts, and the hook returns null rather than a stale id from
 * the last page that had them.
 */
export function useActiveSection(ids: readonly string[], enabled: boolean): string | null {
  const [tracked, setTracked] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) return;

    // The set is the observer's memory. Callbacks report only what *changed*,
    // so a callback firing for one section says nothing about the others --
    // deciding the answer from `entries` alone would forget every section that
    // did not move.
    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }

        setTracked(ids.find((id) => visible.has(id)) ?? null);
      },
      { rootMargin: '-25% 0px -65% 0px' },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [ids, enabled]);

  return enabled ? tracked : null;
}

/**
 * Has an element scrolled off the top of the screen?
 *
 * The hero carries the site's navigation, which works right up until you use
 * it: the links scroll you to a section, the hero goes with them, and from that
 * point on there is nothing to navigate with -- the header deliberately carries
 * no links of its own. This is the signal that hands them over. The header
 * grows the same four links when the hero's row leaves the top of the screen
 * and gives them back when it returns.
 *
 * "Off the top" specifically, not "not visible". `boundingClientRect.top < 0`
 * is the difference between the row having been scrolled past and it simply not
 * having been reached yet -- an element below the fold is also not
 * intersecting, and without the check the header would carry a duplicate set of
 * links while the originals sat in plain sight further down the page.
 *
 * `watch` is anything that should make this look for the element again -- in
 * practice the pathname, because the element belongs to one route and a
 * client-side navigation neither remounts the observer nor tells it that what
 * it was watching has gone.
 *
 * The answer is stored *with* the route it was measured on, and read back only
 * when the two still agree. That is not bookkeeping; it is the fix for a real
 * flash. Leave the home page scrolled down and the answer is `true`; navigate
 * to one with no hero and the effect finds no element and leaves it `true`,
 * which is harmless because that route shows the links unconditionally.
 * Navigate *back*, though, and the page is at the top with the hero's own row
 * in plain sight while a stale `true` says it has gone -- two identical sets of
 * links, until the observer's first callback lands a frame later. Keying the
 * value to the route makes a new route read `false` until it has been measured,
 * and `false` is the state that shows nothing.
 *
 * Storing the pair rather than resetting inside an effect is also what keeps
 * this out of `react-hooks/set-state-in-effect`: there is no render-phase write
 * to undo, just a value that stops applying when its route does.
 */
export function useScrolledPastElement(id: string, watch: string): boolean {
  const [seen, setSeen] = useState<{ watch: string; past: boolean } | null>(null);

  useEffect(() => {
    const element = document.getElementById(id);
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setSeen({ watch, past: !entry.isIntersecting && entry.boundingClientRect.top < 0 });
      },
      { threshold: 0 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [id, watch]);

  return seen?.watch === watch && seen.past;
}
