'use client';

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';
import { updateCoupon, type CouponState } from '@/app/checkout/actions';
import { Spinner, cx } from '@/components/ui/primitives';
import { buttonClasses } from '@/components/ui/button-styles';
import { TagIcon } from '@/components/site/icons';
import { money } from '@/lib/format';
import { shake } from './checkout-motion';

/**
 * The offer code, in the order summary.
 *
 * Collapsed to a link until someone asks for it. A code field that is always
 * open reads as "there is a discount you do not have", and sends people off to
 * search for one mid-checkout; most customers either arrive with the kitchen's
 * offer already on the plan or have no code at all.
 *
 * Every outcome is said in words next to the field. A refused code keeps what
 * was typed, shakes the field that refused it and says why in the customer's
 * terms ("You have already used this offer on this account"), and a code the
 * database has not yet been able to check -- before a customer record exists --
 * says exactly that rather than pretending to be applied.
 */
export function CouponField({
  code,
  applied,
  discount,
  reason,
  canCheck,
  onBeforeChange,
}: {
  /** The code on the plan now, applied or not. */
  code: string | null;
  applied: boolean;
  discount: number;
  /** Why the code on the plan did not apply, already phrased. */
  reason: string | null;
  /** False until there is a customer to check the code against. */
  canCheck: boolean;
  /** Called just before the order is re-priced, so the summary can record its rows. */
  onBeforeChange?: () => void;
}) {
  const [state, dispatch, pending] = useActionState<CouponState, FormData>(updateCoupon, {
    status: 'idle',
  });
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const inputId = `${id}-code`;
  const messageId = `${id}-message`;
  const rejected = state.status === 'rejected';

  useEffect(() => {
    if (state.status !== 'rejected') return;
    shake(inputRef.current);
    inputRef.current?.focus();
  }, [state]);

  function send(intent: 'apply' | 'remove') {
    const data = new FormData();
    data.set('intent', intent);
    data.set('code', value);
    onBeforeChange?.();
    startTransition(() => dispatch(data));
  }

  const note = !code
    ? null
    : applied
      ? `Applied. You save ${money(discount)}.`
      : canCheck
        ? (reason ?? 'This code does not apply to this plan.')
        : 'We check this code as soon as your delivery details are saved.';

  return (
    <div className="co-coupon">
      {code ? (
        <div className="co-coupon-chip" data-applied={applied ? '' : undefined}>
          <TagIcon className="co-coupon-tag" />
          <div className="min-w-0 flex-1">
            <p className="co-coupon-code">{code}</p>
            <p className="co-coupon-note">{note}</p>
          </div>
          <button
            type="button"
            className="co-link"
            disabled={pending}
            onClick={() => send('remove')}
          >
            {pending ? <Spinner className="size-3.5" /> : null}
            Remove<span className="sr-only"> code {code}</span>
          </button>
        </div>
      ) : open ? (
        <form
          className="co-coupon-form"
          onSubmit={(event) => {
            event.preventDefault();
            send('apply');
          }}
        >
          <label htmlFor={inputId} className="co-coupon-label">
            Offer code
          </label>
          <div className="co-coupon-row">
            <input
              ref={inputRef}
              id={inputId}
              name="code"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={40}
              aria-invalid={rejected || undefined}
              aria-describedby={messageId}
              className="co-input co-coupon-input"
            />
            <button
              type="submit"
              className={buttonClasses('outline', 'md', 'co-coupon-apply')}
              disabled={pending}
            >
              {pending ? <Spinner /> : null}
              Apply
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="co-link"
          aria-expanded={false}
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          <TagIcon className="co-coupon-tag" />
          Have an offer code?
        </button>
      )}

      <p
        id={messageId}
        role="status"
        aria-live="polite"
        className={cx('co-coupon-message', rejected && 'is-error')}
      >
        {rejected || state.status === 'removed' ? state.message : ''}
      </p>
    </div>
  );
}
