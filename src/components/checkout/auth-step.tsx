'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/client';
import { Alert, Button, Card, Field, Input, Spinner, cx } from '@/components/ui/primitives';

/**
 * Account creation, positioned late in checkout (PRD 6).
 *
 * The customer has already chosen and configured a plan by this point, so they
 * are being asked for details in exchange for something concrete rather than
 * as a toll gate on the way in.
 */
export function CheckoutAuthStep() {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'signin'>('create');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);

    const supabase = browserClient();

    if (mode === 'create') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (signUpError) {
        setError(signUpError.message);
        setPending(false);
        return;
      }

      // With email confirmation switched on there is no session yet. Saying so
      // is better than leaving the customer on a page that will not advance.
      if (!data.session) {
        setNotice(
          'Check your email to confirm your address, then come back to finish checkout. ' +
            'Your plan selection is saved.',
        );
        setPending(false);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError('That email and password combination did not work.');
        setPending(false);
        return;
      }
    }

    router.refresh();
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold">
          {mode === 'create' ? 'Create your account' : 'Sign in'}
        </h2>

        <div className="flex rounded-ck border border-line p-0.5 text-sm">
          {(['create', 'signin'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setMode(option);
                setError(null);
                setNotice(null);
              }}
              className={cx(
                'rounded-[6px] px-3 py-1 font-medium transition-colors',
                mode === option ? 'bg-brand text-white' : 'text-muted hover:text-ink',
              )}
            >
              {option === 'create' ? 'New here' : 'I have an account'}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1 text-sm text-muted">
        Your plan selection is already saved — this is the last thing standing between you
        and food.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {notice ? <Alert tone="info">{notice}</Alert> : null}

        {mode === 'create' ? (
          <Field label="Full name" required>
            <Input
              value={fullName}
              required
              autoComplete="name"
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Meera Iyer"
            />
          </Field>
        ) : null}

        <Field label="Email" required>
          <Input
            type="email"
            value={email}
            required
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          label="Password"
          required
          hint={mode === 'create' ? 'At least 8 characters.' : undefined}
        >
          <Input
            type="password"
            value={password}
            required
            minLength={mode === 'create' ? 8 : undefined}
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <Spinner /> : null}
          {mode === 'create' ? 'Create account and continue' : 'Sign in and continue'}
        </Button>
      </form>
    </Card>
  );
}
