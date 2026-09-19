# Brag Plan: Infinity Kitchens

## Rubric (Step 1)

1. **What is the app?** A cloud kitchen in Bengaluru that sells home-style vegetarian meals on a subscription — one small menu cooked each morning — plus the operating system behind it: one live kitchen ticket (KOT) board that takes the website, Swiggy and Zomato orders together.
2. **Most impressive claim.** "Not a marketplace with ten thousand dishes. A small menu cooked each morning and delivered on a schedule you set." (home hero, verbatim)
3. **Visual hook.** The hero headline "One kitchen. / One menu a day. / For you." in heavy Inter beside the dosa photograph in its blob mask; the dark-green framed darshini menu board; the plan ticket with dotted leaders and a torn edge.
4. **Real UI to show.** The menu board (`/menu`), the Weekday Lunch plan ticket (`/subscriptions/weekday-lunch`), the three-step flow bar (Your plan → Checkout → Confirmed), and the manager's KOT board (`components/kot/live-board.tsx`).
5. **Shortest satisfying video.** ~23s: the promise, the menu, buying a plan, the kitchen receiving it, the name.
6. **Tone.** Preset `default`; direction "warm, honest kitchen film — food, not SaaS". It is a real product, so no parody; the pace comes from cuts and motion, the confidence from showing things working.
7. **Audio.** Warm mid-tempo bed (vol-11, "warm and business-y", 114.8 BPM) with sparse, motion-matched accents: soft impacts on reveals, a card slide per menu row and ticket, a click on the two simulated presses, one bell on the final name.
8. **Share caption.** Draft below.
9. **User flow worth showing.** Pick a plan (Weekday Lunch, ₹4,499) → continue to checkout → confirmed → the delivery lands on the kitchen board as `SX-001` beside Swiggy and Zomato tickets → the manager presses Accept and it moves into the kitchen.

## What is this app?
Infinity Kitchens: one kitchen, one small vegetarian menu a day, delivered to a schedule the customer sets — and the kitchen board that makes it run.

## The angle
The delivery apps sell infinite choice. This kitchen sells the opposite, and the video proves it is a real operation rather than a slogan: we follow one Weekday Lunch plan from the menu board, through checkout, onto the kitchen's own ticket board, where it sits next to Swiggy and Zomato orders and gets accepted. Food on the outside, instruments on the inside.

## Hook (first 2-3 seconds)
"Not a marketplace with ten thousand dishes." — the site's own line, set big on the pale green ground while a faint wall of dish names drifts behind it (the "ten thousand"). It lands inside the first second and holds.

## Key moments (the middle)
- The hero headline rolls in phrase by phrase — "One kitchen." "One menu a day." "For you." — with the dosa photograph sliding in behind its blob mask.
- The darshini menu board: "Today's menu", the painted tally (27 dishes · 3 sections · all vegetarian), then three real dishes land one by one with their photos and prices: Idli ₹79, Masala Dosa ₹109, Banana Leaf Thali ₹199.
- The Weekday Lunch ticket prints: dotted leaders draw to 22 meals / Lunch, 12:00 pm / 30 days, one-time; the price lands on ₹4,499; a cursor presses "Continue to checkout" and the flow bar walks Your plan → Checkout → Confirmed.
- The board flips dark: the manager's KOT. SW-014 (Swiggy), ZM-009 (Zomato) and SX-001 (Website) arrive in "Waiting on you". A cursor presses Accept on SX-001 and it moves to "In the kitchen".

## Outro / punchline
The footer's green. The logo mark and "INFINITY KITCHENS", then "Home food, at home's pace." and "From ₹3,999 for 30 days · Bengaluru". The giant lower-case "infinity kitchens" rises into the bottom crop, as it does at the foot of every page on the site.

## User flow worth showing
Weekday Lunch plan → Continue to checkout → Confirmed → SX-001 on the kitchen board → Accept → In the kitchen. Scenes 4 and 5 are the centrepiece and show this flow; scenes 1-3 frame it.

## Tone
- Preset: default
- Creative direction: warm, honest kitchen film — food, not SaaS
- Interpretation: clean crossfades and slides, mixed case, generous holds on every line; the only "loud" move is the flip from the light storefront to the dark kitchen board, which is the story's turn.

## Format: landscape — 1920x1080
## Duration: 23.7 seconds

## Visual identity (from the project)
- Background: `#f6f9f8` (storefront bg), `#eff6f4` sunken; menu board and outro `#254139` (footer green, ramp 800); KOT `#0d1714` (ops bg) with `#13201c` cards
- Accent: `#386155` (brand, ramp 700); ops brand `#7db5a4`; source colours only on source tags — SW `#ff8534`, ZM `#ff5a5f`, SX `#7ba7ee` (ops values)
- Text: `#0d1714` ink, `#48605a` muted; on dark `#eff6f4` / `#bedad2`
- Display font: Inter 600 (hero headline); Zodiak for plan and board names (the kitchen's "spoken" voice); Poppins 500/600 for the wordmark only
- Body font: Inter; Cabinet Grotesk for counted figures on the ticket; JetBrains Mono for ticket codes
- Strongest visual element: the plan ticket (dotted leaders, torn edge) and the dark KOT board with the three literal source prefixes

## Share copy (draft)
Not a marketplace with ten thousand dishes — one kitchen in Bengaluru, one menu a day, cooked each morning and delivered on the schedule you set. Built the storefront and the kitchen board it runs on.

## Audio direction
- Role: warm bed with sparse professional accents
- Music: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3`
- Music treatment: from 0s, bed at ~0.32, short fade-in, fade out across the last ~0.9s under the final name
- Music cue guidance: preset `assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json` (114.84 BPM). Strong cues to lock: 3.70s (hero "One kitchen." lands), 12.65s (₹4,499 lands), 17.91s (SX-001 lands on the board); optional 22.65s for the giant wordmark. Beat-grid windows: hero phrases every other beat 3.70 / 4.75 / 5.80; menu rows every other beat 8.44 / 9.50 / 10.54; KOT tickets on consecutive beats 16.86 / 17.39 / 17.91 (short tags, not sentences — held together afterwards).
- Audio-reactive treatment: subtle; music bass lets the warm glow behind the hero photo and the menu board's shadow breathe. No waveform or equalizer visuals.
- SFX posture: moderate, motion-matched, low high-frequency risk
- Audio-coupled moments: hook word landing, hero reveal, three menu rows, ticket price landing, cursor press on Continue, Confirmed stamp, three KOT tickets, Accept press, final wordmark
- Restraint rule: no SFX on every beat; nothing bright or glassy repeated; music never above 0.4

## Storyboard

### Scene 1 — The line — 3.70s (0.00–3.70)
Pale storefront ground `#f6f9f8`. "Not a marketplace with ten thousand dishes." set large in Inter 600, left-anchored, arriving word-group by word-group inside ~0.9s and holding. Behind it, a faint drifting wall of the real dish names (Idli, Khara Bath, Vangi Bath, Chole Bhature…), repeated — the ten thousand.
Sequential/interaction: yes — the line arrives in three quick groups, then holds ~2.4s.
Audio intent: a soft, confident start.
Audio-coupled idea: soft impact as the first group lands.
Music: bed begins.
Transition mood: clean → Scene 2

### Scene 2 — One kitchen — 3.68s (3.70–7.38)
The hero, recreated: "One kitchen." / "One menu a day." / "For you." roll in one per phrase (every other beat), left column; the real dosa photograph slides in on the right inside the site's blob shape; one of the site's line-art tools (spatula) in the margin; the brand mark small at the top.
Sequential/interaction: yes — three phrases one by one, then the full sentence holds ~1.5s.
Audio intent: lift — this is the reveal.
Audio-coupled idea: soft impact beat-locked at 3.70 on "One kitchen."
Transition mood: soft slide → Scene 3

### Scene 3 — Today's menu — 4.22s (7.38–11.60)
The darshini board: dark-green frame on the brick-tile wall, "COOKED THIS MORNING", "Today's menu" in Zodiak, the painted tally with dotted leaders (dishes 27 · sections 3 · vegetarian all). Then three rows land one by one beside the board, each a real photo + name + dotted leader + price: Idli ₹79 · Masala Dosa ₹109 · Banana Leaf Thali ₹199.
Sequential/interaction: yes — rows at 8.44 / 9.50 / 10.54, each held, the set held together at the end.
Audio intent: appetite, rhythm.
Audio-coupled idea: a card slide per row.
Transition mood: clean wipe → Scene 4

### Scene 4 — Pick a plan — 4.74s (11.60–16.34)
Left: "Pick a plan. We cook to it." (the subscriptions heading, verbatim). Right: the Weekday Lunch ticket prints downward — FIXED MENU, "Weekday Lunch" in Zodiak, leaders draw to you get 22 meals · window Lunch, 12:00 pm · cycle 30 days, one-time · FIRST5 note · PLAN PRICE ₹4,499 (lands 12.65). Above it the flow bar: 1 Your plan — 2 Checkout — 3 Confirmed. A cursor glides in and presses "Continue to checkout" (13.70); the bar advances to Checkout then Confirmed (14.76), and a "Confirmed" stamp lands on the ticket.
Sequential/interaction: yes — simulated cursor press; flow steps advance one by one.
Audio intent: satisfying, transactional without being cold.
Audio-coupled idea: price lands with a soft wood tap; click on the press; a warm thud on the stamp.
Transition mood: dramatic (light → dark flip) → Scene 5

### Scene 5 — The kitchen board — 4.20s (16.34–20.54)
Ops surface `#0d1714`. Header "Live board" with a green "Live" connection dot. Three columns: "Waiting on you", "In the kitchen", "Ready and handoff". Tickets arrive in "Waiting on you": SW-014 Swiggy, ZM-009 Zomato, then SX-001 Website (Weekday Lunch · Lunch window · Banana Leaf Thali ×1 · ETA 25 min) with Accept / Reject buttons. Caption in the upper right: "Website. Swiggy. Zomato. One board." A cursor presses Accept on SX-001 (18.96); the card flashes and moves to "In the kitchen", status reading "Accepted".
Sequential/interaction: yes — three tickets one by one, then the press.
Audio intent: operational focus.
Audio-coupled idea: card slide per ticket; click on Accept.
Transition mood: soft → Scene 6

### Scene 6 — Name — 3.16s (20.54–23.70)
Footer green `#254139`. The logo mark (cream) and "INFINITY KITCHENS" in Poppins, "Home food, at home's pace." and "From ₹3,999 for 30 days · Bengaluru". At 22.65 the giant lower-case "infinity kitchens" rises into the bottom crop in the footer's type colour.
Sequential/interaction: yes — three lines, then the giant name.
Audio intent: warm landing.
Audio-coupled idea: bell on the giant name, music fades under it.
Transition mood: end

**Music mood for this video:** warm, upbeat
**Audio summary:** a warm bed from the first frame, a few soft impacts and card slides following the product's own motion, one bell on the name while the music fades.
