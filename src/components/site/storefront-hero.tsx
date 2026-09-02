import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { DeliveryWindow, PlanSummary, ProductCard, PublicOffer } from '@/lib/data/catalog';
import { clockTime, money, pluralise } from '@/lib/format';
import { buttonClasses, cx } from '@/components/ui/button-styles';
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
 * full-width action, two gateway cards -- because that is the shape a customer
 * in this market already knows how to read. What sat in that slot before was a
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

/** A product we can actually show a photograph of. */
type Photo = ProductCard & { imageUrl: string };

/** Dissolves a card photo outward from the corner it is anchored in. */
const CORNER_FADE = 'radial-gradient(115% 115% at 100% 100%, #000 42%, transparent 74%)';

/**
 * The entrance running order, in milliseconds.
 *
 * One list, in the order the eye should pick things up, so the choreography can
 * be read and retimed in one place rather than inferred from four `style`
 * attributes scattered through the markup. The whole thing is over inside a
 * second and a half, under a headline that keeps rolling until ~3.15s -- see
 * the note above `.hero-enter` in `globals.css` for why the two are not
 * chained together.
 *
 * The delivery windows used to be the last entry here and are not any more.
 * They are no longer part of the page's arrival at all: they are handed over by
 * the courier as he passes, on his clock rather than the load's -- see
 * `passAt` and the note over `.delivery-window` in `globals.css`.
 */
const ENTER = {
  subtitle: 140,
  cta: 260,
  primaryCard: 380,
  secondaryCard: 480,
} as const;

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

function withPhotos(menu: ProductCard[]): Photo[] {
  return menu.filter(
    (product): product is Photo => Boolean(product.imageUrl) && product.isAvailable,
  );
}

/** The offer worth leading with: the deepest percentage, else the first one. */
function headlineOffer(offers: PublicOffer[]): PublicOffer | null {
  const percent = offers
    .filter((offer) => offer.discountType === 'percent')
    .sort((a, b) => Number(b.discountValue) - Number(a.discountValue));

  return percent[0] ?? offers[0] ?? null;
}

function offerLabel(offer: PublicOffer): string | null {
  const value = Number(offer.discountValue);
  if (!Number.isFinite(value) || value <= 0) return null;

  return offer.discountType === 'percent'
    ? `Up to ${Math.round(value)}% off`
    : `${money(value)} off`;
}

export function StorefrontHero({
  plans,
  menu,
  offers,
  windows,
}: {
  plans: PlanSummary[];
  menu: ProductCard[];
  offers: PublicOffer[];
  windows: DeliveryWindow[];
}) {
  const photos = withPhotos(menu);
  const available = menu.filter((product) => product.isAvailable);
  const vegetarian = available.filter((product) => product.isVegetarian);

  const cheapest = plans.reduce<PlanSummary | null>(
    (best, plan) => (!best || Number(plan.price) < Number(best.price) ? plan : best),
    null,
  );

  const offer = headlineOffer(offers);
  const offerPill = offer ? offerLabel(offer) : null;

  return (
    <HeroStage className="storefront-hero border-b border-line bg-sunken">
      {/* The bottom padding is what sets the gap between the delivery windows
          and the road, and it is the only thing that can: the lane is out of
          flow and anchored to the section's bottom edge, so margin on the
          windows pushes the section taller and takes the lane down with it,
          leaving the gap exactly where it was. Less padding is the windows
          sitting lower in the scene.

          It is trimmed to just clear the rooftops rather than to look
          comfortable. The houses are the tallest thing in the lane and they
          reach its very top, so this cannot go below the lane's own height
          without the third window landing on a roof -- the row is centred and
          the houses are hard right, and at around 1280px those two overlap.
          It steps at the breakpoints the scene does, because what it is
          clearing is the houses' height. */}
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-32 sm:pt-20 sm:pb-40 lg:pt-24 lg:pb-52">
        {/* The three scroll planes, in depth order. The copy is nearest, so it
            leaves fastest and gives up the most opacity; the cards sit behind
            it and hold on longer, because they are still the actions and a
            visitor scrolling back up should find them where they left them.
            The differences between the depths are the parallax -- see
            `HeroLayer`. */}
        <HeroLayer depth={1.15} fade={0.55}>
          <HeroHeadline />

          <p
            style={enterAt(ENTER.subtitle)}
            className="hero-enter mx-auto mt-5 max-w-xl text-center text-base text-pretty text-muted sm:text-lg"
          >
            Not a marketplace with ten thousand dishes. A small menu cooked each morning and
            delivered on a schedule you set.
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
          </Link>
        </HeroLayer>

        {/* Two up only from lg. Between 640px and 1024px a two-column split
            makes each card narrower than its own photograph needs, and the
            heading ends up sitting on the food. */}
        <HeroLayer depth={0.5} fade={0.12} className="mt-10 sm:mt-12">
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <GatewayCard
              href="/subscriptions"
              title="Meal subscriptions"
              subtitle="Cooked to your schedule"
              pill={offerPill ?? (plans.length ? pluralise(plans.length, 'plan') : null)}
              footnote={
                cheapest
                  ? `From ${money(cheapest.price)} for ${cheapest.billingPeriodDays} days`
                  : null
              }
              photo={photos[0]}
              enterAfter={ENTER.primaryCard}
              priority
            />

            <GatewayCard
              href="/menu"
              title="Today&rsquo;s menu"
              subtitle="What the kitchen is cooking"
              pill={
                available.length ? `${pluralise(available.length, 'dish', 'dishes')} today` : null
              }
              footnote={vegetarian.length ? `${vegetarian.length} of them vegetarian` : null}
              photo={photos[1] ?? photos[0]}
              enterAfter={ENTER.secondaryCard}
            />
          </div>
        </HeroLayer>

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
    <h1 className="hero-headline mx-auto max-w-3xl text-center text-4xl leading-[1.08] font-semibold text-balance text-ink sm:text-5xl lg:max-w-5xl lg:text-6xl">
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
 * The whole card is the link, so "Explore" is a styled span rather than a
 * button -- a button inside an anchor is invalid, and a second tab stop for the
 * same destination is noise. It borrows `buttonClasses` so it cannot drift away
 * from a real button.
 *
 * The anchor and the card are now two elements rather than one, and the split
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
  pill,
  footnote,
  photo,
  enterAfter,
  priority = false,
}: {
  href: Route;
  title: ReactNode;
  subtitle: string;
  pill?: ReactNode;
  footnote?: ReactNode;
  photo?: Photo;
  enterAfter: number;
  priority?: boolean;
}) {
  return (
    <Link
      href={href}
      style={enterAt(enterAfter)}
      className="hero-enter-lift group block rounded-ck-lg"
    >
      <TiltCard
        className={cx(
          'relative isolate flex min-h-56 flex-col overflow-hidden rounded-ck-lg border border-line',
          'bg-surface p-6 shadow-ck-sm transition-shadow duration-300 ease-ck',
          'group-hover:shadow-ck group-focus-visible:shadow-ck',
          // The fourth state. Hover says the card can be pressed and focus says
          // it can be reached, but until this rule there was nothing between
          // deciding to click and arriving on the next page -- the one moment
          // the visitor is actually asking the card whether it heard them. It
          // drops back below its resting shadow, so the card presses into the
          // page rather than off it. Ordered after the hover rule on purpose:
          // a pressed card is also a hovered one, and the later of two equally
          // specific rules is the one that wins.
          'group-active:shadow-ck-sm',
          'sm:min-h-72 sm:p-8',
        )}
      >
        <h2 className="max-w-[52%] text-lg font-semibold tracking-caps text-ink uppercase sm:text-2xl">
          {title}
        </h2>
        {/* Sentence case, and the one line on this card that changed shape
            rather than size. It was a second line of capitals under the first,
            and two lines of capitals do not make a hierarchy -- they make two
            headings, both shouting, and the eye has to read them to find out
            which one matters. Hierarchy is contrast: the title is large, heavy
            and set in capitals, so the line explaining it should be none of
            those things. Nothing about the size changed; it just stopped
            competing. */}
        <p className="mt-1.5 max-w-[52%] text-sm text-muted sm:text-base">{subtitle}</p>

        {pill ? (
          <span className="mt-4 w-fit rounded-full bg-brand-soft px-3 py-1 text-xs font-bold tracking-wide text-brand uppercase">
            {pill}
          </span>
        ) : null}

        <div className="mt-auto pt-8">
          {footnote ? (
            <p className="mb-3 max-w-[52%] text-xs font-medium text-muted">{footnote}</p>
          ) : null}
          <span className={buttonClasses('primary', 'md', 'pointer-events-none w-fit')}>
            Explore
            <DriftingArrow>
              <ArrowRightIcon className="transition-transform duration-300 ease-ck group-hover:translate-x-1" />
            </DriftingArrow>
          </span>
        </div>

        {photo ? (
          <DriftingPhoto>
            <Image
              src={photo.imageUrl}
              // Decorative. The card is already named by its heading, and reading a
              // dish name out inside a link to "Meal subscriptions" misleads.
              alt=""
              width={384}
              height={384}
              sizes="(max-width: 640px) 144px, 208px"
              priority={priority}
              // Anchored in the corner and dissolved toward the card's interior, so
              // the photograph reads as part of the card rather than a pasted-on
              // thumbnail -- and so the corner nearest the copy is already gone.
              style={{ maskImage: CORNER_FADE, WebkitMaskImage: CORNER_FADE }}
              className="absolute right-0 bottom-0 size-36 object-cover sm:size-48 lg:size-52"
            />
          </DriftingPhoto>
        ) : null}
      </TiltCard>
    </Link>
  );
}
