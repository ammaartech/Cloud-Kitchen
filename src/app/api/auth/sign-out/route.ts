import { after, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { serverClient } from '@/lib/supabase/server';

/**
 * Signing out, done on the server and done in two halves.
 *
 * ## Why not `auth.signOut()` in the browser
 *
 * That is what this replaced, and it was slow three ways over. The press first
 * downloaded the Supabase browser client, which the storefront otherwise never
 * loads. `signOut()` then made a round trip to the auth server -- about 220ms
 * warm and 800ms cold from here -- before it cleared anything, because the
 * library revokes first and forgets second. And the button finished by
 * rendering `/sign-in`, a per-request page with a database read behind it.
 *
 * ## The two halves
 *
 * 1. **Forget, now.** The auth cookies are expired on this response. The
 *    moment it arrives, this browser holds no session: nothing it requests
 *    afterwards is signed in, which is what "signed out" means to the person
 *    who pressed the button. This half does no network I/O at all.
 * 2. **Revoke, after.** The session's refresh token is revoked at the auth
 *    server in `after()`, once the response has gone. That is the server-side
 *    invalidation OWASP asks for -- a copied cookie cannot be replayed to mint
 *    new tokens -- without making the person wait on it. Access tokens already
 *    issued stay valid until they expire (Supabase's documented behaviour);
 *    that is true of every sign-out path and not made worse here.
 *
 * ## Scope
 *
 * `local`: this session only. The library's default is `global`, which signs
 * the person out of every device they use -- leaving a laptop by pressing
 * "Sign out" on a phone. That is a separate, deliberate action on every large
 * service, not what a sign-out button in a header does.
 *
 * ## Cross-site requests
 *
 * Refused when the `Origin` is another site. The auth cookies are `SameSite=Lax`
 * and would not ride along on a cross-site POST anyway; the check makes the
 * endpoint's intent explicit rather than leaning on a cookie default.
 */
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (origin && host) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost !== host) {
      return NextResponse.json({ error: 'Cross-site sign-out refused.' }, { status: 403 });
    }
  }

  const supabase = await serverClient();

  // Read, not verified: this token is only being handed back to the auth server
  // so it can revoke its own session. Nothing here trusts who it says it is.
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token ?? null;

  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) {
    // `sb-<ref>-auth-token`, its `.0`/`.1` chunks, and the PKCE code verifier.
    if (name.startsWith('sb-') && name.includes('-auth-token')) {
      cookieStore.set(name, '', { path: '/', maxAge: 0 });
    }
  }

  if (accessToken) {
    after(async () => {
      const { error } = await supabase.auth.admin.signOut(accessToken, 'local');
      // 401/403/404 mean the session is already gone, which is the goal.
      if (error && ![401, 403, 404].includes(error.status ?? 0)) {
        console.warn('[sign-out] session revoke failed:', error.message);
      }
    });
  }

  return NextResponse.json(
    { signedOut: true },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
