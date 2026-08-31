# Product

## Register

product

## Users

- **Customers** (Indian metro, mobile-first): browse the menu, buy and manage meal subscriptions. In a buying mood — the storefront may lean warm and appetising, but checkout is a task.
- **Branch Manager**: runs the kitchen floor from a tablet/desktop. Accepts/rejects tickets, overrides ETAs, marks ready and hands off. Time-pressed, mid-rush.
- **Kitchen Staff** (3 accounts, one shared physical display): glance at a wall screen at arm's length under bad lighting. Start preparation. Must never see money.
- **Owner**: business oversight from a laptop. Analytics, catalog, plans, coupons, customers, reviews, settings, audit. Read-only KOT.
- **Developer Admin**: maximum Phase 1 access; integrations and configuration.

## Product Purpose

A database-backed operating system for a single-brand, single-branch cloud kitchen (PRD v1.0, `c.k.p.prd.pdf`). One customer website, one unified KOT across three order channels (Website SX, Swiggy SW, Zomato ZM), subscription management with a credit ledger, server-verified payments, owner analytics and a full audit trail. Success: the seeded end-to-end flow — purchase → payment → delivery order → realtime KOT → preparation → handoff → analytics → audit — works through the real database with RBAC and failure states functioning.

## Brand Personality

Warm, trustworthy, operational. The storefront reads as *food, not SaaS* — warm-tinted neutrals, spice-red brand, turmeric accent. The operations surface reads as *equipment* — dark, dense, glanceable, zero decoration. Confidence comes from things visibly working: honest states, honest numbers, caveats on estimates.

## Anti-references

- Generic SaaS dashboard cream/gradient template; hero-metric cards with gradient accents.
- Swiggy/Zomato clone styling — their colors appear only as source tags, never as brand.
- Anything that hides state: optimistic UI that lies about persistence, spinners with no outcome, disabled buttons with no reason.
- Decoration on the KOT screens. Kitchen screens are instruments, not marketing.

## Design Principles

1. **The database is the truth; the UI never claims more than it knows.** Offline actions never fake persistence; estimates built on dummy costs say so.
2. **Color is never the only signal.** Every source badge carries its literal prefix (SW/ZM/SX); every state has a label.
3. **Glanceable under rush.** Operational screens optimise for arm's-length reading: big type, high contrast, Kanban columns, one obvious action per ticket state.
4. **Role-shaped interfaces.** Kitchen sees no money. Owner's KOT has no buttons. Manager has no pricing. The UI enforces what RLS already guarantees.
5. **Confirm destruction, forgive everything else.** Reject requires confirmation; ordinary actions are fast and idempotent.

## Accessibility & Inclusion

- WCAG 2.1 AA intent: ≥4.5:1 body text contrast on both light and ops-dark surfaces, visible focus rings everywhere (`:focus-visible` global), 44px touch targets on operational buttons.
- Color-blind safe by construction: literal source prefixes, text labels on all statuses.
- `prefers-reduced-motion` honored globally.
- Operational screens prioritise desktop/tablet/kiosk readability; storefront is fully responsive to 375px.
