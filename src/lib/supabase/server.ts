import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { serverEnv } from '@/lib/env';

/**
 * Request-scoped Supabase client carrying the signed-in user's session.
 *
 * Every query made through this client is filtered by RLS as that user, and
 * every RPC sees them as `auth.uid()` -- which is how the KOT transition
 * checks, the subscription ownership guards and the audit trail all resolve to
 * a real person without the application passing an identity around.
 *
 * Memoised per request with React's `cache()`. A page, its layout, its
 * `generateMetadata` and the session helper all ask for "the client", and
 * before this each call built a fresh one and re-parsed the auth cookie. One
 * instance per request means the token is decoded once and the in-memory
 * session state (including a refreshed token) is shared by every caller in the
 * same render. It holds no state that could leak between requests: the cache is
 * scoped to the request, and the client only ever sees that request's cookies.
 */
export const serverClient = cache(async () => {
  const env = serverEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. `src/proxy.ts` refreshes the
          // session before the render begins, so this is safe to ignore here.
        }
      },
    },
  });
});

export type ServerSupabase = Awaited<ReturnType<typeof serverClient>>;
