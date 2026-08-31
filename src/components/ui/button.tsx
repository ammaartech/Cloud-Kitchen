'use client';

import type { ComponentPropsWithoutRef } from 'react';
import { useFormStatus } from 'react-dom';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-styles';
import { Spinner } from './spinner';

/**
 * The button.
 *
 * A submit button inside a `<form action={…}>` knows the form is in flight via
 * `useFormStatus`, so every server-action form in the app gets a disabled
 * state and a spinner without each page wiring one up. Outside a pending form
 * the hook reports false and this is an ordinary button.
 *
 * That matters here because most admin and account mutations are plain form
 * posts: without this, a slow save looks like a dead button and gets clicked
 * twice (PRD 19: clear loading states; PRD 11: critical operations idempotent
 * -- but not needing the idempotency is better still).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  type,
  disabled,
  ...rest
}: ComponentPropsWithoutRef<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  const { pending } = useFormStatus();
  const submitting = pending && (type === 'submit' || type === undefined);

  return (
    <button
      type={type}
      disabled={disabled || submitting}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {submitting ? <Spinner /> : null}
      {children}
    </button>
  );
}
