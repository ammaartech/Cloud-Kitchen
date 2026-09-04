import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { DeliveryWindow, PlanSummary, ProductCard } from '@/lib/data/catalog';
import { clockTime, money } from '@/lib/format';
import { buttonClasses, cx } from '@/components/ui/button-styles';
import { HERO_NAV } from './nav';
import { withPhotos, type Photo } from './photos';
import { ArrowRightIcon } from './icons';
import {
  DeliveryRun,
  DriftingArrow,
  DriftingPhoto,
  HeroLayer,
  HeroStage,
  TiltCard,
} from './hero-motion';

/**
 * The storefront hero.
 *
 * The composition follows the large Indian delivery apps -- headline, one
 * action, two gateways -- because that is the shape a customer in this market
 * already knows how to read. All four now sit in the left column of the split,
 * beside the photograph rather than under it, which is the one place the
 * arrangement departs from those apps and does so for the reason they would:
 * everything the page is selling has to be on screen when the page arrives. What sat in that slot before was a
 * menu search, and a search field on a kitchen that cooks one menu a day is a
 * question with nothing behind it: the visitor has nothing to search for yet,
 * and the answer is the same page either way. The slot now asks for the thing
 * the page exists to sell. The treatment does not follow the apps: a barely
 * tinted ground with white cards, colour spent only on the actions. The food
 * photography, not the background, carries the appetite.
 *
 * Every figure here is read from the database. When there are no offers, no
 * offer pill renders; nothing on this surface invents a number.
 *
 * This file stays a server component. The motion is imported from
 * `hero-motion.tsx` as a handful of client wrappers that take children, so the
 * data reads, the derivations below and all of this markup are still rendered
 * on the server and prerendered into the static shell -- only the wrappers
 * themselves hydrate.
 */

/**
 * Dissolves a card photo leftward, into the copy beside it.
 *
 * The gateway cards used to be tall panels with the photograph pinned into a
 * corner, and a radial mask was the right shape for that. They are rows now --
 * see `GatewayCard` -- so the photograph holds the right end at the card's full
 * height and has exactly one edge to resolve: the vertical one facing the
 * words. A horizontal ramp is that edge. A radial fade on a box this short
 * guttered the picture at both corners to soften an edge nobody was looking at.
 */
const ROW_FADE = 'linear-gradient(270deg, #000 38%, transparent 92%)';

/**
 * The entrance running order, in milliseconds.
 *
 * One list, in the order the eye should pick things up, so the choreography can
 * be read and retimed in one place rather than inferred from four `style`
 * attributes scattered through the markup. The two cards still arrive last even
 * though they no longer sit last on the page: they are the answer to the
 * headline, and an answer that lands before the question has been asked reads
 * as a menu rather than as a reply. The whole thing is over inside a
 * second and a quarter, under a headline that keeps rolling until ~3.15s --
 * see the note above `.hero-enter` in `globals.css` for why the two are not
 * chained together.
 *
 * The gaps are 80ms and were 120. That is the difference between four things
 * arriving and one thing arriving in four parts, and 120 only became the wrong
 * number when the cards moved up into this column: as a separate band below
 * the split they were a second group and wanted a beat of separation, but in a
 * single vertical run down one column a 120ms gap reads as four elements each
 * waiting for the one above it to finish. 80ms is the top of the range a
 * stagger still holds together in -- past it the cascade stops being one
 * gesture, and it was costing the last card a third of a second on the surface
 * whose whole point is that the actions are already there when you arrive.
 *
 * The nav row is first and by the smallest margin -- 50ms ahead of the
 * subtitle rather than a beat of its own. It sits above the headline, so it has
 * to be there before the eye starts down the column; but it is three quiet
 * words, and giving them their own moment in the choreography would announce
 * them as the most important thing on the page, which is the opposite of what
 * they are.
 *
 * The delivery windows used to be the last entry here and are not any more.
 * They are no longer part of the page's arrival at all: they are handed over by
 * the courier as he passes, on his clock rather than the load's -- see
 * `passAt` and the note over `.delivery-window` in `globals.css`.
 */
const ENTER = {
  nav: 40,
  subtitle: 90,
  cta: 170,
  primaryCard: 250,
  secondaryCard: 320,
} as const;

/**
 * How far the bowl's photograph is over-scaled at rest.
 *
 * The panel it sits in is clipped by a curve, and a photograph that exactly
 * fills its clip has nowhere to go: the slow drift below would drag a hard
 * edge into view at the top or the side. A few per cent of overscale is the
 * margin that drift moves inside.
 */
const BOWL_OVERSCALE = 1.06;

/**
 * The panel's curved edge, in the 0-1 coordinates
 * `clipPathUnits="objectBoundingBox"` wants: the whole panel, with its left
 * side cut by a curve.
 *
 * It replaced a `border-radius`, which can only ever draw a symmetrical arc --
 * leaving the top edge and returning to the bottom at the same distance. This
 * one enters at 0.26 across and leaves at 0.145, so the curve leans and the
 * panel reads as cut rather than filleted. Being a ratio rather than a length,
 * it is the same curve at 1280px and at 2560px with nothing to recalculate.
 *
 * The shape is the whole of the treatment, and that is the second decision
 * here rather than an absence of one. A hand-drawn ink line used to be stroked
 * along this curve and drew itself on as the hero arrived. It is gone: a curve
 * at this size is already a large gesture, and outlining it pointed the eye at
 * the join instead of at either side of it. The references this layout follows
 * all leave the edge clean and let the shape carry it.
 *
 * Three edges are drawn and one is not. The left is the long lean; the bottom
 * is a shallow wave that lifts as it runs right, so the panel *leaves* the page
 * rather than being cut off square by it; the top and right are the box itself,
 * because those two are where the photograph runs off the screen and an edge
 * you cannot see needs no shape.
 *
 * The bottom wave is deliberately shallow -- it lifts about a tenth of the
 * panel's height across its whole width. Any deeper and the empty ground it
 * opens up underneath stops reading as the photograph leaving and starts
 * reading as a gap where something failed to load.
 *
 * The left curve stops at 0.92 rather than running all the way to 1, and that
 * is what makes the corner disappear. A curve arriving at the very bottom edge
 * is travelling steeply downward when it gets there, and the wave leaving it
 * has to travel sideways -- two directions that cannot be reconciled at a
 * point, so the join showed as a visible kink. Handing over above the floor
 * lets the outgoing control point continue the direction the incoming one was
 * already going, and the two read as one edge. The wave then dips to 1.02,
 * just past the box: it flattens along the bottom for a moment instead of
 * touching it and immediately leaving, which is what gives the sweep its
 * weight. Anything outside the box is simply not painted.
 */
const BOWL_CLIP =
  'M 1 0 L 0.26 0 C 0.10 0.12, 0.015 0.28, 0.018 0.46 C 0.021 0.64, 0.075 0.80, 0.155 0.92 C 0.30 1.02, 0.47 0.90, 0.64 0.93 C 0.79 0.955, 0.89 0.90, 1 0.87 Z';

/** The custom property `.hero-enter` reads its delay from. */
function enterAt(ms: number): CSSProperties {
  return { '--enter-at': `${ms}ms` } as CSSProperties;
}

/**
 * How far into the courier's ride a delivery window is handed over, as a
 * fraction of it.
 *
 * The windows are a centred flex row, so they occupy roughly the middle of the
 * page and the courier is level with them over the back half of his crossing --
 * he spends the front half out on the empty road to their left. `PASS_FROM` and
 * `PASS_TO` are that stretch, and the list is spread evenly across it.
 *
 * Both numbers were measured off the run rather than guessed. The first pass
 * started them at 0.28 on the reasoning that the labels occupy the middle of the
 * page, which ignored that he enters from outside it: every window then arrived
 * while he was still several hundred pixels short of it, and three labels
 * appearing ahead of the rider read as a coincidence rather than a delivery.
 * These are the fractions at which he is actually level with each one, pulled
 * back by about the length of the wipe so the label is mid-arrival as he draws
 * alongside rather than starting from nothing once he is past.
 *
 * `PASS_TO` stops well short of 1 for a reason that only shows up at the far
 * end: the wipe takes time of its own, so a last window starting as he arrives
 * finishes well after he has parked, and the run ends with the page still
 * moving after the thing causing the movement has stopped. Ending the last wipe
 * with the brake is what makes the sequence resolve.
 *
 * Derived from the count rather than hard-coded to three, because the windows
 * come from the database: a kitchen that serves two meals gets two, spread
 * across the same stretch, and the run still reads the same way. The single
 * window case has nothing to spread, so it lands in the middle of the stretch
 * rather than at the start of it -- which is also where a lone centred item
 * actually sits.
 */
const PASS_FROM = 0.44;
const PASS_TO = 0.8;

function passAt(index: number, count: number): CSSProperties {
  const spread = count > 1 ? index / (count - 1) : 0.5;
  return { '--pass-at': PASS_FROM + (PASS_TO - PASS_FROM) * spread } as CSSProperties;
}

export function StorefrontHero({
  plans,
  menu,
  windows,
}: {
  plans: PlanSummary[];
  menu: ProductCard[];
  windows: DeliveryWindow[];
}) {
  const photos = withPhotos(menu);
  const available = menu.filter((product) => product.isAvailable);
  const vegetarian = available.filter((product) => product.isVegetarian);

  const cheapest = plans.reduce<PlanSummary | null>(
    (best, plan) => (!best || Number(plan.price) < Number(best.price) ? plan : best),
    null,
  );

  return (
    <HeroStage id="top" className="storefront-hero border-b border-line bg-sunken">
      {/* The kitchen's tools, drawn in the margins either side of the column.
          Direct children of the section and deliberately outside every
          `HeroLayer`: a layer transforms, and a transformed ancestor becomes
          the containing block for anything absolutely positioned inside it,
          which would anchor these to a drifting box instead of to the page.
          The same reason the delivery scene sits out here.

          Decoration, so `aria-hidden` and `pointer-events: none` -- and so
          they render only where there is real margin to put them in. All of
          that lives in `.tool-mark` in `globals.css`. */}
      {/* Only the left margin carries marks now. The right one is where the
          photograph runs off the page, so the two that used to sit out there
          would be drawn on top of the food; the spoon and knife moved inside
          the panel (painted light -- see `HeroBowl`) and the grater dropped to
          sit beside the cards, below where the panel ends. */}
      <span className="tool-mark tool-spatula" aria-hidden />
      <span className="tool-mark tool-spoon-knife" aria-hidden />
      <span className="tool-mark tool-mark-right tool-grater" aria-hidden />
      {/* The bottom padding is what sets the gap between the delivery windows
          and the road, and it is the only thing that can: the lane is out of
          flow and anchored to the section's bottom edge, so margin on the
          windows pushes the section taller and takes the lane down with it,
          leaving the gap exactly where it was. Less padding is the windows
          sitting lower in the scene.

          Trimmed twice now. It is set to just clear the rooftops rather than
          to look comfortable, and then taken in by another 2rem to close the
          gap that was left between the windows and the road -- the courier
          hands the timings over as he passes, and a hand-off across two hundred
          pixels of empty ground does not read as one. The houses are the tallest thing in the lane and they
          reach its very top, so this cannot go below the lane's own height
          without the third window landing on a roof -- the row is centred and
          the houses are hard right, and at around 1280px those two overlap.
          It steps at the breakpoints the scene does, because what it is
          clearing is the houses' height. */}
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-28 sm:pt-20 sm:pb-36 lg:pt-24 lg:pb-44">
        {/* The three scroll planes, in depth order. The copy is nearest, so it
            leaves fastest and gives up the most opacity; the cards sit behind
            it and hold on longer, because they are still the actions and a
            visitor scrolling back up should find them where they left them.
            The differences between the depths are the parallax -- see
            `HeroLayer`. */}
        {/* The split, and the whole shape of the surface.

            The hero was one centred column: a headline in the middle of the
            page with a third of the width empty either side of it, which read
            as unfinished rather than as airy -- there was nothing out there for
            the eye to go to. It is two columns from `lg` now. The copy takes
            the left and stops being centred; the right is a photograph of the
            food, running off the edge of the page behind a curve.

            Below `lg` it is one column again and the photograph goes underneath
            the copy rather than beside it. A 50/50 split on a phone is two
            columns of nothing. */}
        <div className="hero-split">
          <HeroLayer depth={1.15} fade={0.55} className="hero-copy">
            {/* The rest of the site, above the sentence that explains it.
                These three were in the header until the wordmark took the
                middle of the bar -- see `HERO_NAV` in `nav.ts` -- and this is
                the better place for them anyway. A visitor reads down from the
                top of a page: in the header they were a bar of options to scan
                and dismiss before reaching the headline, and here they are the
                first line of the page, read in the same pass as everything
                under them.

                Deliberately small and deliberately not buttons. There is one
                action in this column and it is "start a plan today" further
                down; three links styled with any weight at all would compete
                with it, and the whole reason they can sit this high is that
                they do not. */}
            <nav
              // The header watches this element and grows the same four links
              // when it leaves the top of the screen -- see
              // `useScrolledPastElement`. Without that, using one of these
              // links scrolls the row that contains them off the page and
              // leaves the visitor with no navigation at all.
              id="hero-nav"
              style={enterAt(ENTER.nav)}
              aria-label="Sections"
              className="hero-enter hero-nav"
            >
              {/* Keyed by label, not by section, because the section is not
                  unique: "Meal Plans" and "Subscriptions" both point at
                  `#plans`, so keying on the destination gave two siblings the
                  same key and React warned that it could duplicate or drop
                  one. The label is what distinguishes these rows to a reader
                  and it is what distinguishes them to React. `site-header.tsx`
                  renders the same list and already keys it this way. */}
              {HERO_NAV.map((item) => (
                <Link key={item.label} href={`/#${item.section}`} className="hero-nav-link">
                  {item.label}
                </Link>
              ))}
            </nav>

            <HeroHeadline />

            <p
              style={enterAt(ENTER.subtitle)}
              className="hero-enter mx-auto mt-5 max-w-xl text-center text-base text-pretty text-muted sm:text-lg lg:mx-0 lg:text-left"
            >
              Not a marketplace with ten thousand dishes. A small menu cooked each morning
              and delivered on a schedule you set.
            </p>

          {/* The one action in the copy layer, and a real link rather than a
              styled div: it is a destination, so it is an anchor, and the
              whole rectangle is the hit area. `btn-plain` is the same square
              hairline that fills on hover as the plan buttons further down the
              page -- one shape for "press this", used at two sizes -- and
              `hero-cta` gives it the footprint the search field had. Lower
              case, and written that way rather than transformed, for the same
              reason as the headings below: the accessible name should be the
              words that are actually on the button. */}
            <Link
              href="/subscriptions"
              style={enterAt(ENTER.cta)}
              className={buttonClasses(
                'outline',
                'lg',
                'hero-enter hero-cta btn-plain mt-8 sm:mt-10',
              )}
            >
              start a plan today
              {/* The wipe's second copy of the button: same words, already
                  white, on a ground that is already green, clipped to nothing
                  until a pointer arrives. `aria-hidden`, so the accessible name
                  is the one label rather than the same sentence twice, and the
                  duplicate never becomes a second thing to read. See
                  `.hero-cta-fill` for what the clip does and why it is not a
                  colour transition. */}
              <span className="hero-cta-fill" aria-hidden>
                start a plan today
              </span>
            </Link>

            {/* The two gateways, and they are here rather than in a band of
                their own below the split -- which is where they were, and where
                nobody saw them.

                The cost of the old arrangement was not subtle. Two 288px panels
                under a 608px photograph put the only two links to the things
                this kitchen sells about a screen and a half down: on a laptop
                you had to scroll past a finished-looking hero to find out there
                was anything under it, and a hero that looks finished is one
                people stop at. The left column meanwhile ran out of copy after
                the button and held a column-width of empty ground for the rest
                of the photograph's height, so the page was paying for the space
                twice -- empty above, cramped below.

                Putting them in that empty ground answers both at once, and it
                is what changes the cards' shape as well: half a column is not
                wide enough for a panel with a heading, a photograph and a
                button stacked inside it, but it is a natural width for a row.
                See `GatewayCard`. Two of them stacked cost about 190px, against
                the 650 the band cost, and the whole hero now resolves inside
                one screen.

                They share the copy's plane rather than getting a `HeroLayer` of
                their own. They did have one, at a shallower depth, back when
                they were a separate band that had to hold its own against the
                photograph; sitting directly under the button they are part of
                the copy, and giving them a second parallax rate would slide
                them away from the sentence they answer.

                Held to the subtitle's measure below `lg`, where the column is
                the whole page: rows the full width of a 1024px container with
                a centred paragraph above them read as a different section that
                happens to be adjacent. From `lg` the column itself is the
                measure and the cap comes off. */}
            <div className="mx-auto mt-10 grid w-full max-w-xl gap-3 sm:mt-12 lg:mx-0 lg:max-w-none">
              <GatewayCard
                href="/subscriptions"
                title="Meal subscriptions"
                subtitle="Cooked to your schedule"
                footnote={
                  cheapest
                    ? `From ${money(cheapest.price)} for ${cheapest.billingPeriodDays} days`
                    : null
                }
                photo={photos[1] ?? photos[0]}
                enterAfter={ENTER.primaryCard}
              />

              <GatewayCard
                href="/menu"
                title="Today&rsquo;s menu"
                subtitle="What the kitchen is cooking"
                footnote={vegetarian.length ? `${vegetarian.length} of them vegetarian` : null}
                photo={photos[2] ?? photos[0]}
                enterAfter={ENTER.secondaryCard}
              />
            </div>
          </HeroLayer>

          {/* Its own plane, drifting slower than the copy beside it. The two
              columns leaving at the same rate would be one picture scrolling;
              the difference between the depths is what makes the photograph sit
              behind the words rather than next to them. */}
          <HeroLayer depth={0.72} fade={0.16} className="hero-bowl-layer">
            <HeroBowl photo={photos[0]} />
          </HeroLayer>
        </div>

        {/* The windows and the delivery scene are one unit now, so they sit
            inside a single wrapper rather than being a content row with a
            drawing parked underneath it. The wrapper is in flow and unpositioned
            on purpose: the lane inside it is absolutely positioned, and with
            nothing positioned between it and the section it resolves against the
            section and reaches both edges of the page.

            Deliberately outside every `HeroLayer` -- a `HeroLayer` transforms,
            and a transformed ancestor becomes the containing block for
            absolutely positioned descendants, which would re-anchor the lane to
            a zero-height div and drop the whole scene out of the hero. It costs
            the windows the parallax they used to drift with; that is the price
            of the road reaching the edges, and it is worth it. */}
        <DeliveryRun
          windows={
            windows.length ? (
              /* `max-w-3xl` inside a `max-w-6xl` container, which is narrower
                 than it needs to be for the type and is the point. The last
                 column has to sit where the courier actually stops, and he
                 stops short of the right edge by the width of the houses --
                 spread across the full container, the third window would land
                 behind them, where he never reaches it and the hand-over stops
                 reading as one.

                 One column until 40rem. Three columns of this type on a phone
                 is about 120px each, and "12:00 pm - 2:30 pm" does not go in
                 120px at any size worth calling large. */
              <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-y-9 border-t border-line pt-10 sm:grid-cols-3 sm:gap-x-8">
                {windows.map((window, index) => (
                  <div
                    key={window.id}
                    className="delivery-window text-center"
                    style={passAt(index, windows.length)}
                  >
                    <dt className="delivery-window-label font-semibold text-balance text-ink">
                      {window.label}
                    </dt>
                    <dd className="delivery-window-time mt-1.5 tabular text-muted">
                      {clockTime(window.starts_at)} &ndash; {clockTime(window.ends_at)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null
          }
          scene={<DeliveryScene />}
        />
      </div>
    </HeroStage>
  );
}

/**
 * The bowl: the page's one photograph at full size.
 *
 * The hero used to be text on a tinted ground and nothing else, and it read as
 * unfinished for a reason that had nothing to do with spacing -- a kitchen's
 * front page with no food on it. This is the food, at the size the food should
 * be.
 *
 * Three things make it a composition rather than a picture in a box:
 *
 * 1. **It runs off the page.** The panel is pulled past the content column to
 *    the right edge of the viewport, so the photograph is a view onto
 *    something larger rather than an object with four visible sides. See
 *    `.hero-bowl` for how that is done without a horizontal scrollbar.
 *
 * 2. **The edge facing the words is a curve, not a line.** A straight seam down
 *    the middle of a hero splits it into two documents; a curve reads as one
 *    surface with something behind it.
 *
 * 3. **The green comes back at the curve.** A scrim in the band colour is laid
 *    along the curved edge, so the photograph resolves into the brand rather
 *    than stopping. It is also what gives the drawn tool over it a ground quiet
 *    enough to be seen against -- a line drawing on open food photography is
 *    invisible at any ink.
 *
 * The alt is empty on purpose. The dish is decorative here: it illustrates the
 * headline beside it rather than saying anything the headline does not, and it
 * is not a link to itself. `priority` because at `lg` this is the largest thing
 * above the fold and therefore the LCP element -- it is the one image on the
 * page worth pre-empting the network for.
 */
function HeroBowl({ photo }: { photo?: Photo }) {
  if (!photo) return null;

  return (
    <div className="hero-bowl">
      <Image
        src={photo.imageUrl}
        alt=""
        width={1400}
        height={1400}
        sizes="(max-width: 64rem) 100vw, 56vw"
        priority
        style={{ '--bowl-scale': BOWL_OVERSCALE } as CSSProperties}
        className="hero-bowl-img"
      />

      {/* What the photograph fades into at the curve, so the panel resolves
          into the brand rather than stopping on a hard edge.

          There was a drawn spoon and knife over the photograph here as well,
          and it is gone. The marginalia works in the margins because a margin
          is empty: a line drawing needs a quiet ground, and a photograph is
          the opposite of one. However the ink was tuned it read as a sticker
          left on the picture rather than as something drawn on the page, and
          `object-fit: cover` re-crops the photograph at every width, so the
          ground under it was never the same twice. The drawings belong where
          there is nothing else. */}
      <span className="hero-bowl-scrim" aria-hidden />

      {/* Definition only -- it draws nothing and takes no space. Kept next to
          the element that uses it so the two cannot be separated by a tidy-up.
          `objectBoundingBox` is what makes the clip responsive: the path is
          written in fractions of this panel, so it needs no breakpoints. */}
      <svg className="hero-bowl-defs" aria-hidden focusable="false">
        <clipPath id="hero-bowl-curve" clipPathUnits="objectBoundingBox">
          <path d={BOWL_CLIP} />
        </clipPath>
      </svg>
    </div>
  );
}

/**
 * The road the courier rides, drawn rather than borrowed.
 *
 * The hero used to end on its own bottom rule and let that stand in for a road.
 * It could not stay one once there was somewhere to ride *from* and *to*: a
 * section divider that is also the surface a scooter travels reads as a
 * scooter balanced on a border, and the two buildings now standing on it need
 * ground of their own rather than the edge of a box.
 *
 * `preserveAspectRatio="none"` because the road has to span whatever the
 * container is, and the hand-drawn wobble is the one thing that survives being
 * stretched -- a road is a road at any length. What does not survive it is the
 * stroke, which would come out squashed thin horizontally and fat vertically,
 * so every path carries `vectorEffect="non-scaling-stroke"` and keeps its
 * width in screen pixels no matter what the viewBox is doing around it. The
 * viewBox height is close to the height the band is actually drawn at, which
 * keeps the vertical scale near 1:1 and the wobble the amplitude it was drawn
 * with.
 *
 * Three lines and no more: the near edge the buildings and the courier stand
 * on, a broken centre line, and the far edge. Everything else that could go on
 * a road -- markings, kerbstones, tufts of grass -- is detail at a size where
 * there is no room for detail, and the strip is under three-quarters of an inch
 * tall on a phone.
 */
function RoadDoodle() {
  return (
    <svg
      className="scene-road"
      viewBox="0 0 1200 18"
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        {/* The near edge, and the line everything in the scene stands on -- so
            it is the heaviest of the three, the way the ground is.

            Every wobble is written as its own `Q` rather than chained with
            `T`. `T` mirrors the previous control point, which is fine for two
            or three but compounds over a dozen: a small unevenness early on
            grows into a lurch by the far end, and the arc that fixes it is
            nowhere near the arc that caused it. Spelling out each control
            point costs a line apiece and makes the amplitudes and the spacing
            adjustable where you can see them -- which is what keeps this
            looking drawn rather than plotted, because a wave of one amplitude
            at one wavelength is a sine, not a hand. */}
        <path
          d="M0 3.8 Q 58 2 122 3.6 Q 186 5.4 252 3.4 Q 314 1.8 378 3.9 Q 448 5.2 512 3.5 Q 572 2.1 642 3.3 Q 706 5.3 768 3.8 Q 832 2.2 898 3.5 Q 962 5 1028 3.6 Q 1092 2.1 1200 3.4"
          strokeWidth="1.75"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M10 9.4 Q 130 10.8 254 9.5 Q 380 8.3 508 9.7 Q 636 11 762 9.5 Q 886 8.2 1014 9.6 Q 1120 10.6 1190 9.5"
          strokeWidth="1.25"
          strokeDasharray="15 20"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M0 15.2 Q 66 17 134 15.5 Q 198 13.8 268 15.3 Q 336 17.1 404 15.6 Q 472 13.9 542 15.2 Q 610 16.9 678 15.5 Q 748 13.9 816 15.3 Q 884 17 952 15.4 Q 1024 13.8 1096 15.5 Q 1156 16.8 1200 15.3"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}

/**
 * What the courier rides through: a road across the whole page, a row of houses
 * at the far end of it, and the courier himself.
 *
 * Nothing here is wrapped in a container. The lane it goes into spans the
 * section edge to edge, so the road leaves by both sides of the page and the
 * houses sit hard against the right of it rather than on the content column's
 * grid line. That break from the column is the point -- the street is wider than
 * the page's text, which is what makes it read as somewhere the page is rather
 * than a picture the page contains.
 *
 * There is no longer a building on the left. The courier arrives from outside
 * the frame instead, which is both the older convention and the more honest one:
 * a delivery was already on its way before you looked at it.
 *
 * All server-rendered, and handed to `DeliveryRun` as a slot -- the client
 * component is only the ref and the class that starts the sequence, and only
 * because it has to wait until someone is looking at this strip.
 */
function DeliveryScene() {
  return (
    <>
      <RoadDoodle />
      <span className="scene-homes" />

      {/* One span per transform. The track is the ground he covers, the run
          carries him across it, the bob is the road under his wheels, and the
          courier himself takes the brake -- four elements because a single
          `transform` cannot hold three animations on three different clocks. */}
      <span className="courier-track">
        <span className="courier-run">
          <span className="courier-bob">
            <span className="courier" />
          </span>
        </span>
      </span>
    </>
  );
}

/** The three phrases, in the order they roll and in the order they read. */
const HEADLINE = ['One kitchen.', 'One menu a day.', 'For you.'] as const;

/**
 * The headline, and the one animated introduction on the site.
 *
 * Two layers over the same three phrases. The sentence is the real heading: it
 * sits in normal flow, it is what a screen reader announces, and no base rule
 * ever hides it -- the fade lives entirely in keyframes, so if animation never
 * runs the headline is just there. The roll on top is decorative and
 * `aria-hidden`; it is transparent until its own animation plays, so the
 * failure mode is a plain headline rather than a covered one.
 *
 * The sentence occupies its final height from the first paint, so the roll
 * costs no layout shift.
 */
function HeroHeadline() {
  return (
    <h1 className="hero-headline mx-auto max-w-3xl text-center text-[2.8125rem] leading-[1.06] font-semibold text-balance text-ink sm:text-6xl lg:mx-0 lg:max-w-none lg:text-left lg:text-[4.6875rem]">
      <span className="hero-roll" aria-hidden>
        <span className="hero-roll-window">
          <span className="hero-roll-track">
            {HEADLINE.map((phrase) => (
              <span key={phrase} className="hero-roll-word">
                {phrase}
              </span>
            ))}
          </span>
        </span>
      </span>

      {/* Fragments, not wrapper spans: the stagger is keyed off
          `.hero-part:nth-child(n)`, so each phrase has to stay a direct child
          of the sentence with only the joining space between. */}
      <span className="hero-sentence">
        {HEADLINE.map((phrase, index) => (
          <Fragment key={phrase}>
            {index > 0 ? ' ' : null}
            <span className="hero-part">{phrase}</span>
          </Fragment>
        ))}
      </span>
    </h1>
  );
}

/**
 * One of the two gateways out of the hero.
 *
 * A row: title and count on one line, the detail under it, the photograph
 * holding the right end, an arrow at the point of exit. It was a 288px panel
 * with the same five things stacked vertically, and the shape changed with the
 * position -- see the note beside the pair in `StorefrontHero`. Half a hero
 * column will not take a panel, and a row is what fits a measure like that
 * anyway; the two together cost about a third of what the band did, which is
 * the whole reason the hero now resolves without scrolling.
 *
 * What went in the trade is the "Explore" button, and it went deliberately
 * rather than for space. A row whose entire surface is the link does not need a
 * second thing inside it saying so, and a filled pill on a card this short
 * would be the loudest object in the hero -- louder than "start a plan today"
 * directly above it, which is the one action this surface is actually selling.
 * The arrow is the same promise at a weight that does not outrank the button it
 * sits under: brand-filled, so it still reads as the live end of the row, but
 * the size of a glyph rather than of a control.
 *
 * The right end is padding rather than a layout column -- `pr-24 sm:pr-36`,
 * paired with the photograph's own width. The picture is out of flow and
 * dissolves leftward into the card, so there is nothing for a flex track to
 * measure; reserving the space on the box is what keeps the type off the food.
 * Change one of the pair and change the other.
 *
 * The anchor and the card are two elements rather than one, and the split
 * is along the axis of what owns which transform. The anchor owns the
 * entrance, which is CSS and runs at first paint; the `TiltCard` inside it owns
 * the lean, which is spring-driven and runs on pointer input. One element
 * cannot hold both -- a keyframe and a motion value writing the same
 * `transform` means whichever wrote last wins, and the card would snap out of
 * its entrance the first time the pointer crossed it.
 */
function GatewayCard({
  href,
  title,
  subtitle,
  footnote,
  photo,
  enterAfter,
}: {
  href: Route;
  title: ReactNode;
  subtitle: string;
  footnote?: ReactNode;
  photo?: Photo;
  enterAfter: number;
}) {
  return (
    <Link
      href={href}
      style={enterAt(enterAfter)}
      className="hero-enter-lift group relative block rounded-ck-lg"
    >
      {/* The hover shadow, as an element that fades rather than as a shadow
          that transitions.

          `transition: box-shadow` is a paint animation: the browser re-renders
          a large blurred region on every frame of it, for the whole 300ms, on
          the surface that is also decoding two photographs and running a
          parallax. Opacity is composited -- the shadow is rasterised once and
          the GPU changes how much of it shows. Same picture, none of the work.

          It sits on the anchor rather than inside the card because the card
          clips its own overflow, and a shadow is drawn outside the box it
          belongs to. That has a second effect worth keeping: the shadow stays
          flat on the page while the card leans over it, which is what a card
          lifting off a surface actually does. */}
      <span
        aria-hidden
        className={cx(
          'pointer-events-none absolute inset-0 rounded-ck-lg opacity-0 shadow-ck',
          'transition-opacity duration-200 ease-ck',
          'group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-0',
        )}
      />

      <TiltCard
        className={cx(
          'relative isolate flex items-center gap-4 overflow-hidden rounded-ck-lg border border-line',
          // The resting shadow only. Everything the card does on hover, focus
          // and press now happens on the span above and on the spring in
          // `TiltCard` -- opacity and transform, both composited. This class
          // used to carry four shadow states and a `transition-shadow`.
          'bg-surface py-4 pr-24 pl-5 shadow-ck-sm',
          'sm:py-5 sm:pr-36 sm:pl-6',
        )}
      >
        <div className="min-w-0 flex-1">
          {/* The heading, and nothing beside it.

              There was a brand-tinted pill here -- "up to 5% off" on one card,
              "9 dishes today" on the other. Both were true and both were in
              the way. A pill is the loudest object its size in this system: a
              filled shape in the brand colour, set in bold capitals, sitting
              immediately to the right of the heading it is supposed to be
              subordinate to. Two of them, on the only two cards in the hero,
              meant the first thing the eye found in this column was a number
              nobody had asked for yet.

              The facts themselves did not need defending. The discount already
              has a whole strip across the top of the page whose only job is to
              carry it -- see `offer-bar.tsx` -- so the pill was the same claim
              made twice, sixty pixels apart, in the noisier of the two places.
              The dish count is genuinely interesting and genuinely not the
              headline: the card says "today's menu", and how many things are
              on it is what the menu itself is for.

              What is left is a heading, a line of description and a footnote:
              three registers, decreasing in weight, on a card whose job is to
              be a door rather than a summary. */}
          <h2 className="text-sm leading-tight font-semibold tracking-caps text-ink uppercase sm:text-base">
            {title}
          </h2>

          {/* Sentence case, and the one line on this card that changed shape
              rather than size. It was a second line of capitals under the
              first, and two lines of capitals do not make a hierarchy -- they
              make two headings, both shouting, and the eye has to read them to
              find out which one matters. Hierarchy is contrast: the title is
              set in capitals and this is not.

              The footnote joins it rather than taking a line of its own. It is
              the same register -- what the card is, then what it costs -- and
              on a row a third line is a third of the card's height for a
              clause. `truncate` is the guard for the narrowest phones, where
              the price is the half that survives being cut. */}
          <p className="mt-1.5 truncate text-xs text-muted sm:text-[0.8125rem]">
            {subtitle}
            {footnote ? <> &middot; {footnote}</> : null}
          </p>
        </div>

        <span
          className={cx(
            'relative grid size-9 shrink-0 place-items-center rounded-full border border-transparent',
            'bg-brand text-white transition-colors duration-150 ease-ck',
            'group-hover:bg-brand-hover group-active:bg-ink sm:size-10',
          )}
        >
          <DriftingArrow>
            {/* 200ms, not 300. A hover response should be finished while the
                visitor is still deciding whether to click; at the 300ms
                ceiling a 2px nudge is still arriving after the pointer has
                moved on. */}
            <ArrowRightIcon className="transition-transform duration-200 ease-ck group-hover:translate-x-0.5" />
          </DriftingArrow>
        </span>

        {photo ? (
          <DriftingPhoto>
            <Image
              src={photo.imageUrl}
              // Decorative. The card is already named by its heading, and reading a
              // dish name out inside a link to "Meal subscriptions" misleads.
              alt=""
              width={384}
              height={384}
              sizes="(max-width: 640px) 96px, 144px"
              // No `priority`, deliberately. These two are above the fold and
              // the instinct is to preload them -- but the bowl beside them is
              // the LCP candidate and already has it, and a second and third
              // preload on the same connection is how a page ends up racing
              // its own largest image. At 96 and 144 CSS pixels these are a
              // few kilobytes that arrive well inside the first screen anyway.
              // Hung past the row top and bottom rather than fitted to it, and
              // that overhang is load-bearing: the photograph drifts up to 10px
              // against the card's lean, and a picture flush with a 90px row has
              // nothing to give -- the drift would pull card background into
              // view along the top or bottom edge. On the old 288px panel the
              // rest scale covered it; on a row it cannot, so the cover is a
              // fixed 20px either side instead of a percentage of a height that
              // is now too small to spare one.
              style={{ maskImage: ROW_FADE, WebkitMaskImage: ROW_FADE }}
              className="absolute -inset-y-5 right-0 w-24 object-cover sm:w-36"
            />
          </DriftingPhoto>
        ) : null}
      </TiltCard>
    </Link>
  );
}
