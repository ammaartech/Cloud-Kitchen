'use client';

import { ButtonLink } from '@/components/ui/primitives';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { useAccount } from './account';

/**
 * The right-hand end of the storefront header: who you are, or a way to become
 * somebody.
 *
 * While the identity is still in flight this renders the signed-out controls
 * rather than a skeleton. That is a deliberate bet on the traffic: the public
 * storefront is mostly anonymous, so the optimistic guess is right for most
 * visitors and they see no swap at all. A signed-in visitor sees the buttons
 * change once, shortly after load.
 *
 * The alternative -- holding an empty space until the answer arrives -- makes
 * *everyone* watch something appear, to spare the minority a swap. The
 * container reserves its height either way, so neither version shifts the page.
 */
export function AccountNav() {
  const { account } = useAccount();

  return (
    <div className="ml-auto flex h-9 items-center gap-2">
      {account ? (
        <>
          <span className="hidden text-sm text-subtle sm:inline">{account.name}</span>
          <ButtonLink href={account.href} variant="secondary" size="sm">
            {account.label}
          </ButtonLink>
          <SignOutButton />
        </>
      ) : (
        <>
          <ButtonLink
            href="/sign-in"
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            Sign in
          </ButtonLink>
          <ButtonLink href="/subscriptions" size="sm">
            Start a plan
          </ButtonLink>
        </>
      )}
    </div>
  );
}
