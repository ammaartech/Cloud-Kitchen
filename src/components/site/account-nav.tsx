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
          {/* The one thing in this bar that is not set in capitals. It is a
              person's name, and a name in all caps is a different word about a
              different kind of thing -- the label beside it is a control, this
              is who you are. */}
          <span className="hidden text-sm text-subtle sm:inline">{account.name}</span>
          <ButtonLink href={account.href} variant="secondary" size="sm" className="btn-caps btn-square">
            {account.label}
          </ButtonLink>
          <SignOutButton className="btn-caps btn-square" />
        </>
      ) : (
        <>
          <ButtonLink
            href="/sign-in"
            variant="ghost"
            size="sm"
            className="btn-caps btn-square hidden sm:inline-flex"
          >
            Sign in
          </ButtonLink>
          {/* The hero's words, exactly. This is the same action as the big
              rectangle in the hero column, and once the bar started carrying
              the hero's links it was carrying half of that column already --
              two labels for one destination is the reader having to work out
              whether they are the same thing. */}
          <ButtonLink href="/subscriptions" size="sm" className="btn-caps btn-square">
            Start a plan today
          </ButtonLink>
        </>
      )}
    </div>
  );
}
