'use client';

import { useLayoutEffect, useRef } from 'react';
import { money } from '@/lib/format';
import { countTo } from './checkout-gsap';

/**
 * An amount that counts to its new value when the value changes.
 *
 * The server always renders the real figure, and nothing runs on first paint.
 * Only a change -- an offer applied or removed, which re-prices the plan on the
 * server -- runs the count, so the eye sees a total go down by the saving
 * rather than finding a different number where the old one was.
 *
 * The layout effect runs after React has written the new figure and before the
 * browser paints it, so the count starts from the old value with no flash of
 * the new one.
 */
export function AnimatedMoney({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);

  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (ref.current && from !== value) countTo(ref.current, from, value, money);
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {money(value)}
    </span>
  );
}
