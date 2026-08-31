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
 */
export async function serverClient() {
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
          // Server Components cannot set cookies. The middleware refreshes the
          // session instead, so this is safe to ignore here.
        }
      },
    },
  });
}
