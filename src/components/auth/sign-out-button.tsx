'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/client';
import { clearAccount } from '@/components/site/account';
import { Button, Spinner } from '@/components/ui/primitives';
import type { ButtonVariant } from '@/components/ui/button-styles';

/**
 * Signs the current user out and returns them to the sign-in screen.
 *
 * Done through the browser client for the same reason sign-in is: the
 * `@supabase/ssr` client stores the session in cookies, so signing out there
 * clears the cookies the server components read on the next request. The
 * `router.refresh()` is what makes those components re-run against the now
 * empty session -- without it the shell would keep rendering the old name
 * until something else forced a re-render.
 *
 * On the operational screens this is also the account switcher: the kitchen
 * tablet and the manager's screen are the same device more often than not.
 */
export function SignOutButton({
  label = 'Sign out',
  variant = 'ghost',
  size = 'sm',
  className,
}: {
  label?: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);

    // A failure here still leaves a stale cookie, so the redirect happens
    // either way and the sign-in page re-checks the session for real.
    await browserClient().auth.signOut();

    // The storefront header memoises the identity for the life of the page, and
    // both of the navigations below are client-side -- so without this the bar
    // would keep showing this user's name after they had signed out.
    clearAccount();

    router.refresh();
    router.push('/sign-in');
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={signOut}
      disabled={pending}
    >
      {pending ? <Spinner /> : null}
      {label}
    </Button>
  );
}
