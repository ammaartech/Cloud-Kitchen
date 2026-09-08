-- =============================================================================
-- 0105  Manager fallback: allow manual DELIVERED, keep OUT_FOR_DELIVERY webhook-only
-- =============================================================================
-- 0104 refused any manual transition to OUT_FOR_DELIVERY or DELIVERED because
-- the assumption was that Swiggy/Zomato webhooks would always drive the tail
-- of the flow. In practice the aggregator adapters run in `mocked` state until
-- each merchant contract is signed, and even in production a webhook may miss
-- (rider forgets to swipe, provider outage). Without an escape hatch the
-- manager cannot close a ticket at all.
--
-- The intermediate OUT_FOR_DELIVERY state is only meaningful when a rider is
-- being tracked, so we keep the manual refusal on it. A manager clicking
-- "Mark delivered" jumps straight from PICKED_UP (or OUT_FOR_DELIVERY, if the
-- webhook did fire once) to DELIVERED.
-- =============================================================================

create or replace function public.transition_kot_ticket(
  p_ticket_id uuid,
  p_to_status public.kot_status,
  p_reason    text default null,
  p_notes     text default null,
  p_origin    text default 'manual'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_ticket public.kot_tickets%rowtype;
  v_from   public.kot_status;
begin
  if p_origin is null or p_origin not in ('manual', 'webhook', 'auto') then
    raise exception 'unknown transition origin %', p_origin
      using errcode = 'invalid_parameter_value';
  end if;

  -- Only OUT_FOR_DELIVERY stays webhook-only: it is a rider-tracking event, not
  -- something a manager can attest to. DELIVERED is now a legitimate manual
  -- fallback for when the aggregator update does not arrive.
  if p_to_status = 'OUT_FOR_DELIVERY' and p_origin = 'manual' then
    raise exception
      'transition to OUT_FOR_DELIVERY is driven by the marketplace webhook, not a manual click'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_ticket from public.kot_tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'ticket % not found', p_ticket_id using errcode = 'no_data_found';
  end if;

  if v_ticket.status = p_to_status then
    return jsonb_build_object('ticket_id', p_ticket_id, 'status', p_to_status, 'noop', true);
  end if;

  v_from := v_ticket.status;

  update public.kot_tickets
     set status = p_to_status,
         rejection_reason = case when p_to_status = 'REJECTED' then p_reason else rejection_reason end,
         cancellation_reason = case when p_to_status = 'CANCELLED' then p_reason else cancellation_reason end,
         notes = coalesce(p_notes, notes)
   where id = p_ticket_id;

  if p_to_status = 'PREPARING' then
    update public.orders set status = 'IN_PROGRESS'
     where id = v_ticket.order_id and status = 'CONFIRMED';
  elsif p_to_status = 'DELIVERED' then
    update public.orders set status = 'COMPLETED' where id = v_ticket.order_id;
    update public.subscription_deliveries
       set status = 'fulfilled', fulfilled_at = now()
     where order_id = v_ticket.order_id;
  elsif p_to_status in ('REJECTED','CANCELLED') then
    update public.orders
       set status = case when p_to_status = 'REJECTED'
                         then 'REJECTED'::public.order_status
                         else 'CANCELLED'::public.order_status end,
           cancellation_reason = p_reason
     where id = v_ticket.order_id;
  end if;

  return jsonb_build_object(
    'ticket_id', p_ticket_id,
    'from', v_from,
    'status', p_to_status,
    'noop', false,
    'origin', p_origin);
end;
$fn$;

-- Label refresh so the transitions table lines up with the button copy.
update public.kot_transitions
   set label = 'Mark delivered'
 where from_status = 'PICKED_UP' and to_status = 'DELIVERED';
