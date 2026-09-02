import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { DeliveryWindow, PlanSummary, ProductCard, PublicOffer } from '@/lib/data/catalog';
import { clockTime, money, pluralise } from '@/lib/format';
import { buttonClasses, cx } from '@/components/ui/button-styles';
import { ArrowRightIcon } from './icons';
import { MenuSearch } from './menu-search';
import { Courier, DriftingArrow, DriftingPhoto, HeroLayer, HeroStage, TiltCard } from './hero-motion';

/**
 * The storefront hero.
 *
 * The composition follows the large Indian delivery apps -- headline, one
 * search field, two gateway cards -- because that is the shape a customer in
 * this market already knows how to read. The treatment does not: a barely
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
 * be read and retimed in one place rather than inferred from five `style`
 * attributes scattered through the markup. The whole thing is over inside a
 * second and a half, under a headline that keeps rolling until ~3.15s -- see
 * the note above `.hero-enter` in `globals.css` for why the two are not
 * chained together.
 */
const ENTER = {
  subtitle: 140,
  search: 260,
  primaryCard: 380,
  secondaryCard: 480,
  windows: 620,
} as const;

/** The custom property `.hero-enter` reads its delay from. */
function enterAt(ms: number): CSSProperties {
  return { '--enter-at': `${ms}ms` } as CSSProperties;
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
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-20 sm:pt-20 lg:pt-24 lg:pb-24">
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

          <MenuSearch
            tone="hero"
            style={enterAt(ENTER.search)}
            className="hero-enter mx-auto mt-8 max-w-2xl sm:mt-10"
          />
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

        {windows.length ? (
          <HeroLayer depth={0.28} fade={0.3} className="mt-12">
            <dl
              style={enterAt(ENTER.windows)}
              className="hero-enter flex flex-wrap justify-center gap-x-10 gap-y-3 border-t border-line pt-6"
            >
              {windows.map((window) => (
                <div key={window.id} className="flex items-baseline gap-2">
                  <dt className="text-sm font-semibold text-ink">{window.label}</dt>
                  <dd className="text-sm tabular text-muted">
                    {clockTime(window.starts_at)} &ndash; {clockTime(window.ends_at)}
                  </dd>
                </div>
              ))}
            </dl>
          </HeroLayer>
        ) : null}
      </div>

      <DeliveryCourier />
    </HeroStage>
  );
}

/**
 * The courier who turns up once the introduction is over.
 *
 * Decoration, and `aria-hidden` accordingly -- the delivery windows directly
 * above him already say in words what he says in a picture, and a screen reader
 * announcing a scooter here would be repeating them. He is positioned out of
 * flow against the section, so the hero measures exactly the same with him as
 * without: nothing above him moves, at any width, whether or not he ever rides.
 *
 * The lane is a separate element because something has to clip the run-up, and
 * that something must not be the section -- an `overflow` on the section would
 * reach the search field's focus ring.
 *
 * He parks on the container's right edge rather than at some fraction of it, so
 * he lines up with the gateway card standing directly above him. It is the same
 * grid line, which is the difference between an illustration that was placed
 * and one that was dropped.
 *
 * Deliberately outside every `HeroLayer`, so he does not drift on scroll like
 * the rest of the hero does. The lane is absolutely positioned against the
 * section, and a `HeroLayer` transforms -- a transformed ancestor becomes the
 * containing block for absolutely positioned descendants, so wrapping him would
 * re-anchor the lane to a zero-height div and drop him out of the hero
 * entirely. He is also the one element here that already has a scripted arrival
 * of his own to finish.
 *
 * The lane is server-rendered; only the courier inside it is a client
 * component, and only because his ride has to wait until someone is looking at
 * this strip -- see `Courier` in `hero-motion.tsx`.
 */
function DeliveryCourier() {
  return (
    <div className="courier-lane" aria-hidden>
      <div className="mx-auto flex max-w-6xl justify-end px-4">
        <Courier />
      </div>
    </div>
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
