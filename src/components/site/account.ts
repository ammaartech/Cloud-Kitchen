'use client';

import { useSyncExternalStore } from 'react';
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
 * ## A store, not a memo
 *
 * This was a memoised promise that each component read once, on mount. That
 * held while signing out always left the storefront -- the sign-out button went
 * to `/sign-in`, which unmounts the header -- and it broke the moment sign-out
 * started returning to the home page: the header never unmounted, so it never
 * asked again, and went on greeting somebody who had just left.
 *
 * So it is a tiny external store read through `useSyncExternalStore`. One
 * request serves every reader (the header and the offers notice), a change is
 * pushed to all of them at once, and the answer survives client-side
 * navigation because the module does.
 *
 * ## Other tabs
 *
 * Signing in or out in one tab tells the others over a `BroadcastChannel`, so a
 * second tab does not go on showing a name the session no longer has. A tab on
 * a signed-in-only screen reloads instead, and the server decides where that
 * screen now sends it.
 */

const LOADING: AccountState = { status: 'loading', account: null };
const CHANNEL = 'ik-account';
const PRIVATE_PREFIXES = ['/account', '/admin', '/kot'];

let state: AccountState = LOADING;
let inFlight: Promise<AccountChip | null> | null = null;
/**
 * Bumped by every change of answer. A request that was already on its way when
 * the person signed out must not land afterwards and put their name back.
 */
let generation = 0;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

type Message = { type: 'signed-out' } | { type: 'changed' };

function publish(next: AccountState): void {
  state = next;
  for (const listener of listeners) listener();
}

function load(): Promise<AccountChip | null> {
  inFlight ??= (async () => {
    const asked = generation;
    try {
      const response = await fetch('/api/account/session', {
        credentials: 'same-origin',
        cache: 'no-store',
      });

      if (!response.ok) throw new Error(String(response.status));

      const body: { account: AccountChip | null } = await response.json();
      const account = body.account ?? null;
      if (asked === generation) publish({ status: 'ready', account });
      return account;
    } catch {
      // Offline, or mid-deploy. Drop the memo so the next reader retries rather
      // than pinning "signed out" for the rest of the page's life, and show the
      // signed-out header in the meantime -- it is the state that costs a
      // signed-in visitor a click, not one that shows them somebody else's name.
      if (asked === generation) {
        inFlight = null;
        publish({ status: 'ready', account: null });
      }
      return null;
    }
  })();

  return inFlight;
}

function onMessage(event: MessageEvent<Message>): void {
  const onPrivateScreen = PRIVATE_PREFIXES.some((prefix) =>
    window.location.pathname.startsWith(prefix),
  );

  if (event.data?.type === 'signed-out') {
    generation += 1;
    inFlight = Promise.resolve(null);
    publish({ status: 'ready', account: null });
    if (onPrivateScreen) window.location.reload();
    return;
  }

  if (event.data?.type === 'changed') {
    generation += 1;
    inFlight = null;
    if (listeners.size > 0) void load();
  }
}

function connect(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(CHANNEL);
  channel.addEventListener('message', onMessage);
  return channel;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  connect();
  if (!inFlight) void load();
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Re-reads the identity after it may have changed -- a sign-in, or a checkout
 * that just created an account. The current answer stays on screen until the
 * new one arrives, so the header does not flash through "signed out" on the way.
 * Resolves with the new identity, and tells other tabs to re-read theirs.
 */
export function refreshAccount(): Promise<AccountChip | null> {
  generation += 1;
  inFlight = null;
  connect()?.postMessage({ type: 'changed' } satisfies Message);
  return load();
}

/** Kept for existing callers: the same as `refreshAccount`, without the result. */
export function clearAccount(): void {
  void refreshAccount();
}

/**
 * Records a completed sign-out. Every reader switches to signed-out at once --
 * no request, because the server has just said so -- and other tabs follow.
 */
export function markSignedOut(): void {
  generation += 1;
  inFlight = Promise.resolve(null);
  publish({ status: 'ready', account: null });
  connect()?.postMessage({ type: 'signed-out' } satisfies Message);
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => LOADING,
  );
}
