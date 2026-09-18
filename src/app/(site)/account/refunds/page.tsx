import { Suspense } from 'react';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import { serverClient } from '@/lib/supabase/server';
import { nullableNum, str } from '@/lib/admin/form';
import { done, fail, readable } from '@/lib/admin/feedback';
import { AccountHead } from '@/components/account/account-shell';
import { RefundsSkeleton } from '@/components/account/account-skeletons';
import {
  RefundsNoCustomer,
  RefundsView,
  type RequestRow,
  type SubscriptionOption,
} from '@/components/account/refunds-view';

export const metadata = { title: 'Refund requests' };

const PATH = '/account/refunds';

/**
 * Refund requests (PRD 7, PRD 22).
 *
 * Refund policy is still being finalised, so this raises a case rather than
 * promising an outcome -- and the page says so plainly instead of implying a
 * guarantee the business has not agreed to yet.
 */
export default function AccountRefundsPage({ searchParams }: PageProps<'/account/refunds'>) {
  return (
    <div className="acct-page mx-auto max-w-3xl px-4">
      <AccountHead eyebrow="Help" title="Refund requests">
        Something wrong with an order or a plan? Raise it here and it gets looked at.
      </AccountHead>
      <div className="acct-body">
        <Suspense fallback={<RefundsSkeleton />}>
          <Refunds searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Refunds({ searchParams }: Pick<PageProps<'/account/refunds'>, 'searchParams'>) {
  const supabase = await serverClient();

  // The guard and the reads go out together. Both reads are already confined
  // to this customer by RLS, and a refused guard still redirects before render.
  const [session, params, requestsResult, subscriptionsResult] = await Promise.all([
    requireSession(),
    searchParams,
    supabase
      .from('refund_requests')
      .select(
        'id, reason, requested_amount, status, resolution_note, resolved_at, created_at, subscriptions ( subscription_number )',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('id, subscription_number, status, price_paid, subscription_plans ( name )')
      .order('created_at', { ascending: false }),
  ]);

  if (!session.customerId) {
    return <RefundsNoCustomer />;
  }

  const customerId = session.customerId;

  const requests = (requestsResult.data ?? []) as unknown as RequestRow[];
  const subscriptions = (subscriptionsResult.data ?? []) as unknown as SubscriptionOption[];

  async function raiseRequest(formData: FormData) {
    'use server';

    const reason = str(formData, 'reason');
    if (reason.length < 10) {
      fail(PATH, 'Tell us a bit more about what went wrong. A sentence or two is plenty.');
    }

    const db = await serverClient();
    const { error } = await db.from('refund_requests').insert({
      customer_id: customerId,
      subscription_id: str(formData, 'subscriptionId') || null,
      reason,
      requested_amount: nullableNum(formData, 'requestedAmount'),
    });

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    done(PATH, 'Request raised. You will hear back about it.');
  }

  async function withdrawRequest(formData: FormData) {
    'use server';

    const db = await serverClient();
    // Goes through an RPC that re-proves ownership and refuses a case that has
    // already been decided.
    const { error } = await db.rpc('withdraw_refund_request', {
      p_request_id: str(formData, 'requestId'),
    });

    if (error) fail(PATH, readable(error));

    revalidatePath(PATH);
    done(PATH, 'Request withdrawn.');
  }

  return (
    <RefundsView
      requests={requests}
      subscriptions={subscriptions}
      feedback={{ error: params.error as string | undefined, ok: params.ok as string | undefined }}
      actions={{ raise: raiseRequest, withdraw: withdrawRequest }}
    />
  );
}
