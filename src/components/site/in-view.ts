/**
 * The storefront's scroll-triggered motion, on `IntersectionObserver`.
 *
 * This replaced ScrollTrigger, which was doing three jobs here: has this been
 * reached, which of these is crossing a line on the screen, and is this on the
 * screen at all. The browser answers all three itself, off the main thread.
 * ScrollTrigger answered them by measuring every trigger on every refresh --
 * about thirty on a phone on `/menu`, each one a forced layout -- and it keeps
 * an empty `requestAnimationFrame` loop running for as long as it is loaded, so
 * a phone that had opened `/menu` drew a fresh frame on every vsync for the
 * rest of the visit, whatever page it moved on to. Measured on a throttled
 * phone profile, that loop alone was most of the page's idle work.
 *
 * Nothing here needs re-measuring when fonts land or the layout shifts, which
 * is the other thing that goes: an observer tracks the element, not a scroll
 * offset worked out from where the element used to be.
 *
 * Lines are fractions of the viewport's height from the top, the way the
 * ScrollTrigger positions they replace were written: `0.9` is `'top 90%'`.
 */

/**
 * Calls `enter` once for each element, when its top first rises past `line`.
 *
 * Elements that cross together arrive in one call, in document order -- the
 * job `ScrollTrigger.batch` did -- so a caller can stagger a row of three on a
 * wide screen and one at a time on a phone from the same code.
 *
 * An element scrolled past before it was ever seen (a visitor arriving on a
 * deep link) waits until it is scrolled back to, rather than playing its
 * entrance off the top of the screen where nobody is looking.
 */
export function onceInView(
  elements: readonly Element[],
  line: number,
  enter: (batch: HTMLElement[]) => void,
): () => void {
  if (elements.length === 0) return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      const batch: HTMLElement[] = [];
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        batch.push(entry.target as HTMLElement);
      }
      if (batch.length > 0) enter(batch);
    },
    // The viewport with everything below the line cut off, so "intersecting"
    // means "some of it is above the line".
    { rootMargin: `0px 0px ${-(1 - line) * 100}% 0px` },
  );

  elements.forEach((element) => observer.observe(element));
  return () => observer.disconnect();
}

/**
 * Calls `cross` with an element's index whenever it comes to span `line` --
 * with the line across the middle of the screen, the one being read.
 *
 * The root is shrunk to a line with no height at all. Intersection is
 * edge-inclusive, so an element that spans it still counts as intersecting.
 */
export function onCrossing(
  elements: readonly Element[],
  line: number,
  cross: (index: number) => void,
): () => void {
  if (elements.length === 0) return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      // Two neighbours can both touch the line when the boundary between them
      // sits exactly on it. The later one is the one being scrolled into.
      const arrivals = entries.filter((entry) => entry.isIntersecting);
      const arrived = arrivals[arrivals.length - 1];
      if (arrived) cross(elements.indexOf(arrived.target));
    },
    { rootMargin: `${-line * 100}% 0px ${-(1 - line) * 100}% 0px` },
  );

  elements.forEach((element) => observer.observe(element));
  return () => observer.disconnect();
}

/**
 * Calls `change` as `element` comes on to and goes off the screen, starting
 * with where it is now.
 */
export function onScreen(element: Element, change: (visible: boolean) => void): () => void {
  const observer = new IntersectionObserver((entries) => {
    const latest = entries[entries.length - 1];
    if (latest) change(latest.isIntersecting);
  });

  observer.observe(element);
  return () => observer.disconnect();
}
