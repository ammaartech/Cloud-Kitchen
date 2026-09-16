'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { IDLE, type AccountAction } from '@/lib/account/action-state';
import { shake, useMotion } from './account-motion';
import { useStage } from './account-stage';

/**
 * Skip one delivery, in two presses.
 *
 * There is no un-skip on the server, so this cannot be the fast action with an
 * Undo that a reversible skip would deserve -- an Undo that cannot undo is the
 * worst of both. It is the next best thing: the first press turns the button
 * into the question, with what the skip will do written beside it ("returns 1
 * credit"), and the second press is the decision. No dialog, no timeout that
 * disarms it while someone is still reading, and Escape or "Keep it" puts it
 * back.
 *
 * A refusal -- the kitchen took it while the question was open -- is said next
 * to the button and the button shakes. A success re-renders the row, so the
 * confirmation is handed to the stage, which outlives this control.
 */
export function SkipControl({
  deliveryId,
  label,
  question,
  consequence,
  action,
  size = 'sm',
}: {
  deliveryId: string;
  /** The idle button's words. */
  label: string;
  /** "Skip tomorrow's lunch?" */
  question: string;
  /** "Returns 1 credit to your balance." */
  consequence: string;
  action: AccountAction;
  size?: 'sm' | 'md';
}) {
  const { announce } = useStage();
  const [armed, setArmed] = useState(false);
  const [state, formAction, pending] = useActionState<Awaited<ReturnType<AccountAction>>, FormData>(
    async (previous, formData) => {
      const result = await action(previous, formData);
      if (result.status === 'ok') announce(result.message);
      return result;
    },
    IDLE,
  );

  const { scope, animate } = useMotion<HTMLFormElement>();
  const trigger = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const messageId = useId();
  const questionId = useId();

  // Arming moves focus to the decision, so a keyboard user answers the question
  // they just asked for; disarming puts it back where it came from.
  useEffect(() => {
    if (armed) confirm.current?.focus();
  }, [armed]);

  useEffect(() => {
    if (state.status !== 'error') return;
    animate((gsap, root) => shake(gsap, root.querySelector('.acct-skip-actions') ?? root));
  }, [state, animate]);

  function disarm() {
    setArmed(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  return (
    <form
      ref={scope}
      action={formAction}
      className="acct-skip"
      data-armed={armed ? '' : undefined}
      onKeyDown={(event) => {
        if (armed && event.key === 'Escape' && !pending) {
          event.preventDefault();
          disarm();
        }
      }}
    >
      <input type="hidden" name="deliveryId" value={deliveryId} />

      {armed ? (
        <div className="acct-skip-question">
          <p id={questionId} className="acct-skip-text">
            <strong>{question}</strong> <span>{consequence}</span>
          </p>
          <div className="acct-skip-actions">
            <Button
              ref={confirm}
              type="submit"
              size={size}
              variant="primary"
              aria-describedby={`${questionId} ${messageId}`}
            >
              {pending ? 'Skipping' : 'Yes, skip it'}
            </Button>
            <Button type="button" size={size} variant="ghost" onClick={disarm} disabled={pending}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="acct-skip-actions">
          <Button ref={trigger} type="button" size={size} variant="secondary" onClick={() => setArmed(true)}>
            {label}
          </Button>
        </div>
      )}

      <p id={messageId} className="acct-skip-error" role="alert">
        {state.status === 'error' ? state.message : null}
      </p>
    </form>
  );
}
