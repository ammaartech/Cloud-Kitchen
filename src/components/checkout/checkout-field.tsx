import type { ReactNode } from 'react';
import { cx } from '@/components/ui/primitives';
import { CheckIcon } from '@/components/site/icons';

/**
 * A labelled checkout field.
 *
 * Separate from the admin `Field` because checkout is filled in on a phone by
 * someone who has never seen the form, and three things follow from that:
 *
 *   - **Both kinds of field are marked.** Required ones carry an asterisk and
 *     optional ones say "optional" in words. Marking only one kind leaves
 *     people guessing about the other, and the guess that costs a failed submit
 *     is the common one.
 *   - **The message sits under the control it is about**, and an error replaces
 *     the hint rather than joining it, so the field says one thing at a time.
 *   - **A finished field gets a tick.** Confirmation that an entry is right is
 *     as useful as being told when it is wrong; people slow down on long forms
 *     for lack of it.
 *
 * The control itself is passed in, so every input keeps its own `type`,
 * `inputMode` and `autoComplete` -- the attributes that decide which keyboard a
 * phone opens and whether autofill can do the typing.
 */
export function CheckoutField({
  id,
  label,
  required,
  optional,
  hint,
  error,
  valid,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  error?: string | null;
  valid?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx('co-field', className)}
      data-invalid={error ? '' : undefined}
      data-valid={valid && !error ? '' : undefined}
    >
      <label htmlFor={id} className="co-label">
        {label}
        {required ? (
          <span className="co-required" aria-hidden>
            *
          </span>
        ) : null}
        {optional ? <span className="co-optional">optional</span> : null}
      </label>

      <div className="co-control">
        {children}
        {valid && !error ? <CheckIcon className="co-valid-mark" /> : null}
      </div>

      {error ? (
        <p id={`${id}-error`} className="co-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="co-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The id a control should point `aria-describedby` at, matching what the field shows. */
export function describedBy(id: string, error?: string | null, hint?: ReactNode): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
