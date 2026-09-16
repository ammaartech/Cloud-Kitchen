'use client';

import Link from 'next/link';
import { useActionState, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/primitives';
import { addDays, calendarDate } from '@/lib/checkout/schedule';
import { daysInclusive, pauseImpact, type ImpactDelivery } from '@/lib/account/schedule';
import { IDLE, type AccountAction, type AccountActionState } from '@/lib/account/action-state';
import { shake, useMotion } from './account-motion';
import { useStage } from './account-stage';

type Panel = 'pause' | 'cancel' | null;

/**
 * Pause and cancel, on the plan ticket.
 *
 * Both open inline, under the plan they change, rather than in a dialog: the
 * customer should be able to see the plan and the calendar while deciding.
 * They are ordered by weight -- pausing first and filled, cancelling second
 * and quiet -- but cancelling is one press away, labelled for what it does,
 * and asks for nothing it does not need. A plan that is easy to leave is one
 * people are comfortable staying on.
 *
 * The pause form knows the rules before it is submitted: the limits are read
 * from the same settings the server enforces and shown before anyone types a
 * date, and the preview under the dates is the calendar's own arithmetic -- how
 * many deliveries would be skipped, the credits that would come back, and when
 * food starts again. The server still has the final word, and its refusals are
 * said beside the button that was pressed.
 */
export function PlanControls({
  subscriptionId,
  planName,
  status,
  pausedUntil,
  pauses,
  returnsCredits,
  today,
  upcoming,
  pauseAction,
  cancelAction,
}: {
  subscriptionId: string;
  planName: string;
  status: 'active' | 'paused' | 'past_due';
  pausedUntil: string | null;
  pauses: { used: number; allowed: number; maxDays: number };
  returnsCredits: boolean;
  today: string;
  upcoming: ImpactDelivery[];
  pauseAction: AccountAction;
  cancelAction: AccountAction;
}) {
  const [open, setOpen] = useState<Panel>(null);
  const { scope, animate } = useMotion<HTMLDivElement>();
  const { setPreview } = useStage();
  const pauseId = useId();
  const cancelId = useId();
  const opened = useRef<Panel>(null);
  const pauseTrigger = useRef<HTMLButtonElement>(null);
  const cancelTrigger = useRef<HTMLButtonElement>(null);

  const pausesLeft = Math.max(pauses.allowed - pauses.used, 0);
  const pauseBlocked =
    status === 'paused'
      ? `Already paused${pausedUntil ? ` until ${calendarDate(pausedUntil)}` : ''}.`
      : pausesLeft === 0
        ? `You have used all ${pauses.allowed} pauses for this cycle.`
        : null;

  // Opening: the panel is rendered by the state change, then grows from nothing
  // before it is painted. Focus goes to its first control, which is the part
  // that matters to someone on a keyboard.
  useLayoutEffect(() => {
    const was = opened.current;
    if (open === was) return;
    opened.current = open;

    // Closing: focus that was inside the panel went with it. Here, after the
    // commit that removed it, the browser has already dropped it to <body> --
    // put it back on the button that opened the panel.
    if (!open) {
      const active = document.activeElement;
      if (was && (!active || active === document.body)) {
        (was === 'pause' ? pauseTrigger : cancelTrigger).current?.focus({ preventScroll: true });
      }
      return;
    }

    const panel = scope.current?.querySelector<HTMLElement>(`[data-panel="${open}"]`);
    if (!panel) return;
    // `opacity`, never `autoAlpha`: autoAlpha starts by setting `visibility:
    // hidden`, and a control inside a hidden element cannot take focus -- the
    // focus call below would silently land on <body>.
    animate((gsap) => {
      gsap.fromTo(
        panel,
        { height: 0, opacity: 0 },
        { height: 'auto', opacity: 1, duration: 0.34, ease: 'ck', clearProps: 'height,opacity' },
      );
    });
    panel.querySelector<HTMLElement>('button, input:not([type="hidden"])')?.focus({ preventScroll: true });
  }, [open, animate, scope]);

  function close(then?: () => void) {
    const panel = open ? scope.current?.querySelector<HTMLElement>(`[data-panel="${open}"]`) : null;
    const finish = () => {
      setOpen(null);
      setPreview(null);
      then?.();
    };
    const ran =
      panel !== null &&
      panel !== undefined &&
      animate((gsap) => {
        gsap.to(panel, { height: 0, opacity: 0, duration: 0.24, ease: 'ck', onComplete: finish });
      });
    if (!ran) finish();
  }

  function toggle(panel: Exclude<Panel, null>) {
    if (open === panel) close();
    else {
      setPreview(null);
      setOpen(panel);
    }
  }

  return (
    <div ref={scope} className="acct-controls">
      <div className="acct-controls-row">
        <Button
          ref={pauseTrigger}
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => toggle('pause')}
          aria-expanded={open === 'pause'}
          aria-controls={pauseId}
          disabled={pauseBlocked !== null}
          aria-describedby={`${pauseId}-rule`}
        >
          Pause deliveries
        </Button>
        <Button
          ref={cancelTrigger}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => toggle('cancel')}
          aria-expanded={open === 'cancel'}
          aria-controls={cancelId}
        >
          Cancel plan
        </Button>
      </div>

      <p id={`${pauseId}-rule`} className="acct-controls-note">
        {pauseBlocked ??
          `${pausesLeft} of ${pauses.allowed} ${pauses.allowed === 1 ? 'pause' : 'pauses'} left this cycle, up to ${pauses.maxDays} days each.`}
      </p>

      {open === 'pause' ? (
        <div id={pauseId} data-panel="pause" className="acct-panel">
          <PauseForm
            subscriptionId={subscriptionId}
            maxDays={pauses.maxDays}
            returnsCredits={returnsCredits}
            today={today}
            upcoming={upcoming}
            action={pauseAction}
            onDone={() => close()}
            onCancel={() => close()}
          />
        </div>
      ) : null}

      {open === 'cancel' ? (
        <div id={cancelId} data-panel="cancel" className="acct-panel">
          <CancelForm
            subscriptionId={subscriptionId}
            planName={planName}
            scheduled={upcoming.filter((delivery) => delivery.status === 'scheduled').length}
            action={cancelAction}
            onKeep={() => close()}
          />
        </div>
      ) : null}
    </div>
  );
}

function useAnnouncedAction(action: AccountAction, onOk?: () => void) {
  const { announce } = useStage();
  return useActionState<AccountActionState, FormData>(async (previous, formData) => {
    const result = await action(previous, formData);
    if (result.status === 'ok') {
      announce(result.message);
      onOk?.();
    }
    return result;
  }, IDLE);
}

function PauseForm({
  subscriptionId,
  maxDays,
  returnsCredits,
  today,
  upcoming,
  action,
  onDone,
  onCancel,
}: {
  subscriptionId: string;
  maxDays: number;
  returnsCredits: boolean;
  today: string;
  upcoming: ImpactDelivery[];
  action: AccountAction;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { setPreview } = useStage();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [state, formAction, pending] = useAnnouncedAction(action, onDone);
  const { scope, animate } = useMotion<HTMLFormElement>();
  const summaryId = useId();

  const tomorrow = addDays(today, 1);
  const length = from && to ? daysInclusive(from, to) : 0;
  const problem =
    !from || !to
      ? null
      : to < from
        ? 'The last day has to be on or after the first.'
        : length > maxDays
          ? `A pause can be at most ${maxDays} days. This one is ${length}.`
          : null;
  const valid = Boolean(from && to) && problem === null;
  const impact = valid ? pauseImpact(upcoming, from, to, returnsCredits) : null;

  useEffect(() => {
    setPreview(valid ? { from, to } : null);
  }, [valid, from, to, setPreview]);

  useEffect(() => () => setPreview(null), [setPreview]);

  useEffect(() => {
    if (state.status !== 'error') return;
    animate((gsap, root) => shake(gsap, root.querySelector('.acct-panel-actions') ?? root));
  }, [state, animate]);

  function preset(days: number) {
    setFrom(tomorrow);
    setTo(addDays(tomorrow, days - 1));
  }

  const presets = Array.from(new Set([1, Math.min(3, maxDays), maxDays])).filter((days) => days >= 1);

  return (
    <form ref={scope} action={formAction} className="acct-form" noValidate>
      <input type="hidden" name="subscriptionId" value={subscriptionId} />

      <p className="acct-form-lede">
        Deliveries on the days you choose are skipped{returnsCredits ? ' and their credits come back' : ''}.
        The rest of the plan carries on as it is.
      </p>

      <div className="acct-presets" role="group" aria-label="Quick choices, starting tomorrow">
        {presets.map((days) => (
          <button
            key={days}
            type="button"
            className="acct-preset"
            aria-pressed={from === tomorrow && length === days && !problem}
            onClick={() => preset(days)}
          >
            {days === 1 ? 'Tomorrow' : `${days} days from tomorrow`}
          </button>
        ))}
      </div>

      <div className="acct-form-dates">
        <Field label="First day" required>
          <Input
            type="date"
            name="startsOn"
            min={today}
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              if (to && event.target.value > to) setTo(event.target.value);
            }}
            aria-describedby={summaryId}
            required
          />
        </Field>
        <Field label="Last day" required>
          <Input
            type="date"
            name="endsOn"
            min={from || today}
            max={from ? addDays(from, maxDays - 1) : undefined}
            value={to}
            onChange={(event) => setTo(event.target.value)}
            aria-describedby={summaryId}
            required
          />
        </Field>
      </div>

      <p id={summaryId} className="acct-impact" data-tone={problem ? 'danger' : undefined} aria-live="polite">
        {problem ??
          (impact
            ? impact.skipped === 0
              ? `Nothing is scheduled on those days, so nothing is skipped.${impact.resumesOn ? ` Your next delivery is ${calendarDate(impact.resumesOn)}.` : ''}`
              : `Skips ${impact.skipped} ${impact.skipped === 1 ? 'delivery' : 'deliveries'}${
                  impact.credits > 0 ? ` and returns ${impact.credits} ${impact.credits === 1 ? 'credit' : 'credits'}` : ''
                }.${impact.resumesOn ? ` Deliveries start again ${calendarDate(impact.resumesOn)}.` : ''}`
            : `Pick up to ${maxDays} days. The calendar shows what they cover.`)}
      </p>

      <Field label="Reason" hint="Optional. It helps the kitchen plan.">
        <Input name="reason" placeholder="Travelling" autoComplete="off" />
      </Field>

      <div className="acct-panel-actions">
        <Button type="submit" size="sm" disabled={!valid}>
          {pending ? 'Pausing' : 'Pause these days'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Never mind
        </Button>
      </div>

      <p className="acct-form-error" role="alert">
        {state.status === 'error' ? state.message : null}
      </p>
    </form>
  );
}

function CancelForm({
  subscriptionId,
  planName,
  scheduled,
  action,
  onKeep,
}: {
  subscriptionId: string;
  planName: string;
  scheduled: number;
  action: AccountAction;
  onKeep: () => void;
}) {
  const [state, formAction, pending] = useAnnouncedAction(action);
  const { scope, animate } = useMotion<HTMLFormElement>();

  useEffect(() => {
    if (state.status !== 'error') return;
    animate((gsap, root) => shake(gsap, root.querySelector('.acct-panel-actions') ?? root));
  }, [state, animate]);

  return (
    <form ref={scope} action={formAction} className="acct-form">
      <input type="hidden" name="subscriptionId" value={subscriptionId} />

      <p className="acct-form-title">Cancel {planName}?</p>
      <ul className="acct-consequences">
        <li>
          {scheduled > 0
            ? `Your ${scheduled} scheduled ${scheduled === 1 ? 'delivery is' : 'deliveries are'} called off, and nothing new is scheduled.`
            : 'Nothing new is scheduled.'}
        </li>
        <li>Anything the kitchen already has is still cooked and delivered.</li>
        <li>Your delivery history and invoices stay on your account.</li>
        <li>
          Refunds are handled by our team.{' '}
          <Link href="/account/refunds" className="acct-link">
            Request one
          </Link>
          .
        </li>
      </ul>

      <Field label="Anything we should know?" hint="Optional.">
        <Input name="reason" placeholder="Moving cities" autoComplete="off" />
      </Field>

      <div className="acct-panel-actions">
        <Button type="submit" size="sm" variant="danger">
          {pending ? 'Cancelling' : 'Cancel my plan'}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onKeep} disabled={pending}>
          Keep my plan
        </Button>
      </div>

      <p className="acct-form-error" role="alert">
        {state.status === 'error' ? state.message : null}
      </p>
    </form>
  );
}
