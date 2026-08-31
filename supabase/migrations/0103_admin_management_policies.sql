-- =============================================================================
-- 0103  Policies the Owner admin screens need (PRD 5.2, PRD 13, PRD 14)
-- =============================================================================
-- 0090 gave every table its read posture and gated catalog/config writes. Three
-- gaps remain once the Owner actually has screens for employees, customers and
-- reviews:
--
--   * staff accounts are created and retired by the Owner, which means writing
--     someone else's auth_profiles row;
--   * an Owner-created customer (PRD 14) has no login, so nobody but the Owner
--     can give them an address;
--   * a review's "verified purchase" flag must be computed by the database,
--     not asserted by whoever posts the review.
--
-- These are deliberately permission-gated policies rather than service-role
-- work in the application: the writes stay under RLS and the audit trigger
-- keeps naming the real person who made them (PRD 17).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Staff accounts. The privilege guard from 0090 still applies on top of this:
-- it is what stops anyone *without* employees.manage from editing their own
-- role, and this policy is what lets the Owner edit someone else's.
-- -----------------------------------------------------------------------------
create policy auth_profiles_manage on public.auth_profiles
  for all using (app.has_permission('employees.manage'))
  with check (app.has_permission('employees.manage'));

-- -----------------------------------------------------------------------------
-- Addresses for customers the Owner maintains on their behalf.
-- -----------------------------------------------------------------------------
create policy customer_addresses_manage on public.customer_addresses
  for all using (app.has_permission('customers.manage'))
  with check (app.has_permission('customers.manage'));

-- =============================================================================
-- Verified purchase is derived, never claimed
-- =============================================================================
-- The badge is only worth anything if the database decides it. A customer
-- inserts a review through their own token, so without this they could simply
-- set the column to true.
--
-- Trusted writers are exempt, matching the guards in 0090: the seed, a
-- migration and the service role can already bypass RLS entirely, and they are
-- the ones importing history this query cannot see -- an order placed before
-- the system existed still produced a real meal.
-- =============================================================================
create or replace function app.review_set_verified_purchase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if app.is_direct_connection() or app.is_service_role() then
    return new;
  end if;

  new.is_verified_purchase :=
    exists (
      select 1
        from public.subscription_deliveries d
        join public.subscription_delivery_items i on i.delivery_id = d.id
       where d.customer_id = new.customer_id
         and d.status = 'fulfilled'
         and (new.product_id is null or i.product_id = new.product_id)
    )
    or exists (
      select 1
        from public.orders o
        join public.order_items oi on oi.order_id = o.id
       where o.customer_id = new.customer_id
         and o.status = 'COMPLETED'
         and (new.product_id is null or oi.product_id = new.product_id)
    );

  return new;
end;
$fn$;

create trigger reviews_set_verified_purchase
  before insert or update of product_id, customer_id on public.reviews
  for each row execute function app.review_set_verified_purchase();

-- =============================================================================
-- Public rating summary (PRD 14)
-- =============================================================================
-- Only published, undeleted reviews count, so nothing unmoderated can move a
-- product's rating. Aggregated in the view rather than in the page so the
-- storefront cannot accidentally count a pending review.
-- =============================================================================
create view public.v_product_ratings as
select
  r.product_id,
  count(*)::integer                 as review_count,
  round(avg(r.rating)::numeric, 2)  as average_rating
from public.reviews r
where r.status = 'published'
  and r.deleted_at is null
  and r.product_id is not null
group by r.product_id;

grant select on public.v_product_ratings to anon, authenticated, service_role;

-- =============================================================================
-- Moderating a review, with the moderator's note kept on the same record
-- =============================================================================
-- The status trigger in 0009 already writes a review_moderation row for every
-- status change, which is what makes hiding a review auditable. Writing a
-- second row here to carry the note would leave two competing records of one
-- decision, so this annotates the row the trigger just created instead.
--
-- review_moderation has no client write policy at all, which is deliberate:
-- moderation history is not something a browser token edits.
-- =============================================================================
create or replace function public.moderate_review(
  p_review_id uuid,
  p_status    public.review_status,
  p_reason    text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_from public.review_status;
begin
  if not app.has_permission('reviews.moderate') then
    raise exception 'you may not moderate reviews'
      using errcode = 'insufficient_privilege';
  end if;

  select r.status into v_from from public.reviews r where r.id = p_review_id;

  if not found then
    raise exception 'review not found' using errcode = 'no_data_found';
  end if;

  -- A no-op decision leaves no trace, so the history reads as decisions made
  -- rather than buttons pressed.
  if v_from = p_status then
    return;
  end if;

  update public.reviews set status = p_status where id = p_review_id;

  update public.review_moderation
     set reason = p_reason
   where id = (
     select m.id
       from public.review_moderation m
      where m.review_id = p_review_id
      order by m.created_at desc, m.id desc
      limit 1);
end;
$fn$;

grant execute on function
  public.moderate_review(uuid, public.review_status, text)
to authenticated, service_role;

-- =============================================================================
-- A customer withdrawing their own refund request (PRD 7)
-- =============================================================================
-- refund_requests is updatable only by payments.manage, which is right for
-- deciding a case but leaves a customer unable to take one back. Rather than
-- widening that policy -- which would also let them edit a decision already
-- recorded against them -- this does the one thing they should be able to do,
-- and proves ownership before doing it.
-- =============================================================================
create or replace function public.withdraw_refund_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_customer uuid;
  v_status   text;
begin
  select r.customer_id, r.status
    into v_customer, v_status
    from public.refund_requests r
   where r.id = p_request_id;

  if not found then
    raise exception 'refund request not found' using errcode = 'no_data_found';
  end if;

  if v_customer is distinct from app.current_customer_id() then
    raise exception 'that refund request is not yours'
      using errcode = 'insufficient_privilege';
  end if;

  -- A case that has already been decided is part of the record, not a draft.
  if v_status not in ('open', 'under_review') then
    raise exception 'that request has already been decided'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.refund_requests
     set status          = 'withdrawn',
         resolved_at     = now(),
         resolution_note = coalesce(resolution_note, 'Withdrawn by the customer')
   where id = p_request_id;
end;
$fn$;

grant execute on function public.withdraw_refund_request(uuid) to authenticated, service_role;
