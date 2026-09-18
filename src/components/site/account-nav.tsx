'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { ButtonLink } from '@/components/ui/primitives';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { useAccount, type AccountChip } from './account';
import { ArrowRightIcon, ChevronDownIcon } from './icons';

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
 *
 * The swap itself fades rather than cuts: the group is keyed by which side it
 * is showing, so signing in or out mounts the other side fresh and
 * `@starting-style` brings it in. The first paint of a page load is not a
 * change, and does not animate.
 *
 * On a phone "Sign in" is hidden here and offered at the foot of the menu
 * drawer instead, so the mark can sit on the centre line (see `.account-sign-in`
 * in `globals.css`).
 *
 * "Sign in" carries the current page as `?next=`, so signing in returns the
 * visitor to what they were looking at instead of dropping them somewhere
 * else -- see `safeNextPath` for what is allowed through.
 */
export function AccountNav() {
  const { account } = useAccount();
  const pathname = usePathname();
  const signInHref = `/sign-in?next=${encodeURIComponent(pathname || '/')}` as Route;

  return (
    <div className="account-actions ml-auto flex items-center gap-2">
      {account ? (
        <div key="in" className="account-swap">
          <AccountMenu account={account} />
        </div>
      ) : (
        <div key="out" className="account-swap">
          <ButtonLink
            href={signInHref}
            variant="ghost"
            size="sm"
            className="account-sign-in btn-caps btn-square"
          >
            Sign in
          </ButtonLink>
          {/* The hero's words, exactly. This is the same action as the big
              rectangle in the hero column, and once the bar started carrying
              the hero's links it was carrying half of that column already --
              two labels for one destination is the reader having to work out
              whether they are the same thing. */}
          <ButtonLink
            href="/subscriptions"
            size="sm"
            className="account-plan-cta btn-caps btn-square"
          >
            <span className="account-cta-long">Start a plan today</span>
            <span className="account-cta-short">Start a plan</span>
          </ButtonLink>
        </div>
      )}
    </div>
  );
}

/**
 * A signed-in visitor, as one control.
 *
 * It was three: the name as loose grey text, "My account" as a filled block and
 * "Sign out" as a bare label -- three treatments in a row for what is one
 * thing, who you are and what you can do about it. Now the bar carries a
 * monogram and the name, and the two actions live one press away, the way
 * every account control people already know works.
 *
 * The menu is a native popover rather than hand-rolled state. The platform
 * already dismisses it on an outside click and on Escape, returns focus to the
 * trigger, and puts it in the top layer -- which matters here, because the
 * header's `backdrop-filter` would otherwise become the containing block for
 * anything fixed inside it. It sits straight after the trigger in the DOM, so
 * Tab moves from the trigger into the menu.
 *
 * Its contents are a link and a button, so it is a disclosure of those rather
 * than an ARIA `menu`, which promises arrow-key navigation this does not need
 * (the APG's advice for navigation-style dropdowns).
 *
 * It is centred under the trigger, so it reads as dropping out of the control
 * rather than out of the corner of the screen, and it unrolls downward from
 * under the bar. Where centring would push it past the edge of a narrow window
 * it hangs flush from the trigger's right edge instead. On a phone it spans the
 * width of the screen. See `.account-panel`.
 */
function AccountMenu({ account }: { account: AccountChip }) {
  const menu = useRef<HTMLDivElement>(null);
  const initial = account.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="account-menu">
      <button
        type="button"
        popoverTarget="account-menu-panel"
        className="account-trigger"
        aria-label={`${account.name}, account menu`}
      >
        <span className="account-avatar" aria-hidden>
          {initial}
        </span>
        <span className="account-trigger-name">{account.name}</span>
        <ChevronDownIcon className="account-chevron" />
      </button>

      <div ref={menu} id="account-menu-panel" popover="auto" className="account-panel">
        <div className="account-panel-head">
          <span className="account-avatar account-avatar-lg" aria-hidden>
            {initial}
          </span>
          <div className="min-w-0">
            <p className="account-panel-name">{account.name}</p>
            <p className="account-panel-note">Signed in</p>
          </div>
        </div>

        <div className="account-panel-items">
          {/* A client-side navigation leaves the header mounted, so the menu
              would stay open over the next page without this. */}
          <Link
            href={account.href}
            className="account-item"
            onClick={() => menu.current?.hidePopover()}
          >
            {account.label}
            <ArrowRightIcon className="account-item-arrow" />
          </Link>
          {/* A customer who signs out is still a visitor: back to the top of the
              home page, not to a sign-in form. */}
          <SignOutButton redirectTo="/" className="account-item account-item-quiet" />
        </div>
      </div>
    </div>
  );
}
