'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { CHECKOUT_EASE, motionAllowed } from './checkout-motion';

/**
 * The response when a checkout section is finished.
 *
 * The server decides which section is open (it is a fact about the session and
 * the customer record, not about the browser), and every completed step ends in
 * a re-render. This wraps the sections and notices when that decision changes
 * between renders -- never on the first one, because checkout is a task and
 * the rule for tasks is that nothing moves before someone has done something.
 *
 * When it does change, three things happen, in the order they matter:
 *
 *   1. Focus moves to the heading of the section that just opened, and the
 *      page scrolls to it if it is not already in view. This is the part that
 *      is not decoration: without it a keyboard or screen-reader user is left
 *      on a button that no longer exists.
 *   2. The tick on the section that just finished is written in with an SVG
 *      stroke animation, so "done" is seen happening rather than found.
 *   3. The new section's contents rise into place, 400ms, which is about the
 *      time the scroll takes and so reads as the page arriving, not waiting.
 */
export function CheckoutFlow({ step, children }: { step: string; children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const previous = useRef(step);

  useLayoutEffect(() => {
    if (previous.current === step) return;
    previous.current = step;

    const root = scope.current;
    if (!root) return;

    const moving = motionAllowed();
    const current = root.querySelector<HTMLElement>('.co-section[data-state="current"]');

    if (current) {
      const top = current.getBoundingClientRect().top;
      if (top < 56 || top > window.innerHeight * 0.55) {
        current.scrollIntoView({ block: 'start', behavior: moving ? 'smooth' : 'auto' });
      }
      current.querySelector<HTMLElement>('.co-section-title')?.focus({ preventScroll: true });
    }

    if (!moving) return;

    const ticks = root.querySelectorAll<SVGPathElement>(
      '.co-section[data-state="done"] .co-step-check path',
    );
    const tick = ticks[ticks.length - 1];
    if (tick) {
      const length = tick.getTotalLength();
      tick.animate(
        [
          { strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
          { strokeDasharray: `${length}`, strokeDashoffset: '0' },
        ],
        { duration: 500, delay: 100, easing: CHECKOUT_EASE },
      );
    }

    current?.querySelector<HTMLElement>('.co-section-body')?.animate(
      [
        { opacity: 0, transform: 'translateY(14px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 400, easing: CHECKOUT_EASE },
    );
  }, [step]);

  return (
    <div ref={scope} className="co-flow">
      {children}
    </div>
  );
}
