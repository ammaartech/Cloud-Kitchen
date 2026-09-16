import type { ReactNode } from 'react';
import { CheckIcon } from '@/components/site/icons';

export type SectionState = 'done' | 'current' | 'upcoming';

/**
 * One section of the checkout page: account, delivery, payment.
 *
 * Checkout is a single page of sections rather than a screen per step. The
 * whole job stays in view -- a customer can see that paying is two short
 * sections away before starting the first -- while only the section being
 * worked on is open. A finished section folds down to one line saying what was
 * decided, with a way to change it, so nothing already answered is asked again
 * and nothing is hidden behind a back button.
 *
 * `data-state` drives the look and the motion layer; the heading carries the
 * same state in words, because a number turning into a tick says nothing to a
 * screen reader. The heading takes focus when its section opens, so keyboard
 * and screen-reader users land where the work is instead of at the top of the
 * page.
 */
export function CheckoutSection({
  id,
  index,
  title,
  state,
  summary,
  action,
  children,
}: {
  id: string;
  index: number;
  title: string;
  state: SectionState;
  summary?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const headingId = `${id}-heading`;

  return (
    <section id={id} aria-labelledby={headingId} className="co-section" data-state={state}>
      <div className="co-section-head">
        <span className="co-step" aria-hidden>
          {state === 'done' ? <CheckIcon className="co-step-check" /> : index}
        </span>

        <div className="co-section-titles">
          <h2 id={headingId} tabIndex={-1} className="co-section-title">
            {title}
            <span className="sr-only">
              {state === 'done' ? ', done' : state === 'upcoming' ? ', not started' : ''}
            </span>
          </h2>
          {summary ? <div className="co-section-summary">{summary}</div> : null}
        </div>

        {action ? <div className="co-section-action">{action}</div> : null}
      </div>

      {children ? <div className="co-section-body">{children}</div> : null}
    </section>
  );
}
