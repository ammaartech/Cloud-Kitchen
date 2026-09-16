import '@/components/site/ticket.css';
import '@/components/account/account.css';
import { requireSession } from '@/lib/auth/session';
import { serverClient } from '@/lib/supabase/server';
import { loadAccountOverview } from '@/lib/account/overview';
import { AccountOverview } from '@/components/account/overview';
import { cancelSubscription, pauseSubscription, skipDelivery } from './actions';

/**
 * These screens are per-user by definition -- a session decides not just what
 * they show but whether you may see them at all -- so there is no static shell
 * to prerender and no point pretending otherwise. `instant = false` says that
 * plainly: this segment is allowed to block.
 *
 * It is a statement about *this* route, not a global escape hatch. The public
 * storefront next door is held to the opposite standard.
 */
export const instant = false;

export const metadata = { title: 'My account' };

/**
 * The account overview.
 *
 * Three steps and no decisions: who is asking, what their rows say
 * (`loadAccountOverview`, which reads everything in one parallel round), and
 * the composition that arranges it (`AccountOverview`). The actions live in
 * `actions.ts` and are handed down, so the same composition can be rendered
 * over any model.
 */
export default async function AccountPage() {
  const [session, supabase] = await Promise.all([requireSession(), serverClient()]);
  const model = await loadAccountOverview(supabase, session);

  return (
    <AccountOverview
      model={model}
      actions={{ skip: skipDelivery, pause: pauseSubscription, cancel: cancelSubscription }}
    />
  );
}
