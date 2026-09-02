import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';

/**
 * Service-role client. Bypasses RLS.
 *
 * Reserved for work that has no authenticated user behind it and that the
 * database must trust: verifying a payment webhook, ingesting a marketplace
 * order, releasing due deliveries, running reconciliation. Every route that
 * reaches for this performs its own authorization check first.
 *
 * When there *is* a user -- a customer cancelling a subscription, a manager
 * accepting a ticket -- use `serverClient()` instead. It carries the user's
 * token, so RLS and the transition permission checks apply to them
 * specifically, and the audit trail names them. Reaching for the service role
 * to "just make it work" would discard exactly the protections this system is
 * built on.
 *
 * Never import this from a client component.
 */
let client: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (client) return client;

  const env = serverEnv();
  client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'cloud-kitchen-server' } },
  });

  return client;
}
