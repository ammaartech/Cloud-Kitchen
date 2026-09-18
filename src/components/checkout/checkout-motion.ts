'use client';

/**
 * The flow's motion, without GSAP.
 *
 * Everything the customer sees before a payment succeeds is feedback for a tap
 * they just made: a shake, a figure counting, a ring moving, a row sliding
 * down. None of it needs a timeline, so none of it is worth a library on the
 * one route where a slow phone is closest to paying. GSAP stays behind the
 * receipt's lazy chunk (`checkout-gsap.ts`), which is the one sequence in the
 * product that has earned it.
 *
 * `sign-in-form.tsx` makes the same trade for the same reason.
 */

/**
 * The `--ck-ease` curve, spelled for the Web Animations API.
 *
 * The same four numbers as the `ck` CustomEase registered in
 * `checkout-gsap.ts` and `site/gsap.ts`, so a row sliding here and the receipt
 * printing there move on one curve.
 */
export const CHECKOUT_EASE = 'cubic-bezier(0.25, 1, 0.5, 1)';

/**
 * Motion in the flow is feedback, never an entrance, and it still steps aside
 * for anyone who has asked for less of it. Checked at the moment of animating
 * rather than once, so the setting can change without a reload.
 */
export function motionAllowed(): boolean {
  return (
    typeof window !== 'undefined' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/* Keyed by element rather than held in a ref: `shake` is called from event
   handlers that do not own the node, and a second refusal must replace the
   first rather than fight it. */
const shakes = new WeakMap<Element, Animation>();

/**
 * A refusal: a short sideways shake on the thing that said no.
 *
 * Paired with a message every time -- the shake says "here", the words say
 * "why". It is 360ms and a few pixels, long enough to catch the eye that was
 * on the button and short enough to be over before anyone reads it.
 */
export function shake(target: Element | null | undefined): void {
  if (!target || !motionAllowed()) return;

  shakes.get(target)?.cancel();
  const animation = target.animate(
    [0, -6, 6, -4, 4, -2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration: 360, easing: 'linear' },
  );
  shakes.set(target, animation);
  animation.finished.catch(() => {}).finally(() => {
    if (shakes.get(target) === animation) shakes.delete(target);
  });
}

const counters = new WeakMap<HTMLElement, number>();

/**
 * A figure running from its old value to its new one, so a changed total is
 * seen to change rather than silently being different.
 *
 * It writes into the element's existing text node rather than setting
 * `textContent`. React rendered that node and keeps a reference to it;
 * replacing it would leave React updating a detached node, and the next real
 * change to the figure would never reach the screen.
 */
export function countTo(
  element: HTMLElement,
  from: number,
  to: number,
  format: (value: number) => string,
): void {
  const write = (text: string) => {
    const node = element.firstChild;
    if (node && node.nodeType === Node.TEXT_NODE) node.nodeValue = text;
    else element.textContent = text;
  };

  const previous = counters.get(element);
  if (previous !== undefined) cancelAnimationFrame(previous);

  if (!motionAllowed() || from === to) {
    write(format(to));
    return;
  }

  const started = performance.now();
  const duration = 600;

  /* Quartic ease-out rather than the shared cubic-bezier: this is a number
     being read, not a box being moved, and the value has to settle early
     enough to be legible for most of the 600ms. */
  const frame = (now: number) => {
    const progress = Math.min((now - started) / duration, 1);
    const eased = 1 - (1 - progress) ** 4;
    write(format(Math.round((from + (to - from) * eased) * 100) / 100));

    if (progress < 1) {
      counters.set(element, requestAnimationFrame(frame));
    } else {
      counters.delete(element);
      write(format(to));
    }
  };

  write(format(from));
  counters.set(element, requestAnimationFrame(frame));
}
