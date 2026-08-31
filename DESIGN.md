# Design

Captured from the live system: `src/app/globals.css` (tokens) and `src/components/ui/primitives.tsx` (components). Tokens are the single source of truth — components use the Tailwind theme names (`bg-brand`, `text-ink`, …), never raw hex.

## Theme

Two registers share one token system:

- **Storefront** (default `:root`): light, warm-tinted neutrals. Food, not SaaS.
- **Operations** (`[data-surface="ops"]`, set by the KOT screens): dark, high-contrast ramp for kitchen glanceability. Components are surface-agnostic; the attribute flips the variables.

## Color Palette

| Role | Token (Tailwind name) | Light | Ops dark |
| --- | --- | --- | --- |
| Background | `bg` | `#fbf9f6` | `#14120f` |
| Surface | `surface` | `#ffffff` | `#1f1c18` |
| Sunken | `sunken` | `#f4f1ec` | `#100e0c` |
| Border | `line` / `line-strong` | `#e5e0d8` / `#d2cabd` | `#322d27` / `#4a423a` |
| Ink | `ink` | `#1c1917` | `#f7f4f0` |
| Muted / Subtle | `muted` / `subtle` | `#6b6259` / `#938a80` | `#b3a99e` / `#857c72` |
| Brand (spice red-brown) | `brand` (+`-hover`, `-soft`) | `#9c3919` | `#e8763f` |
| Accent (turmeric) | `accent` (+`-soft`) | `#c98a13` | `#e8b23f` |
| Status | `success` / `warning` / `danger` / `info` (+`-soft`) | see globals.css | see globals.css |

**Order-source colors are fixed by the PRD** and always paired with a literal prefix:
`sw` orange (Swiggy), `zm` red (Zomato), `sx` navy (Website). Each has a `-soft` tint. Never use them as decoration.

## Typography

- Family: Geist Sans (`--font-geist-sans`) for everything; Geist Mono for ticket codes and tabular data. One family — this is product UI.
- Fixed rem scale, tight ratio. `.tabular` (tabular-nums) on any column of figures.
- Ops screens size up: `lg` buttons (h-12), `text-lg` ticket codes — arm's-length reading.

## Components

Everything is re-exported from `src/components/ui/primitives.tsx`; the button
family lives in its own files because it needs `'use client'`.

| Component | File | Notes |
| --- | --- | --- |
| `Button` | `ui/button.tsx` | Variants `primary \| secondary \| ghost \| danger \| success`; sizes `sm \| md \| lg`. Reads `useFormStatus`, so a submit inside a `<form action={…}>` disables itself and shows a `Spinner` while the action runs — no page wires that up by hand. |
| `ButtonLink` | `ui/primitives.tsx` | A real `<a>` styled as a button. **Anything that navigates uses this**; a `<button>` inside a `<Link>` is invalid HTML and breaks open-in-new-tab. |
| `ConfirmButton` | `ui/confirm-button.tsx` | Two-click destructive submit: first click arms and turns danger-red, second click submits, 4s timeout or blur disarms. Every delete/retire/disable uses it (PRD 19). |
| `buttonClasses` | `ui/button-styles.ts` | The single class definition the three above share, so they cannot drift. |

- `Card` — `rounded-ck-lg border border-line bg-surface shadow-ck-sm`. No nested cards.
- `Badge` — tonal pill; `SourceTag` — the only place source colors appear, always with the literal SW/ZM/SX code.
- `Alert`, `EmptyState`, `Stat` (with `hint` for caveats on estimates), `Field`/`Input`/`Select`/`Textarea`, `Skeleton`, `Spinner`.

### Server-action feedback

A server action cannot return a value to a server-rendered page, so outcomes
travel back in the query string: `fail(path, msg)` / `done(path, msg)` from
`src/lib/admin/feedback.tsx`, rendered by `<ActionFeedback>`. `readable()`
turns Postgres error codes into sentences. **Every server action that can be
refused must report it** — a save that silently does nothing is how an Owner
comes to believe a setting changed when it did not.

## Radii, Shadow, Motion

- Radii: `rounded-ck` (0.625rem), `rounded-ck-lg` (1rem), pills for badges.
- Shadows: `shadow-ck-sm | ck | ck-lg` — warm-tinted, subtle in light, deeper on ops.
- Motion: 150–250ms color/opacity transitions; `ck-flash` one-shot pulse when a ticket changes (realtime visibility); global `prefers-reduced-motion` kill-switch. No page-load choreography.

## Layout

- Storefront: `max-w-6xl` centered container, generous vertical rhythm.
- Admin: left nav (`admin-nav`), content `max-w-6xl`, dense tables allowed.
- KOT: full-width Kanban columns, `data-surface="ops"`, minimum touch target 44px.

## Rules

- Unavailable product = grayscale image + "Unavailable" badge (`.is-unavailable`), not hidden, not selectable.
- Focus: global `:focus-visible` brand outline — never remove it.
- No raw hex in components; extend tokens in globals.css instead.
- Money never renders on kitchen surfaces (the views mask it; the UI must not reintroduce it).
