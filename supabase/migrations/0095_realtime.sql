-- =============================================================================
-- 0095  Realtime publication (PRD 11)
-- =============================================================================
-- Realtime is the primary mechanism, not a polling fallback. Supabase applies
-- the SELECT policies from 0090 to every change event, so a Kitchen client
-- receives ticket changes and nothing else.
--
-- REPLICA IDENTITY FULL is set on the operational tables so update events
-- carry the previous row too -- clients need the old status to reconcile an
-- out-of-order or duplicated event rather than trusting arrival order.
-- =============================================================================

alter table public.kot_tickets             replica identity full;
alter table public.kot_status_events       replica identity full;
alter table public.subscription_deliveries replica identity full;
alter table public.orders                  replica identity full;
alter table public.integration_accounts    replica identity full;

do $do$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$do$;

-- Adding a table twice raises; ignore the duplicate so the migration is
-- re-runnable against an existing Supabase project.
do $do$
declare
  t text;
begin
  foreach t in array array[
    'kot_tickets',
    'kot_status_events',
    'subscription_deliveries',
    'orders',
    'integration_accounts'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end
$do$;
