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

/**
 * Records an audit entry for work done by the system rather than a person.
 *
 * Webhooks and scheduled jobs genuinely have no human actor, so the entry is
 * attributed to the system and the `context` says which subsystem acted. That
 * is more truthful than borrowing a user's identity for a machine's action.
 *
 * (The database also supports an `app.actor_id` session setting, but it is
 * only usable from a dedicated connection such as psql or the seed script --
 * PostgREST pools connections, so a session-level setting there would leak
 * into an unrelated request.)
 */
export async function auditSystemEvent(input: {
  action: 'insert' | 'update' | 'delete' | 'state_transition' | 'config_change';
  entityType: string;
  entityId: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  context: Record<string, unknown>;
}): Promise<void> {
  const { error } = await adminClient().rpc('record_audit_event', {
    p_action: input.action,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_old: input.oldValues ?? null,
    p_new: input.newValues ?? null,
    p_context: input.context,
  });

  // An audit write failing must be loud in the logs but must not take down the
  // operation that succeeded -- the alternative is losing real work to a
  // logging problem.
  if (error) {
    console.error('[audit] failed to record system event', {
      entity: input.entityType,
      error: error.message,
    });
  }
}
