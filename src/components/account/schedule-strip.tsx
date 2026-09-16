'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { calendarDate } from '@/lib/checkout/schedule';
import type { ScheduleDay, ScheduleDayKind } from '@/lib/account/schedule';
import { useMotion } from './account-motion';
import { usePreview } from './account-stage';

const KIND_TEXT: Record<ScheduleDayKind, string> = {
  kitchen: 'with the kitchen',
  delivery: 'delivery',
  skipped: 'skipped',
  paused: 'paused',
  rest: 'no delivery',
};

/**
 * The next two weeks, one mark per day.
 *
 * Dates, not a rule. "Weekdays, lunch" is what the plan says; what the customer
 * actually needs is whether food is coming on Thursday, and this answers that
 * for each of the next fourteen days. Two rows of seven on every width, so the
 * rows read as the next two weeks rather than wrapping wherever a screen runs
 * out.
 *
 * Every state is a different shape as well as a different colour -- a filled
 * dot, a ring with a stroke through it, a hatched square, nothing -- and every
 * cell carries its state in words for a screen reader, with the legend below
 * for everyone else. A day with a delivery is a link to that delivery's row.
 *
 * Two things move, and both are answers:
 *
 * - **A day changing state.** After a skip the dot folds into the struck ring;
 *   the strike is drawn from its left end.
 * - **The pause preview.** While the pause form holds a range, the days it
 *   covers are marked as they would be, and the ones that lose a delivery
 *   settle in with a short stagger so the eye finds them.
 */
export function ScheduleStrip({ days }: { days: ScheduleDay[] }) {
  const preview = usePreview();
  const { scope, animate } = useMotion<HTMLOListElement>();
  const previous = useRef<Map<string, ScheduleDayKind> | null>(null);

  // Before paint, so a day that has just changed never flashes its new state
  // at full size before the animation takes it from the old one.
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = new Map(days.map((day) => [day.date, day.kind]));
    if (!before) return;

    const changed = days.filter((day) => before.has(day.date) && before.get(day.date) !== day.kind);
    if (changed.length === 0) return;

    animate((gsap, root) => {
      for (const day of changed) {
        const cell = root.querySelector<HTMLElement>(`[data-date="${day.date}"]`);
        if (!cell) continue;
        const mark = cell.querySelector('.acct-day-mark');
        const strike = cell.querySelector('.acct-day-strike');

        gsap.fromTo(mark, { scale: 0.6 }, { scale: 1, duration: 0.42, ease: 'ck' });
        if (strike) {
          gsap.fromTo(
            strike,
            { scaleX: 0 },
            { scaleX: 1, duration: 0.34, ease: 'ck', delay: 0.08, transformOrigin: 'left center' },
          );
        }
      }
    });
  }, [days, animate]);

  useEffect(() => {
    if (!preview) return;
    animate((gsap, root) => {
      const hit = root.querySelectorAll('[data-preview="skip"] .acct-day-mark');
      if (hit.length === 0) return;
      gsap.fromTo(
        hit,
        { scale: 0.75 },
        { scale: 1, duration: 0.3, ease: 'ck', stagger: 0.03, overwrite: 'auto' },
      );
    });
  }, [preview, animate]);

  return (
    <div className="acct-strip">
      <ol ref={scope} className="acct-days" aria-label="Your next two weeks">
        {days.map((day) => {
          const inPreview = preview !== null && day.date >= preview.from && day.date <= preview.to;
          const previewKind = inPreview ? (day.kind === 'delivery' ? 'skip' : 'pause') : undefined;
          const described = `${calendarDate(day.date)}: ${
            previewKind === 'skip' ? 'would be skipped by this pause' : KIND_TEXT[day.kind]
          }${day.isToday ? ', today' : ''}${day.isCycleEnd ? ', last day of this cycle' : ''}`;

          const body = (
            <>
              <span className="acct-day-name" aria-hidden>
                {day.weekday}
              </span>
              <span className="acct-day-num tabular" aria-hidden>
                {day.dayOfMonth}
              </span>
              <span className="acct-day-mark" aria-hidden>
                {day.kind === 'skipped' ? <span className="acct-day-strike" /> : null}
              </span>
              <span className="sr-only">{described}</span>
            </>
          );

          return (
            <li
              key={day.date}
              className="acct-day"
              data-date={day.date}
              data-kind={day.kind}
              data-today={day.isToday ? '' : undefined}
              data-cycle-end={day.isCycleEnd ? '' : undefined}
              data-preview={previewKind}
            >
              {day.deliveryIds.length > 0 ? (
                <a href={`#delivery-${day.deliveryIds[0]}`} className="acct-day-cell">
                  {body}
                </a>
              ) : (
                <span className="acct-day-cell">{body}</span>
              )}
            </li>
          );
        })}
      </ol>

      <ul className="acct-legend" aria-hidden>
        <li data-kind="delivery">
          <span className="acct-day-mark" />
          Delivery
        </li>
        <li data-kind="kitchen">
          <span className="acct-day-mark" />
          With the kitchen
        </li>
        <li data-kind="skipped">
          <span className="acct-day-mark">
            <span className="acct-day-strike" />
          </span>
          Skipped
        </li>
        <li data-kind="paused">
          <span className="acct-day-mark" />
          Paused
        </li>
      </ul>
    </div>
  );
}
