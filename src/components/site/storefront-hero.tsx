import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { Fragment, type ReactNode } from 'react';
import type { DeliveryWindow, PlanSummary, ProductCard, PublicOffer } from '@/lib/data/catalog';
import { clockTime, money, pluralise } from '@/lib/format';
import { buttonClasses, cx } from '@/components/ui/button-styles';
import { ArrowRightIcon } from './icons';
import { MenuSearch } from './menu-search';

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
 */

/** A product we can actually show a photograph of. */
type Photo = ProductCard & { imageUrl: string };

/** Dissolves a card photo outward from the corner it is anchored in. */
const CORNER_FADE = 'radial-gradient(115% 115% at 100% 100%, #000 42%, transparent 74%)';

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
    <section className="border-b border-line bg-sunken">
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:pt-20 lg:pt-24 lg:pb-20">
        <HeroHeadline />

        <p className="mx-auto mt-5 max-w-xl text-center text-base text-pretty text-muted sm:text-lg">
          Not a marketplace with ten thousand dishes. A small menu cooked each morning and
          delivered on a schedule you set.
        </p>

        <MenuSearch tone="hero" className="mx-auto mt-8 max-w-2xl sm:mt-10" />

        {/* Two up only from lg. Between 640px and 1024px a two-column split
            makes each card narrower than its own photograph needs, and the
            heading ends up sitting on the food. */}
        <div className="mt-10 grid gap-4 sm:mt-12 sm:gap-5 lg:grid-cols-2">
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
            priority
          />

          <GatewayCard
            href="/menu"
            title="Today&rsquo;s menu"
            subtitle="What the kitchen is cooking"
            pill={available.length ? `${pluralise(available.length, 'dish', 'dishes')} today` : null}
            footnote={vegetarian.length ? `${vegetarian.length} of them vegetarian` : null}
            photo={photos[1] ?? photos[0]}
          />
        </div>

        {windows.length ? (
          <dl className="mt-12 flex flex-wrap justify-center gap-x-10 gap-y-3 border-t border-line pt-6">
            {windows.map((window) => (
              <div key={window.id} className="flex items-baseline gap-2">
                <dt className="text-sm font-semibold text-ink">{window.label}</dt>
                <dd className="text-sm tabular text-muted">
                  {clockTime(window.starts_at)} &ndash; {clockTime(window.ends_at)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
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
 */
function GatewayCard({
  href,
  title,
  subtitle,
  pill,
  footnote,
  photo,
  priority = false,
}: {
  href: Route;
  title: ReactNode;
  subtitle: string;
  pill?: ReactNode;
  footnote?: ReactNode;
  photo?: Photo;
  priority?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        'group relative isolate flex min-h-56 flex-col overflow-hidden rounded-ck-lg border border-line',
        'bg-surface p-6 shadow-ck-sm transition-[transform,box-shadow] duration-200 ease-ck',
        'hover:-translate-y-1 hover:shadow-ck sm:min-h-72 sm:p-8',
      )}
    >
      <h2 className="max-w-[52%] text-lg font-semibold tracking-tight text-ink uppercase sm:text-2xl">
        {title}
      </h2>
      <p className="mt-1 max-w-[52%] text-xs font-semibold tracking-wide text-muted uppercase sm:text-sm">
        {subtitle}
      </p>

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
          <ArrowRightIcon className="transition-transform duration-200 ease-ck group-hover:translate-x-1" />
        </span>
      </div>

      {photo ? (
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
          className={cx(
            'pointer-events-none absolute right-0 bottom-0 -z-10 size-36 object-cover sm:size-48',
            'transition-transform duration-300 ease-ck group-hover:scale-105 lg:size-52',
          )}
        />
      ) : null}
    </Link>
  );
}
