import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { serverEnv } from '@/lib/env';

/**
 * Supabase session refresh.
 *
 * This file is the thing `src/lib/supabase/server.ts` has been describing all
 * along. Its `setAll` swallows the write with "Server Components cannot set
 * cookies. The middleware refreshes the session instead" -- and there was no
 * middleware. Nothing anywhere refreshed a token. A signed-in customer was
 * carrying an access token that nothing renewed, so they stayed signed in
 * exactly as long as its lifetime and were then quietly logged out, most
 * visibly in the middle of a checkout.
 *
 * It is `proxy.ts` rather than `middleware.ts` because Next 16 renamed the
 * convention. The behaviour is unchanged; the old name is deprecated.
 *
 * A Server Component may read cookies but may not write them, which is why the
 * refresh has to happen out here: this runs before rendering, where the
 * response is still open and a rotated token can actually be set on it.
 *
 * **The early return is load-bearing.** `getUser()` validates the token against
 * the auth server, which is a network round-trip, and this runs on every
 * matched request. Paying that on the storefront -- whose visitors are mostly
 * signed out and whose speed is the entire point of the surrounding work --
 * would be trading one stall for another. A request with no Supabase auth
 * cookie has no session to refresh, and that is decidable from the cookie
 * header alone, so those requests leave without touching the network.
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

  // The call itself is the refresh: it rotates an expiring token and hands the
  // new one to `setAll` above. The result is deliberately unused -- authorizing
  // anyone is `getSession()`'s job, and RLS re-checks it at the database no
  // matter what this concludes.
  await supabase.auth.getUser();

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
