# Hyperframes Composition Brief: Infinity Kitchens — customer Reel

## Objective
A vertical, narrated walkthrough of a customer ordering from Infinity Kitchens on their phone.

## Output
- Composition directory: `brag-output-2026-09-19-134744/composition/`
- Rendered video: `brag-output-2026-09-19-134744/brag.mp4`
- Format: vertical — 1080x1920
- Duration: 39.6 seconds (set by the voiceover)

## Source Material
- Live mobile captures (390×559 viewport, 2.3077× → 900×1290), reduced-motion so reveals do not smear across frames: `assets/screens/home.png`, `menu-start.png` + `menu-scroll.mp4` + `menu-end.png`, `subs-scroll.mp4` + `subs-end.png`, `plan-start.png` + `plan-scroll.mp4` + `plan-end.png` + `plan-weekdays.png`; tap targets in `assets/screens/taps.json` (viewport CSS px).
- Rebuilt from components (signed-in; not walked on production so no rows are written): checkout (`app/checkout/page.tsx`, `checkout-section`, `auth-step`, `delivery-form`, `payment-step`), receipt (`receipt.tsx`), account next delivery (`account/deliveries.tsx`, `skip-control.tsx`). Styles from `checkout/checkout.css` and `account/account.css`.
- Copy that must appear verbatim: Checkout · Account · Delivery · Payment · Sign in and continue · Full name · Mobile number · Flat, house number, building · Area, street · Delivery instructions · Save and continue to payment · Deliver to · UPI, cards, net banking or wallet · Pay ₹4,487.75 · Confirming your payment… · subscription confirmed · Your plan is active · first delivery · deliveries scheduled · deliver to · paid · Go to my account · Next delivery · Skip this delivery · Yes, skip it · Keep it · The kitchen will not cook it.
- Figures: ₹4,499 plan; FIRST5 −₹224.95; GST ₹213.70; total ₹4,487.75; SUB-000412; first delivery Mon, 21 Sept, 12:00 pm; 22 deliveries scheduled.

## Creative Direction
- Tone preset: app-store
- Creative direction: a friendly phone walkthrough — the customer's own screen, narrated
- Angle: show a real customer's screen start to finish so ordering looks as simple as it is.
- Hook: the real home screen with the voice's first line.
- Outro: "Infinity Kitchens. Home food, at home's pace." end card.
- Avoid: generic SaaS language, invented claims, anything the app would not show.

## Visual Identity
- Around the phone: `#254139` with a faint kolam texture; captions `#eff6f4`, emphasis `#9ec7bb`
- Inside the phone: the storefront tokens (`#f6f9f8`, `#ffffff`, `#dfece8`, `#7f918b`, `#0d1714`, `#48605a`, `#386155`)
- Fonts: Inter, Zodiak, Cabinet Grotesk, Poppins, JetBrains Mono — local files from the project build

## Storyboard
`brag-plan.md` is the contract; nine scenes, cut to the voiceover.

## Audio
- Voiceover: `assets/vo/vo-01…09.wav` (Kokoro af_heart), one track, full level
- Music: `assets/music/happy-beats-business-moves-vol-11-by-ende-dot-app.mp3`, ducked to ~0.13 under the voice via the volume lane, fade-in and fade-out
- Music cue guidance: bundled preset available; narration sets the cuts, so no forced beat locks
- Audio-reactive: subtle bass-driven glow behind the phone
- SFX: `ui/click2` per tap, `impact/impactWood_medium_001` on the PAID stamp, `impact/impactBell_heavy_000` on the end card

## Hyperframes Instructions
Built against `hyperframes-core`, `-animation`, `-creative`, `-keyframes`, `-cli` (0.8.50). No intent interview. Local assets only (GSAP from the project's `node_modules`). `hyperframes check` must pass before render.
