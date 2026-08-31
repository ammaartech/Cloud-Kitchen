-- =============================================================================
-- 0099  Explicit privilege grants
-- =============================================================================
-- Supabase grants broad table access to anon/authenticated by default and
-- relies on RLS to filter it. That default is fine for tables, but NOT for
-- functions: several RPCs in this schema are SECURITY DEFINER and must never
-- be callable by a browser token.
--
-- So: table access is granted (RLS is the gate), and function EXECUTE is
-- revoked wholesale and then granted back one function at a time.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- Tables: RLS decides what is visible. Operational tables have no write policy
-- at all, so these grants cannot be used to move a ticket or mint an order.
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- =============================================================================
-- Functions: deny by default
-- =============================================================================
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema app    from public, anon, authenticated;

-- Helpers used inside RLS policies must be executable by the roles those
-- policies run as, or every policy evaluation fails.
grant execute on function
  app.current_actor_id(),
  app.current_role(),
  app.is_service_role(),
  app.is_direct_connection(),
  app.has_permission(text),
  app.has_any_permission(text[]),
  app.is_staff(),
  app.is_admin(),
  app.current_customer_id(),
  app.product_is_orderable(uuid, timestamptz),
  app.business_timezone(),
  app.business_now(),
  app.business_date(timestamptz),
  app.setting(text),
  app.setting_numeric(text),
  app.setting_int(text),
  app.setting_bool(text),
  app.setting_text(text),
  app.resolve_delivery_fee(numeric, public.order_source, timestamptz),
  app.resolve_tax_components(text, timestamptz)
to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Read-only pricing and eligibility. Safe for the storefront: they compute,
-- they never commit.
-- -----------------------------------------------------------------------------
grant execute on function
  public.quote_subscription(uuid, uuid, text)
to anon, authenticated, service_role;

grant execute on function
  public.validate_coupon(text, uuid, numeric, uuid, public.order_source, timestamptz),
  public.subscription_credit_balance(uuid)
to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Customer actions. Each of these proves the caller owns the subscription it
-- is about to touch (app.assert_subscription_access / assert_customer_access).
-- -----------------------------------------------------------------------------
grant execute on function
  public.begin_subscription_checkout(uuid, uuid, uuid, uuid, public.payment_provider, text, smallint[], jsonb, text, text, date),
  public.schedule_credit_delivery(uuid, date, uuid, jsonb, uuid),
  public.skip_subscription_delivery(uuid, text),
  public.pause_subscription(uuid, date, date, text),
  public.cancel_subscription(uuid, text)
to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Operational actions. Callable by staff tokens: the transition trigger checks
-- the actor's permission for the specific move being attempted, so an Owner
-- token calling this still cannot accept a ticket.
-- -----------------------------------------------------------------------------
grant execute on function
  public.transition_kot_ticket(uuid, public.kot_status, text, text),
  public.override_prep_eta(uuid, integer)
to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Service-role only. These mint entitlements, confirm money, or ingest
-- external orders; a browser token must never reach them, whatever RLS says.
-- -----------------------------------------------------------------------------
grant execute on function
  public.confirm_subscription_payment(uuid, text, boolean, text, jsonb),
  public.fail_subscription_payment(uuid, text, text, boolean, jsonb),
  public.generate_subscription_deliveries(uuid, date, date),
  public.release_due_deliveries(timestamptz, integer),
  public.ingest_marketplace_order(public.integration_provider, text, jsonb, jsonb, jsonb, jsonb, text, timestamptz),
  public.sync_marketplace_order_status(public.integration_provider, text, text, text, jsonb),
  public.reconcile_marketplace_orders(public.integration_provider, timestamptz, timestamptz, text[]),
  public.record_integration_failure(public.integration_provider, text),
  public.record_integration_success(public.integration_provider),
  public.record_audit_event(public.audit_action, text, text, jsonb, jsonb, jsonb)
to service_role;

-- New objects created later inherit the same posture.
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant insert, update, delete on tables to authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
