-- =============================================================================
-- 0107  A customer may create their own record (PRD 6, PRD 14)
-- =============================================================================
-- Account creation happens late in checkout: the customer row appears with the
-- first delivery address, which is the first point at which there is a name and
-- a mobile number to put in it.
--
-- Nothing could write that row. `customers` carries a policy for reading your
-- own record, one for updating it, and one for staff who hold
-- 'customers.manage' -- but no insert path for the person the record is about.
-- So the first save by a newly signed-up account was refused by RLS (42501),
-- and checkout could only be completed by someone who already had a customer
-- row from the seed. Both the checkout action and `ensureCustomer` in the
-- payment path hit the same wall.
--
-- The fix is an RPC rather than an insert policy, for the reason subscriptions
-- are written only through RPCs: an insert policy hands the browser every
-- column in the row, `phone_verified` among them -- and that column is a claim
-- about a check the kitchen has carried out, not something a customer may
-- assert about themselves. Here the caller supplies a name, a number and a
-- marketing choice. Everything else is decided on this side.
-- =============================================================================

create or replace function public.ensure_customer_record(
  p_full_name         text,
  p_phone             text,
  p_marketing_consent boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_actor    uuid := app.current_actor_id();
  v_existing uuid;
  v_email    text;
  v_id       uuid;
begin
  if v_actor is null then
    raise exception 'sign in before creating a customer record'
      using errcode = 'insufficient_privilege';
  end if;

  -- Idempotent, like the checkout it serves: a double submit, a retried action
  -- or a second tab returns the record the first call created rather than
  -- raising on the unique index.
  select c.id into v_existing
    from public.customers c
   where c.profile_id = v_actor
     and c.deleted_at is null;

  if found then
    return v_existing;
  end if;

  if coalesce(btrim(p_full_name), '') = '' or coalesce(btrim(p_phone), '') = '' then
    raise exception 'a customer record needs a name and a mobile number'
      using errcode = 'invalid_parameter_value';
  end if;

  -- The email is the account's own, never the form's: it is what the receipts
  -- and the sign-in are keyed on, and a customer typing a different one here
  -- would quietly detach the two.
  select p.email into v_email
    from public.auth_profiles p
   where p.id = v_actor;

  insert into public.customers (
    profile_id, full_name, email, phone,
    phone_verified,
    marketing_consent, marketing_consent_updated_at, marketing_consent_source,
    created_source
  ) values (
    v_actor, btrim(p_full_name), v_email, btrim(p_phone),
    -- Never from the caller.
    false,
    coalesce(p_marketing_consent, false),
    -- Stamped either way: when the choice was recorded is as much a fact about
    -- a "no" as about a "yes" (PRD 14).
    now(),
    'checkout',
    'website'
  )
  returning id into v_id;

  return v_id;

exception
  when unique_violation then
    -- customers_phone_key and customers_email_key are partial uniques over the
    -- live customers. Either way the number or address belongs to an account
    -- that already exists, and the customer needs to hear that rather than a
    -- constraint name.
    raise exception 'that mobile number or email is already on another account'
      using errcode = 'unique_violation';
end;
$fn$;

comment on function public.ensure_customer_record(text, text, boolean) is
  'Creates the calling account''s own customer record, or returns the existing one.';

grant execute on function public.ensure_customer_record(text, text, boolean)
  to authenticated, service_role;
