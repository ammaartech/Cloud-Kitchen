'use client';

import { buttonClasses } from '@/components/ui/button-styles';
import { ArrowUpIcon } from './icons';
import { useScrolledPastViewport } from './scroll';

/**
 * Back to top.
 *
 * The storefront's pages are long -- the home page is five full bands, the menu
 * is a grid that keeps going -- and the header is sticky but the *page* is not:
 * once you are three screens down, getting back to the navigation is a scroll
 * you have to perform rather than a place you can go. This is that place.
 *
 * It appears after one whole screen and not before. A button offering to take
 * you somewhere you can already see is noise, and on a phone it would sit over
 * the hero's call to action -- the one thing on the first screen it must never
 * be in front of.
 *
 * Both breakpoints get it, which is worth saying because the usual instinct is
 * to make this desktop-only: a phone has the shortest viewport and therefore
 * the longest scroll back, so if either device needs it more it is that one.
 * What changes between them is where it sits, not whether it is there -- see
 * `.to-top` in `globals.css` for the two insets and why the mobile one is
 * larger.
 *
 * ## Why it is a real button that stays in the DOM
 *
 * Rendering it conditionally would make it appear with no transition and, worse,
 * would move focus off it the moment it left -- so a keyboard visitor who
 * pressed it would be returned to the top of the document with their focus
 * dropped on `<body>`. It is always present and moves between two states, and
 * the hidden state is `visibility: hidden`, which takes it out of the tab order
 * as well as out of sight. `opacity: 0` alone would leave an invisible tab stop
 * in the corner of every page.
 */
export function ScrollTopButton() {
  const shown = useScrolledPastViewport();

  function toTop() {
    // Read the preference at the moment of the press rather than through a
    // hook. This is a one-shot imperative action, and the setting can be
    // changed by the visitor while the page is open.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });

    // The scroll is only half the job. Without this, a keyboard visitor who
    // presses the button is looking at the top of the page with their focus
    // still three screens down: the next Tab returns them to where they came
    // from, which reads as the button having done nothing.
    //
    // `preventScroll` is what stops the two halves fighting. Focusing an
    // element that is off-screen scrolls it into view instantly, which would
    // jump the page to the top and then leave the smooth scroll animating from
    // a position it had already arrived at.
    document.getElementById('site-top')?.focus({ preventScroll: true });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      // The state is an attribute rather than a class so the whole transition
      // can live in the stylesheet next to the geometry it moves.
      data-shown={shown ? '' : undefined}
      // The button has no text -- an arrow in a circle is the one control on
      // this page that is genuinely understood as a picture -- so it carries
      // its name here. "Back to top" rather than "Scroll to top": it names the
      // destination, which is what the visitor is choosing, not the mechanism.
      aria-label="Back to top"
      // Hidden from assistive technology while it is hidden on screen. The
      // `visibility: hidden` below already does this in every browser, and this
      // says the same thing to a tree that may be read before the styles are.
      aria-hidden={shown ? undefined : true}
      tabIndex={shown ? undefined : -1}
      className={buttonClasses('primary', 'md', 'to-top')}
    >
      <ArrowUpIcon />
    </button>
  );
}
