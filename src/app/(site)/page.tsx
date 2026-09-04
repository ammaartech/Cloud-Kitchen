import Image from 'next/image';
import type { CSSProperties } from 'react';
import {
  byPriceAscending,
  listPlans,
  listMenu,
  listDeliveryWindows,
} from '@/lib/data/catalog';
import { money, PLAN_TYPE_LABELS } from '@/lib/format';
import { ButtonLink } from '@/components/ui/primitives';
import { ProductTile } from '@/components/product-card';
import { withPhotos } from '@/components/site/photos';
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
    body: 'A fixed menu, a pool, or credits.',
    icon: 'choice',
  },
  {
    title: 'Set your schedule',
    body: 'Your window, your days. Change anytime.',
    icon: 'calendar',
  },
  {
    title: 'We cook to that plan',
    body: 'Cooked just before your window — never days early.',
    icon: 'pot',
  },
  {
    title: 'Skip or pause freely',
    body: 'Skips return to your balance. Pause anytime.',
    icon: 'pause',
  },
] as const;

export default async function HomePage() {
  const [plans, menu, windows] = await Promise.all([
    listPlans(),
    listMenu(),
    listDeliveryWindows(),
  ]);

  /* What the kitchen is actually cooking, which is what the menu section shows.
     The hero derives the same thing for its dish count; this is the second
     reader rather than a duplicate, and it stays here because the section that
     needs it is here. */
  const available = menu.filter((product) => product.isAvailable);

  /* The photographs the hero has not already spent. It takes the first three --
     one for the bowl panel and one for each gateway card -- so this starts at
     the fourth and the page never shows the same plate twice.

     Up to three, and however many of those exist. The arrangement below is
     sized by flex rather than by a fixed column count, so two photographs make
     a slightly wider pair and one makes a single tall frame; none of the three
     cases needs its own layout. Where the kitchen has published nothing past
     the hero's three, the section renders the copy alone rather than a gap
     where a picture should be. */
  const aboutPhotos = withPhotos(menu).slice(3, 6);

  return (
    <>
      <StorefrontHero plans={plans} menu={menu} windows={windows} />

      {/* ---------------------------------------------------------------- */}
      {/* Plans                                                             */}
      {/* ---------------------------------------------------------------- */}
      {/* `overflow-hidden` because the calendar is tilted and sits past the
          content edge: the clip has to be scoped to this band so a rotated
          corner can never reach the document and add a horizontal scrollbar. */}
      <section
        id="plans"
        /* `border-b`, not `border-y`. This band sits directly under the hero
           now, and the hero already closes on a `border-b` -- keeping the top
           rule here stacks two hairlines into one 2px line, which is the sort
           of seam that reads as a rendering fault rather than as a divider. */
        className="section-anchor paper-grid overflow-hidden border-b border-line bg-surface"
      >
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
            /* No entrance. The notes used to rise and fade in a beat behind
               the heading, and it was the wrong idea for this object: paper
               pinned to a board does not arrive, it is already up there, and
               four of them lifting into place turned a wall into a slideshow.
               The heading above still reveals -- a heading is a thing being
               said -- but what it introduces is simply present, which is what
               makes the tilts and the scattered lift read as a hand having
               placed them rather than as choreography.

               So this is a plain `div` rather than a `Reveal`: with nothing to
               add `is-revealed`, `reveal-up` cannot fire, and dropping the
               wrapper takes the observer with it instead of leaving one running
               to set a class nothing reads. */
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
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* Sorted before it is sliced, not after, and the difference
                  matters more than it looks. Sorting the first four by price
                  would put a tidy ascending row on the page that is not the
                  cheapest four -- and a reader who can see 3,999 through 5,299
                  in order will take that for the range on offer. If a 2,999
                  plan existed and sat fifth in `sort_order`, this row would be
                  quietly telling them something untrue. Cheapest first,
                  cheapest four, and "compare all plans" above it for the
                  rest. */}
              {byPriceAscending(plans).slice(0, 4).map((plan, index) => (
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
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section id="how-it-works" className="section-anchor texture-dots py-20 sm:py-24">
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
      {/* Menu                                                              */}
      {/* ---------------------------------------------------------------- */}
      {/* Six dishes, not the whole catalogue. The job of a section on a
          one-page site is to answer the question its nav item raises -- "what
          do they actually cook?" -- well enough that the visitor can decide
          whether to go further. The full grid, with its search and its category
          headings, is still a page, and this links to it.

          `available` rather than every published dish: a preview leading with
          something the kitchen is not cooking today is a worse preview than a
          shorter one. */}
      <section id="menu" className="section-anchor border-b border-line py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal className="reveal-up">
            <h2 className="section-display font-semibold text-balance">what we cook</h2>
            <p className="mt-4 max-w-xl text-muted text-pretty">
              A small menu, cooked fresh each morning. This is what is on it today &mdash;
              meals are ordered through a subscription rather than one at a time.
            </p>
          </Reveal>

          {available.length === 0 ? (
            <p className="mt-10 text-sm text-muted">
              Nothing is published for today yet. Check back shortly.
            </p>
          ) : (
            <Reveal className="reveal-up mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" delay={140}>
              {available.slice(0, 6).map((product) => (
                <ProductTile key={product.id} product={product} />
              ))}
            </Reveal>
          )}

          <Reveal className="reveal-up mt-10" delay={220}>
            <ButtonLink href="/menu" variant="outline" size="sm" className="btn-plain">
              see the full menu
            </ButtonLink>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* About                                                             */}
      {/* ---------------------------------------------------------------- */}
      {/* The page's closing statement, and the two paragraphs of `/about` that
          are the argument rather than the policy. How we handle your food and
          how we handle your data are both on that page, and neither is a
          closing note for a front page. */}
      <section id="about" className="section-anchor bg-sunken py-20 sm:py-28">
        {/* No `max-w-6xl`, and that is the point rather than an omission.

            Every other band on this page is built inside the same 72rem column,
            which is what makes the page feel like one document -- and it is
            also what was stopping this band from doing the one thing it is for.
            The column puts its left edge 384px in from the window on a wide
            screen, so "hard left" inside it was still the middle third of the
            page. Breaking out lets the words start where the page starts and
            hands the three or four hundred pixels the column was reserving to
            the food, which is what buys the third photograph.

            The padding is the page's own margin rather than the column's: 4rem
            at the top end, which is enough that the type never touches the
            window and little enough that it still reads as the edge. */}
        <div className="px-6 sm:px-10 lg:px-16">
          {/* Copy hard left, pictures across the middle and the right.

              It was a `max-w-3xl` block centred in the page, which is the safe
              arrangement and the reason the section read as a page of notes
              rather than as part of this one: every other band here is built on
              an axis -- the hero's copy against its photograph, the steps
              across their row -- and a centred column of prose has no axis at
              all. Pinning the words to the left edge gives the section the same
              spine as the hero four bands above it, and hands the two thirds it
              was wasting to the food.

              The measure comes out of it for free. Prose is readable to about
              70 characters and the old block ran to nearly 100; the left column
              is sized to the text rather than to the page, so the line length
              improved as a consequence of the layout rather than needing a
              second decision. */}
          <div className="about-split">
            <Reveal className="reveal-up about-copy">
              <h2 className="section-display font-semibold text-balance">one kitchen</h2>

              <div className="mt-6 space-y-5 text-muted text-pretty">
                <p>
                  We are a single kitchen serving a single neighbourhood. Not a chain, not a
                  franchise, not a marketplace listing a thousand dishes it does not cook.
                </p>
                <p>
                  That constraint is deliberate. A small menu means we buy fresh for the day,
                  cook in batches that finish, and know exactly how many portions are going
                  out. It is also why we sell subscriptions rather than one-off orders
                  &mdash; knowing what the day looks like before it starts is what keeps the
                  food good.
                </p>
              </div>

              <ButtonLink href="/about" variant="outline" size="sm" className="btn-plain mt-8">
                more about us
              </ButtonLink>
            </Reveal>

            {/* Real dishes from the catalogue rather than stock photography or
                a placeholder, which is what makes the space worth reserving:
                the section claims the kitchen cooks a small menu fresh, and the
                two pictures beside that claim are two things it is cooking.

                A beat behind the copy, and the second picture a beat behind the
                first -- so the pair arrives as a pair rather than as one wide
                object. `--shot-at` is the offset each one reads its delay from.

                `aria-hidden`: the sentence to the left is the content and these
                illustrate it. A screen reader announcing two dish names in the
                middle of an argument about how the kitchen works is reading out
                the furniture. */}
            {aboutPhotos.length > 0 ? (
              <Reveal className="reveal-up about-art" delay={140} aria-hidden>
                {aboutPhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="about-shot"
                    style={{ '--shot-at': `${index * 90}ms` } as CSSProperties}
                  >
                    <Image
                      src={photo.imageUrl}
                      alt=""
                      width={800}
                      height={1000}
                      sizes="(max-width: 64rem) 50vw, 20rem"
                      className="about-shot-img"
                    />
                  </div>
                ))}
              </Reveal>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
