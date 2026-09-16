# Design

Captured from the live system: `src/app/globals.css` (tokens) and `src/components/ui/primitives.tsx` (components). Tokens are the single source of truth — components use the Tailwind theme names (`bg-brand`, `text-ink`, …), never raw hex.

## Theme

Two registers share one token system:

- **Storefront** (default `:root`): light and calm. White cards on a barely tinted ground, colour spent on actions and state rather than on surfaces. The food photography carries the appetite.
- **Operations** (`[data-surface="ops"]`, set by the KOT screens): dark, high-contrast ramp for kitchen glanceability. Components are surface-agnostic; the attribute flips the variables.

One surface sits outside both: the **footer** (`.site-footer`) — ramp step 800, the green the hero's bowl panel is painted in, and the only dark ground on the storefront, so the page opens and closes on the same colour. It is deliberately *not* the ops surface, which is tuned for a cook reading a wall screen rather than for the close of a page. It carries its own `--ck-footer-*` inks (checked by `npm run check:contrast`) and re-points `--ck-focus` for everything inside it, because the brand-green ring is invisible on that ground.

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
- **The kitchen's own voice is set in two other faces**, and they are a system rather than decoration: **Zodiak** (`--font-zodiak`, serif) and **Cabinet Grotesk** (`--font-cabinet`, grotesque), paired on the contrast axis so neither can be mistaken for the other. They appear exactly where someone is *speaking* rather than where something is being operated — the plan notes, which are a piece of paper someone wrote on, and the home page's mission band, which is the kitchen making a promise. Inter appears on neither, and that exclusion is the whole point: Inter is what the surrounding interface is already set in. Both load `preload: false` (below the fold on one route each) and are never used on admin or KOT.
- **Only `latin` is preloaded.** The rupee sign (U+20B9) is in the `latin-ext` file, which next/font still ships as an `@font-face` behind its `unicode-range` — `subsets` controls preloading, not availability. Preloading `latin-ext` cost every page an 85 KB request for one glyph; the browser now fetches it only where a price is on screen.
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
| `AccountNav` / `AccountMenu` | Signed out: "Sign in" (carrying the current page as `?next=`) and "Start a plan today". Signed in: one control, a monogram, the name and a chevron, opening a native popover with the account link and "Sign out". The panel hangs from the trigger's right edge and unrolls downward out of the bar (clip + half-rem travel + fade, 210ms in, 150ms out); on phones it spans the screen. The two states cross-fade. Identity comes from a small external store (`site/account.ts`) that every reader shares and other tabs follow over a `BroadcastChannel`. |
| Sign-in / sign-out | Sign-out is `POST /api/auth/sign-out`: session cookies expired on the response, the session revoked at Supabase in `after()`, scope `local` (this device). Storefront sign-out returns to the top of `/`; staff screens go to `/sign-in`. Sign-in returns to a safe `?next=` or the role's landing screen. The submit button carries the progress ("Sign in" → spinner "Signing in" → tick "Signed in"); a refusal shakes it, shows the reason beneath and selects the password. Motion in `auth/auth.css`. |
| `StorefrontHero` | Headline (see `HeroHeadline` — the rolling introduction), one search field, two gateway cards, delivery windows, on a lightly tinted ground. The composition follows the Indian delivery apps; the treatment does not — colour is spent on the actions, and the food photography carries the appetite. Every figure is read from the database, and a missing one renders nothing rather than a placeholder. |
| `MissionSection` | The home page's closing statement: who the kitchen cooks for. A full-bleed dark-green band (the one dark storefront surface), a mission statement set large in Zodiak, and two audiences — the desk and the hostel — each a photograph, a lower-case label, a heading and one link. Not cards: the photograph gives each block its edge. Photographs come from the catalogue, offset past the two the hero has already spent, so the page never shows a dish twice. |
| Menu spread (`#menu` on `/`) + `ProductTile` | "What we cook" as the day's menu printed on handmade paper — the one storefront band with its own art direction. Warm ivory (`#f3f0e6`) with a measured grain (`/textures/paper-grain.svg`), one banana leaf drawn as line art (`/textures/banana-leaf.svg`, brand green at 6.5%) placed per breakpoint and kept off the masthead, the page's usual lower-case `.section-display` heading over a hairline rule, six dishes in a 3/2/1 grid. `ProductTile` is a plate on the sheet: inset photograph, name and price on one line with a dotted leader, facts on a hairline at the card's foot, a hairline border and no shadow. Closes on a text link, not a button. Styles and ink roles are local to `.menu-spread` in `globals.css`. |
| `MenuSearch` | GET form to `/menu`. With JavaScript it submits as a client-side navigation inside a transition, so the board's entrance does not replay; the field follows `q`, clears with an icon, and shows a delayed progress hairline while results load. Without JavaScript it is an ordinary bookmarkable form. |
| `icons` | `SearchIcon`, `ArrowRightIcon`, `CloseIcon`. One 24-unit grid, one stroke weight, no icon dependency. |
| `PlanTicket` | A plan on `/subscriptions`, drawn as a kitchen ticket: torn top edge, dotted leaders from each label to its value, a total under a solid rule, and a perforated stub that is the one link (stretched over the whole ticket). Five rows on `subgrid`, so across a row of tickets every total and every stub share a line. Zodiak for the name, Cabinet for everything counted. Server component. |
| `CycleBoard` | The account rules (deliver, skip, pause, cancel) beside a 30-day example month that acts them out with GSAP. Labelled as an example, `role="img"` with a sentence for its name. The markup is the finished month; the timeline rewinds it and plays forward, so no-JS and reduced-motion visitors see the outcome. |
| `DishRow` / `VegMark` | A dish on `/menu` as a row, not a card. Below `lg`: words left, square photo right (the delivery-app shape), price under the name. From `lg`: price at the end of the name's line with a dotted leader, no photo (the pass shows it). One price in the DOM; the grid areas move. `VegMark` is the Indian packaging mark (square with dot, or triangle), labelled for assistive tech. |
| `MenuBoard` / `MenuStage` | `/menu`. The board is a framed darshini menu board in the footer's green, hung on the brick stock, with the tally and search painted on. The stage wires a sticky section index (a rail under the header on phones, a column from `lg`) to the list, and on desktop adds the pass: a sticky photo window showing whichever dish is being read, chosen by scroll position or by pointing at a row. The pass is `aria-hidden` because it repeats the row. |
| `SubscriptionsStage` | The GSAP layer for `/subscriptions`: one `gsap.matchMedia()` inside `useGSAP`, driven by attributes the page sets (`data-enter`, `data-rise`, `data-split-heading`, `data-rule`, `data-tool`). Plugins and the `ck` / `ck-travel` eases are registered once in `site/gsap.ts`; nothing outside that route loads GSAP. |

### Buying a plan (`components/checkout/`)

The plan page and checkout are one flow and share this folder, their CSS
(`checkout/checkout.css`) and their GSAP entry point
(`checkout/checkout-gsap.ts`). The storefront sells; this part is a task, and
every decision below follows from that.

| Component | Notes |
| --- | --- |
| `FlowProgress` | Three steps — your plan, checkout, confirmed — on both pages. Not the checkout's own sections, which say for themselves whether they are done: this answers how much is left, and a visible finish line is one of the few things that keeps people in a checkout. |
| `PlanConfigurator` | This product's cart: one plan, configured (window, days, and the meals for a pick-your-own plan). Real radios and checkboxes named for the server action, so the submission is the form's own data. Presets for days, a live ticket beside the steps on desktop, a dock with the price and Continue on phones. Continue is never disabled — pressing it early goes to the unfinished step and says what is missing. |
| `CheckoutSection` / `CheckoutFlow` | One page of numbered sections; the server decides which is open, from the session and the customer's rows. A finished section folds to a line saying what was decided, with a way to change it. `CheckoutFlow` notices the decision change between renders and moves focus to the newly opened section — the part that is not decoration — then draws the tick and raises the new body. |
| `OrderSummary` / `CouponField` | The plan's ticket from `/subscriptions`, filled in: same paper, same leaders, now with a server-priced total. A bar that opens on phones, a sticky column on a sunken panel from `lg`. Applying a code re-prices on the server; Flip carries the rows to the new layout and the total counts to its new value. Nothing about a price is computed in the browser. |
| `DeliveryForm` | Name, mobile and address, asked once — it replaces two screens that between them asked for a name and a number three times. Rules come from `lib/checkout/fields.ts` and run in the browser (on leaving a field, cleared on the keystroke that fixes it) and again on the server. Keyboards, `autocomplete` tokens and a `+91` prefix are chosen per field; required and optional are both marked. |
| `PaymentStep` / `Receipt` | Delivery and payment together, because the address picked in one is what the other pays for. Methods lead with what they accept, not the gateway's name. The pay button says the amount and sits in a dock stuck to the bottom of a phone screen. All three outcomes stay honest, the unconfirmed one loudest. The receipt is the ticket printed and stamped, and the one sequence in the flow. |

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
- **No page-load choreography, with four exceptions.** The rule exists because animating a screen somebody is *working* on puts a delay between them and the thing they came to do, so the test for an exception is whether there is a task on the surface at all.
  - The storefront hero headline (`.hero-roll` / `.hero-part` in globals.css). Three phrases roll through a slot and settle as one sentence. The home page is the only surface where a visitor is being introduced rather than working.
  - The 404 (`not-found.css`). A dead end is a full stop, not a task: there is one line to read and three ways out, so there is nothing for the motion to sit in front of. One curve, one distance, one interval, so six elements arrive as a single wave rather than six animations.
  - `/subscriptions` (GSAP, see `SubscriptionsStage`). The page is still choosing, not yet a task: the form work starts on the plan page. Held to a budget: everything readable in the intro is on screen inside about a second, each entrance is the object doing what it does (a heading said word by word, a ticket printing), and the one long sequence, the cycle board, is an explanation the visitor scrolls to and can replay.
  - `/menu` (GSAP, see `MenuBoard` / `MenuStage`). Browsing, not a task. Only the board has an entrance (strings drawn, border painted round, title lettered in, under a second). Everything else is either a short scroll reveal or feedback about where the reader is: the index marker following the section, the pass following the dish.
- **The buying flow answers; it does not perform.** The plan page and checkout have no entrance at all: nothing is hidden, nothing has to finish before the page can be used. GSAP runs there only in response to something the customer did — the ring travelling to the option just chosen, price rows making room for an offer line while the total counts to it (Flip), the tick written on a section that just completed (DrawSVG), a refused field shaking beside its reason, the pay button's label sliding as what it is waiting on changes. Each is one movement of 300–450ms on the `ck` curve, and none of them stands between a tap and its result. The confirmed payment is the single sequence — the receipt printing, stamped, its number resolving out of scrambled digits — and it plays once the money has moved and there is no task left to delay.
- Its plugins are registered in `checkout/checkout-gsap.ts` (Flip, DrawSVG, ScrambleText), not `site/gsap.ts`, so ScrollTrigger and SplitText stay off the one route where a slow phone is closest to paying.
- The rule holds everywhere else.
- GSAP tweens use the system curve: `ck` in `site/gsap.ts` is `--ck-ease`. Transforms GSAP writes and transitions CSS runs never share a property on one element (tickets lift with `translate` on the outer element, GSAP moves the paper inside).
- Failure modes decide base rules for any reveal. Content that must survive is never hidden by a base rule, only inside keyframes, so a renderer that never animates still shows it; decoration does the reverse, starting transparent so it can only ever appear by animating. Never gate real content on a class-triggered transition.
  - The one sanctioned exception is the GSAP entrance gate (`site/motion-gate.css`, opted into with `.motion-stage` by `/subscriptions` and `/menu`), and it is shaped to keep the rule's intent: content is hidden only inside `@media (scripting: enabled) and (prefers-reduced-motion: no-preference)`, so no-JS and reduced-motion visitors never match it, and a 2.6s `visibility` failsafe keyframe brings content back if the bundle fails. GSAP then animates to explicit visible values (`fromTo`, never `from()`).

## Illustration

One hand throughout: black line art, drawn rather than sourced. Two ways of putting it on the page, and the choice is not stylistic.

- **As a mask** (`.courier`, `.scene-homes`, `.tool-mark`): the file supplies the shape, `background-color` supplies the ink. The drawing then belongs to the palette and follows the surface — which is why the mission band inverts its marginalia by re-pointing `--ck-mark` and needs no second set of files. Always behind an `@supports (mask-image: …)` guard: unguarded, an unsupported mask degrades into a solid rectangle.
- **As the artwork itself** (`.calendar-mark`, `.chef-mark`): shown exactly as drawn, when the drawing's own weight is the point.

`.tool-mark` is the marginalia system — five kitchen tools in `public/tools/`, placed in the empty page margins either side of the `max-w-6xl` column, centred there by `calc((100% - 72rem) / 4)` so they hold their position at any width. They render only where that margin actually exists (`90rem` in the hero, `80rem` on the mission band); below it, nothing. A decorative ladle sitting on a headline is worse than no ladle.

## Layout

- Storefront: `max-w-6xl` centered container, generous vertical rhythm.
- Admin: left nav (`admin-nav`), content `max-w-6xl`, dense tables allowed.
- KOT: full-width Kanban columns, `data-surface="ops"`, minimum touch target 44px.

## Rules

- Unavailable product = grayscale image + "Unavailable" badge (`.is-unavailable`), not hidden, not selectable.
- Focus: global `:focus-visible` outline in `--ck-focus` (a token, because the ops surface flips the brand colour out from under it) — never remove it. Suppressing it on one control (the hero search input) is only allowed when a wrapper renders an equally visible `focus-within` indicator in its place.
- No raw hex in components; extend tokens in globals.css instead.
- Money never renders on kitchen surfaces (the views mask it; the UI must not reintroduce it).
