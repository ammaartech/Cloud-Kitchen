'use client';

import { useEffect, useState } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { refreshAccount } from '@/components/site/account';
import { CheckIcon } from '@/components/site/icons';
import { safeNextPath } from '@/lib/auth/redirect';
import { Alert, Button, Field, Input, Spinner } from '@/components/ui/primitives';

/**
 * The Supabase browser client, fetched when it is about to be needed rather
 * than with the page. Focusing any field in the form starts the download, so by
 * the time somebody has typed an email and a password it has long since
 * arrived -- and `import()` is cached, so the focus and the submit share one
 * request. A visitor who reads the page and leaves never downloads it at all.
 */
const loadClient = () => import('@/lib/supabase/client');

type Phase = 'idle' | 'pending' | 'success';

/**
 * The refusal, as the checkout says it: a short sideways shake on the thing
 * that said no, paired with the words that say why. Same keyframes and 360ms as
 * `shake()` in `checkout-gsap.ts`; written with the Web Animations API because
 * this page does not otherwise load GSAP, and a shake is not worth a library.
 */
function shake(target: Element | null | undefined): void {
  if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  target.animate(
    [0, -6, 6, -4, 4, -2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration: 360, easing: 'linear' },
  );
}

/**
 * Email + password sign-in.
 *
 * The PRD asks the auth architecture to support mobile OTP, Google and Apple
 * "where feasible" (PRD 6). Those are Supabase provider settings rather than
 * application code: enabling them in the project dashboard is what makes them
 * work, and offering a button for a provider that is not enabled would just
 * produce a confusing error. So this renders what is actually wired up.
 *
 * ## After signing in
 *
 * Back to where the visitor was when they chose to sign in -- the header's
 * "Sign in" carries the page along as `?next=` -- and otherwise to the screen
 * their role lands on. That second part used to be the home page for everyone,
 * which sent a kitchen account to the storefront.
 *
 * ## The button is the progress
 *
 * It holds the whole exchange in one place, so the eye never has to go looking:
 * "Sign in", then a spinner and "Signing in" on the same frame as the press,
 * then a tick and "Signed in" while the next page loads. A wrong password
 * shakes the button, puts the words under it -- where the eye already is, and
 * where appearing moves nothing above it -- and hands focus back to the
 * password with its contents selected, ready to be typed over.
 */
/**
 * The credential fields are controlled from outside so the development account
 * panel can fill them by simply setting state, rather than this component
 * syncing to a prop in an effect. Same reason any shared value gets lifted:
 * one owner, no copy to keep in step.
 */
export function SignInForm({
  next,
  email,
  password,
  onEmailChange,
  onPasswordChange,
}: {
  next: string | null;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  // Next keeps a recently visited page alive but hidden, and shows it again --
  // state and all -- when it is visited again. A sign-in that finished must not
  // be what the next visit finds: a disabled form still saying "Signed in".
  // Effects are torn down when the page is hidden, so this cleanup is the
  // moment to put the form back, and to drop the password rather than keep it
  // in a hidden page on a shared device.
  useEffect(
    () => () => {
      setPhase('idle');
      setError(null);
      onPasswordChange('');
    },
    [onPasswordChange],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Held now: `currentTarget` is gone once the handler first awaits.
    const form = event.currentTarget;
    setPhase('pending');
    setError(null);

    const { browserClient } = await loadClient();
    const { error: signInError } = await browserClient().auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Deliberately not distinguishing "no such account" from "wrong
      // password" -- that difference tells an attacker which emails exist.
      setError('That email and password combination did not work.');
      setPhase('idle');
      shake(form.querySelector('[type="submit"]'));
      const passwordField = form.querySelector<HTMLInputElement>('input[type="password"]');
      // After the re-render that re-enables the field; a disabled input
      // cannot take focus.
      requestAnimationFrame(() => {
        passwordField?.focus();
        passwordField?.select();
      });
      return;
    }

    setPhase('success');

    // Re-reads the identity for every open tab, and answers where this role
    // lands when there is no page to go back to.
    const account = await refreshAccount();
    const destination = safeNextPath(next) ?? account?.href ?? '/';

    // Refresh first, then navigate. The refresh drops whatever the router cached
    // while signed out; issued after the navigation instead, it can supersede a
    // navigation still in flight and leave the page where it was.
    router.refresh();
    router.replace(destination as Route);
  }

  const busy = phase !== 'idle';

  return (
    <form onSubmit={submit} onFocus={() => void loadClient()} className="space-y-4">
      <Field label="Email" required>
        <Input
          type="email"
          value={email}
          autoComplete="email"
          required
          disabled={busy}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="you@example.com"
        />
      </Field>

      <Field label="Password" required>
        <Input
          type="password"
          value={password}
          autoComplete="current-password"
          required
          disabled={busy}
          onChange={(event) => onPasswordChange(event.target.value)}
        />
      </Field>

      <Button
        type="submit"
        className="signin-submit w-full"
        size="lg"
        disabled={busy}
        aria-busy={phase === 'pending'}
        data-phase={phase}
      >
        {/* Keyed by phase, so each state mounts fresh and fades in through a
            touch of blur -- the two labels read as one changing, not two
            swapping. See `.signin-submit-face` in `auth.css`. */}
        <span key={phase} className="signin-submit-face">
          {phase === 'pending' ? <Spinner /> : null}
          {phase === 'success' ? <CheckIcon className="signin-submit-tick" /> : null}
          {phase === 'pending' ? 'Signing in' : phase === 'success' ? 'Signed in' : 'Sign in'}
        </span>
      </Button>

      {error ? (
        <div className="signin-error">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
    </form>
  );
}
