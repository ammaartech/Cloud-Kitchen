import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { landingPathForRole } from '@/lib/auth/permissions';

/**
 * The signed-in identity, flattened to exactly what the storefront header draws.
 *
 * This endpoint exists so that reading the session costs the *storefront*
 * nothing. `getSession()` reads `cookies()`, and a cookie read anywhere in a
 * layout's render makes every route beneath that layout per-request -- which is
 * what kept the whole of `(site)` out of the prerender, `/about` included, a
 * page that fetches nothing and could be pure static HTML. Moving the read here
 * takes it off the render path: the shell prerenders, and the browser asks who
 * it is afterwards.
 *
 * Only the three fields the header shows cross the wire. The permission set
 * stays on the server, where it is an authorization input; a client could do
 * nothing with it but hide buttons, which is not a security boundary anyway.
 */
export async function GET() {
  const session = await getSession();

  const account = session
    ? {
        name: session.fullName || session.email || 'Account',
        href: landingPathForRole(session.role),
        label: session.role === 'customer' ? 'My account' : 'Dashboard',
      }
    : null;

  // Per-user and cheap to re-read. `no-store` is what stops a shared cache --
  // a CDN, or the browser's own bfcache on a back navigation -- from handing
  // one visitor's name to the next.
  return NextResponse.json(
    { account },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
