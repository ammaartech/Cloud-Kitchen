# Brag Plan: Infinity Kitchens — customer Reel

Invocation: `/brag --format vertical --voice`, customer point of view only.

## Rubric (Step 1)

1. **What is the app?** A Bengaluru cloud kitchen that sells home-style vegetarian meals on a subscription: one small menu cooked each morning, delivered on a schedule the customer sets.
2. **Most impressive claim.** "Not a marketplace with ten thousand dishes. A small menu cooked each morning and delivered on a schedule you set."
3. **Visual hook.** The phone home screen: "One kitchen. / One menu a day. / For you."
4. **Real UI to show.** The mobile storefront as a customer uses it: home, `/menu`, `/subscriptions`, the Weekday Lunch plan page with its dock, then checkout, payment, the printed receipt and the account's next delivery.
5. **Shortest satisfying video.** ~40s. The request is the whole ordering path, which is the reason to run past the usual 25s; the voice sets the pace.
6. **Tone.** Preset `app-store`; direction "a friendly phone walkthrough — the customer's own screen, narrated". Clean slides, one idea per line, nothing jokey.
7. **Audio.** Voiceover leads (Kokoro `af_heart`). The same warm bed as the first video (vol-11) ducked well under the voice, a soft click on every tap, a thud when the receipt is stamped, one bell on the name.
8. **Share caption.** Below.
9. **User flow worth showing.** Home → Menu → Meal plans → Weekday Lunch → choose Weekdays → Continue → Checkout (sign in, delivery address with a rider note) → Payment (UPI / cards) → "Your plan is active" → account: next delivery → skip it in two taps.

## What is this app?
Infinity Kitchens: a month of home-style lunches set up from a phone in a few taps.

## The angle
Show a customer's own screen, start to finish, so a prospective customer (or a client) sees exactly how simple ordering is. Real mobile captures of the live site for browsing and choosing; the signed-in checkout, receipt and account rebuilt from the components and their exact copy, because walking the live checkout would write real rows to production.

## Hook (first 2-3 seconds)
The real phone home screen with the hero line, and the voice: "Here's how you get a month of home-style lunches from Infinity Kitchens."

## Key moments (the middle)
- The menu board, then a real scroll through the day's dishes under the sticky header and section rail.
- The plan tickets; a tap on Weekday Lunch's "choose this plan".
- "Which days?" → tap Weekdays; the note changes to "Monday to Friday. Nothing arrives at the weekend."; tap Continue in the dock (₹4,499).
- Checkout: sign in, then the delivery form typed in — flat, street, a note for the rider — and "Save and continue to payment".
- Payment: "UPI, cards, net banking or wallet", tap "Pay ₹4,487.75" (₹4,499 − FIRST5 ₹224.95 + 5% GST ₹213.70, as the quote function computes it).
- Receipt: "Your plan is active", SUB-000412 resolving, 22 deliveries scheduled, a PAID stamp.
- Account: next delivery Mon, 21 Sept, lunch; "Skip this delivery" → "Yes, skip it".

## Outro / punchline
"Infinity Kitchens. Home food, at home's pace." End card with the logo, "From ₹3,999 for 30 days" and the site address.

## User flow worth showing
As in rubric 9 — it is the whole video.

## Tone
- Preset: app-store
- Creative direction: a friendly phone walkthrough — the customer's own screen, narrated
- Interpretation: one step per caption, taps you can see, screen transitions that feel like navigating a phone; the voice carries the pace and every cut waits for it.

## Format: vertical — 1080x1920
## Duration: ~39.6 seconds (set by the voiceover)

## Visual identity (from the project)
- Background: `#254139` (footer green) around the phone; storefront `#f6f9f8` inside it
- Accent: `#386155` (brand); `#9ec7bb` on the dark ground
- Text: `#eff6f4` captions on dark; `#0d1714` ink on the screens
- Display font: Inter 600 (captions); Zodiak for plan names on tickets; Poppins for the wordmark
- Body font: Inter; Cabinet Grotesk for ticket figures; JetBrains Mono for codes
- Strongest visual element: the real mobile screens, with the site's ticket receipt as the payoff

## Layout for Reels
Caption zone at the top (clear of Instagram's own top bar), a 900×1290 phone screen (a 390×559 viewport at 2.3077×) below it, framed as a phone. Everything the viewer must read sits inside y ≈ 200–1750.

## Share copy (draft)
A month of home-style lunches, set up from your phone: pick today's menu or a plan, choose your days, pay with UPI, done. Infinity Kitchens, Bengaluru.

## Voiceover script
Voice: Kokoro `af_heart`, speed 1.0. Each line generated separately so every scene is cut to the real length of its line.

| # | Scene | Line | Length |
|---|---|---|---|
| 1 | Home | Here's how you get a month of home-style lunches from Infinity Kitchens. | 3.99s |
| 2 | Menu | Start with today's menu. It's small, all vegetarian, and cooked fresh every morning. | 5.23s |
| 3 | Plans | Then pick a plan. Weekday Lunch is twenty-two lunches a month. | 3.58s |
| 4 | Plan page | Choose your delivery window and your days, then tap continue. | 3.33s |
| 5 | Checkout | At checkout, sign in and add your address once, with a note for the rider. | 3.93s |
| 6 | Payment | Pay with U P I or card. | 1.77s |
| 7 | Receipt | That's it. Your plan is active, and all twenty-two lunches are scheduled. | 4.16s |
| 8 | Account | Busy day? Skip a delivery from your account in two taps. | 3.18s |
| 9 | Name | Infinity Kitchens. Home food, at home's pace. | 3.03s |

Line 7 originally promised the first lunch "tomorrow". Today is Saturday 19 Sept and the customer picks Weekdays, so the first delivery is Monday; the line was rewritten to what the receipt actually shows.

## Audio direction
- Role: voice-led, music as a quiet bed
- Music: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` (the first video's track, so the two read as one brand)
- Music treatment: held at 0.18 under the voice for the whole piece (set in the volume lane itself, which replaces `data-volume` rather than scaling it), short fade-in, fade-out under the last line; voice lifted to 1.5. Delivered master normalised to −14 LUFS: voice ≈ −17 dB, bed ≈ −27.5 dB
- Music cue guidance: preset `assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json`; with narration the voice sets every cut, so no beat locks are forced
- Audio-reactive treatment: subtle; bass lets the glow behind the phone breathe
- SFX posture: sparse — a soft click per tap, one thud for the stamp, one bell on the name
- Restraint rule: nothing under the voice louder than the voice; no typing sounds

## Storyboard (times are the timeline's)

### Scene 1 — Home — 0.00–4.50
Real home screen. VO 1 from 0.20. Tap on the hero's MENU at 3.95.
### Scene 2 — Menu — 4.50–10.20
Menu board holds, scrolls through the first dishes (5.80–8.00), holds. VO 2 from 4.65. Tap START A PLAN at 9.85.
### Scene 3 — Plans — 10.20–14.30
Real scroll down /subscriptions to the Weekday Lunch ticket. VO 3 from 10.35. Tap "choose this plan" at 13.95.
### Scene 4 — Plan page — 14.30–18.40
Scroll to "When should it arrive? / Which days?". Tap Weekdays (16.70), the note changes; tap Continue (17.95). VO 4 from 14.45.
### Scene 5 — Checkout — 18.40–24.40
Rebuilt checkout. Sign in (email, password, "Sign in and continue"); Account folds to a line; Delivery opens; flat, street and a rider note are typed; "Save and continue to payment". VO 5 from 18.55.
### Scene 6 — Payment — 24.40–27.60
Delivery folds to the address; Payment: Razorpay's "UPI, cards, net banking or wallet"; tap "Pay ₹4,487.75" → "Confirming your payment…". VO 6 from 24.60.
### Scene 7 — Receipt — 27.60–32.30
The receipt prints: "subscription confirmed", "Your plan is active", Weekday Lunch, SUB-000412 resolving, first delivery Mon, 21 Sept, 22 deliveries scheduled, deliver to, paid ₹4,487.75, a PAID stamp. Tap "Go to my account". VO 7 from 27.75.
### Scene 8 — Account — 32.30–36.20
Next delivery: Mon, 21 Sept · Lunch, from 12:00 pm · Banana Leaf Thali; "You can skip this until 10:00 am, Mon, 21 Sept." Tap "Skip this delivery" → "Skip lunch on Mon, 21 Sept?" "The kitchen will not cook it." → tap "Yes, skip it" → Skipped. VO 8 from 32.45.
### Scene 9 — Name — 36.20–39.60
The screen gives way to the end card: logo, "Home food, at home's pace.", "From ₹3,999 for 30 days", the site address. VO 9 from 36.40, bell as the logo lands.
