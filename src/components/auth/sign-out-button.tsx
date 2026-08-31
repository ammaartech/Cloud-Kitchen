'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/client';
import { Button, Spinner } from '@/components/ui/primitives';

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
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
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
