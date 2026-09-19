import { gsap, SplitText } from './gsap';
import { onceInView, onScreen } from './in-view';

/**
 * The scroll reveals every GSAP page on the storefront shares.
 *
 * A page's own stage decides what is particular to it -- the subscriptions
 * tickets printing, the menu's pass -- and calls these for the parts that
 * should behave the same everywhere: a section heading is said the same way on
 * every page, and a row of content rises the same distance on the same curve.
 * Two copies of these would drift apart the first time one of them was tuned.
 *
 * All three expect to run inside a `gsap.matchMedia()` branch for
 * `(prefers-reduced-motion: no-preference)`, so the branch reverting takes
 * every split and inline style they made with it. Each returns the function
 * that stops its observers, for the branch to call on the way out. The
 * elements they reveal are hidden by `motion-gate.css` rather than by these
 * functions, so anything GSAP animates goes *to* an explicit visible value.
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
export function splitHeadings(q: Query): () => void {
  const headings = q('[data-split-heading]');
  const sayings = new Map<Element, gsap.core.Tween>();

  headings.forEach((heading) => {
    const split = SplitText.create(heading, { type: 'words', mask: 'words' });
    gsap.set(heading, { autoAlpha: 1 });

    sayings.set(
      heading,
      gsap.fromTo(
        split.words,
        { yPercent: 115 },
        {
          yPercent: 0,
          duration: 0.85,
          stagger: 0.07,
          ease: 'ck',
          paused: true,
          onComplete: () => split.revert(),
        },
      ),
    );
  });

  return onceInView(headings, 0.88, (reached) =>
    reached.forEach((heading) => sayings.get(heading)?.play()),
  );
}

/**
 * Everything else below the fold: a short rise, and hairlines drawn across.
 *
 * Not GSAP. These are the same movement on every element, and there are a lot
 * of them -- one per dish on `/menu` -- so they are keyframes in
 * `motion-gate.css`, run by the compositor, and all this does is say when.
 * Tweening them meant a `gsap.set` per row at load, each one reading computed
 * style straight after the last one wrote it, which on a phone was a forced
 * style recalculation per dish before the page could respond to anything.
 *
 * Whatever crosses the line together is staggered as a group -- a row of three
 * on a wide screen, one at a time on a phone -- from the same code.
 */
export function riseOnScroll(q: Query): () => void {
  const stops = [arrive(q('[data-rise]'), 80), arrive(q('[data-rule]'), 100)];
  return () => stops.forEach((stop) => stop());
}

/**
 * `data-reveal` is the handshake with the stylesheet. `armed` means the
 * observer is watching, which is what lets the stylesheet hold the element at
 * zero opacity past the gate's failsafe; `in` plays its keyframe, `--arrive-at`
 * into it.
 */
function arrive(elements: HTMLElement[], stagger: number) {
  elements.forEach((element) => {
    element.dataset.reveal = 'armed';
  });

  const stop = onceInView(elements, 0.9, (batch) =>
    batch.forEach((element, index) => {
      element.style.setProperty('--arrive-at', `${index * stagger}ms`);
      element.dataset.reveal = 'in';
    }),
  );

  return () => {
    stop();
    // Anything never reached goes back to the gate, whose failsafe shows it,
    // rather than being held invisible by an observer that has gone.
    elements.forEach((element) => {
      if (element.dataset.reveal === 'armed') delete element.dataset.reveal;
    });
  };
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
export function setDownTools(q: Query): () => void {
  const stops = q('[data-tool]').map((tool, index) => {
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

    const section = tool.parentElement;
    return section
      ? onScreen(section, (visible) => (visible ? drift.resume() : drift.pause()))
      : () => {};
  });

  return () => stops.forEach((stop) => stop());
}
