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

/**
 * Drawn marginalia: set down a beat after the copy, then left to drift.
 *
 * Shared by `/subscriptions` and `/about`, which both put tool drawings in the
 * page gutters. The hero does this in pure CSS -- see the `animation` shorthand
 * on `.storefront-hero > .tool-mark` -- because its marks have to arrive at
 * first paint with everything else on that surface. These two pages are already
 * paying for GSAP, and a mark that enters on the same timeline as the heading
 * beside it is one fewer clock to keep in sync.
 *
 * The drift pauses whenever the section is scrolled away. An infinite loop
 * nobody can see is still work on every frame, and both pages are long.
 *
 * `lean` alternates so no two neighbours settle the same way, and each mark's
 * drift runs against its own entrance tilt -- the same reasoning as
 * `NOTE_PLACEMENT` on the home page: the irregularity has to be composed, or
 * four marks drifting in step read as one animation applied four times.
 */
export function setDownTools(q: Query) {
  q('[data-tool]').forEach((tool, index) => {
    const lean = index % 2 === 0 ? -1 : 1;
    const settles = 0.7 + index * 0.3;

    gsap.fromTo(
      tool,
      { autoAlpha: 0, y: 28, rotation: 8 * lean },
      { autoAlpha: 1, y: 0, rotation: 0, duration: 1.3, ease: 'ck', delay: settles },
    );

    // Starts the moment the entrance ends, so the two never write `y` at once.
    const drift = gsap.to(tool, {
      y: -22,
      rotation: 3.5 * -lean,
      duration: 6 + index * 1.5,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      delay: settles + 1.3,
    });

    ScrollTrigger.create({
      trigger: tool.parentElement,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? drift.resume() : drift.pause()),
    });
  });
}
