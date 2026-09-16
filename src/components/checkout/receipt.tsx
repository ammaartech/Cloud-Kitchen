'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { buttonClasses } from '@/components/ui/button-styles';
import { cx } from '@/components/ui/primitives';
import { CheckIcon } from '@/components/site/icons';
import { money } from '@/lib/format';
import { gsap, motionAllowed, useGSAP } from './checkout-gsap';

export interface ReceiptDetails {
  planName: string;
  subscriptionNumber?: string;
  creditsGranted?: number;
  deliveriesGenerated?: number;
  total: number | null;
  /** "Thu, 17 Sept · 12:00 pm - 2:30 pm", or null for a credit plan. */
  firstDelivery: string | null;
  deliverTo: string;
  isCredits: boolean;
}

/**
 * The confirmed payment, as the ticket being printed and stamped.
 *
 * This is the one place in the buying flow with a sequence rather than a
 * single response, and it has earned it: the task is over, the money has been
 * verified on the server, and the page's only remaining job is to say so in a
 * way nobody doubts. The ticket prints (a clip wipe, top to bottom), the check
 * is written, the stamp lands, and the subscription number resolves out of
 * scrambled digits -- about a second in all, with every line already readable
 * as it arrives.
 *
 * Everything is in the DOM from the first frame, so a screen reader reads a
 * finished receipt; the number that scrambles is hidden from assistive tech,
 * which gets a plain copy beside it. With reduced motion, none of it moves.
 */
export function Receipt({ details }: { details: ReceiptDetails }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      scope.current?.querySelector<HTMLElement>('.co-receipt-title')?.focus({ preventScroll: true });
      scope.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
      if (!motionAllowed()) return;

      const number = scope.current?.querySelector('.co-receipt-number');
      const timeline = gsap.timeline({ defaults: { ease: 'ck' } });

      timeline
        .fromTo(
          '.co-receipt-paper',
          { clipPath: 'inset(0% 0% 100% 0%)', y: -16 },
          { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.7, clearProps: 'clipPath,transform' },
        )
        .fromTo('.co-receipt-check path', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.45 }, 0.3)
        .fromTo(
          '.co-receipt-line',
          { autoAlpha: 0, y: 8 },
          { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.06 },
          0.35,
        )
        .fromTo(
          '.co-receipt-stamp',
          { autoAlpha: 0, scale: 1.9, rotation: -22 },
          { autoAlpha: 1, scale: 1, rotation: -9, duration: 0.42, ease: 'back.out(2)' },
          0.6,
        );

      if (number && details.subscriptionNumber) {
        timeline.fromTo(
          number,
          { scrambleText: { text: details.subscriptionNumber.replace(/\d/g, '0'), chars: '0123456789' } },
          {
            scrambleText: {
              text: details.subscriptionNumber,
              chars: '0123456789',
              speed: 0.6,
              revealDelay: 0.25,
            },
            duration: 0.9,
            ease: 'none',
          },
          0.45,
        );
      }
    },
    { scope },
  );

  return (
    <div ref={scope} className="co-receipt" role="region" aria-labelledby="co-receipt-title">
      {/* The shadow is a filter on a wrapper: the paper's torn edge is a mask,
          and a mask clips a box-shadow to a rectangle. */}
      <div className="co-receipt-shadow">
      <div className="co-receipt-paper ticket-stock">
        <span className="co-receipt-stamp" aria-hidden>
          paid
        </span>

        <div className="co-receipt-head">
          <span className="co-receipt-seal" aria-hidden>
            <CheckIcon className="co-receipt-check" />
          </span>
          <p className="ticket-meta co-receipt-line">
            <span>subscription confirmed</span>
          </p>
          <h2 id="co-receipt-title" tabIndex={-1} className="co-receipt-title">
            Your plan is active
          </h2>
          <p className="ticket-name co-receipt-line">{details.planName}</p>
          {details.subscriptionNumber ? (
            <p className="co-receipt-line co-receipt-ref">
              <span className="sr-only">Subscription number {details.subscriptionNumber}</span>
              <span className="co-receipt-number tabular" aria-hidden>
                {details.subscriptionNumber}
              </span>
            </p>
          ) : null}
        </div>

        <dl className="co-receipt-rows">
          {details.isCredits ? (
            <div className="ticket-row co-receipt-line">
              <dt>credits ready</dt>
              <dd className="tabular">{details.creditsGranted ?? 0}</dd>
            </div>
          ) : (
            <>
              {details.firstDelivery ? (
                <div className="ticket-row co-receipt-line">
                  <dt>first delivery</dt>
                  <dd>{details.firstDelivery}</dd>
                </div>
              ) : null}
              <div className="ticket-row co-receipt-line">
                <dt>deliveries scheduled</dt>
                <dd className="tabular">{details.deliveriesGenerated ?? 0}</dd>
              </div>
            </>
          )}
          <div className="ticket-row co-receipt-line">
            <dt>deliver to</dt>
            <dd>{details.deliverTo}</dd>
          </div>
          {details.total !== null ? (
            <div className="ticket-total co-receipt-line">
              <span className="ticket-total-label">paid</span>
              <span className="ticket-price tabular">{money(details.total)}</span>
            </div>
          ) : null}
        </dl>
        </div>
      </div>

      <div className="co-receipt-next co-receipt-line">
        <p>
          {details.isCredits
            ? 'Book meals against your credits from your account, for any window the plan offers.'
            : 'Each meal enters the kitchen queue shortly before its delivery window. Skip, pause or change days from your account.'}
        </p>
        <div className="co-receipt-actions">
          <Link href="/account" className={cx(buttonClasses('primary', 'lg'), 'btn-square')}>
            Go to my account
          </Link>
          <Link href="/menu" className={cx(buttonClasses('outline', 'lg'), 'btn-square')}>
            See the menu
          </Link>
        </div>
      </div>
    </div>
  );
}
