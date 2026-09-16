import { markSignedOut } from '@/components/site/account';

/**
 * Ends the session on this device. Resolves once the server has cleared the
 * session cookies; rejects if it could not be reached, in which case nothing
 * about the session has changed and the caller should say so.
 *
 * Every sign-out control goes through here -- the storefront menu, the staff
 * screens, checkout's "Not you?" -- so all of them are fast in the same way and
 * all of them update the header, and other tabs, the same way. Where each one
 * goes afterwards is its own decision. See `app/api/auth/sign-out/route.ts`.
 */
export async function signOut(): Promise<void> {
  const response = await fetch('/api/auth/sign-out', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Sign-out failed (${response.status})`);

  markSignedOut();
}
