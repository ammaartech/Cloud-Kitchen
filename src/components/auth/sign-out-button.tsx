'use client';

import { useEffect, useState } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Button, Spinner } from '@/components/ui/primitives';
import type { ButtonVariant } from '@/components/ui/button-styles';
import { signOut } from './sign-out';

/**
 * Signs the current user out, then goes wherever this screen's sign-out should
 * go.
 *
 * ## Where it goes
 *
 * The destination depends on what is left once you are signed out, which is
 * how the large services split as well. Where the product has a public face
 * worth staying on -- YouTube, Swiggy, a Shopify store -- signing out drops you
 * back on it. Where nothing is usable signed out, you land on the sign-in
 * form.
 *
 * So the default here is `/sign-in`, for the staff screens: on the kitchen
 * tablet and the manager's screen a sign-out is also the account switcher, and
 * the next thing that happens is somebody else signing in. The storefront's
 * account menu passes `/` -- a customer who signs out is still a visitor, and
 * sending them to a sign-in form asks the one thing they just said they are
 * done with.
 *
 * ## Why it is fast
 *
 * The press shows its pending state on the same frame, and the only wait is
 * one request to our own server, which expires the session cookies and answers
 * without waiting on the auth server (see `app/api/auth/sign-out/route.ts`).
 * The header switches the moment that answer lands, before the navigation
 * starts.
 *
 * If the request fails, nothing has changed: the button says so and can be
 * pressed again, rather than pretending the session is gone.
 */
export function SignOutButton({
  label = 'Sign out',
  pendingLabel = 'Signing out',
  variant = 'ghost',
  size = 'sm',
  className,
  redirectTo = '/sign-in',
}: {
  label?: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Where to go once signed out. */
  redirectTo?: Route;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'pending' | 'failed'>('idle');

  // A staff screen is kept alive, hidden, after signing out of it, and shown
  // again with its state when the next person returns to it. Put the button
  // back to "Sign out" when the screen is hidden, not "Signing out".
  useEffect(() => () => setStatus('idle'), []);

  async function handle() {
    setStatus('pending');

    try {
      await signOut();
    } catch {
      setStatus('failed');
      return;
    }

    // Drops every server-rendered page the router is holding from while the
    // session was alive -- so Back cannot restore one -- and it goes first: a
    // refresh issued after a navigation can supersede it mid-flight.
    router.refresh();

    if (window.location.pathname === redirectTo) {
      // Already there: a navigation to the same URL would not bring the top of
      // the page back into view, and the point is to land at the start.
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    } else {
      // `replace`, so Back does not return to a signed-in screen.
      router.replace(redirectTo);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handle}
      disabled={status === 'pending'}
      aria-busy={status === 'pending'}
      data-status={status}
    >
      {status === 'pending' ? <Spinner /> : null}
      <span aria-live="polite">
        {status === 'pending' ? pendingLabel : status === 'failed' ? 'Try again' : label}
      </span>
    </Button>
  );
}
