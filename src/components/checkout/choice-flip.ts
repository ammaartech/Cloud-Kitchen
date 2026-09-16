'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { Flip, motionAllowed } from './checkout-gsap';

/**
 * The selection ring travels to the option that was chosen.
 *
 * A single-choice group (delivery window, address, payment method) draws a ring
 * inside the selected option only, and every ring in the group shares one
 * `data-flip-id`. When the choice changes, React removes the old ring and
 * renders a new one inside the new option. Flip sees two elements with the same
 * id, one gone and one arrived, and animates the arrival from where the
 * departure was -- so the ring slides from the old card to the new one instead
 * of blinking out and in.
 *
 * That is feedback about the choice itself, which is why it survives this
 * flow's rule against motion: it shows *what changed*, at the speed of a press
 * (340ms), and never stands between the tap and the next thing.
 *
 * Usage: call `capture()` in the change handler, before the state update, so
 * the "first" position is recorded while the old ring is still in the DOM. The
 * layout effect runs after React has committed the new ring and before paint,
 * which is the moment Flip needs.
 */
export function useChoiceFlip(scope: RefObject<HTMLElement | null>, selected: unknown) {
  const pending = useRef<Flip.FlipState | null>(null);

  useLayoutEffect(() => {
    const state = pending.current;
    pending.current = null;
    if (!state || !scope.current) return;

    Flip.from(state, {
      targets: scope.current.querySelectorAll('.choice-ring'),
      duration: 0.34,
      ease: 'ck',
      zIndex: 2,
    });
  }, [selected, scope]);

  return function capture() {
    if (!scope.current || !motionAllowed()) return;
    const rings = scope.current.querySelectorAll('.choice-ring');
    if (rings.length) pending.current = Flip.getState(rings);
  };
}
