# Graph Report - Cloud-Kitchen  (2026-09-02)

## Corpus Check
- 163 files · ~161,447 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1517 nodes · 3578 edges · 114 communities (95 shown, 19 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 185 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b301f00a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 109|Community 109]]
- [[_COMMUNITY_Community 110|Community 110]]
- [[_COMMUNITY_Community 111|Community 111]]
- [[_COMMUNITY_Community 112|Community 112]]
- [[_COMMUNITY_Community 113|Community 113]]

## God Nodes (most connected - your core abstractions)
1. `serverClient()` - 73 edges
2. `cx()` - 43 edges
3. `Card()` - 43 edges
4. `app.audit_trigger()` - 42 edges
5. `app.has_permission(text)` - 38 edges
6. `money()` - 36 edges
7. `orders (table)` - 36 edges
8. `Button()` - 35 edges
9. `Badge()` - 35 edges
10. `requirePermission()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Configuration as Rows (business_settings)` --semantically_similar_to--> `Role Permissions Are Data, Not Code`  [INFERRED] [semantically similar]
  README.md → tests/rbac.test.ts
- `Principle: The Database Is the Truth` --semantically_similar_to--> `Capability Honesty: No Unverified 'integrated' State`  [INFERRED] [semantically similar]
  PRODUCT.md → tests/marketplace.test.ts
- `Principle: Color Is Never the Only Signal` --semantically_similar_to--> `Source-Prefixed Daily KOT Numbering`  [INFERRED] [semantically similar]
  PRODUCT.md → tests/kot.test.ts
- `Principle: Glanceable Under Rush` --semantically_similar_to--> `Ticket Priority and SLA Urgency Escalation`  [INFERRED] [semantically similar]
  PRODUCT.md → tests/kot.test.ts
- `Principle: Role-Shaped Interfaces` --semantically_similar_to--> `Role Permissions Are Data, Not Code`  [INFERRED] [semantically similar]
  PRODUCT.md → tests/rbac.test.ts

## Import Cycles
- 1-file cycle: `src/components/auth/demo-accounts.tsx -> src/components/auth/demo-accounts.tsx`

## Hyperedges (group relationships)
- **Payment-before-KOT enforcement chain** — m0008_trg_subscriptions_require_verified_payment, m0008_trg_kot_requires_confirmed_order, m0008_app_subscription_requires_verified_payment, m0008_app_kot_requires_confirmed_order, m0012_confirm_subscription_payment, m0013_release_due_deliveries, m0008_payments [EXTRACTED 1.00]
- **Cross-boundary idempotency mesh** — m0008_idempotency_keys, m0008_payment_events, m0010_integration_events, m0006_subscription_credit_ledger, m0006_subscription_deliveries, m0007_orders, m0011_begin_subscription_checkout, m0014_ingest_marketplace_order, m0012_confirm_subscription_payment [INFERRED 0.85]
- **Authorization-as-data resolution path** — m0002_permissions, m0002_role_permissions, m0007_kot_transitions, m0002_app_has_permission, m0002_app_current_role, m0007_app_kot_enforce_transition, m0013_transition_kot_ticket [EXTRACTED 1.00]
- **Subscription purchase to activation journey** — site_plan_detail_page, plan_detail_continue_to_checkout, schema_rpc_quote_subscription, schema_rpc_begin_subscription_checkout, schema_rpc_confirm_subscription_payment, schema_rpc_generate_subscription_deliveries, schema_tbl_subscription_credit_ledger [EXTRACTED 1.00]
- **Scheduled delivery released into a live kitchen ticket** — schema_tbl_subscription_deliveries, schema_rpc_release_due_deliveries, schema_rpc_subscription_credit_balance, schema_fn_create_kot_ticket, schema_tbl_orders, schema_tbl_kot_tickets [EXTRACTED 1.00]
- **Catalog edit propagating to the storefront** — admin_product_editor_page, admin_catalog_page, schema_tbl_products, schema_tbl_product_images, schema_tbl_collection_products, site_menu_page, site_meal_plans_page [EXTRACTED 1.00]
- **Payment verification and activation chain** — confirm_route_checkoutConfirm, sandbox_route_checkoutSandbox, concept_paymentOwnershipCheck, service_confirmCheckout, rpc_confirm_subscription_payment, db_payments, draft_clearDraft [EXTRACTED 1.00]
- **KOT transition authorization chain** — transition_route_kotTransition, eta_route_kotEta, server_supabaseServerClient, rpc_transition_kot_ticket, rpc_override_prep_eta, concept_kotStateMachineInDatabase, db_role_permissions [EXTRACTED 1.00]
- **Scheduled job layer** — notifications_route_jobsNotifications, reconcile_route_jobsReconcile, release_deliveries_route_jobsRelease, jobs_isAuthorisedJob, admin_supabaseAdminClient, concept_idempotentCronBearerAuth [EXTRACTED 1.00]
- **Marketplace webhook ingestion path** — route_MarketplaceWebhookRoute, concept_RawBodySignatureVerification, table_IntegrationEvents, rpc_IngestMarketplaceOrder, rpc_RecordIntegrationFailure, kotboardshared_BoardTicket [EXTRACTED 1.00]
- **Payment confirmation and activation path** — route_PaymentWebhookRoute, table_PaymentEvents, concept_WebhookIdempotency, rpc_ConfirmSubscriptionPayment, page_CheckoutPage, concept_ServerComputedQuote [EXTRACTED 1.00]
- **Sign-in journey** — page_SignInPage, signinpanel_SignInPanel, signinform_SignInForm, demoaccounts_DemoAccountsPanel, concept_LiftedCredentialState, signoutbutton_SignOutButton, page_ForbiddenPage [EXTRACTED 1.00]
- **The shared button family** — button_styles_buttonClasses, button_Button, primitives_ButtonLink, confirm_button_ConfirmButton, spinner_Spinner [EXTRACTED 1.00]
- **Realtime KOT board sync and honesty** — kitchen_board_KitchenBoard, manager_board_ManagerBoard, ticket_actions_useTicketActions, connection_badge_ConnectionBadge, ticket_items_TicketItems [EXTRACTED 1.00]
- **Idempotent, verified checkout** — draft_idempotencyKey, draft_draftSchema, service_beginCheckout, service_confirmCheckout, payment_step_PaymentStep, rpc_begin_subscription_checkout [EXTRACTED 1.00]
- **One PaymentAdapter contract, three gateways, one resolver** — paymenttypes_PaymentAdapter, razorpay_RazorpayAdapter, cashfree_CashfreeAdapter, sandbox_SandboxAdapter, paymentsindex_paymentAdapter, env_configuredPaymentProviders [EXTRACTED 1.00]
- **Constant-time HMAC verification across every trust boundary** — razorpay_signaturesMatch, cashfree_verifyWebhook, sandbox_SandboxAdapter, adapter_verifyWebhook, jobsauth_isAuthorisedJob [EXTRACTED 1.00]
- **Realtime as signal: refetch, resync, and the DB wiring that backs it** — usekotboard_useKotBoard, usekotboard_refetchOne, usekotboard_resync, usekotboard_connectionState, supabaseclient_browserClient, couponsconfig_realtimeWiring [INFERRED 0.95]
- **The Four-Role RBAC Model** — product_role_owner, product_role_branch_manager, product_role_kitchen_staff, product_role_developer_admin, rbac_permissions_are_data, readme_invariant_owner_kot_readonly, readme_invariant_kitchen_no_money [EXTRACTED 1.00]
- **The Payment Safety Guarantee** — readme_invariant_no_unverified_payment, readme_invariant_server_side_verification, readme_invariant_financial_idempotency, payments_uncertain_to_reconciliation, readme_sandbox_gateway_not_a_bypass, readme_no_payment_provider_is_safety, kot_requires_confirmed_order [EXTRACTED 1.00]
- **The Honest-State Doctrine** — product_principle_database_is_truth, product_anti_references, readme_rule_refused_write_reported, mp_capability_honesty, readme_invariant_no_fabricated_endpoints, readme_provisional_settings, design_server_action_feedback [INFERRED 0.85]

## Communities (114 total, 19 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (28): AddOnRow, metadata, CatalogNav(), TABS, bool(), codify(), list(), nullableBool() (+20 more)

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (22): AddOnsPage(), AddressesPage(), NotFound(), AuditPage(), requirePermission(), requireSession(), CatalogPage(), CategoriesPage() (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (49): PartnerMarketplaceAdapter, attempt() capability gate + circuit breaker, capabilityState() lookup, interpretPayload() best-effort mapper, PartnerMarketplaceAdapter.verifyWebhook(), Test: review moderation authority and audit, Test: staff roles, addresses, refund cases, Test: verified-purchase badge is derived, not claimed (+41 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (15): serverEnv, CashfreeAdapter, signaturesMatch(), RazorpayAdapter, signaturesMatch(), SandboxAdapter, CreateOrderInput, CreateOrderResult (+7 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (21): metadata, ConnectionBadge(), COLUMNS, KitchenBoard(), GROUPS, ManagerBoard(), useTicketActions(), Item (+13 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (27): notification_status (enum), payment_flow (enum), payment_provider (enum), payment_status (enum), plan_type (enum), subscription_status (enum), subscription_plans (table), subscriptions (table) (+19 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (36): ProductTile(), CATALOG_TAGS, CategoryGroup, CollectionSummary, DeliveryWindow, getPlan(), getPlanMeals(), listCollections() (+28 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (25): metadata, AddressStep(), CheckoutAuthStep(), metadata, Quote, Address, Outcome, PaymentStep() (+17 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (36): dependencies, next, react, react-dom, @supabase/ssr, @supabase/supabase-js, zod, devDependencies (+28 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (32): kot_status (enum), order_source (enum), app.current_role(), app.has_any_permission(text[]), app.is_staff(), permissions (table), role_permissions (table), app.resolve_delivery_fee() (+24 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (38): review_status (enum), app.has_permission(text), app.is_direct_connection(), app.is_service_role(), app.current_customer_id(), customer_addresses (table), customers (table), customer_addresses_audit (trigger, redacts address PII) (+30 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (12): resolveSecret(), AdapterConfig, interpretPayload(), PartnerMarketplaceAdapter, adapters, CapabilityState, IncomingOrder, MarketplaceAdapter (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (30): AccountPage(), metadata, SubscriptionControls(), AdminOverviewPage(), DailyRow, DashboardRow, metadata, DailyRow (+22 more)

### Community 13 - "Community 13"
Cohesion: 0.17
Nodes (11): ActAs, actingAs(), asService(), createTestDb(), Db, expectFailure(), HERE, MIGRATIONS (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (24): continueToCheckout server action, Idempotent Money Paths, Seed Through Real Workflows, Verified-Payment Gate, app.subscription_requires_verified_payment(), begin_subscription_checkout(), confirm_subscription_payment(), fail_subscription_payment() (+16 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (26): app_role (enum), audit_action (enum), credit_entry_type (enum), app.current_actor_id(), app.forbid_mutation(), audit_logs (table), auth_profiles (table), employees (table) (+18 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (16): bodySchema, POST(), CheckoutDraft, clearDraft(), draftSchema, readDraft(), saveDraft(), beginCheckout() (+8 more)

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (22): subscription_delivery_status (enum), public.record_audit_event(), delivery_windows (table), app.product_is_orderable(), products (table), subscription_deliveries (table), subscription_delivery_items (table), subscription_plan_meals (table) (+14 more)

### Community 18 - "Community 18"
Cohesion: 0.24
Nodes (13): Frozen plan snapshot, Archive, never hard delete, business_settings table, products table, subscription_plan_meals table, subscription_plan_windows table, subscription_plans table, subscriptions table (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.13
Nodes (23): DESIGN.md — Visual System, Global :focus-visible Ring, Never Removed, Layout: Storefront, Admin and KOT Kanban, Money Never Renders on Kitchen Surfaces, Motion Budget and prefers-reduced-motion Kill-Switch, Order-Source Colors Fixed by the PRD (SourceTag), Two Registers: Storefront Light, Operations Dark, Typography: One Family, Tabular Figures, Ops Sizes Up (+15 more)

### Community 20 - "Community 20"
Cohesion: 0.16
Nodes (20): integration_capability_state (enum), integration_health (enum), integration_provider (enum), idempotency_keys (table), payment_events (table), Idempotency Everywhere, integration_accounts (table), integration_capabilities (table) (+12 more)

### Community 21 - "Community 21"
Cohesion: 0.10
Nodes (13): app.create_kot_ticket(), app.provider_to_source(), ingest_marketplace_order(), reconcile_marketplace_orders(), integration_events table, integration_reconciliation table, kot_tickets table, orders table (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 23 - "Community 23"
Cohesion: 0.16
Nodes (16): isAuthorisedJob(), marketplaceAdapter(), ConsoleTransport, dispatchQueuedNotifications(), NotificationChannel, notificationTransport, OutboundNotification, renderTemplate() (+8 more)

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (26): Button Family Sharing buttonClasses, Concurrency Group Prevents Delayed Runs Piling Up, Job: Drain the Notification Outbox, KOT State Machine (NEW → COMPLETED), Capability Honesty: No Unverified 'integrated' State, Database-Driven Imagery Constrained by a Host Allowlist, typedRoutes Enabled, Invoices Carry a CGST/SGST Tax Split (+18 more)

### Community 25 - "Community 25"
Cohesion: 0.13
Nodes (19): No hardcoded business policy, cost_settings table, delivery_settings table, delivery_windows table, product_variant_groups table, role_permissions table, tax_settings table, variant_groups table (+11 more)

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (18): Button, buttonClasses (single button visual definition), cx (class name joiner), Colour is never the only signal, Two-click destructive confirmation, ConfirmButton (two-click destructive submit), ConnectionBadge (realtime state indicator), Manager board stage groups (+10 more)

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (17): PlanSummary read model, ProductCard read model, getPlanMeals (fixed vs selectable), listCollections, listMenu, listMenuByCategory, listPlans / getPlan, loadRatings (v_product_ratings lookup) (+9 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (16): app.business_date(timestamptz), app.business_timezone(), app.setting(text), app.setting_bool(text), app.setting_int(text), app.setting_numeric(text), app.setting_text(text), business_settings (table) (+8 more)

### Community 29 - "Community 29"
Cohesion: 0.08
Nodes (39): ACTION_TONE, AuditRow, metadata, Permission, PERMISSIONS, STAFF_ROLES, can(), requireAnyPermission() (+31 more)

### Community 30 - "Community 30"
Cohesion: 0.21
Nodes (11): landingPathForRole(), authorizeRequest(), getSession, bodySchema, POST(), ForbiddenPage(), GET(), metadata (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.18
Nodes (15): Colour Is Never the Only Indicator, Per-Provider Failure Isolation, Raw-Body-First Signature Verification, Webhook Idempotency on Provider Event Id, Webhook Is Authoritative, Callback Is Cosmetic, Revenue Chart, Marketplace Webhook Route (Swiggy/Zomato), Payment Provider Webhook Route (+7 more)

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (14): Admin Customer Detail, Admin Customers List, customer_addresses table, customers table, invoices table, orders table, refund_requests table, PERMISSIONS.customersManage (+6 more)

### Community 33 - "Community 33"
Cohesion: 0.15
Nodes (15): app.resolve_delivery_fee(), app.resolve_tax_components(), quote_subscription(), validate_coupon(), coupon_redemptions table, coupon_rules table, coupons table, delivery_settings table (+7 more)

### Community 34 - "Community 34"
Cohesion: 0.21
Nodes (14): Admin Add-ons Page, Admin Collections Page, Admin Product Editor Page, saveAddOns server action, saveCollections server action, saveVariantGroups server action, Replace the Whole Relationship Set, add_ons table (+6 more)

### Community 35 - "Community 35"
Cohesion: 0.23
Nodes (14): Admin Catalog Products Page, Admin Categories Page, createProduct server action, toggleAvailability server action, updatePricing server action, saveDetails server action, Availability-First Kitchen Controls, Subscription-Only Commerce (+6 more)

### Community 36 - "Community 36"
Cohesion: 0.19
Nodes (15): adminClient() (service-role Supabase), Honest integration and estimate labelling, Idempotent cron endpoints behind a bearer secret, Reconciliation reports, never repairs, integration_capabilities table, integration_reconciliation table, Admin Integration Health, isAuthorisedJob(request) (+7 more)

### Community 37 - "Community 37"
Cohesion: 0.20
Nodes (14): /api/checkout/begin endpoint, /api/checkout/sandbox endpoint, /api/kot/eta endpoint, /api/kot/transition endpoint, Report unknown outcomes as unknown, Refuse offline mutations up front, PaymentStep (address, provider, pay), completeSandbox (test gateway outcome) (+6 more)

### Community 38 - "Community 38"
Cohesion: 0.24
Nodes (7): CopyButton(), DemoAccountList, DemoAccounts(), ROLE_LABELS, SignInForm(), SignInPanel(), browserClient()

### Community 39 - "Community 39"
Cohesion: 0.16
Nodes (14): notification_channel (enum), app.audit_trigger(), app.resolve_tax_components(), tax_settings (table), add_ons (table), categories (table), collection_products (table), collections (table) (+6 more)

### Community 40 - "Community 40"
Cohesion: 0.19
Nodes (12): Account Addresses Page, cancelSubscription server action, Account Dashboard Page, Customer Account Layout, makeDefaultAddress server action, saveAddress server action, addImage / makePrimaryImage actions, cancel_subscription() (+4 more)

### Community 41 - "Community 41"
Cohesion: 0.18
Nodes (13): Unavailable Product Is Shown, Not Hidden, Role: Customer, Role: Kitchen Staff, Role: Owner, Anonymous Storefront Access Boundary, The Audit Log Cannot Be Rewritten, Audit Visibility Limited to Owner and Developer Admin, Customers See and Act Only on Their Own Records (+5 more)

### Community 42 - "Community 42"
Cohesion: 0.23
Nodes (12): skipDelivery server action, Admin Audit Log Page, Append-Only History, Derived Balance Over Stored Counter, app.assert_subscription_access(), app.audit_trigger(), app.forbid_mutation(), schedule_credit_delivery() (+4 more)

### Community 43 - "Community 43"
Cohesion: 0.21
Nodes (12): ConfirmButton — Two-Click Destructive Submit, Manager-Only ETA Override Preserving the Original, Per-Role Transition Rights on the Board, Rejection Requires a Reason and Confirmation, A Ticket Cannot Exist Without a Confirmed Order, A Status Event for Every Move, Including Creation, A Repeated Transition Is a No-Op, Not an Error, KOT Test Suite (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.12
Nodes (18): Job: Hourly Marketplace Reconciliation, Marketplace Test Suite, Per-Provider Circuit Breaker, Duplicate Marketplace Delivery Is Harmless, Platform-Driven Cancellation Overrides Our Flow, Two-Way Marketplace Reconciliation, Retried Checkout Replays the Original Subscription, A Duplicate Payment Webhook Is a No-Op (+10 more)

### Community 45 - "Community 45"
Cohesion: 0.19
Nodes (10): contrast(), css, deltaE(), light, luminance(), oklab(), ops, report() (+2 more)

### Community 46 - "Community 46"
Cohesion: 0.25
Nodes (9): Admin Offers and Coupons, coupon_rules table, coupons table, variants table, PERMISSIONS.couponsManage, begin_subscription_checkout RPC, validate_coupon() RPC, beginCheckout() (+1 more)

### Community 47 - "Community 47"
Cohesion: 0.27
Nodes (9): Permission-Not-Role Gating of Actions, BUSINESS_TIMEZONE formatters (Asia/Kolkata), BoardTicket / KOT board status sets, Forbidden Page, Kitchen Display Page, KOT Manager Page, PERMISSIONS.kotAccept, PERMISSIONS.kotView (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.31
Nodes (7): configuredPaymentProviders(), adapters, availablePaymentProviders(), DISPLAY_NAMES, paymentAdapter(), PaymentProviderId, POST()

### Community 49 - "Community 49"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 50 - "Community 50"
Cohesion: 0.20
Nodes (7): Design Tokens as Single Source of Truth, eslintConfig, package.json — Scripts and Dependencies, config, Tests Run the Real Migrations on PGlite, Tests Act as Genuine Non-Superuser Roles, Test Harness — createTestDb / actingAs / asService

### Community 51 - "Community 51"
Cohesion: 0.24
Nodes (10): Job: Release Due Deliveries Into the KOT, Invariant: History Is Preserved, Configuration as Rows (business_settings), Booking Guards: Balance and Meal Availability, Cancellation Stops Future Deliveries but Preserves the Record, Credit Balance Derived From Ledger Entries, Premium Meals Cost More Credits, Customer-Selected Plans Are Bounded by a Selectable Pool (+2 more)

### Community 52 - "Community 52"
Cohesion: 0.25
Nodes (9): Account Refund Requests Page, retireAddress server action, setArchived server action, Retire, Never Delete, raiseRequest server action, withdrawRequest server action, withdrawReview server action, withdraw_refund_request() (+1 more)

### Community 53 - "Community 53"
Cohesion: 0.25
Nodes (9): Account Reviews Page, RLS as the Authorization Boundary, submitReview server action, updateReview server action, Cloud Kitchen Database Schema, app.review_record_moderation(), review_moderation table, reviews table (+1 more)

### Community 54 - "Community 54"
Cohesion: 0.22
Nodes (8): DATABASE_URL Read but Never Printed, One Transaction Per Migration File, schema.sql Is Generated, Never Edited, build-bundle.mjs — Schema Bundler, Credentials Stored Only by Reference, Two Schema Application Routes (db push vs schema.sql), Seed Data Built Through Real Workflows, Test Harness — Seeded Fixture IDs

### Community 55 - "Community 55"
Cohesion: 0.39
Nodes (9): Checkout Auth Step, Demo Panel Environment Gating, Late Account Creation, Lifted Credential State, Non-Enumerating Auth Error, Demo Accounts Panel, Sign In Page, Sign In Form (+1 more)

### Community 56 - "Community 56"
Cohesion: 0.31
Nodes (9): Test: realtime is wired for the operational tables, SOURCE_LABELS / KOT_STATUS_LABELS, ACTIVE_STATUSES / KITCHEN_STATUSES, providerForSource(source), browserClient() anon browser client, ConnectionState (connecting|live|reconnecting|offline), refetchOne() -- event as signal, not data, resync() full resynchronisation (+1 more)

### Community 57 - "Community 57"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Design Principles, Product, Product Purpose, Register, Users, Front-end Rule: A Refused Write Is Reported, Never Swallowed

### Community 58 - "Community 58"
Cohesion: 0.29
Nodes (7): Account Nav, Admin Nav, Catalog Nav, Confirm Destructive Actions, Kitchen Sees Accepted Work Only, Server-Filtered Navigation, Subscription Controls (Pause / Cancel)

### Community 59 - "Community 59"
Cohesion: 0.11
Nodes (18): 1. Create a Supabase project, 2. Apply the schema, 3. Seed demo data (optional but recommended), 4. Run, Architecture in one paragraph, Cloud Kitchen — Phase 1, Demonstrating the end-to-end flow, Deploying (+10 more)

### Community 60 - "Community 60"
Cohesion: 0.17
Nodes (15): Role-to-permission mapping is data, not code, KOT state machine enforced in the database, A hidden button is not a security boundary, auth_profiles table, role_permissions table, POST /api/kot/eta, PERMISSIONS constants, override_prep_eta() RPC (+7 more)

### Community 61 - "Community 61"
Cohesion: 0.22
Nodes (11): publicSettings / listPublicOffers, No money on kitchen screens, RLS decides what the read models return, v_kot_ticket_items (money-masking view), Kitchen board column definition, KitchenBoard (kitchen display), kot.mark_ready permission, kot.start_prep permission (+3 more)

### Community 62 - "Community 62"
Cohesion: 0.36
Nodes (9): Payment ownership check, POST /api/checkout/confirm, payments table, clearDraft(), SandboxAdapter, confirm_subscription_payment() RPC, fail_subscription_payment RPC, POST /api/checkout/sandbox (+1 more)

### Community 63 - "Community 63"
Cohesion: 0.40
Nodes (6): Checkout Address Step, Server-Computed Quote, Checkout Page, begin_subscription_checkout (RPC), quote_subscription (RPC), customer_addresses (table)

### Community 64 - "Community 64"
Cohesion: 0.29
Nodes (7): POST /api/checkout/begin, Defense-in-depth authorization, Server-side payment provider allowlist, reviews table, PERMISSIONS.reviewsModerate, Admin Review Moderation, moderate_review() RPC

### Community 65 - "Community 65"
Cohesion: 0.24
Nodes (13): coupon_discount_type (enum), order_status (enum), app.order_record_transition(), order_number_seq (sequence), order_status_events (table), orders (table), orders_record_transition_ins (trigger), orders_record_transition_upd (trigger) (+5 more)

### Community 66 - "Community 66"
Cohesion: 0.33
Nodes (6): Service key only where no caller token can exist, employees table, Admin Employees, PERMISSIONS.employeesManage, PERMISSIONS.employeesView, developer_admin role

### Community 67 - "Community 67"
Cohesion: 0.40
Nodes (5): pauseSubscription server action, app.setting() accessors, pause_subscription(), business_settings table, subscription_pauses table

### Community 68 - "Community 68"
Cohesion: 0.29
Nodes (5): geistMono, geistSans, metadata, mono, sans

### Community 69 - "Community 69"
Cohesion: 0.40
Nodes (5): Dependency-Free Last-Resort Boundary, Route Error Boundary, Global Error Boundary, Root Layout, Not Found Page

### Community 70 - "Community 70"
Cohesion: 0.50
Nodes (4): Authorization Is Data, Not Code, app.has_permission(), permissions table, role_permissions table

### Community 71 - "Community 71"
Cohesion: 0.40
Nodes (4): body, files, migrationsDir, root

### Community 72 - "Community 72"
Cohesion: 0.17
Nodes (11): Color Palette, Components, Design, Guarding the palette, Layout, Radii, Shadow, Motion, Rules, Server-action feedback (+3 more)

### Community 73 - "Community 73"
Cohesion: 0.50
Nodes (3): client, done, onlySeed

### Community 74 - "Community 74"
Cohesion: 0.50
Nodes (3): crons, framework, $schema

### Community 76 - "Community 76"
Cohesion: 0.67
Nodes (3): AGENTS.md — Next.js Agent Rules, Rule: Read node_modules/next/dist/docs Before Writing Next.js Code, CLAUDE.md — Project Instructions

### Community 77 - "Community 77"
Cohesion: 0.67
Nodes (3): app.kot_enforce_transition(), kot_status_events table, kot_transitions table

### Community 100 - "Community 100"
Cohesion: 0.50
Nodes (3): crons, framework, $schema

### Community 103 - "Community 103"
Cohesion: 0.29
Nodes (7): auth_profiles table, ROLE_NOTES / ROLE_LABELS / ROLE_ORDER, demoAccountsEnabled (SHOW_DEMO_ACCOUNTS gate), explainAbsence (one-shot server log), listDemoAccounts, AppRole union, landingPathForRole

### Community 104 - "Community 104"
Cohesion: 0.29
Nodes (7): ActionFeedback, fail / done (server-action redirect feedback), readable (Postgres error translator), nullableBool (tri-state), FormData readers (str/num/list), slugify / codify, Alert

### Community 105 - "Community 105"
Cohesion: 0.18
Nodes (12): SignOutButton(), metadata, AccountChip, AccountState, clearAccount(), AccountNav(), useAccount(), NAV (+4 more)

### Community 106 - "Community 106"
Cohesion: 0.19
Nodes (15): Address, metadata, ActionFeedback(), done(), fail(), readable(), Customer, generateMetadata() (+7 more)

### Community 107 - "Community 107"
Cohesion: 0.28
Nodes (5): publicEnv, serverSchema, config, hasAuthCookie(), proxy()

### Community 108 - "Community 108"
Cohesion: 0.50
Nodes (4): CONTROL (shared form control classes), Input, Select, Textarea

### Community 109 - "Community 109"
Cohesion: 0.21
Nodes (14): ArrowRightIcon(), BASE, SearchIcon(), MenuSearch(), BleedPhoto(), GatewayCard(), HEADLINE, headlineOffer() (+6 more)

### Community 110 - "Community 110"
Cohesion: 0.31
Nodes (8): DemoAccount, demoAccountsEnabled(), explainAbsence(), listDemoAccounts(), ROLE_NOTES, ROLE_ORDER, AppRole, SessionProfile

### Community 111 - "Community 111"
Cohesion: 0.42
Nodes (5): BUTTON_SIZES, BUTTON_VARIANTS, ButtonSize, ButtonVariant, Spinner()

### Community 112 - "Community 112"
Cohesion: 0.50
Nodes (3): AccountNav(), TABS, AccountLayout()

### Community 113 - "Community 113"
Cohesion: 0.50
Nodes (3): AdminNav(), AdminLayout(), SECTIONS

## Ambiguous Edges - Review These
- `payment_provider (enum)` → `business_settings (table)`  [AMBIGUOUS]
  supabase/migrations/0001_extensions_and_enums.sql · relation: conceptually_related_to
- `notifications (table)` → `public.transition_kot_ticket()`  [AMBIGUOUS]
  supabase/migrations/0010_notifications_integrations.sql · relation: conceptually_related_to
- `public.confirm_subscription_payment()` → `payment_provider 'sandbox' value`  [AMBIGUOUS]
  supabase/migrations/0101_sandbox_payment_provider.sql · relation: conceptually_related_to
- `customers table` → `About Page`  [AMBIGUOUS]
  src/app/(site)/about/page.tsx · relation: conceptually_related_to
- `Checkout Page` → `begin_subscription_checkout (RPC)`  [AMBIGUOUS]
  src/app/checkout/page.tsx · relation: references
- `Secrets live in the environment only` → `Test: configuration is data, not constants`  [AMBIGUOUS]
  tests/coupons-config-realtime.test.ts · relation: conceptually_related_to
- `refetchOne() -- event as signal, not data` → `Test: realtime is wired for the operational tables`  [AMBIGUOUS]
  tests/coupons-config-realtime.test.ts · relation: conceptually_related_to
- `README — Cloud Kitchen Phase 1` → `Demo Accounts and Roles`  [AMBIGUOUS]
  README.md · relation: references
- `No Configured Provider Means No Checkout Method` → `Environment Variables Validated at Boot`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **359 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+354 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `payment_provider (enum)` and `business_settings (table)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `notifications (table)` and `public.transition_kot_ticket()`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `public.confirm_subscription_payment()` and `payment_provider 'sandbox' value`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `customers table` and `About Page`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Checkout Page` and `begin_subscription_checkout (RPC)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Secrets live in the environment only` and `Test: configuration is data, not constants`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `refetchOne() -- event as signal, not data` and `Test: realtime is wired for the operational tables`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._