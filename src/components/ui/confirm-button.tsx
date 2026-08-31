'use client';

import { useEffect, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Button } from './button';
import type { ButtonSize, ButtonVariant } from './button-styles';

/**
 * A destructive submit that cannot fire on a single click (PRD 19).
 *
 * First click arms it -- the label changes to the confirmation and the button
 * turns danger-red so the second click is a decision, not a repeat. Doing
 * nothing for a few seconds disarms it. No modal: these live inside dense
 * admin tables where a dialog per row is heavier than the action deserves,
 * and the two-click pattern keeps the confirmation exactly where the eye is.
 */
export function ConfirmButton({
  children,
  confirmLabel = 'Click again to delete',
  variant = 'ghost',
  size = 'sm',
  className,
  ...rest
}: Omit<ComponentPropsWithoutRef<'button'>, 'type'> & {
  confirmLabel?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (armed) {
    return (
      <Button
        type="submit"
        variant="danger"
        size={size}
        className={className}
        onBlur={() => setArmed(false)}
        {...rest}
      >
        {confirmLabel}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        setArmed(true);
        timer.current = setTimeout(() => setArmed(false), 4000);
      }}
      {...rest}
    >
      {children}
    </Button>
  );
}
