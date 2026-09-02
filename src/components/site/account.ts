'use client';

import { useEffect, useState } from 'react';
import type { Route } from 'next';

/** What the header needs to draw a signed-in user: a name and a way back in. */
export interface AccountChip {
  name: string;
  href: Route;
  label: string;
}

export type AccountState =
  | { status: 'loading'; account: null }
  | { status: 'ready'; account: AccountChip | null };

/**
 * Client-side access to the signed-in identity.
 *
 * The session used to be read in the `(site)` layout, which is what made every
 * storefront route dynamic -- see the note in `app/api/account/session/route.ts`.
 * It is fetched from the browser after hydration instead, so the shell can be
 * static HTML.
 *
 * The in-flight promise is memoised at module scope rather than held in a
 * context provider. Two things fall out of that, and both are the point:
 *
 *   * The header and the offers notice share one request instead of issuing
 *     two, without either of them knowing the other exists.
 *   * It survives client-side navigation, so moving around the site re-reads
 *     nothing. The module only unloads on a full page load, which is exactly
 *     when the answer could have changed underneath us.
 *
 * The cost of memoising is that sign-in and sign-out have to say so, because
 * both navigate with the client router and would otherwise leave the previous
 * answer standing. `clearAccount()` is that announcement.
 */
let inFlight: Promise<AccountChip | null> | null = null;

function load(): Promise<AccountChip | null> {
  inFlight ??= (async () => {
    try {
      const response = await fetch('/api/account/session', {
        credentials: 'same-origin',
      });

      if (!response.ok) throw new Error(String(response.status));

      const body: { account: AccountChip | null } = await response.json();
      return body.account ?? null;
    } catch {
      // Offline, or mid-deploy. Drop the memo so the next mount retries rather
      // than pinning "signed out" for the rest of the page's life, and show the
      // signed-out header in the meantime -- it is the state that costs a
      // signed-in visitor a click, not one that shows them somebody else's name.
      inFlight = null;
      return null;
    }
  })();

  return inFlight;
}

/** Forgets the memoised identity. Call after any sign-in or sign-out. */
export function clearAccount(): void {
  inFlight = null;
}

export function useAccount(): AccountState {
  const [state, setState] = useState<AccountState>({
    status: 'loading',
    account: null,
  });

  useEffect(() => {
    let active = true;

    load().then((account) => {
      if (active) setState({ status: 'ready', account });
    });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
