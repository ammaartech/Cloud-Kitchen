'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DemoAccount, DemoAccountList } from '@/lib/auth/demo-accounts';
import { SignInForm } from './sign-in-form';
import { DemoAccounts } from './demo-accounts';
import { Card, cx } from '@/components/ui/primitives';

/**
 * Sign-in layout, and the small piece of shared state that lets the demo
 * account panel fill the form.
 *
 * When `accounts` is null -- which is the case unless SHOW_DEMO_ACCOUNTS is
 * set -- this collapses back to the plain centred sign-in card, and no demo
 * code is reachable at all.
 */
export function SignInPanel({
  next,
  accounts,
}: {
  next: string | null;
  accounts: DemoAccountList | null;
}) {
  // The credential fields live here so the account panel can fill them by
  // setting state directly, with no prop-to-state syncing anywhere.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function useAccount(account: DemoAccount) {
    if (!accounts?.password) return;
    setEmail(account.email);
    setPassword(accounts.password);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-center px-4 py-12">
      <div
        className={cx(
          'grid w-full items-start gap-8',
          accounts ? 'lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]' : 'max-w-md',
          accounts ? '' : 'mx-auto',
        )}
      >
        <div>
          <Link href="/" className="mb-8 flex items-center gap-2 font-semibold">
            <span
              className="grid h-8 w-8 place-items-center rounded-ck bg-brand text-sm font-bold text-white"
              aria-hidden
            >
              CK
            </span>
            Cloud Kitchen
          </Link>

          <Card className="p-6">
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted">
              Staff and customers use the same sign-in. You will land on the right screen.
            </p>

            <div className="mt-6">
              <SignInForm
                next={next}
                email={email}
                password={password}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
              />
            </div>
          </Card>

          <p className="mt-6 text-center text-xs text-subtle">
            Buying a plan? You do not need an account first — we create one during checkout.
          </p>
        </div>

        {accounts ? (
          <div className="lg:pt-18">
            <DemoAccounts accounts={accounts} onUse={useAccount} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
