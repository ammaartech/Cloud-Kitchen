'use client';

import { useLayoutEffect, useRef } from 'react';
import { countText, useMotion } from './account-motion';

/**
 * The balance, with a meter against what a full cycle grants.
 *
 * The number is the ledger's, read on the server; nothing here computes a
 * balance. What this adds is the change being seen: after a skip or a pause
 * returns credits, the figure counts from the old balance to the new one and
 * the meter grows to match, so "3 credits are back" is something the customer
 * watches happen rather than a sentence they have to check against a number.
 */
export function CreditsFigure({ credits, perCycle }: { credits: number | null; perCycle: number | null }) {
  const { scope, animate } = useMotion<HTMLDivElement>();
  const previous = useRef(credits);

  const ratio = credits !== null && perCycle ? Math.min(Math.max(credits / perCycle, 0), 1) : null;

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = credits;
    if (before === null || credits === null || before === credits) return;

    animate((gsap, root) => {
      const value = root.querySelector<HTMLElement>('.acct-credits-value');
      if (value) countText(gsap, value, before, credits);

      const fill = root.querySelector('.acct-meter-fill');
      if (fill && perCycle) {
        gsap.fromTo(
          fill,
          { scaleX: Math.min(Math.max(before / perCycle, 0), 1) },
          {
            scaleX: Math.min(Math.max(credits / perCycle, 0), 1),
            duration: 0.6,
            ease: 'ck',
            transformOrigin: 'left center',
            // Hand the resting width back to the stylesheet, so the next
            // server render is what decides it.
            clearProps: 'transform',
          },
        );
      }

      // GSAP cannot interpolate from a `var()`, so the token is read to a real
      // colour first -- still the token, never a hex written here.
      const tint = getComputedStyle(root).getPropertyValue('--ck-brand-soft').trim();
      if (tint) {
        gsap.fromTo(
          root,
          { backgroundColor: tint },
          { backgroundColor: 'rgba(0,0,0,0)', duration: 1.1, ease: 'ck', clearProps: 'backgroundColor' },
        );
      }
    });
  }, [credits, perCycle, animate]);

  if (credits === null) {
    return (
      <div className="acct-credits">
        <p className="acct-credits-missing">Your balance could not be loaded just now. Refresh to try again.</p>
      </div>
    );
  }

  return (
    <div ref={scope} className="acct-credits">
      <p className="acct-credits-figure">
        <span className="acct-credits-value tabular">{credits}</span>
        <span className="acct-credits-unit">
          {credits === 1 ? 'credit' : 'credits'} left
          {perCycle ? <span className="acct-credits-of"> of {perCycle}</span> : null}
        </span>
      </p>
      {ratio !== null ? (
        <div className="acct-meter" aria-hidden>
          <span className="acct-meter-fill" style={{ '--acct-fill': ratio } as React.CSSProperties} />
        </div>
      ) : null}
    </div>
  );
}
