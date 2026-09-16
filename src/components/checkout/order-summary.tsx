'use client';

import Link from 'next/link';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDownIcon, LockIcon } from '@/components/site/icons';
import { money } from '@/lib/format';
import { AnimatedMoney } from './animated-money';
import { CouponField } from './coupon-field';
import { Flip, gsap, motionAllowed } from './checkout-gsap';

export interface SummaryQuote {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  taxes: Array<{ code: string; rate: number; amount: number }>;
  total: number;
  couponCode: string | null;
  couponApplied: boolean;
  /** Already phrased for the customer. */
  couponReason: string | null;
}

export interface SummaryPlan {
  name: string;
  kind: string;
  /** The plan's own page, for "Edit plan". A slug rather than a built href, so
      the link is typed by the route it points at. */
  slug: string;
  rows: Array<{ label: string; value: string }>;
  meals: string[];
}

/**
 * What is being bought, drawn as the ticket it was on the plans page.
 *
 * The plan was chosen from a row of kitchen tickets on `/subscriptions`; here
 * the same ticket comes back, now filled in -- the window and days that were
 * picked, the meals, and a total that is the server's quote rather than the
 * sticker price. Same paper, same dotted leaders, same Zodiak name, so the
 * thing being paid for is recognisably the thing that was chosen.
 *
 * ## Phones
 *
 * The summary comes first in the markup and folds to one bar -- "Show order
 * summary" and the total -- so the total is on screen from the first moment
 * without the ticket pushing the form below the fold. From `lg` it is a sticky
 * column beside the form and the bar is not drawn.
 *
 * ## When the price changes
 *
 * Applying or removing a code re-prices the plan on the server and the page
 * re-renders. The rows are recorded with Flip just before that request, and
 * played from there when the new quote lands: the tax lines slide down to make
 * room for the offer line, which fades in, and the total counts to its new
 * value. Nothing about the new numbers is invented in the browser -- the motion
 * only connects the old server figures to the new ones.
 */
export function OrderSummary({
  plan,
  quote,
  canCheckCode,
}: {
  plan: SummaryPlan;
  quote: SummaryQuote | null;
  canCheckCode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const pricesRef = useRef<HTMLDivElement>(null);
  const recorded = useRef<Flip.FlipState | null>(null);

  const quoteKey = quote
    ? `${quote.total}|${quote.discount}|${quote.deliveryFee}|${quote.couponCode}|${quote.couponApplied}`
    : 'unpriced';

  useLayoutEffect(() => {
    const state = recorded.current;
    recorded.current = null;
    if (!state || !pricesRef.current) return;

    Flip.from(state, {
      targets: pricesRef.current.querySelectorAll('[data-flip-id]'),
      duration: 0.45,
      ease: 'ck',
      onEnter: (entering) =>
        gsap.fromTo(
          entering,
          { autoAlpha: 0, y: -8 },
          { autoAlpha: 1, y: 0, duration: 0.35, ease: 'ck', delay: 0.1 },
        ),
    });
  }, [quoteKey]);

  // Opening animates here, after the body is displayed; closing animates in
  // `toggle` first and only then hides it, or there would be nothing to watch.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!open || !body || !motionAllowed()) return;
    if (window.matchMedia('(min-width: 64rem)').matches) return;

    gsap.fromTo(
      body,
      { height: 0, autoAlpha: 0 },
      { height: 'auto', autoAlpha: 1, duration: 0.4, ease: 'ck', clearProps: 'height,opacity,visibility' },
    );
  }, [open]);

  function toggle() {
    const body = bodyRef.current;

    if (!open) {
      setOpen(true);
      return;
    }

    if (!body || !motionAllowed()) {
      setOpen(false);
      return;
    }

    gsap.to(body, {
      height: 0,
      autoAlpha: 0,
      duration: 0.3,
      ease: 'ck',
      onComplete: () => {
        setOpen(false);
        gsap.set(body, { clearProps: 'height,opacity,visibility' });
      },
    });
  }

  function recordRows() {
    if (!pricesRef.current || !motionAllowed()) return;
    recorded.current = Flip.getState(pricesRef.current.querySelectorAll('[data-flip-id]'));
  }

  return (
    <aside className="co-summary" data-open={open ? '' : undefined} aria-label="Order summary">
      <button
        type="button"
        className="co-summary-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
      >
        <span className="co-summary-toggle-label">
          {open ? 'Hide' : 'Show'} order summary
          <ChevronDownIcon className="co-summary-chevron" />
        </span>
        {quote ? <AnimatedMoney value={quote.total} className="co-summary-toggle-total tabular" /> : null}
      </button>

      <div id={bodyId} ref={bodyRef} className="co-summary-body">
        <div className="co-ticket ticket-stock">
          <p className="ticket-meta">
            <span>{plan.kind}</span>
            <Link href={`/subscriptions/${plan.slug}`} className="co-edit">
              Edit plan
            </Link>
          </p>
          <p className="ticket-name">{plan.name}</p>

          <dl className="co-ticket-block">
            {plan.rows.map((row) => (
              <div key={row.label} className="ticket-row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>

          {plan.meals.length > 0 ? (
            <div className="co-ticket-block">
              <p className="ticket-total-label">your meals</p>
              <ul className="co-ticket-meals">
                {plan.meals.map((meal) => (
                  <li key={meal}>{meal}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {quote ? (
            <>
              <div className="co-ticket-block co-ticket-coupon">
                <CouponField
                  code={quote.couponCode}
                  applied={quote.couponApplied}
                  discount={quote.discount}
                  reason={quote.couponReason}
                  canCheck={canCheckCode}
                  onBeforeChange={recordRows}
                />
              </div>

              <div ref={pricesRef} className="co-ticket-block co-prices">
                <dl>
                  <div className="ticket-row" data-flip-id="price-plan">
                    <dt>plan</dt>
                    <dd className="tabular">{money(quote.subtotal)}</dd>
                  </div>
                  {quote.discount > 0 ? (
                    <div className="ticket-row co-saving" data-flip-id="price-offer">
                      <dt>offer{quote.couponCode ? ` ${quote.couponCode}` : ''}</dt>
                      <dd className="tabular">&minus;{money(quote.discount)}</dd>
                    </div>
                  ) : null}
                  {quote.deliveryFee > 0 ? (
                    <div className="ticket-row" data-flip-id="price-delivery">
                      <dt>delivery</dt>
                      <dd className="tabular">{money(quote.deliveryFee)}</dd>
                    </div>
                  ) : null}
                  {quote.taxes.map((tax) => (
                    <div key={tax.code} className="ticket-row" data-flip-id={`price-${tax.code}`}>
                      <dt>
                        {tax.code} {tax.rate}%
                      </dt>
                      <dd className="tabular">{money(tax.amount)}</dd>
                    </div>
                  ))}
                </dl>

                <p className="ticket-total" data-flip-id="price-total">
                  <span className="ticket-total-label">total</span>
                  <AnimatedMoney value={quote.total} className="ticket-price tabular" />
                </p>
              </div>
            </>
          ) : (
            <p className="co-ticket-block co-ticket-warning">
              We could not price this plan just now. Refresh the page to try again. Nothing has been
              charged.
            </p>
          )}

          <p className="co-ticket-foot">
            <LockIcon className="shrink-0" />
            <span>No charge until you pay. If a payment fails, nothing is created or scheduled.</span>
          </p>
        </div>
      </div>
    </aside>
  );
}
