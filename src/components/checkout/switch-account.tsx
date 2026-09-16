'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAccount } from '@/components/site/account';
import { Spinner } from '@/components/ui/primitives';

/**
 * "Not you?" for the account section of checkout.
 *
 * Unlike the storefront's `SignOutButton`, which takes the visitor to the
 * sign-in page, this signs out and stays: the plan is still in the draft
 * cookie, so the right place to land is this same checkout with the account
 * section open again, not a screen that has forgotten what was being bought.
 */
export function SwitchAccountButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function switchAccount() {
    setPending(true);
    const { browserClient } = await import('@/lib/supabase/client');
    await browserClient().auth.signOut();
    clearAccount();
    router.refresh();
    setPending(false);
  }

  return (
    <button type="button" className="co-link" onClick={switchAccount} disabled={pending}>
      {pending ? <Spinner className="size-3.5" /> : null}
      Not you?
    </button>
  );
}
