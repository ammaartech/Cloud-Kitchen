'use client';

import { useState } from 'react';
import { Alert, Button, Field, Input, cx } from '@/components/ui/primitives';

/**
 * Pause and cancel.
 *
 * Both are consequential, so neither fires on a single click: pausing asks for
 * dates, cancelling asks for explicit confirmation and states what will happen
 * to deliveries already in the kitchen (PRD 19: confirm destructive actions).
 *
 * The limits (how many pauses, how long) are enforced server-side from
 * settings, so this form does not restate them as rules -- it just reports
 * whatever the server says if a request is refused.
 */
export function SubscriptionControls({
  subscriptionId,
  status,
  pauseAction,
  cancelAction,
}: {
  subscriptionId: string;
  status: string;
  pauseAction: (formData: FormData) => Promise<void>;
  cancelAction: (formData: FormData) => Promise<void>;
}) {
  const [mode, setMode] = useState<'none' | 'pause' | 'cancel'>('none');

  if (status === 'cancelled') {
    return (
      <Alert tone="info">
        This subscription is cancelled. Deliveries already with the kitchen were still
        prepared, and your records are kept.
      </Alert>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className={cx('flex flex-wrap gap-2', mode !== 'none' && 'hidden')}>
        <Button variant="secondary" size="sm" onClick={() => setMode('pause')}>
          Pause deliveries
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setMode('cancel')}>
          Cancel subscription
        </Button>
      </div>

      {mode === 'pause' ? (
        <form action={pauseAction} className="space-y-4">
          <input type="hidden" name="subscriptionId" value={subscriptionId} />

          <p className="text-sm text-muted">
            Deliveries in this window are skipped and their credits returned to your balance.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" required>
              <Input type="date" name="startsOn" min={today} required />
            </Field>
            <Field label="Until" required>
              <Input type="date" name="endsOn" min={today} required />
            </Field>
          </div>

          <Field label="Reason" hint="Optional, but it helps us plan.">
            <Input name="reason" placeholder="Travelling" />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Confirm pause
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode('none')}>
              Never mind
            </Button>
          </div>
        </form>
      ) : null}

      {mode === 'cancel' ? (
        <form action={cancelAction} className="space-y-4">
          <input type="hidden" name="subscriptionId" value={subscriptionId} />

          <Alert tone="warning" title="This stops future deliveries">
            Anything already sent to the kitchen will still be prepared and delivered. Your
            past orders and invoices are kept. Refunds are handled separately by our team.
          </Alert>

          <Field label="Why are you cancelling?" hint="Optional.">
            <Input name="reason" placeholder="Moving cities" />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" variant="danger" size="sm">
              Yes, cancel it
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode('none')}>
              Keep my subscription
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
