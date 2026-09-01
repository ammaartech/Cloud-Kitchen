import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';

/**
 * Anonymous, cookie-free Supabase client for the public catalog.
 *
 * `serverClient()` is the right client for anything that belongs to a person.
 * It is the wrong one for the storefront's catalog, for two separate reasons,
 * and both of them are why this file exists.
 *
 * **It cannot be cached.** `serverClient()` reads `cookies()`. Next refuses
 * `cookies()` inside an `unstable_cache` scope, and any route that touches it
 * is opted out of static rendering for good. So every visitor to the landing
 * page was paying for the same five catalog queries over the wire -- roughly
 * half a second of a cold visitor's attention spent re-reading rows that had
 * not changed since the last person asked for them.
 *
 * **It would cache the wrong rows.** This is the more serious one. The read
 * policies are not uniform across callers:
 *
 *     products_read            using ((is_published and archived_at is null)
 *                                     or app.has_permission('catalog.manage'))
 *     subscription_plans_read  using ((is_published and is_active
 *                                      and archived_at is null)
 *                                     or app.has_permission('plans.manage'))
 *
 * An editor holding `catalog.manage` therefore sees unpublished and archived
 * rows that a customer must never see. A cache entry is shared by everyone, so
 * had the storefront kept reading through the session-scoped client, the first
 * editor to open the home page would have filled the shared entry with the
 * kitchen's unpublished drafts and served them to the public until it expired.
 *
 * Reading as `anon` removes the possibility rather than relying on nobody with
 * a staff cookie ever loading the storefront. The client carries no identity,
 * so the policy's second branch can never be true and the rows are exactly the
 * public subset by construction -- which is the only thing safe to put in a
 * shared cache.
 *
 * It also settles a smaller question that was previously answered by accident:
 * an editor browsing the storefront now sees the storefront as customers see
 * it, rather than a private preview mixed into the live page.
 *
 * One client per process is safe precisely because it holds no session: there
 * is no per-user state to leak between requests, which is the usual reason a
 * Supabase client has to be built per request.
 */
let client: SupabaseClient | null = null;

export function publicClient(): SupabaseClient {
  if (client) return client;

  const env = serverEnv();

  client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      // No session, ever. Persisting or refreshing one would reintroduce the
      // per-user state this client exists to not have.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}
