'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { CHECKOUT_EASE, motionAllowed } from './checkout-motion';

/**
 * The selection ring travels to the option that was chosen.
 *
 * A single-choice group (delivery window, address, payment method) draws a ring
 * inside the selected option only. When the choice changes React removes the
 * old ring and renders a new one inside the new option, so left to itself the
 * ring would blink out and in. Measuring the old one before the state update
 * and the new one after the commit gives both boxes, and the new ring is played
 * from the old one's position and size -- so it reads as the same ring sliding
 * across.
 *
 * That is feedback about the choice itself, which is why it survives this
 * flow's rule against motion: it shows *what changed*, at the speed of a press
 * (340ms), and never stands between the tap and the next thing.
 *
 * Size is animated as width and height rather than as a scale. The ring is a
 * 2px border (a 1.5px inset shadow in the switch), and scaling a box scales its
 * border with it -- a ring moving between options of different heights would
 * visibly thicken and thin on the way. It is an empty, absolutely positioned,
 * `pointer-events: none` span, so laying it out each frame costs nothing that
 * anything else can see.
 *
 * Usage: call `capture()` in the change handler, before the state update, so
 * the first position is recorded while the old ring is still in the DOM. The
 * layout effect runs after React has committed the new ring and before paint,
 * which is the moment the second measurement needs.
 */
export function useChoiceFlip(scope: RefObject<HTMLElement | null>, selected: unknown) {
  const pending = useRef<DOMRect | null>(null);

  useLayoutEffect(() => {
    const from = pending.current;
    pending.current = null;
    const ring = scope.current?.querySelector<HTMLElement>('.choice-ring');
    if (!from || !ring) return;

    const to = ring.getBoundingClientRect();

    /* A choice changed again mid-slide: drop the ring's in-flight tween so the
       new one starts from the box just measured rather than fighting it. */
    ring.getAnimations().forEach((animation) => animation.cancel());

    /* `translate` rather than `transform`, so this never clobbers a transform
       the stylesheet may put on the ring later. */
    ring.animate(
      [
        {
          translate: `${from.left - to.left}px ${from.top - to.top}px`,
          width: `${from.width}px`,
          height: `${from.height}px`,
        },
        { translate: '0px 0px', width: `${to.width}px`, height: `${to.height}px` },
      ],
      { duration: 340, easing: CHECKOUT_EASE },
    );
  }, [selected, scope]);

  return function capture() {
    if (!scope.current || !motionAllowed()) return;
    const ring = scope.current.querySelector<HTMLElement>('.choice-ring');
    if (ring) pending.current = ring.getBoundingClientRect();
  };
}
