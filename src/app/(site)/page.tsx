import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { listPlans, listMenu, listPublicOffers, listDeliveryWindows } from '@/lib/data/catalog';
import { money, PLAN_TYPE_LABELS } from '@/lib/format';
import { ButtonLink, Card } from '@/components/ui/primitives';
import { StorefrontHero } from '@/components/site/storefront-hero';
import { Reveal } from '@/components/site/reveal';
import { StepFlow, Typewriter } from '@/components/site/step-flow';

export const metadata = {
  title: 'Home-style meals, on subscription',
};

/**
 * The four steps of a subscription, in order.
 *
 * Lifted out of the markup because `StepFlow` is a client component and this is
 * the data it renders: keeping the copy here means it is still authored and
 * reviewed alongside the rest of the page, and it crosses to the client as
 * plain strings.
 */
/**
 * Where each plan note is pinned: how far off square, and how far up or down.
 *
 * A composition rather than a pattern, which is why it is a table here and not
 * an `nth-child` rule in the stylesheet -- the four are chosen against each
 * other. No two neighbours lean the same way, the middle pair lean apart so the
 * row does not read as drifting in one direction, and each note's lift runs
 * against its own tilt so the two irregularities do not compound into one note
 * that is obviously the odd one out.
 *
 * `tilt` stays under two degrees. Real notes are crooked by about that much;
 * past four or five the row turns into a novelty and the text becomes work.
 *
 * `lift` is the part that replaced letting the notes be different heights. All
 * four are one size now -- a note that is longer because its title wrapped
 * looks broken, not hand-placed -- so the hand shows in where they sit on the
 * page instead. Under 10px, which is enough to break the baseline they would
 * otherwise share and not enough to look like a layout fault.
 */
const NOTE_PLACEMENT = [
  { tilt: '-1.6deg', lift: '0px' },
  { tilt: '1.1deg', lift: '-9px' },
  { tilt: '-0.7deg', lift: '6px' },
  { tilt: '1.8deg', lift: '-4px' },
] as const;

const SUBSCRIPTION_STEPS = [
  {
    title: 'Pick a plan',
    body: 'A fixed menu, a pool you choose from, or a bank of credits you spend when you like.',
  },
  {
    title: 'Set your schedule',
    body: 'Choose your delivery window and the days you want food. Change it later.',
  },
  {
    title: 'We cook to that plan',
    body: 'Your meals enter the kitchen queue shortly before your window opens — not days early.',
  },
  {
    title: 'Skip or pause freely',
    body: 'Skipping returns the entitlement to your balance. Travelling? Pause the plan.',
  },
];

export default async function HomePage() {
  const [plans, menu, offers, windows] = await Promise.all([
    listPlans(),
    listMenu(),
    listPublicOffers(),
    listDeliveryWindows(),
  ]);

  const featured = menu.filter((product) => product.isAvailable).slice(0, 3);

  return (
    <>
      <StorefrontHero plans={plans} menu={menu} offers={offers} windows={windows} />

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-20 sm:py-24">
        {/* A wider container than the steps below it, which is the whole
            break-out: on a large screen the heading starts a good way left of
            the grid everything else sits on, and as the viewport narrows the
            two containers converge on the same padding and the offset closes
            itself. See the note over `.section-display` in `globals.css` for
            why this is not a negative margin. */}
        <div className="mx-auto max-w-[96rem] px-4 sm:px-8">
          <h2 className="section-display max-w-4xl font-semibold text-balance">
            <Typewriter text="How a subscription works" />
          </h2>
        </div>

        <div className="mx-auto max-w-6xl px-4">
          <StepFlow steps={SUBSCRIPTION_STEPS} />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Plans                                                             */}
      {/* ---------------------------------------------------------------- */}
      {/* `overflow-hidden` because the calendar is tilted and sits past the
          content edge: the clip has to be scoped to this band so a rotated
          corner can never reach the document and add a horizontal scrollbar. */}
      <section className="paper-grid overflow-hidden border-y border-line bg-surface">
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-24">
          {/* Both are decoration, and `aria-hidden` accordingly -- the heading
              between them already says these are subscription plans. The
              artwork is shown exactly as drawn, tilt and red day included; the
              stylesheet places it and says when it arrives, and does nothing to
              the picture. `sizes` is the rendered width rather than the source
              width, so a 1426px original is not shipped to draw 240 of them. */}
          <Reveal className="calendar-mark" amount={0.4} aria-hidden>
            <Image
              src="/calendar.png"
              alt=""
              width={1426}
              height={1164}
              sizes="240px"
              className="h-auto w-full"
            />
          </Reveal>

          <Reveal className="chef-mark" amount={0.4} aria-hidden>
            <Image
              src="/cheff.png"
              alt=""
              width={886}
              height={1444}
              sizes="120px"
              className="h-auto w-full"
            />
          </Reveal>

          {/* Centred, where the section above it pushes its heading off the
              grid to the left. The two are a pair: a page of headings that all
              start on the same left edge is the boxiness, and alternating the
              axis is what gives the scroll somewhere to go. Centring it also
              clears the left of this band, which is where the calendar sits. */}
          <Reveal className="reveal-up text-center">
            {/* Lower case, and written that way rather than transformed: a
                heading whose accessible name is "Plans we offer" while the page
                reads "plans we offer" is two different headings, and the one
                the screen reader gets should be the one that is there. */}
            <h2 className="section-display font-semibold text-balance">plans we offer</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted text-pretty">
              Every plan is prepaid for one cycle. Cancel anytime.
            </p>

            {/* A real button rather than a text link, and no arrow on it --
                the shape already says it is something to press, and a glyph
                repeating that is the arrow in the step gutters all over again.
                `.btn-plain` squares the corners and makes the hover a fill;
                everything else still comes from `buttonClasses`. */}
            <ButtonLink
              href="/subscriptions"
              variant="outline"
              size="sm"
              className="btn-plain mt-6"
            >
              compare all plans
            </ButtonLink>
          </Reveal>

          {plans.length === 0 ? (
            <p className="mt-10 text-center text-sm text-muted">
              No plans are published yet. Check back shortly.
            </p>
          ) : (
            /* A beat behind the heading, so the section introduces itself and
               then shows its work, rather than both landing in one move. */
            /* `gap-6` rather than `gap-4`, because the notes are tilted and
               the gutter has to clear the corner that swings out as well as the
               edge that does not.

               The grid stretches all four to a single height, which is a
               reversal: the previous pass let each note be as tall as what was
               written on it, and the result was one note visibly longer than
               its neighbours because "Build Your Own Lunch" wraps to two lines
               and the others do not. That reads as a bug, not as charm -- the
               unevenness has to come from how the notes are *placed*, not from
               how much text each happens to carry. So they are one size, and
               `--note-lift` scatters them instead. */
            <Reveal
              className="reveal-up mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
              delay={140}
            >
              {plans.slice(0, 4).map((plan, index) => (
                <div
                  key={plan.id}
                  className="sticky-note"
                  style={
                    {
                      '--note-tilt': NOTE_PLACEMENT[index % NOTE_PLACEMENT.length].tilt,
                      '--note-lift': NOTE_PLACEMENT[index % NOTE_PLACEMENT.length].lift,
                    } as CSSProperties
                  }
                >
                  <p className="note-kind">{PLAN_TYPE_LABELS[plan.planType] ?? plan.planType}</p>
                  <h3 className="note-title mt-3 text-pretty">{plan.name}</h3>
                  <p className="note-body mt-2 text-pretty">{plan.tagline}</p>

                  {/* One line, not two. The amount and what it buys are a
                      single fact and were being written as a number with a
                      caption under it, which made the note four separate
                      things instead of three. The rule above replaces the gap
                      that used to separate them -- on a note this small, a gap
                      big enough to read as a division reads as a mistake, and
                      paper has lines on it anyway. */}
                  <p className="note-price pt-4">
                    <span className="tabular">{money(plan.price)}</span>
                    <span className="note-meta">per {plan.billingPeriodDays} days</span>
                  </p>

                  {/* Its own line, and only when it is true. It was tacked onto
                      the period as ", renews automatically", which buried the
                      one fact on this note somebody might want to have noticed
                      before paying. */}
                  {plan.paymentFlow === 'recurring' ? (
                    <p className="note-meta mt-2">renews automatically</p>
                  ) : null}

                  {/* `self-start`, so it is the width of its label. A
                      full-width button is a form control, and four of them
                      lined up across the row were the last thing making these
                      read as cards. */}
                  <ButtonLink
                    href={`/subscriptions/${plan.slug}`}
                    variant="outline"
                    size="sm"
                    className="btn-plain mt-6 self-start"
                  >
                    view plan
                  </ButtonLink>
                </div>
              ))}
            </Reveal>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Menu preview                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">What we cook</h2>
            <p className="mt-1 text-muted">
              The menu is for browsing — meals are ordered through a subscription.
            </p>
          </div>
          <Link href="/menu" className="text-sm font-medium text-brand hover:underline">
            See the full menu →
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((product) => (
            <Card key={product.id} className="flex gap-4 p-4">
              {product.imageUrl ? (
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-ck bg-sunken">
                  <Image
                    src={product.imageUrl}
                    alt={product.imageAlt}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                <h3 className="font-medium">{product.name}</h3>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                  {product.shortDescription}
                </p>
                <p className="mt-1 text-sm font-medium tabular">{money(product.basePrice)}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
