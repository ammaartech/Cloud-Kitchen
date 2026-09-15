import { gsap, ScrollTrigger, SplitText } from './gsap';

/**
 * The scroll reveals every GSAP page on the storefront shares.
 *
 * A page's own stage decides what is particular to it -- the subscriptions
 * tickets printing, the menu's pass -- and calls these for the parts that
 * should behave the same everywhere: a section heading is said the same way on
 * every page, and a row of content rises the same distance on the same curve.
 * Two copies of these would drift apart the first time one of them was tuned.
 *
 * Both expect to run inside a `gsap.matchMedia()` branch for
 * `(prefers-reduced-motion: no-preference)`, so the branch reverting takes
 * every split, inline style and ScrollTrigger they made with it. Both animate
 * to explicit visible values, because the elements they reveal are hidden by
 * `motion-gate.css` rather than by these functions.
 */

export type Query = (selector: string) => HTMLElement[];

/**
 * Section headings, said a word at a time as they are reached.
 *
 * Words rather than lines, which is what makes this safe on a heading that
 * wraps differently on every screen: a word is an inline box that reflows on
 * its own, so nothing has to be split again when the viewport or a late font
 * moves the line breaks. The split is reverted the moment the words land,
 * which hands the heading back to the browser as one run of text -- no masks
 * left clipping descenders, and the `aria-label` SplitText added taken off.
 */
export function splitHeadings(q: Query) {
  q('[data-split-heading]').forEach((heading) => {
    const split = SplitText.create(heading, { type: 'words', mask: 'words' });
    gsap.set(heading, { autoAlpha: 1 });

    gsap.fromTo(
      split.words,
      { yPercent: 115 },
      {
        yPercent: 0,
        duration: 0.85,
        stagger: 0.07,
        ease: 'ck',
        scrollTrigger: { trigger: heading, start: 'top 88%', once: true },
        onComplete: () => split.revert(),
      },
    );
  });
}

/**
 * Everything else below the fold: a short rise, and hairlines drawn across.
 *
 * `ScrollTrigger.batch`, so whatever enters the viewport together is staggered
 * as a group -- a row of three on a wide screen, one at a time on a phone --
 * from the same code.
 */
export function riseOnScroll(q: Query) {
  const risers = q('[data-rise]');

  if (risers.length > 0) {
    gsap.set(risers, { autoAlpha: 0, y: 20 });
    ScrollTrigger.batch(risers, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          duration: 0.75,
          stagger: 0.08,
          ease: 'ck',
          overwrite: true,
        }),
    });
  }

  const rules = q('[data-rule]');

  if (rules.length > 0) {
    gsap.set(rules, { scaleX: 0, transformOrigin: 'left center' });
    ScrollTrigger.batch(rules, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { scaleX: 1, duration: 1.1, stagger: 0.1, ease: 'ck' }),
    });
  }
}
