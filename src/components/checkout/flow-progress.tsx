import { cx } from '@/components/ui/primitives';
import { CheckIcon } from '@/components/site/icons';

/**
 * Where the customer is in buying a plan: three steps, on both pages of it.
 *
 * Three rather than the checkout's internal stages (account, delivery,
 * payment), because those are sections of one page and each already says
 * whether it is done. This answers the other question -- how much is left --
 * and "two of three" is the honest answer on the checkout page whatever
 * section somebody is in. A visible finish line is one of the few things that
 * measurably keeps people in a checkout; a seven-dot tracker that counts form
 * sections does the opposite.
 *
 * Presentational and hook-free, so the static plan page and the checkout's
 * client stage can both render it.
 */

const STEPS = ['Your plan', 'Checkout', 'Confirmed'] as const;

export function FlowProgress({
  current,
  className,
}: {
  current: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <ol className={cx('flow-progress', className)} aria-label="Buying a plan">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const state = step < current ? 'done' : step === current ? 'current' : 'upcoming';

        return (
          <li
            key={label}
            className="flow-step"
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className="flow-dot" aria-hidden>
              {state === 'done' ? <CheckIcon className="size-3" /> : step}
            </span>
            <span className="flow-label">
              {label}
              <span className="sr-only">
                {state === 'done' ? ', done' : `, step ${step} of ${STEPS.length}`}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
