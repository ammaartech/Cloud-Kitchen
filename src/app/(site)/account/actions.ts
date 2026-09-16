'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { serverClient } from '@/lib/supabase/server';
import { readable } from '@/lib/admin/feedback';
import type { AccountActionState } from '@/lib/account/action-state';

/**
 * The three things a customer can do to their plan from the overview.
 *
 * They return a result instead of redirecting with `?ok=`, and that is the
 * point of moving them here. A redirect re-renders the page with the message
 * pinned to the top of it -- a long way from the button that was pressed, left
 * in the URL for the next reload to show again. A returned result lands beside
 * the control that asked, is announced from there, and is gone on the next
 * visit. `revalidatePath` still refreshes the page's data in the same round
 * trip, so the calendar, the balance and the message all arrive together.
 *
 * Each one still proves who is asking. The RPCs check ownership of the
 * subscription themselves (`app.assert_subscription_access`); the session check
 * here is what turns a signed-out request into a sentence rather than a
 * database error.
 */

const PATH = '/account';

function ok(message: string): AccountActionState {
  return { status: 'ok', message, at: Date.now() };
}

function refused(message: string): AccountActionState {
  return { status: 'error', message, at: Date.now() };
}

/**
 * The server's refusals, in the customer's words. The RPCs raise precise,
 * operational messages ("delivery is released and can no longer be skipped");
 * anything not recognised here still reaches the customer through `readable`,
 * so a new rule is never swallowed -- only phrased less kindly.
 */
function explain(error: { message: string; code?: string }): string {
  const message = error.message;

  if (/can no longer be skipped/.test(message)) {
    return 'The kitchen already has this one, so it can no longer be skipped.';
  }
  const limit = message.match(/pause limit reached for this period \((\d+) allowed\)/);
  if (limit) {
    return `You have used all ${limit[1]} pauses for this cycle. They reset when the next cycle starts.`;
  }
  const longest = message.match(/may not exceed (\d+) days/);
  if (longest) return `A pause can be at most ${longest[1]} days long.`;
  if (/cannot start in the past/.test(message)) return 'Pick a start date from today onwards.';
  if (/end date is before its start date/.test(message)) {
    return 'The last day of the pause has to be on or after the first.';
  }
  if (/cannot be paused/.test(message)) return 'This plan cannot be paused in its current state.';
  if (/not found/.test(message)) return 'We could not find that on your account. Refresh and try again.';

  return readable(error);
}

async function signedIn(): Promise<boolean> {
  return Boolean(await getSession());
}

export async function skipDelivery(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  if (!(await signedIn())) return refused('Your session has ended. Sign in again to make changes.');

  const deliveryId = String(formData.get('deliveryId') ?? '');
  if (!deliveryId) return refused('That delivery could not be identified. Refresh and try again.');

  const db = await serverClient();
  const { data, error } = await db.rpc('skip_subscription_delivery', {
    p_delivery_id: deliveryId,
    p_reason: 'Skipped from account',
  });
  if (error) return refused(explain(error));

  revalidatePath(PATH);

  const returned = Number((data as { credits_returned?: number } | null)?.credits_returned ?? 0);
  return ok(
    returned > 0
      ? `Skipped. ${returned} ${returned === 1 ? 'credit is' : 'credits are'} back in your balance.`
      : 'Skipped. The kitchen will not cook this one.',
  );
}

export async function pauseSubscription(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  if (!(await signedIn())) return refused('Your session has ended. Sign in again to make changes.');

  const startsOn = String(formData.get('startsOn') ?? '');
  const endsOn = String(formData.get('endsOn') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
    return refused('Choose both the first and the last day of the pause.');
  }

  const db = await serverClient();
  const { error } = await db.rpc('pause_subscription', {
    p_subscription_id: String(formData.get('subscriptionId') ?? ''),
    p_starts_on: startsOn,
    p_ends_on: endsOn,
    p_reason: String(formData.get('reason') ?? '').trim() || null,
  });
  if (error) return refused(explain(error));

  revalidatePath(PATH);
  return ok('Paused. Deliveries on those days are skipped and their credits returned.');
}

export async function cancelSubscription(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  if (!(await signedIn())) return refused('Your session has ended. Sign in again to make changes.');

  const db = await serverClient();
  const { error } = await db.rpc('cancel_subscription', {
    p_subscription_id: String(formData.get('subscriptionId') ?? ''),
    p_reason: String(formData.get('reason') ?? '').trim() || null,
  });
  if (error) return refused(explain(error));

  revalidatePath(PATH);
  return ok('Your plan is cancelled. Nothing new will be scheduled, and your records are kept.');
}
