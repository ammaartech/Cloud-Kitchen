'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/client';
import { Alert, Button, Field, Input, Spinner } from '@/components/ui/primitives';

/**
 * Email + password sign-in.
 *
 * The PRD asks the auth architecture to support mobile OTP, Google and Apple
 * "where feasible" (PRD 6). Those are Supabase provider settings rather than
 * application code: enabling them in the project dashboard is what makes them
 * work, and offering a button for a provider that is not enabled would just
 * produce a confusing error. So this renders what is actually wired up.
 */
export function SignInForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error: signInError } = await browserClient().auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Deliberately not distinguishing "no such account" from "wrong
      // password" -- that difference tells an attacker which emails exist.
      setError('That email and password combination did not work.');
      setPending(false);
      return;
    }

    // A full refresh so the server components re-read the session cookie.
    router.refresh();
    router.push((next ?? '/') as never);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Field label="Email" required>
        <Input
          type="email"
          value={email}
          autoComplete="email"
          required
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </Field>

      <Field label="Password" required>
        <Input
          type="password"
          value={password}
          autoComplete="current-password"
          required
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? <Spinner /> : null}
        Sign in
      </Button>
    </form>
  );
}
