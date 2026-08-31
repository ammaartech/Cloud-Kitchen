# Cloud Kitchen — Phase 1

A database-backed operating system for a single-brand, single-branch cloud kitchen:
one customer website, one unified KOT across three order channels, subscription
management, server-verified payments, owner analytics and a full audit trail.

Built against `c.k.p.prd.pdf` (Working PRD v1.0).

---

## Where things stand

| Stage | Status |
| --- | --- |
| 1. Foundation & config | Done |
| 2. Database, schema, RLS | Done — 15 migrations, 56 tables, 90 policies |
| 3. Domain engine (checkout, payments, subscriptions, KOT, marketplace) | Done — 30 SQL routines |
| 4. Seed data through real workflows | Done |
| 5. Automated tests | Done — 95 tests |
| 6. Provider abstractions (payments, marketplaces, notifications) | Done |
| 7. Auth/RBAC application layer | Done |
| 8. Storefront, checkout and customer account | Done |
| 9. KOT Manager + Kitchen, realtime | Done |
| 10. Owner analytics, audit, integrations, settings, catalog | Done |
| 11. Webhooks and scheduled jobs | Done |
| 12. Live verification against a Supabase project | Done |

`npm run build` compiles all 28 routes; `npm test` runs 95 tests; `tsc` and
`eslint` are clean. The schema, the seed and the full operational walkthrough
have been run against a live Supabase project — see below.

### Verified live

Against a real Supabase project (21 migrations, 56 tables, 90 policies applied):

- All four staff/customer roles sign in
- Kitchen board renders with **zero currency on screen**; `orders` returns
  nothing to a kitchen token; the audit log is invisible to them
- Owner sees totals and analytics; Branch Manager does **not** (no `orders.view_financial`)
- Owner's KOT renders "Read-only view" with no action buttons, and the API
  refuses the transition anyway: *"role owner may not perform transition NEW -> ACCEPTED"*
- Kitchen refused ACCEPT and refused READY; Manager performs both
- Illegal skip refused: *"illegal KOT transition NEW -> READY_FOR_PICKUP"*
- Full lifecycle NEW → COMPLETED drove the order to COMPLETED and the delivery
  to `fulfilled`, with all eight status events attributed to the right role
- Checkout: begin → **retry with the same key returned the same subscription**
  → decline created nothing → retry succeeded, granting 30 credits, 30
  deliveries, one invoice and one coupon redemption
- Raising `kot.release_lead_time_minutes` from the Owner UI released deliveries
  into the KOT with no code change or redeploy
- Daily KOT numbering resets per business day (SX-001 on three consecutive
  days, zero collisions)

---

## Architecture in one paragraph

Postgres is the authority. Business rules, permissions, the KOT state machine
and every fee, tax and limit are **rows**, not constants — so the Owner retunes
the business without a deploy. Operational writes (orders, payments,
subscriptions, tickets) have **no client write policy at all**; they happen only
through `SECURITY DEFINER` functions that validate state, permission and
idempotency first. The application layer is a thin, typed shell over that.

### The invariants, and where they are enforced

| Invariant | Enforced by |
| --- | --- |
| No unverified payment creates an order or KOT | `subscriptions_require_verified_payment` and `kot_tickets_require_confirmed_order` triggers |
| Payment verified server-side, never from the browser | `confirm_subscription_payment` refuses unless the adapter verified a signature |
| Financial operations are idempotent | Unique keys on `payments.idempotency_key`, `(subscription_id, idempotency_key)` on the ledger, `(source, external_order_id)` on orders |
| Owner's KOT is read-only | `role_permissions` grants the Owner `kot.view` and no transition permission |
| Kitchen staff get no financial data | Money columns masked in `v_kot_tickets` / `v_kot_ticket_items`; kitchen holds no `orders.view` |
| One marketplace failing cannot stop another | Per-provider circuit breaker on `integration_accounts` |
| No fabricated marketplace endpoints | `integration_capabilities` gates every outbound call; `blocked` refuses instead of guessing |
| History is preserved | Append-only triggers on `audit_logs` and the credit ledger; snapshotted order lines |

---

## Getting started

### 1. Create a Supabase project

Phase 1 targets Supabase for Postgres, Auth, Realtime and RLS.

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` from your project's API settings.

### 2. Apply the schema

Either route works.

**With the database password** (preferred — keeps migration history):

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push        # applies supabase/migrations in order
```

**With dashboard access only:** paste `supabase/schema.sql` into the Supabase
SQL editor and run it. That file is every migration concatenated in order,
regenerated with `npm run build:schema`. Then paste `supabase/seed.sql` if you
want the demo data.

### 3. Seed demo data (optional but recommended)

```bash
npx supabase db reset       # re-runs migrations, then supabase/seed.sql
```

The seed does not insert fake rows into `orders` or `kot_tickets`. It *buys
subscriptions* through `begin_subscription_checkout` and
`confirm_subscription_payment`, *releases* deliveries through
`release_due_deliveries`, and *ingests* marketplace orders through
`ingest_marketplace_order` — the same functions the application calls. It ends
by asserting the PRD's core invariants, so if one regresses the seed fails
rather than producing quietly wrong data.

Demo accounts (password `ClaudeKitchen!2026`):

| Account | Role |
| --- | --- |
| `dev@cloudkitchen.test` | Developer Admin |
| `owner@cloudkitchen.test` | Owner |
| `manager@cloudkitchen.test` | Branch Manager |
| `kitchen1@cloudkitchen.test` … `kitchen3` | Kitchen Staff |
| `meera@example.test`, `rahul@example.test`, `sana@example.test` | Customers |

### 4. Run

```bash
npm run dev
```

---

## Deploying

### Vercel project settings

`vercel.json` pins `"framework": "nextjs"`, which overrides whatever the
dashboard's **Application Preset** says. That is deliberate: with the preset on
**Other**, Vercel runs no Next build, finds no static `index.html`, and every
path — including `/` — returns `404: NOT_FOUND` on the `.vercel.app` domain. A
404 on a freshly deployed root path almost always means the framework preset,
not the application.

Set these environment variables on the project (Settings → Environment
Variables). The app validates them at boot and fails with a readable list, so a
missing one is loud rather than mysterious:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only. Bypasses RLS |
| `CRON_SECRET` | for the jobs | 16+ chars; also signs sandbox payment callbacks |
| `NEXT_PUBLIC_SITE_URL` | no | Declared but currently unreferenced |

**Payments in production.** `ENABLE_SANDBOX_PAYMENTS` has no effect on Vercel:
the sandbox adapter refuses to construct when `NODE_ENV=production`, which it
always is there. With no Razorpay or Cashfree credentials,
`configuredPaymentProviders()` returns an empty list and checkout has no method
to offer. That is the safety property working, not a bug — a fake gateway must
never be reachable in production. Add Razorpay **test-mode** keys
(`rzp_test_…`) to exercise the real verification path without moving money.

### The scheduled jobs

Three endpoints have to be called on a timer. They are guarded by a shared
secret rather than a session, compared in constant time, and each answers both
`POST` and `GET` because most hosted schedulers only issue `GET`.

| Endpoint | Wants to run | Why |
| --- | --- | --- |
| `/api/jobs/release-deliveries` | every few minutes | Releases due deliveries into the live KOT inside the configurable lead time |
| `/api/jobs/notifications` | every few minutes | Drains the notification outbox |
| `/api/jobs/reconcile` | hourly | Two-way marketplace reconciliation |

**Vercel's Hobby plan allows two cron jobs per project, each firing at most
once per day.** That is enough for reconciliation and useless for delivery
release — a job whose purpose is to reach the kitchen inside a lead time cannot
run once at 1am and be said to work.

So the cadence is split:

- `vercel.json` keeps two **daily** crons as a floor, within Hobby limits.
- `.github/workflows/scheduled-jobs.yml` does the real work — every 5 minutes
  for release and notifications, hourly for reconciliation. GitHub Actions is
  free for public repositories, and its 5-minute minimum matches what these
  jobs need.

Set two repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `SITE_URL` | your deployment origin, no trailing slash |
| `CRON_SECRET` | the same value as the `CRON_SECRET` env var on Vercel |

Two caveats worth knowing rather than discovering:

- GitHub disables scheduled workflows on repositories with **no activity for 60
  days**. The daily Vercel crons are the reason that degrades into "late"
  rather than "stopped".
- GitHub's scheduler is best-effort and can run late under load. The release
  job releases whatever is due when it next runs rather than assuming it was
  punctual, so a delayed run catches up.

Running both schedulers is safe: `release_due_deliveries` locks rows with
`SKIP LOCKED` and is idempotent, the dispatcher drains a queue, and
reconciliation only records findings. A duplicated run is a no-op, never a
double delivery.

On the Pro plan, delete the workflow and set `vercel.json` back to
`*/5 * * * *`, `2-59/5 * * * *` and `17 * * * *`.

---

## Demonstrating the end-to-end flow

With no Razorpay or Cashfree merchant account, set `ENABLE_SANDBOX_PAYMENTS=true`
in `.env.local` (it is already on there). The sandbox gateway is **not a
bypass**: it signs its callback with HMAC-SHA256 and that signature is verified
through the same path a real provider uses, so a declined or unverified outcome
still creates no subscription and no KOT ticket. It refuses to construct at all
when `NODE_ENV=production`.

The walkthrough:

1. `/subscriptions` → choose a plan → configure window, days, meals
2. Checkout creates the account *late*, then collects details and an address
3. Pay → pick **Succeed**, **Decline** or **Time out** at the test gateway
   - *Decline* leaves the subscription inactive with no ticket — the invariant, visible
   - *Time out* routes to reconciliation rather than guessing
4. `POST /api/jobs/release-deliveries` with `Authorization: Bearer $CRON_SECRET`
   releases due deliveries into the KOT
5. `/kot/manager` (manager account) — accept the ticket
6. `/kot/kitchen` (kitchen account) — it appears live, start preparing
7. Back on the manager board — mark ready, hand off, complete
8. `/admin` — revenue by channel and timings; `/admin/audit` — the whole trail

## Tests

```bash
npm test
```

95 tests run the **real migrations** against
[PGlite](https://pglite.dev) — Postgres compiled to WebAssembly — so
constraints, triggers, RLS policies and RPCs are exercised as themselves, with
no Docker daemon and no mocking of the database.

Each test acts as a genuine non-superuser role (`anon`, `authenticated`,
`service_role`), because as superuser every policy would be bypassed and the
suite would prove nothing.

Coverage maps to the PRD's testing checklist:

- **RBAC** — role grants, Owner's read-only KOT, kitchen money masking, audit visibility, privilege escalation
- **Payments** — failure path creates nothing, unsigned confirmation refused, uncertain outcomes routed to reconciliation
- **Idempotency** — retried checkout, duplicate webhook, out-of-order failure notice
- **KOT** — full lifecycle, illegal transitions, per-role transition rights, ETA override, daily source-prefixed numbering
- **Subscriptions** — credit ledger arithmetic, premium multi-credit meals, skip/reversal, pause limits, cancellation
- **Coupons** — first-subscription eligibility, caps, expiry, server-side validation
- **Marketplace** — duplicate ingestion, platform-driven cancellation, failure isolation, two-way reconciliation
- **Configuration** — settings changes take effect with no code change; missing settings fail loudly

---

## Marketplace integration status

Swiggy and Zomato grant partner API access per merchant, under contract. This
repository has no such contract, so **every capability is recorded as
`blocked`** in `integration_capabilities`, except reconciliation, which is
`mocked` — the logic is implemented and tested against the mock transport.

No endpoint is invented anywhere in this codebase. An adapter call for a
blocked capability returns a refusal that says nothing was sent; it does not
guess a URL. When real credentials and documentation arrive, moving a row from
`blocked` to `integrated` switches that path on.

The Owner's integration health view reports these states verbatim, so the UI
never implies a connection the system does not have.

---

## Open items awaiting owner validation

These are live in the system as **provisional** settings (`is_provisional`),
visible as such in the admin, and changeable without a deploy:

- Delivery fee (currently ₹40, free above ₹499)
- Maximum pauses per period (2) and maximum pause length (5 days)
- KOT release lead time (120 minutes)
- Default preparation estimate (25 minutes) and per-source SLA
- Whether the delivery fee is charged at subscription checkout
- GST treatment — Phase 1 assumes 5% split CGST 2.5% + SGST 2.5%, flagged provisional
- Marketplace commission and food-cost assumptions (explicitly dummy data)
- Refund policy — the request/ticket workflow is modelled; no policy is assumed

COD exists in the data model and is switched off, per the PRD.
