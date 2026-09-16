import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { serverEnv } from '@/lib/env';

/**
 * Supabase session refresh.
 *
 * A Server Component may read cookies but may not write them, which is why the
 * refresh has to happen out here: this runs before rendering, where the
 * response is still open and a rotated token can actually be set on it.
 * Without it a signed-in user carries an access token that nothing renews and
 * is quietly logged out when it expires -- most visibly mid-checkout.
 *
 * It is `proxy.ts` rather than `middleware.ts` because Next 16 renamed the
 * convention. The behaviour is unchanged; the old name is deprecated.
 *
 * **Two things keep this cheap, and both are load-bearing.**
 *
 * The early return: a request with no Supabase auth cookie has no session to
 * refresh, and that is decidable from the cookie header alone. The storefront's
 * visitors are mostly signed out, and this runs on every matched request.
 *
 * `getClaims()` rather than `getUser()`: `getUser()` asks the auth server to
 * validate the token on every request -- a network round-trip that every admin
 * navigation, and every link prefetch, paid before the page could even begin.
 * `getClaims()` verifies the token's signature locally against the project's
 * public signing key (fetched once, cached ten minutes per process), and only
 * goes to the network when the token has actually expired and needs rotating,
 * which is the one case this file exists for. The project issues ES256 tokens;
 * on a legacy HS256 project the call falls back to `getUser()` by itself, so
 * this is never weaker than what it replaced.
 *
 * The result is deliberately unused -- authorizing anyone is `getSession()`'s
 * job, and RLS re-checks it at the database no matter what this concludes.
 */

/** `sb-<project-ref>-auth-token`, plus the `.0`/`.1` chunks of a split cookie. */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));
}

export async function proxy(request: NextRequest) {
  if (!hasAuthCookie(request)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const env = serverEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Both halves matter. The request copy is what the render that
          // follows will read, so it has to carry the rotated token; the
          // response copy is what the browser keeps for next time. Setting
          // only one leaves either this render or the next request holding the
          // token that was just replaced.
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // The call itself is the refresh: an expired token is rotated and handed to
  // `setAll` above; a valid one is verified locally and nothing else happens.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  /**
   * Everything except things that never carry a session: the build output, the
   * image optimizer, and static files. `delivery-scooter.png` and friends are
   * covered by the extension list -- running an auth refresh to serve an image
   * is pure latency.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)'],
};
