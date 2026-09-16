'use client';

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';
import { saveDelivery, type DeliveryState } from '@/app/checkout/actions';
import { Alert, Spinner, cx } from '@/components/ui/primitives';
import { buttonClasses } from '@/components/ui/button-styles';
import {
  ADDRESS_LABELS,
  INDIAN_STATES,
  REQUIRED_FIELDS,
  checkField,
  type DeliveryField,
} from '@/lib/checkout/fields';
import { CheckoutField, describedBy } from './checkout-field';
import { useChoiceFlip } from './choice-flip';
import { shake } from './checkout-gsap';

type Values = Record<DeliveryField, string>;

/**
 * Who we deliver to and where: one form.
 *
 * This replaces two screens (your details, then an address) that between them
 * asked for a name and a mobile number twice, and that the account step had
 * already asked for once more. It is now asked once, with the name filled in
 * from the account.
 *
 * ## What shaped the fields
 *
 *   - **The keyboard is chosen for the field.** The mobile number opens the
 *     phone pad with +91 already printed; the PIN code opens digits; nothing
 *     that is not prose is autocorrected. Every field carries the
 *     `autocomplete` token browsers use to fill an address in one tap.
 *   - **Optional things stay out of the way.** Area and landmark are visible
 *     and marked optional, because an Indian address without them often cannot
 *     be found. Delivery instructions are rarer and sit behind a link.
 *   - **The mobile field says why it is there.** People are reluctant to hand
 *     over a number with no reason given; "the rider calls this if they cannot
 *     find you" is the reason.
 *   - **Errors are the shared rules** in `lib/checkout/fields.ts`, checked when
 *     a field is left and again, identically, on the server.
 */
export function DeliveryForm({
  defaultName,
  defaultPhone,
  includeConsent,
  submitLabel,
  onSaved,
  onCancel,
}: {
  defaultName: string;
  defaultPhone: string;
  /** Only for a first-time customer: the consent lives on the customer record. */
  includeConsent: boolean;
  submitLabel: string;
  onSaved?: (addressId: string) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const labelGroupRef = useRef<HTMLDivElement>(null);

  const [values, setValues] = useState<Values>({
    fullName: defaultName,
    phone: defaultPhone.replace(/^\+91/, ''),
    line1: '',
    line2: '',
    landmark: '',
    postalCode: '',
    city: '',
    state: '',
    label: 'Home',
    instructions: '',
  });
  const [touched, setTouched] = useState<Partial<Record<DeliveryField, boolean>>>({});
  const [showInstructions, setShowInstructions] = useState(false);
  const [state, dispatch, pending] = useActionState<DeliveryState, FormData>(saveDelivery, {
    status: 'idle',
  });

  // A server refusal is shown until the field it is about is edited.
  const [serverErrors, setServerErrors] = useState<DeliveryState['errors']>({});
  const captureLabel = useChoiceFlip(labelGroupRef, values.label);

  // Once per saved result: the owner's callback may re-render this form, and a
  // second call would select an address the customer has since moved off.
  const reported = useRef<DeliveryState | null>(null);
  useEffect(() => {
    if (state.status !== 'saved' || !state.addressId || reported.current === state) return;
    reported.current = state;
    onSaved?.(state.addressId);
  }, [state, onSaved]);

  useEffect(() => {
    if (state.status !== 'invalid' && state.status !== 'error') return;
    const firstInvalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    firstInvalid?.focus();
    shake(firstInvalid?.closest('.co-field') ?? formRef.current?.querySelector('[type="submit"]'));
  }, [state]);

  const fieldId = (field: DeliveryField) => `${id}-${field}`;

  function errorFor(field: DeliveryField): string | null {
    if (touched[field]) {
      const problem = checkField(field, values[field]);
      if (problem) return problem;
    }
    return serverErrors?.[field] ?? null;
  }

  function isValid(field: DeliveryField): boolean {
    return Boolean(touched[field] && values[field].trim() && !checkField(field, values[field]));
  }

  function update(field: DeliveryField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (serverErrors?.[field]) {
      setServerErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function leave(field: DeliveryField) {
    // An untouched empty field is not an error yet; someone tabbing past it on
    // the way to another field has not had a chance to fill it in.
    if (!values[field].trim() && !touched[field]) return;
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const everything = Object.fromEntries(
      (Object.keys(values) as DeliveryField[]).map((field) => [field, true]),
    );
    const invalid = (Object.keys(values) as DeliveryField[]).filter((field) =>
      checkField(field, values[field]),
    );

    if (invalid.length > 0) {
      setTouched(everything);
      const control = formRef.current?.querySelector<HTMLElement>(
        `#${CSS.escape(fieldId(invalid[0]))}`,
      );
      control?.focus();
      shake(control?.closest('.co-field'));
      return;
    }

    const data = new FormData(event.currentTarget);
    setServerErrors({});
    startTransition(() => dispatch(data));
  }

  // Server errors are copied in when a new result arrives; kept in state so an
  // edit can clear just the one it is about.
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.status === 'invalid') setServerErrors(state.errors ?? {});
  }

  const field = (name: DeliveryField) => ({
    id: fieldId(name),
    name,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      update(name, event.target.value),
    onBlur: () => leave(name),
    required: REQUIRED_FIELDS.includes(name),
    'aria-invalid': errorFor(name) ? true : undefined,
  });

  const phoneHint = 'The rider calls this number if they cannot find you.';
  const landmarkHint = 'Anything that helps the rider find the door.';

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="co-form">
      {state.status === 'error' ? (
        <div role="alert">
          <Alert tone="danger" title="That could not be saved">
            {state.message} Nothing was charged.
          </Alert>
        </div>
      ) : null}

      <div className="co-grid">
        <CheckoutField
          id={fieldId('fullName')}
          label="Full name"
          required
          error={errorFor('fullName')}
          valid={isValid('fullName')}
          className="co-span-2"
        >
          <input
            {...field('fullName')}
            className="co-input"
            autoComplete="shipping name"
            autoCapitalize="words"
            enterKeyHint="next"
            aria-describedby={describedBy(fieldId('fullName'), errorFor('fullName'))}
          />
        </CheckoutField>

        <CheckoutField
          id={fieldId('phone')}
          label="Mobile number"
          required
          hint={phoneHint}
          error={errorFor('phone')}
          valid={isValid('phone')}
          className="co-span-2"
        >
          <span className="co-input-prefix" aria-hidden>
            +91
          </span>
          <input
            {...field('phone')}
            className="co-input co-input-with-prefix"
            type="tel"
            inputMode="tel"
            autoComplete="shipping tel-national"
            enterKeyHint="next"
            maxLength={16}
            aria-describedby={describedBy(fieldId('phone'), errorFor('phone'), phoneHint)}
          />
        </CheckoutField>

        <CheckoutField
          id={fieldId('line1')}
          label="Flat, house number, building"
          required
          error={errorFor('line1')}
          valid={isValid('line1')}
          className="co-span-2"
        >
          <input
            {...field('line1')}
            className="co-input"
            autoComplete="shipping address-line1"
            enterKeyHint="next"
            aria-describedby={describedBy(fieldId('line1'), errorFor('line1'))}
          />
        </CheckoutField>

        <CheckoutField
          id={fieldId('line2')}
          label="Area, street"
          optional
          error={errorFor('line2')}
          className="co-span-2"
        >
          <input
            {...field('line2')}
            className="co-input"
            autoComplete="shipping address-line2"
            enterKeyHint="next"
            aria-describedby={describedBy(fieldId('line2'), errorFor('line2'))}
          />
        </CheckoutField>

        <CheckoutField
          id={fieldId('landmark')}
          label="Landmark"
          optional
          hint={landmarkHint}
          error={errorFor('landmark')}
          className="co-span-2"
        >
          <input
            {...field('landmark')}
            className="co-input"
            autoComplete="off"
            enterKeyHint="next"
            aria-describedby={describedBy(fieldId('landmark'), errorFor('landmark'), landmarkHint)}
          />
        </CheckoutField>

        <CheckoutField
          id={fieldId('postalCode')}
          label="PIN code"
          required
          error={errorFor('postalCode')}
          valid={isValid('postalCode')}
        >
          <input
            {...field('postalCode')}
            className="co-input tabular"
            inputMode="numeric"
            autoComplete="shipping postal-code"
            enterKeyHint="next"
            maxLength={7}
            aria-describedby={describedBy(fieldId('postalCode'), errorFor('postalCode'))}
          />
        </CheckoutField>

        <CheckoutField
          id={fieldId('city')}
          label="City"
          required
          error={errorFor('city')}
          valid={isValid('city')}
        >
          <input
            {...field('city')}
            className="co-input"
            autoComplete="shipping address-level2"
            autoCapitalize="words"
            enterKeyHint="next"
            aria-describedby={describedBy(fieldId('city'), errorFor('city'))}
          />
        </CheckoutField>

        <CheckoutField
          id={fieldId('state')}
          label="State"
          required
          error={errorFor('state')}
          valid={isValid('state')}
          className="co-span-2"
        >
          <select
            {...field('state')}
            className="co-input co-select"
            autoComplete="shipping address-level1"
            aria-describedby={describedBy(fieldId('state'), errorFor('state'))}
          >
            <option value="" disabled>
              Choose a state
            </option>
            {INDIAN_STATES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </CheckoutField>
      </div>

      <fieldset className="co-fieldset">
        <legend className="co-label">Save address as</legend>
        <div ref={labelGroupRef} className="co-chips">
          {ADDRESS_LABELS.map((label) => (
            <label key={label} className="co-chip">
              <input
                type="radio"
                name="label"
                value={label}
                checked={values.label === label}
                onChange={() => {
                  captureLabel();
                  update('label', label);
                }}
                className="sr-only"
              />
              {values.label === label ? <span className="choice-ring" data-flip-id="address-label" /> : null}
              <span className="relative">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {showInstructions ? (
        <CheckoutField
          id={fieldId('instructions')}
          label="Delivery instructions"
          optional
          hint="For example: call from the gate, the lift is slow."
          error={errorFor('instructions')}
        >
          <textarea
            {...field('instructions')}
            className="co-input co-textarea"
            maxLength={500}
            aria-describedby={describedBy(
              fieldId('instructions'),
              errorFor('instructions'),
              'hint',
            )}
          />
        </CheckoutField>
      ) : (
        <button
          type="button"
          className="co-link self-start"
          aria-expanded={false}
          onClick={() => {
            setShowInstructions(true);
            requestAnimationFrame(() =>
              formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(fieldId('instructions'))}`)?.focus(),
            );
          }}
        >
          + Add delivery instructions
        </button>
      )}

      {includeConsent ? (
        <label className="co-consent">
          <input
            type="checkbox"
            name="marketingConsent"
            defaultChecked
            className="co-checkbox"
          />
          <span>
            <span className="co-consent-title">Send me the occasional offer</span>
            <span className="co-hint">
              Optional, separate from your plan, and you can turn it off at any time.
            </span>
          </span>
        </label>
      ) : null}

      <div className={cx('co-form-actions', onCancel && 'has-cancel')}>
        <button
          type="submit"
          className={cx(buttonClasses('primary', 'lg'), 'btn-square co-submit')}
          disabled={pending}
        >
          {pending ? <Spinner /> : null}
          {pending ? 'Saving…' : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            className={cx(buttonClasses('ghost', 'lg'), 'btn-square')}
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
