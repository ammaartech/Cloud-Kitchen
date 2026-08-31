-- =============================================================================
-- 0102  Provisioning a profile for every new auth user
-- =============================================================================
-- Without this, a customer who signs up during checkout has an auth.users row
-- but no auth_profiles row -- so app.current_role() returns null, every RLS
-- policy denies them, and they cannot see the subscription they just bought.
--
-- New accounts are always created as 'customer'. Staff roles are granted by the
-- Owner afterwards: self-service signup must never be able to mint a
-- privileged account.
-- =============================================================================

create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.auth_profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.phone,
    'customer'
  )
  on conflict (id) do nothing;

  return new;
end;
$fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

-- Keep the profile's contact details in step when Supabase Auth updates them
-- (email change, phone verification). Role and is_active are deliberately not
-- touched here -- those belong to the Owner, not to the auth system.
create or replace function app.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  update public.auth_profiles
     set email = new.email,
         phone = coalesce(new.phone, phone),
         phone_verified = (new.phone_confirmed_at is not null)
   where id = new.id
     and (email is distinct from new.email
          or phone is distinct from coalesce(new.phone, phone));

  return new;
end;
$fn$;

do $do$
begin
  -- phone_confirmed_at exists on Supabase but not on a bare Postgres used for
  -- local testing, so this trigger is created only where the column is there.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'auth' and table_name = 'users'
       and column_name = 'phone_confirmed_at'
  ) then
    create trigger on_auth_user_updated
      after update on auth.users
      for each row execute function app.handle_auth_user_updated();
  end if;
end
$do$;
