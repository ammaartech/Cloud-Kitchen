'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/components/auth/sign-out';
import { Spinner } from '@/components/ui/primitives';

/**
 * "Not you?" for the account section of checkout.
 *
 * Unlike the storefront's `SignOutButton`, which leaves the page it was pressed
 * on, this signs out and stays: the plan is still in the draft cookie, so the
 * right place to land is this same checkout with the account section open
 * again, not a screen that has forgotten what was being bought.
 */
export function SwitchAccountButton() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'pending' | 'failed'>('idle');

  async function switchAccount() {
    setStatus('pending');
    try {
      await signOut();
    } catch {
      setStatus('failed');
      return;
    }
    router.refresh();
    setStatus('idle');
  }

  return (
    <button
      type="button"
      className="co-link"
      onClick={switchAccount}
      disabled={status === 'pending'}
    >
      {status === 'pending' ? <Spinner className="size-3.5" /> : null}
      {status === 'failed' ? 'Could not sign out. Try again?' : 'Not you?'}
    </button>
  );
}
