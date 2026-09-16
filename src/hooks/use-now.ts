'use client';

import { useSyncExternalStore } from 'react';

/**
 * A clock the screen ticks on.
 *
 * The board's "waiting 3 min" and "4 min over" labels are computed at render
 * time, and a live board only renders when a ticket changes. On a quiet
 * afternoon nothing changes for ten minutes, and a display that still says
 * "just now" about a ticket placed at the start of that is wrong in the one
 * way a kitchen display must not be. This re-renders every subscriber on an
 * interval, so every relative time, deadline and overdue border is at most
 * that far out of date.
 *
 * One clock for the page rather than one per component: every board and card
 * that asks for the time gets the same instant and re-renders in the same
 * pass. The interval runs only while something is subscribed.
 *
 * `initial` is the server's clock at render time. Hydration renders with it,
 * so the HTML the server sent and the HTML React expects agree to the
 * character; React then compares it with the live snapshot and, finding the
 * clock has moved on, re-renders once with the real time.
 */

/** How often the waiting times and deadlines are redrawn. */
const TICK_MS = 30_000;

let now = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick(): void {
  now = Date.now();
  for (const listener of listeners) listener();
}

function handleVisibility(): void {
  // A backgrounded tab's timers are throttled; the moment it is looked at
  // again, every label is brought up to date rather than waiting out the
  // remainder of the interval.
  if (document.visibilityState === 'visible') tick();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (timer === null) {
    // The module may have loaded long before the first subscriber; the
    // snapshot is refreshed here so the first render is not that old.
    now = Date.now();
    timer = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', handleVisibility);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', handleVisibility);
    }
  };
}

function snapshot(): number {
  return now;
}

export function useNow(initial: number): number {
  return useSyncExternalStore(subscribe, snapshot, () => initial);
}
