-- =============================================================================
-- 0108  Batch claim / complete for the notification outbox (PRD 15)
-- =============================================================================
-- The dispatcher used to select a batch, then per row: mark it 'sending',
-- send, write the outcome, insert an event -- 2 + 3N round-trips, one after
-- another. It also had no lock, so two overlapping runs could pick up the
-- same queued rows and message a customer twice.
--
-- These two functions reduce a batch to two round-trips around the sends:
-- claim_notifications locks and marks the batch in one statement (SKIP
-- LOCKED, as release_due_deliveries does), and complete_notifications writes
-- every outcome and event in one go.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- claim_notifications
-- -----------------------------------------------------------------------------
-- A row is claimable when it is due, or when it has sat in 'sending' long
-- enough that the run which claimed it must have died (a function timeout
-- mid-batch). updated_at is maintained by notifications_touch, so it marks
-- the moment of the claim.
-- -----------------------------------------------------------------------------
create or replace function public.claim_notifications(
  p_limit      integer     default 50,
  p_now        timestamptz default now(),
  p_stale_after interval   default interval '10 minutes'
)
returns table (
  id            uuid,
  channel       public.notification_channel,
  to_address    text,
  payload       jsonb,
  rendered_body text,
  attempts      integer,
  max_attempts  integer,
  template_code text
)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
begin
  return query
  with due as (
    select n.id
      from public.notifications n
     where (n.status in ('queued', 'failed') and n.next_attempt_at <= p_now)
        or (n.status = 'sending' and n.updated_at <= p_now - p_stale_after)
     order by n.created_at
     limit p_limit
     for update skip locked
  )
  update public.notifications n
     set status = 'sending'
    from due
   where n.id = due.id
  returning n.id, n.channel, n.to_address, n.payload, n.rendered_body,
            n.attempts, n.max_attempts, n.template_code;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- complete_notifications
-- -----------------------------------------------------------------------------
-- p_results is an array of
--   { id, sent, body, provider_message_id?, error?, retryable? }
-- attempts is incremented from the row, not taken from the caller, and the
-- retry rules live here: a failure is parked in dead_letter once attempts
-- reach max_attempts or the transport calls it permanent; otherwise it backs
-- off exponentially, capped at an hour.
-- -----------------------------------------------------------------------------
create or replace function public.complete_notifications(
  p_provider text,
  p_results  jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
begin
  with r as (
    select *
      from jsonb_to_recordset(p_results) as x(
        id uuid, sent boolean, body text,
        provider_message_id text, error text, retryable boolean)
  )
  update public.notifications n
     set attempts            = n.attempts + 1,
         rendered_body       = r.body,
         status              = case
                                 when r.sent then 'sent'
                                 when n.attempts + 1 >= n.max_attempts
                                   or r.retryable is false then 'dead_letter'
                                 else 'failed'
                               end::public.notification_status,
         sent_at             = case when r.sent then now() else n.sent_at end,
         provider            = case when r.sent then p_provider else n.provider end,
         provider_message_id = case when r.sent then r.provider_message_id
                                    else n.provider_message_id end,
         last_error          = case when r.sent then null
                                    else coalesce(r.error, 'Unknown error') end,
         next_attempt_at     = case when r.sent then n.next_attempt_at
                                    else now() + make_interval(
                                      mins => least(power(2, n.attempts + 1), 60)::integer)
                               end
    from r
   where n.id = r.id;

  insert into public.notification_events (notification_id, event_type, payload)
  select r.id,
         case when r.sent then 'sent' else 'failed' end,
         jsonb_build_object('transport', p_provider, 'error', r.error)
    from jsonb_to_recordset(p_results) as r(id uuid, sent boolean, error text);
end;
$fn$;

-- Service-role only, like every other job RPC (0099_grants.sql).
revoke execute on function
  public.claim_notifications(integer, timestamptz, interval),
  public.complete_notifications(text, jsonb)
from public, anon, authenticated;

grant execute on function
  public.claim_notifications(integer, timestamptz, interval),
  public.complete_notifications(text, jsonb)
to service_role;
