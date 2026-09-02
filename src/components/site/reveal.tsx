'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useInView } from 'motion/react';
import { cx } from '@/components/ui/button-styles';

/**
 * A section that waits until it is on screen before it arrives.
 *
 * This is the whole of the component: it adds one class when it reaches the
 * viewport, and everything that happens next is a keyframe in `globals.css`.
 * Nothing about the motion lives here, which is the point -- `Reveal` does not
 * know whether it is wrapping a heading, a grid of cards or an illustration,
 * and the class it is given decides what arriving means for that thing. See
 * `.reveal-up` and `.calendar-mark` in the stylesheet.
 *
 * It is JavaScript for the same reason `step-flow.tsx` is: CSS still cannot
 * trigger on viewport intersection anywhere but Chromium, and a section below
 * the fold whose entrance ran at page load is an entrance nobody saw.
 * `useInView` is a bare `IntersectionObserver` hook -- no `LazyMotion` feature
 * bundle, and already in the chunk this route loads -- so the cost is the
 * observer and nothing else.
 *
 * `once`, always. These are arrivals, not state: a section that re-entered
 * every time it scrolled back past would be an idle loop with extra steps.
 *
 * The failure mode is decided by the stylesheet, not here, and the rule it
 * follows is the one the rest of this codebase follows. Content that has to
 * survive -- a heading, a price, a card -- is never hidden by a base rule, only
 * inside a keyframe, so a visitor whose JavaScript never lands, a headless
 * renderer and a screenshot service all get the finished section. Decoration
 * does the reverse: it starts invisible, so it can only ever appear by
 * animating.
 */
export function Reveal({
  className,
  delay = 0,
  amount = 0.2,
  children,
  'aria-hidden': ariaHidden,
}: {
  className?: string;
  /** Milliseconds behind the moment the section is seen. */
  delay?: number;
  /** How much of this element has to be visible before it counts as seen. */
  amount?: number;
  children?: ReactNode;
  /** For the childless case: a `Reveal` that is only ever an illustration. */
  'aria-hidden'?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount });

  return (
    <div
      ref={ref}
      className={cx(className, seen && 'is-revealed')}
      style={{ '--reveal-at': `${delay}ms` } as CSSProperties}
      aria-hidden={ariaHidden}
    >
      {children}
    </div>
  );
}
