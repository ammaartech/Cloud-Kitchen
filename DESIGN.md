# Design

Captured from the live system: `src/app/globals.css` (tokens) and `src/components/ui/primitives.tsx` (components). Tokens are the single source of truth — components use the Tailwind theme names (`bg-brand`, `text-ink`, …), never raw hex.

## Theme

Two registers share one token system:

- **Storefront** (default `:root`): light and calm. White cards on a barely tinted ground, colour spent on actions and state rather than on surfaces. The food photography carries the appetite.
- **Operations** (`[data-surface="ops"]`, set by the KOT screens): dark, high-contrast ramp for kitchen glanceability. Components are surface-agnostic; the attribute flips the variables.

## Color Palette

One hue carries the system: a dark-slate-grey/green ramp, exposed whole as `--color-dark-slate-grey-50` … `-950` (reach for a step directly only for chart series and illustration). Neutrals are tinted toward that hue rather than toward grey, so everything reads as one material. Semantic tokens are built on top; components use those.

| Role | Token (Tailwind name) | Light | Ops dark |
| --- | --- | --- | --- |
| Background | `bg` | `#f6f9f8` | `#0d1714` (950) |
| Surface | `surface` | `#ffffff` | `#13201c` (900) |
| Sunken | `sunken` | `#eff6f4` (50) | `#080f0d` |
| Border | `line` | `#dfece8` (100) | `#254139` (800) |
| Control boundary | `line-strong` | `#7f918b` | `#4a8271` (600) |
| Ink | `ink` | `#0d1714` (950) | `#eff6f4` (50) |
| Muted / Subtle | `muted` / `subtle` | `#48605a` / `#5f7169` | `#bedad2` / `#9ec7bb` |
| Brand | `brand` (+`-hover`, `-soft`, `-soft-hover`, `-soft-active`) | `#386155` (700) | `#7db5a4` (400) |
| Accent | `accent` (+`-soft`) | `#4a8271` (600) | `#5da28d` (500) |
| Status | `success` / `warning` / `danger` / `info` (+`-soft`) | see globals.css | see globals.css |

Three constraints shaped these and are not free to change casually:

- **`brand` is step 700, not 600.** 600 carries white text at only 4.45:1 and fails AA on a filled button. 700 reaches 6.98:1.
- **`line-strong` is not a ramp step.** Control boundaries need 3:1, which steps 100–300 cannot reach on white. It is a desaturated sibling of the ramp at 3.32:1.
- **`success` is a true green, not another step of the ramp.** The brand is a cool grey-green; on the KOT board a state must never read as chrome. The two sit 0.114 apart in OKLab.
- **`accent` is a step, not a second hue.** The palette is monochrome, so accent means *quieter brand*, not *different meaning*.

**Order-source colors are fixed by the PRD**, are the one exception to the palette, and always pair with a literal prefix: `sw` orange (Swiggy), `zm` red (Zomato), `sx` navy (Website). Never use them as decoration.

### Guarding the palette

`npm run check:contrast` reads the tokens straight out of `globals.css` and checks every pair that matters — 4.5:1 for text, 3:1 for control boundaries and focus rings, plus OKLab ΔE ≥ 0.10 between colours a cook must never confuse. WCAG contrast alone cannot catch the last one: two colours of equal lightness and opposite hue score 1.0:1. Run it after any palette change.

## Typography

- Family: **Inter** (`--font-inter`) for everything; **JetBrains Mono** (`--font-jetbrains-mono`) for ticket codes and tabular data. One family — this is product UI.
- **`subsets` must include `latin-ext`.** The rupee sign (U+20B9) lives there, not in `latin`. Loading `latin` alone leaves every price on the site falling back to a system font, which is what the previous setup did.
- `cv05` is on globally: the lower-case *l* gets a tail, so `l` / `I` / `1` stay apart in dish names and ticket codes.
- Fixed rem scale, tight ratio. `.tabular` (tabular-nums) on any column of figures.
- `h1`–`h3` carry `-0.02em`; Inter is drawn loose for small sizes and needs tightening as it grows.
- Ops screens size up: `lg` buttons (h-12), `text-lg` ticket codes — arm's-length reading.

## Components

Everything is re-exported from `src/components/ui/primitives.tsx`; the button
family lives in its own files because it needs `'use client'`.

| Component | File | Notes |
| --- | --- | --- |
| `Button` | `ui/button.tsx` | Variants `primary \| secondary \| outline \| ghost \| danger \| success`; sizes `sm \| md \| lg`. Reads `useFormStatus`, so a submit inside a `<form action={…}>` disables itself and shows a `Spinner` while the action runs — no page wires that up by hand. |
| `ButtonLink` | `ui/primitives.tsx` | A real `<a>` styled as a button. **Anything that navigates uses this**; a `<button>` inside a `<Link>` is invalid HTML and breaks open-in-new-tab. |
| `ConfirmButton` | `ui/confirm-button.tsx` | Two-click destructive submit: first click arms and turns danger-red, second click submits, 4s timeout or blur disarms. Every delete/retire/disable uses it (PRD 19). |
| `buttonClasses` | `ui/button-styles.ts` | The single class definition the three above share, so they cannot drift. Pill-shaped. Three weights in the order the eye should find them — `primary` (filled brand), `secondary` (soft tint), `outline` (hairline, for tinted grounds where a soft fill would vanish) — plus `ghost`, `danger`, `success`. Every variant defines default, hover, active and disabled. |

- `Card` — `rounded-ck-lg border border-line bg-surface shadow-ck-sm`. No nested cards.
- `Badge` — tonal pill; `SourceTag` — the only place source colors appear, always with the literal SW/ZM/SX code.
- `Alert`, `EmptyState`, `Stat` (with `hint` for caveats on estimates), `Field`/`Input`/`Select`/`Textarea`, `Skeleton`, `Spinner`.

### Storefront (`components/site/`)

| Component | Notes |
| --- | --- |
| `SiteHeader` | The shell's top bar, one light register on every route. The layout hands it a flattened account, never the session. |
| `StorefrontHero` | Headline (see `HeroHeadline` — the rolling introduction), one search field, two gateway cards, delivery windows, on a lightly tinted ground. The composition follows the Indian delivery apps; the treatment does not — colour is spent on the actions, and the food photography carries the appetite. Every figure is read from the database, and a missing one renders nothing rather than a placeholder. |
| `MenuSearch` | One GET form to `/menu`, as a `hero` pill or an `inline` field. No JavaScript, bookmarkable, and the menu page really does filter on `q`. |
| `icons` | `SearchIcon`, `ArrowRightIcon`. One 24-unit grid, one stroke weight, no icon dependency. |

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
- Motion: 150–250ms color/opacity transitions; `ck-flash` one-shot pulse when a ticket changes (realtime visibility); global `prefers-reduced-motion` kill-switch, which flattens delays as well as durations.
- **No page-load choreography, with one exception**: the storefront hero headline (`.hero-roll` / `.hero-part` in globals.css). Three phrases roll through a slot and settle as one sentence — the home page is the only surface where a visitor is being introduced rather than working. The rule holds everywhere else.
- Failure modes decide base rules for any reveal. Content that must survive is never hidden by a base rule, only inside keyframes, so a renderer that never animates still shows it; decoration does the reverse, starting transparent so it can only ever appear by animating. Never gate real content on a class-triggered transition.

## Layout

- Storefront: `max-w-6xl` centered container, generous vertical rhythm.
- Admin: left nav (`admin-nav`), content `max-w-6xl`, dense tables allowed.
- KOT: full-width Kanban columns, `data-surface="ops"`, minimum touch target 44px.

## Rules

- Unavailable product = grayscale image + "Unavailable" badge (`.is-unavailable`), not hidden, not selectable.
- Focus: global `:focus-visible` outline in `--ck-focus` (a token, because the ops surface flips the brand colour out from under it) — never remove it. Suppressing it on one control (the hero search input) is only allowed when a wrapper renders an equally visible `focus-within` indicator in its place.
- No raw hex in components; extend tokens in globals.css instead.
- Money never renders on kitchen surfaces (the views mask it; the UI must not reintroduce it).
