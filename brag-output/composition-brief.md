# Hyperframes Composition Brief: Infinity Kitchens

## Objective
Create a short launch-style brag video for Infinity Kitchens.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 23.7 seconds

## Source Material
- Project root: the Cloud-Kitchen repo (Next.js 16 app)
- Primary files read: `PRODUCT.md`, `DESIGN.md`, `README.md`, `src/app/globals.css` (tokens), `src/components/site/storefront-hero.tsx`, `src/components/kot/live-board.tsx`, `src/lib/format.ts`, plus the live pages `/`, `/menu`, `/subscriptions`, `/subscriptions/weekday-lunch`
- Product name: Infinity Kitchens
- Tagline / strongest claim: "Not a marketplace with ten thousand dishes. A small menu cooked each morning and delivered on a schedule you set."
- Key UI to recreate: the hero headline + dosa blob; the darshini menu board and dish rows; the Weekday Lunch plan ticket with the three-step flow bar; the manager's KOT live board with SW/ZM/SX tickets
- Copy that must appear verbatim:
  - Not a marketplace with ten thousand dishes.
  - One kitchen. / One menu a day. / For you.
  - Today's menu · COOKED THIS MORNING · dishes 27 · sections 3 · vegetarian all
  - Idli ₹79 · Masala Dosa ₹109 · Banana Leaf Thali ₹199
  - Pick a plan. We cook to it.
  - Weekday Lunch · you get 22 meals · window Lunch, 12:00 pm · cycle 30 days, one-time · PLAN PRICE ₹4,499 · Continue to checkout
  - Your plan · Checkout · Confirmed
  - Waiting on you · In the kitchen · Ready and handoff · Accept · Reject
  - SX-001 Website · SW-014 Swiggy · ZM-009 Zomato
  - Home food, at home's pace. · From ₹3,999 for 30 days

## Creative Direction
- Tone preset: default
- Creative direction: warm, honest kitchen film — food, not SaaS
- Interpretation: clean crossfades and slides, mixed case, generous holds; the one big move is the light storefront flipping to the dark kitchen board.
- Angle: the delivery apps sell infinite choice; this kitchen sells one small menu a day, and the video proves it runs — one Weekday Lunch plan goes from the menu board, through checkout, onto the kitchen's own ticket board beside Swiggy and Zomato orders, and gets accepted.
- Hook: "Not a marketplace with ten thousand dishes." over a faint drifting wall of real dish names.
- Outro / punchline: logo + "INFINITY KITCHENS", "Home food, at home's pace.", "From ₹3,999 for 30 days · Bengaluru", then the giant lower-case name rising into the bottom crop.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign (colours and faces come from the project; Swiggy/Zomato colours only on source tags)

## Visual Identity
- Background: `#f6f9f8`; dark grounds `#254139` (menu board, outro) and `#0d1714` (KOT)
- Text: `#0d1714` on light; `#eff6f4` on dark
- Accent: `#386155` (brand); `#7db5a4` on the ops surface; success `#4ade80` (ops)
- Display font: Inter 600 (headlines), Zodiak (board/plan names), Poppins 500/600 (wordmark only) — local `.woff2` copied from the project build
- Body font: Inter; Cabinet Grotesk for figures; JetBrains Mono for ticket codes
- Visual references: `public/menu/*.jpg` dish photos, `public/brand/mark-*.png`, `public/tools/*.png` line art, `.next/static/media/masala-dosa*.jpg` hero photo

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. The line — 3.70s — "Not a marketplace with ten thousand dishes." over drifting dish names
2. One kitchen — 3.68s — hero headline rolls in, dosa photo in blob
3. Today's menu — 4.22s — menu board + tally, three dish rows one by one
4. Pick a plan — 4.74s — Weekday Lunch ticket prints, ₹4,499, cursor presses Continue, flow reaches Confirmed
5. The kitchen board — 4.20s — SW-014, ZM-009, SX-001 arrive; Accept moves SX-001 into the kitchen
6. Name — 3.16s — logo, wordmark, lines, giant name rises

## Audio
- Audio role: warm bed with sparse professional accents
- Audio arc: bed from frame 0, accents follow the product's own motion, bell on the name while the bed fades
- Music: `assets/music/happy-beats-business-moves-vol-11-by-ende-dot-app.mp3`
- Music treatment: ~0.32, short fade-in, fade out over the last ~0.9s
- Music cue guidance: bundled preset `assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json` (114.84 BPM). Lock 3.70 (hero), 12.65 (price), 17.91 (SX-001); optional 22.65 (giant name). Beat grid for sequences: 3.70/4.75/5.80, 8.44/9.50/10.54, 16.86/17.39/17.91.
- Audio-reactive treatment: subtle; bass lets the glow behind the hero photo and the menu board's shadow breathe. No visualiser graphics.
- Audio-coupled moments:
  - Scene 1 — first words land — soft impact
  - Scene 2 — "One kitchen." — soft impact (beat-locked)
  - Scene 3 — three rows — card slides
  - Scene 4 — price lands, cursor press, Confirmed stamp — wood tap, click, warm thud
  - Scene 5 — three tickets, Accept press — card slides, click
  - Scene 6 — giant name — bell
- SFX selection guidance: low/medium high-frequency risk (`sfx-analysis.md`); card sounds for card-like arrivals, clicks only where a cursor presses.
- Exact SFX choice: chosen against the implemented animation.
- Audio files: copied into `brag-output/composition/assets/`

## Hyperframes Instructions
Built against the Hyperframes domain skills (`hyperframes-core`, `-animation`, `-creative`, `-keyframes`, `-cli`) read from the Hyperframes repo at the CLI's version (0.8.50). /brag is its own workflow: no intent interview, no generic launch-video route.

Requirements:
- Show real UI, copy and photographs from the project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the music/SFX layer.
- Beat locks within ±0.15s, sequence snaps within ±0.10s, marked in the timeline code.
- Local assets only (fonts, images, audio, and GSAP itself — copied from the project's own `node_modules/gsap`), so nothing is fetched at render time.
- `hyperframes check` passes before render.
