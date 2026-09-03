import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import type { ProductCard } from '@/lib/data/catalog';
import { withPhotos, type Photo } from './photos';
import { Reveal } from './reveal';
import { ArrowRightIcon } from './icons';

/**
 * Who the kitchen cooks for, and why.
 *
 * This slot used to hold three dishes lifted off the menu under the heading
 * "What we cook" -- a preview of a page the header already links to, closing
 * the home page on a smaller version of something the visitor could go and
 * read in full. The last thing a page says should be the thing it most wants
 * remembered, and a card grid of three dishes was not it.
 *
 * It says who the food is for instead. Two audiences, named plainly: the
 * working professional eating at a desk and the student eating in a hostel.
 * Both are the same product; what differs is the day the food arrives into,
 * which is the only reason to split the statement in two rather than write one
 * paragraph.
 *
 * The band is the one dark surface on the storefront, and the departure is
 * deliberate rather than decorative. Four sections of near-white run above it
 * -- the hero's tinted ground, the plain page, the white paper of the plans --
 * and a fifth would let the page end by trailing off. This is the close, so it
 * changes key. Colour also does something for the photography that no amount of
 * layout can: a dish on a dark green ground is lit, where the same dish on
 * off-white is merely placed.
 *
 * Zodiak and Cabinet Grotesk carry the whole band and Inter appears nowhere in
 * it, which is the same rule the plan notes follow and for the same reason.
 * Those two faces are the voice of the people who cook rather than the voice of
 * the interface, and a mission statement is the one other place on the site
 * where someone is speaking rather than something is being operated. The notes
 * established the pair; this is the second half of that system, not a third
 * typographic idea.
 *
 * A server component. The only client boundary is `Reveal`, which adds a class
 * when the band reaches the viewport; every keyframe it triggers lives in
 * `globals.css`, and nothing here is hidden by a base rule -- with no
 * JavaScript the class never lands and the section is simply present.
 */

type Area = {
  /** Where this reader is when the food arrives. Lower case, and not a kicker. */
  label: string;
  title: string;
  body: string;
  href: Route;
  action: string;
};

/**
 * The two areas, and the two links.
 *
 * They do not point at the same page, and the asymmetry is the point rather
 * than an oversight. Someone buying their working week back has already decided
 * they want the food and needs to know what a plan costs and how the windows
 * work; someone in a hostel is still deciding whether the cooking is any good,
 * and the menu answers that before a price can. Two identical links reading
 * "Browse the plans" would have been the tidier row and the less useful one.
 *
 * Every claim below is a mechanic the product actually has: delivery windows
 * are chosen by the customer, and skipping a day really does return the
 * entitlement to the balance (see `SUBSCRIPTION_STEPS` on the home page). This
 * band invents nothing it cannot honour.
 */
const AREAS: Area[] = [
  {
    label: 'at the desk',
    title: 'Lunch stops being a decision',
    body: 'A hot meal arrives inside the window you picked, every working day. No 12:40 scroll through ten apps, no queue at the food court, no deciding again tomorrow.',
    href: '/subscriptions',
    action: 'Browse the plans',
  },
  {
    label: 'in the hostel',
    title: 'Home food, a long way from home',
    body: 'The cooking you grew up on, minus the mess queue. Going home for the weekend? Skip those days and the meals come back to your balance.',
    href: '/menu',
    action: 'See what we cook',
  },
];

export function MissionSection({ menu }: { menu: ProductCard[] }) {
  /* The hero has already spent the first two photographs on its gateway cards,
     so this takes what is left rather than showing the visitor the same two
     dishes twice on one page. Where the kitchen publishes fewer than four
     photographs the areas render without one -- a missing picture is nothing,
     never a grey rectangle standing in for one. */
  const photos = withPhotos(menu).slice(2);

  return (
    <section className="mission">
      {/* The band's marginalia, out in the page gutters either side of the
          content column rather than inside it. Direct children of the section
          for that reason -- the column is only 72rem wide and these belong to
          the space outside it.

          Painted light, and none of them is a new file: `.mission` re-points
          `--ck-mark`, so these are the same drawings the hero uses in its own
          margins, inverted for the dark ground. Each is a `Reveal` with no
          children, the way the plans section's chef and calendar are done, so
          they arrive when the band does instead of animating unseen below the
          fold. */}
      <Reveal className="tool-mark tool-pan" amount={0.15} aria-hidden />
      <Reveal className="tool-mark tool-ladle-side" amount={0.15} aria-hidden />
      <Reveal className="tool-mark tool-mark-right tool-mitt" amount={0.15} aria-hidden />
      {/* `relative`, so the drawn tools below anchor to the content column
          rather than to the full-width band -- the gap they stand in belongs to
          the column, and tracking the window instead would walk them away from
          it on a wide screen. */}
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28">
        {/* The one mark on this band, and the same file as the hero's: it comes
            out light here only because `.mission` re-points `--ck-mark`. A
            `Reveal` with no children, the way the plans section's chef and
            calendar are done -- it arrives when the band does. */}
        <Reveal className="tool-mark mission-mark" amount={0.15} aria-hidden />
        {/* The statement is the heading. There is no small tracked label above
            it announcing that a mission statement follows: the sentence is
            perfectly capable of introducing itself, and a kicker here would be
            scaffolding rather than voice. */}
        <Reveal className="reveal-up">
          <h2 className="mission-statement max-w-4xl text-balance">
            We cook the food you&rsquo;d make at home, if you had the morning to make it.
          </h2>

          {/* The one place the band states the facts plainly, and it echoes the
              sentence above it on purpose: the statement offers the morning
              you do not have, this says whose morning it is. */}
          <p className="mission-lede mt-7 max-w-2xl text-pretty">
            One kitchen in Bangalore, cooking a small menu fresh every morning &mdash; for
            the people whose own mornings are already spoken for.
          </p>
        </Reveal>

        {/* A beat behind the statement, so the band makes its claim before it
            shows who the claim is about.

            Two up from `sm`, where the hero's gateway cards wait until `lg`,
            and the difference is where each puts its photograph. The hero
            anchors its picture in the corner *behind* the copy, so a narrow
            column drops the heading onto the food; here the photograph sits
            above the text and taking the column narrower only ever makes both
            smaller. Waiting until `lg` would instead leave a whole tablet's
            worth of widths rendering a full-bleed 4:3 -- at 820px that is a
            photograph 788px wide and 591 tall standing over four lines of
            copy, which reads as a picture with a caption rather than as one of
            two answers to the same question. */}
        <Reveal
          className="mission-areas mt-16 grid gap-x-8 gap-y-16 sm:mt-20 sm:grid-cols-2 lg:gap-x-12"
          delay={140}
        >
          {AREAS.map((area, index) => (
            <MissionArea key={area.label} area={area} photo={photos[index]} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/**
 * One audience: a photograph of what they are sent, then who they are and what
 * changes for them.
 *
 * Not a card, and that is a decision rather than an omission. A card would put
 * a box around each audience on a surface whose whole argument is that these
 * are two kinds of person rather than two products, and the plans section three
 * screens up already made the case against boxing things that are not boxes.
 * The photograph gives the block its edge; nothing else needs to.
 */
function MissionArea({ area, photo }: { area: Area; photo?: Photo }) {
  return (
    <article className="mission-area">
      {photo ? (
        <div className="mission-shot">
          {/* A real alt rather than the empty one the hero cards carry. There
              the photograph sits inside a link named "Meal subscriptions" and
              reading a dish name into that misleads; here it stands on its own
              as an example of the food, and naming it is the more useful of the
              two answers. */}
          <Image
            src={photo.imageUrl}
            alt={photo.imageAlt}
            width={800}
            height={600}
            sizes="(max-width: 40rem) 100vw, (max-width: 72rem) 50vw, 34rem"
            className="mission-shot-img"
          />
        </div>
      ) : null}

      <p className="mission-label">{area.label}</p>
      <h3 className="mission-title mt-2 text-balance">{area.title}</h3>
      <p className="mission-body mt-4 text-pretty">{area.body}</p>

      {/* No margin utility on the link: it is pushed to the foot of the column
          by `margin-top: auto`, and `.mission-body` carries the floor under
          that. See the note over `.mission-area`. */}
      <Link href={area.href} className="mission-link">
        {area.action}
        <ArrowRightIcon className="mission-arrow" />
      </Link>
    </article>
  );
}
