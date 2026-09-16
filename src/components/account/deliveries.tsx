'use client';

import { useLayoutEffect, useRef } from 'react';
import { calendarDate } from '@/lib/checkout/schedule';
import { clockTime } from '@/lib/format';
import {
  KITCHEN_STEPS,
  kitchenStep,
  relativeDay,
  skipDeadline,
  type UpcomingDelivery,
} from '@/lib/account/schedule';
import type { AccountAction } from '@/lib/account/action-state';
import { CheckIcon, LockIcon } from '@/components/site/icons';
import { useMotion } from './account-motion';
import { SkipControl } from './skip-control';

type Shared = {
  today: string;
  /** The render's clock, as an ISO string, so the server and the islands agree. */
  now: string;
  returnsCredits: boolean;
  skipAction: AccountAction;
};

function dishes(items: UpcomingDelivery['items']): string | null {
  if (items.length === 0) return null;
  return items.map((item) => (item.quantity > 1 ? `${item.quantity} × ${item.name}` : item.name)).join(', ');
}

function consequence(delivery: UpcomingDelivery, returnsCredits: boolean): string {
  if (!returnsCredits || delivery.creditsCost === 0) return 'The kitchen will not cook it.';
  return `${delivery.creditsCost} ${delivery.creditsCost === 1 ? 'credit goes' : 'credits go'} back to your balance.`;
}

/** "tomorrow's lunch", "Fri, 19 Sept lunch" -- the thing being skipped, in words. */
function naming(delivery: UpcomingDelivery, today: string): string {
  const day = relativeDay(delivery.date, today);
  const window = delivery.windowLabel.toLowerCase();
  if (day === 'Today' || day === 'Tomorrow') return `${day.toLowerCase()}'s ${window}`;
  return `${window} on ${day}`;
}

/**
 * The next thing that is going to happen, at the top of the page.
 *
 * Every account page visit starts with one question -- is food coming, and can
 * I still change it -- so this answers both before anything else: the day in
 * words, what is being cooked, and, while it can still be skipped, exactly how
 * long for. The deadline is the kitchen's real one (window opening less the
 * release lead time), so "until 10:30 am" is the moment the server would start
 * refusing, not a rule of thumb.
 *
 * Once the kitchen has it, the skip goes and a progress line takes its place.
 */
export function NextDelivery({
  delivery,
  emptyNote,
  today,
  now,
  returnsCredits,
  skipAction,
}: Shared & { delivery: UpcomingDelivery | null; emptyNote: string }) {
  const { scope, animate } = useMotion<HTMLElement>();
  const shown = useRef<string | null>(delivery?.id ?? null);

  // When the delivery at the top changes -- the one that was here was just
  // skipped -- the next one rises into its place instead of being swapped in
  // silently, so it reads as the queue moving up.
  useLayoutEffect(() => {
    const id = delivery?.id ?? null;
    if (shown.current === id) return;
    shown.current = id;
    animate((gsap, root) => {
      gsap.fromTo(
        root.querySelector('.acct-next-body'),
        // Opacity rather than autoAlpha, so a keyboard user's focus inside the
        // panel is never dropped by a momentary `visibility: hidden`.
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.38, ease: 'ck', clearProps: 'transform,opacity' },
      );
    });
  }, [delivery?.id, animate]);

  return (
    <section ref={scope} className="acct-next" aria-labelledby="acct-next-title">
      <h2 id="acct-next-title" className="acct-label">
        Next delivery
      </h2>

      {delivery ? (
        <div className="acct-next-body">
          <p className="acct-next-day">{relativeDay(delivery.date, today)}</p>
          <p className="acct-next-when">
            {relativeDay(delivery.date, today) === calendarDate(delivery.date)
              ? null
              : `${calendarDate(delivery.date)} · `}
            {delivery.windowLabel}, from {clockTime(delivery.windowStartsAt)}
          </p>

          <p className="acct-next-dishes">
            {dishes(delivery.items) ?? 'The dishes are confirmed closer to the day.'}
          </p>

          {delivery.status === 'released' ? (
            <KitchenProgress delivery={delivery} />
          ) : (
            <NextActions
              delivery={delivery}
              today={today}
              now={now}
              returnsCredits={returnsCredits}
              skipAction={skipAction}
            />
          )}
        </div>
      ) : (
        <div className="acct-next-body">
          <p className="acct-next-empty">{emptyNote}</p>
        </div>
      )}
    </section>
  );
}

function NextActions({ delivery, today, now, returnsCredits, skipAction }: Shared & { delivery: UpcomingDelivery }) {
  const deadline = skipDeadline(delivery.locksAt, new Date(now), today);

  if (!deadline) {
    return (
      <p className="acct-next-lock">
        <LockIcon className="acct-inline-icon" />
        The kitchen is about to start on this one, so it can no longer be skipped.
      </p>
    );
  }

  return (
    <div className="acct-next-foot">
      <p className="acct-next-lock">
        <LockIcon className="acct-inline-icon" />
        You can skip this {deadline}.
      </p>
      <SkipControl
        deliveryId={delivery.id}
        label="Skip this delivery"
        question={`Skip ${naming(delivery, today)}?`}
        consequence={consequence(delivery, returnsCredits)}
        action={skipAction}
        size="md"
      />
    </div>
  );
}

/**
 * Where a delivery the kitchen has taken is, in five plain steps. The latest
 * step is the loud one; the finished ones are ticked; the estimate says it is
 * an estimate.
 */
function KitchenProgress({ delivery }: { delivery: UpcomingDelivery }) {
  const step = kitchenStep(delivery.kitchenStatus);

  if (step === null) {
    return (
      <p className="acct-next-lock" data-tone="danger">
        The kitchen could not prepare this delivery, so it will be credited back or refunded. Message us
        on WhatsApp if you have not heard from us.
      </p>
    );
  }

  const cooking = step <= 1 && delivery.prepEtaMinutes;

  return (
    <div className="acct-progress" style={{ '--acct-progress': step / (KITCHEN_STEPS.length - 1) } as React.CSSProperties}>
      <p className="acct-progress-now">
        <span>{KITCHEN_STEPS[step]}</span>
        {delivery.ticketCode ? <span className="acct-ticket-code">{delivery.ticketCode}</span> : null}
      </p>
      <ol className="acct-progress-steps" aria-label="Delivery progress">
        {KITCHEN_STEPS.map((label, index) => (
          <li
            key={label}
            data-state={index < step ? 'done' : index === step ? 'now' : 'next'}
            aria-current={index === step ? 'step' : undefined}
          >
            <span className="acct-progress-dot" aria-hidden>
              {index < step ? <CheckIcon /> : null}
            </span>
            <span className="acct-progress-label">{label}</span>
          </li>
        ))}
      </ol>
      {cooking ? (
        <p className="acct-progress-eta">Usually ready in about {delivery.prepEtaMinutes} minutes (an estimate).</p>
      ) : null}
    </div>
  );
}

/**
 * One delivery after the next one, as a row.
 *
 * A list, not cards: these are the same kind of thing, read in date order, and
 * the job is scanning down them for the day that needs changing. Skipped
 * deliveries stay in the list, struck through, so the customer can see what
 * they did rather than wondering where Thursday went.
 */
export function DeliveryRow({ delivery, today, now, returnsCredits, skipAction }: Shared & { delivery: UpcomingDelivery }) {
  const { scope, animate } = useMotion<HTMLLIElement>();
  const status = useRef(delivery.status);

  // A skip lands as the date being struck through from its left end and the
  // status settling in where the button was.
  useLayoutEffect(() => {
    if (status.current === delivery.status) return;
    const was = status.current;
    status.current = delivery.status;
    if (was !== 'scheduled' || delivery.status !== 'skipped') return;

    animate((gsap, root) => {
      gsap.fromTo(
        root.querySelector('.acct-row-strike'),
        { scaleX: 0 },
        { scaleX: 1, duration: 0.36, ease: 'ck', transformOrigin: 'left center' },
      );
      gsap.fromTo(
        root.querySelector('.acct-row-status'),
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.28, ease: 'ck', delay: 0.1, clearProps: 'transform,opacity' },
      );
    });
  }, [delivery.status, animate]);

  const deadline = delivery.status === 'scheduled' ? skipDeadline(delivery.locksAt, new Date(now), today) : null;
  const day = relativeDay(delivery.date, today);

  return (
    <li ref={scope} id={`delivery-${delivery.id}`} className="acct-row" data-status={delivery.status} tabIndex={-1}>
      <div className="acct-row-when">
        <p className="acct-row-day">
          <span className="acct-row-date">
            {day}
            {delivery.status === 'skipped' ? <span className="acct-row-strike" aria-hidden /> : null}
          </span>
          {day !== calendarDate(delivery.date) ? (
            <span className="acct-row-calendar">{calendarDate(delivery.date)}</span>
          ) : null}
        </p>
        <p className="acct-row-meta">
          {delivery.windowLabel}, {clockTime(delivery.windowStartsAt)}
        </p>
      </div>

      <p className="acct-row-dishes">{dishes(delivery.items) ?? 'Dishes confirmed closer to the day'}</p>

      <div className="acct-row-end">
        {delivery.status === 'skipped' ? (
          <p className="acct-row-status" data-tone="muted">
            Skipped
          </p>
        ) : delivery.status === 'released' ? (
          <p className="acct-row-status" data-tone="brand">
            With the kitchen
            {delivery.ticketCode ? <span className="acct-ticket-code">{delivery.ticketCode}</span> : null}
          </p>
        ) : deadline ? (
          <SkipControl
            deliveryId={delivery.id}
            label="Skip"
            question={`Skip ${naming(delivery, today)}?`}
            consequence={`${consequence(delivery, returnsCredits)} You can skip it ${deadline}.`}
            action={skipAction}
          />
        ) : (
          <p className="acct-row-status" data-tone="muted">
            <LockIcon className="acct-inline-icon" />
            Locked
          </p>
        )}
      </div>
    </li>
  );
}
