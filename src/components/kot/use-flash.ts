'use client';

import { useEffect, useRef } from 'react';

/**
 * Replays the `ck-flash` animation on a card each time its ticket changes.
 *
 * The flash used to be a class applied while `now - _changedAt` was under a
 * threshold. `now` only ticks every 30 seconds, so the class stayed on for up
 * to half a minute -- and a second change inside that window could not replay
 * an animation that was already applied. Restarting it from the change itself
 * fixes both, and keeps the card from re-rendering just to drop a class.
 *
 * Changes landing within `windowMs` of the last flash share it: an action's
 * optimistic patch, the server's confirmation and the Realtime echo arrive
 * within a second of each other, and are one change to the person watching.
 */
export function useFlash<T extends HTMLElement>(changedAt: number | undefined, windowMs = 2000) {
  const ref = useRef<T>(null);
  const lastRef = useRef(-Infinity);

  useEffect(() => {
    const element = ref.current;
    if (changedAt === undefined || !element) return;
    if (changedAt - lastRef.current < windowMs) return;
    lastRef.current = changedAt;

    element.classList.remove('ck-flash');
    // Reading layout commits the removal, so re-adding restarts the animation.
    void element.offsetWidth;
    element.classList.add('ck-flash');
  }, [changedAt, windowMs]);

  return ref;
}
