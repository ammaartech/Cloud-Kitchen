import '@/components/site/ticket.css';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getUserId, requireSession } from '@/lib/auth/session';
import { serverClient } from '@/lib/supabase/server';
import { loadAccountOverview } from '@/lib/account/overview';
import { AccountOverview } from '@/components/account/overview';
import { OverviewSkeleton } from '@/components/account/account-skeletons';
import { cancelSubscription, pauseSubscription, skipDelivery } from './actions';

export const metadata = { title: 'My account' };

/**
 * The account overview.
 *
 * The page itself is static: a skeleton the router has already prefetched, so
 * pressing "Overview" paints immediately. Everything that belongs to the
 * customer streams into it from `Overview` below.
 */
export default function AccountPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview />
    </Suspense>
  );
}

/**
 * Three steps and no decisions: who is asking, what their rows say
 * (`loadAccountOverview`, one parallel round that runs alongside the session
 * lookup rather than after it), and the composition that arranges it. The
 * actions live in `actions.ts` and are handed down, so the same composition
 * can be rendered over any model.
 */
async function Overview() {
  const [supabase, userId] = await Promise.all([serverClient(), getUserId()]);
  if (!userId) redirect('/sign-in');

  const model = await loadAccountOverview(supabase, requireSession(), userId);

  return (
    <AccountOverview
      model={model}
      actions={{ skip: skipDelivery, pause: pauseSubscription, cancel: cancelSubscription }}
    />
  );
}
