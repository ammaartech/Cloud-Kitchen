import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { serverEnv } from '@/lib/env';
import {
  hasPreviewAccess,
  isOpenWhileLocked,
  PRIVATE_PREVIEW_PATH,
  siteLock,
  type PreviewProfile,
} from '@/lib/auth/site-lock';

/**
 * Supabase session refresh, and the private development lock.
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
 * Outside the lock the result is deliberately unused -- authorizing anyone is
 * `getSession()`'s job, and RLS re-checks it at the database no matter what
 * this concludes.
 *
 * **The lock.** While SITE_LOCKED is on (see `lib/auth/site-lock.ts`), every
 * path except the few the lock itself needs is refused to anyone who is not a
 * Developer Admin or an allowed test account. This is the one place that sees
 * every page, route handler and Server Action before it runs, which is why it
 * lives here rather than in a layout: a layout guards nothing under `/api`.
 */

/** `sb-<project-ref>-auth-token`, plus the `.0`/`.1` chunks of a split cookie. */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));
}

/** Customer screens that only ever render for a session. */
function isAccountPath(pathname: string): boolean {
  return pathname === '/account' || pathname.startsWith('/account/');
}

/**
 * Turns a request away from the locked site.
 *
 * A page is redirected -- to sign-in with the page carried along as `?next=`,
 * or, for an account that is signed in but not allowed, to the page that says
 * so. Anything else (an API call, a Server Action) gets a status code instead,
 * because a redirect to an HTML page is not an answer a `fetch` can use.
 */
function refuse(request: NextRequest, reason: 'signed-out' | 'no-access'): NextResponse {
  const { pathname } = request.nextUrl;
  const isPage =
    (request.method === 'GET' || request.method === 'HEAD') && !pathname.startsWith('/api/');

  if (!isPage) {
    return NextResponse.json(
      {
        error:
          reason === 'signed-out'
            ? 'Sign in to continue.'
            : 'This site is in private development.',
      },
      {
        status: reason === 'signed-out' ? 401 : 403,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  }

  if (reason === 'no-access') {
    return NextResponse.redirect(new URL(PRIVATE_PREVIEW_PATH, request.url));
  }

  const signIn = new URL('/sign-in', request.url);
  // The home page is left off, so signing in from it lands on the role's own
  // screen as it always has. `_rsc` is the router's cache-buster, not the page.
  if (pathname !== '/') {
    const target = new URL(request.nextUrl);
    target.searchParams.delete('_rsc');
    signIn.searchParams.set('next', target.pathname + target.search);
  }
  return NextResponse.redirect(signIn);
}

/**
 * The lock's view of each account, remembered per process for a minute.
 *
 * Without it every navigation, prefetch and API call from a signed-in tester
 * would wait on a profile read before anything else could start -- the exact
 * round trip `getClaims()` was chosen to avoid. The cost is that a role change
 * or deactivation takes up to a minute to reach the lock. The pages behind it
 * see it at once regardless: `getSession()` reads the profile fresh on every
 * request.
 */
const PROFILE_TTL_MS = 60_000;
const profileCache = new Map<string, { profile: PreviewProfile | null; expires: number }>();

async function previewProfile(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<PreviewProfile | null> {
  const now = Date.now();
  const hit = profileCache.get(userId);
  if (hit && hit.expires > now) return hit.profile;

  const { data, error } = await supabase
    .from('auth_profiles')
    .select('role, is_active')
    .eq('id', userId)
    .maybeSingle();

  // Fails closed, but does not remember the failure: the next request asks
  // again rather than locking a developer out for a minute over one blip.
  if (error) {
    console.warn('[site-lock] profile read failed:', error.message);
    return null;
  }

  const profile = data ? { role: String(data.role), isActive: Boolean(data.is_active) } : null;
  // A crude bound, and enough: while the site is locked, the accounts that
  // reach this line are the team's.
  if (profileCache.size >= 1000) profileCache.clear();
  profileCache.set(userId, { profile, expires: now + PROFILE_TTL_MS });
  return profile;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const lock = siteLock();
  const guarded = lock.locked && !isOpenWhileLocked(pathname);

  if (!hasAuthCookie(request)) {
    if (guarded) return refuse(request, 'signed-out');
    // Nobody to show an account to. Sending them to sign-in here, from the
    // cookie header alone, beats rendering the account shell and redirecting
    // from inside its stream. The pages still guard themselves: a cookie that
    // is present but no longer valid is `requireSession()`'s to refuse.
    if (isAccountPath(pathname)) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }
    return NextResponse.next({ request });
  }

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
  const { data } = await supabase.auth.getClaims();

  if (guarded) {
    const claims = data?.claims;
    let refusal: NextResponse | null = null;

    if (!claims) {
      refusal = refuse(request, 'signed-out');
    } else {
      const profile = await previewProfile(supabase, claims.sub);
      if (!hasPreviewAccess(claims.email, profile, lock.allowedEmails)) {
        refusal = refuse(request, 'no-access');
      }
    }

    if (refusal) {
      // A token rotated on the way in must still reach the browser. Dropped
      // here, the browser would present the spent refresh token next time,
      // and Supabase treats a reused refresh token as a stolen one.
      for (const cookie of response.cookies.getAll()) refusal.cookies.set(cookie);
      return refusal;
    }
  }

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
