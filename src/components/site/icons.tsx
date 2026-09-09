import { cx } from '@/components/ui/primitives';

/**
 * The storefront's icon set. Deliberately tiny -- there is no icon library in
 * this project, and a handful of hand-drawn glyphs on one 24-unit grid with one
 * stroke weight beat pulling in a dependency for a search field and an arrow.
 *
 * `BASE` is the reason that holds. Every mark here is built on the same grid at
 * the same weight with the same caps, so they sit together at any size without
 * one of them reading as heavier or rounder than the rest -- which is exactly
 * what happens when marks are collected from different sets.
 */

const BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-4', className)} aria-hidden>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      <path d="M12 20V5" />
      <path d="m6 11 6-6 6 6" />
    </svg>
  );
}

/* --------------------------------------------------------------------------
   The four steps of a subscription.

   Drawn rather than numbered, and the trade is worth being explicit about: a
   numeral says where you are in a sequence and nothing about what happens
   there, while a drawing says what happens and nothing about the order. This
   row gets its order from the layout instead -- four columns read left to
   right, and the markup is an <ol>, so a screen reader still announces "3 of
   4" whatever is printed in the circle.

   Legibility at 24px is what shapes them -- 18px when they were first drawn,
   and the badge they sit in has since grown to 48. Each is two or three
   elements, no detail smaller than about a fifth of the grid, and nothing that
   depends on a thin line surviving. The pot is the one that had to be
   simplified hardest: handles and a lid knob are what make a pot obviously a
   pot at 48px, and at this size they close up into a smudge. A rim, a body and
   two ticks of steam is what is left when everything that cannot be seen is
   taken out.

   The size change did not send any of them back to the drawing board, and that
   is the grid doing its job rather than luck. 24px is `viewBox` scale 1:1, so
   every mark here is now drawn at exactly the proportions it was designed on;
   a set that reads at 18 has nothing to lose at 24. It is the other direction
   that costs -- the pot is still the shape that survives 18px, because the
   search field and the arrows still ask for these marks at that size.
   -------------------------------------------------------------------------- */

/** Pick a plan: a choice, made. */
export function ChoiceIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

/** Set your schedule: a calendar. */
export function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="4" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

/** We cook to that plan: a pot, with steam coming off it. */
export function PotIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      <path d="M3 9.5h18" />
      <path d="M5.5 9.5V15a4 4 0 0 0 4 4h5a4 4 0 0 0 4-4V9.5" />
      <path d="M9 6V3.5" />
      <path d="M15 6V3.5" />
    </svg>
  );
}

/** Skip or pause freely: pause. */
export function PauseIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      <path d="M9.5 5v14" />
      <path d="M14.5 5v14" />
    </svg>
  );
}

/**
 * The menu toggle's two states, as one glyph.
 *
 * Two lines rather than the usual three, and they are the same two lines in
 * both states: closed they sit apart and level, open they cross. That is what
 * lets the button morph instead of swapping icons -- a crossfade between a
 * hamburger and an X is two drawings dissolving through each other, and there
 * is a moment in the middle where it is neither. Rotating the strokes it
 * already has is one object changing shape, which is the thing that actually
 * happened.
 *
 * Three lines cannot do this: the middle one has nowhere to go and has to fade,
 * which puts the crossfade back. The two-line mark reads as a menu just as
 * plainly and is the one that can move.
 *
 * The transform lives in `globals.css` under `.nav-toggle`, keyed off the
 * button's `aria-expanded`, so the state the assistive tech reads and the state
 * the drawing is in cannot disagree.
 */
export function MenuGlyph({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('nav-glyph size-5', className)} aria-hidden>
      <path className="nav-glyph-top" d="M3 9h18" />
      <path className="nav-glyph-bottom" d="M3 15h18" />
    </svg>
  );
}

/* --------------------------------------------------------------------------
   The three ways to reach the kitchen.

   Drawn on the same 24-unit grid at the same weight as everything above,
   rather than pulled from a brand icon pack, and that is a deliberate trade.
   The official WhatsApp and Instagram marks are solid glyphs -- filled shapes
   with no stroke -- so dropping them in beside a hand-drawn envelope would put
   two filled logos and one line drawing in the same row, which reads as a
   third-party badge stuck onto the page rather than as part of it. Redrawn in
   outline they lose a little of their trademark exactness and gain the thing
   that matters more here: they look like the kitchen drew them.

   Both are still unmistakable at 20px, which is the only test that counts.
   WhatsApp is a speech bubble with a handset in it and nothing else is; the
   Instagram mark is a rounded square, a circle and a dot in the corner, and
   the proportions are what identify it rather than the fill.
   -------------------------------------------------------------------------- */

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      {/* The bubble is stroked and the handset is filled, which is the fix.
          Drawn as an outline the handset is a narrow S-bend with two counters
          barely wider than the stroke itself, so at 20px the rasteriser closes
          them and what lands on the page is a blob with a hole in it. Filled,
          it is one solid shape at the size the real mark uses, and it reads
          correctly down to 16px.

          That also puts the icon in the same construction as the drawn logo at
          the foot of this page -- an outlined vessel with a solid mark inside
          it -- rather than making it the one glyph in the set that is outline
          all the way through. */}
      <path d="M20.2 11.7a8.2 8.2 0 0 1-12.1 7.2L3.8 20.2l1.4-4.2a8.2 8.2 0 1 1 15-4.3Z" />
      <path
        fill="currentColor"
        stroke="none"
        d="M9.9 8.1c-.2-.5-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.7 2.8 4.2 3.8 2.1.8 2.5.7 3 .6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3l-1.8-.9c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.7-1.7Z"
      />
    </svg>
  );
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      {/* A dot rather than a tiny circle. At 20px an outlined 1-unit circle at
          this stroke weight fills itself in anyway and rasterises as a smudge;
          drawing it as a round cap on a zero-length line gives a clean dot at
          every size. */}
      <path d="M16.9 7.1h.01" />
    </svg>
  );
}

export function MailIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      {/* The flap stops short of the corners rather than running into them.
          Drawn corner to corner it meets the rectangle's own join and thickens
          it; pulled in a unit, the envelope reads as folded paper. */}
      <path d="M4.5 8 12 13l7.5-5" />
    </svg>
  );
}

/* --------------------------------------------------------------------------
   The marquee's marks.

   Four more on the same grid, chosen for what the band actually claims rather
   than for being food-shaped. A wheat sheaf and a chef's hat are what a stock
   set would offer and neither is true here -- the kitchen does not bake and
   nobody wears a toque. A house, a leaf, a steaming bowl and a sunrise are the
   four things the band says: home, fresh, warm, this morning.

   They are read at 18px between words, which is smaller than anything else in
   this file gets used at, so each is built from at most four strokes. Detail
   that survives at 24px turns to noise at 18.
   -------------------------------------------------------------------------- */

export function HomeIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.8V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.8" />
      {/* The chimney, and it is what stops this reading as a generic roof
          glyph. On the right so it does not collide with the apex. */}
      <path d="M16.5 7.2V5h2v3.8" />
    </svg>
  );
}

export function LeafIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      <path d="M5 19c-1.5-6 2-12 14-13 1 8-3 13-9 13-2.5 0-4-.5-5-1Z" />
      {/* The midrib runs past the tip of the blade and out to the stem. A leaf
          drawn as an outline alone is an eye or a lens; the vein is the one
          stroke that makes it a leaf. */}
      <path d="M5.5 19.5C8 15 11.5 12 16 10" />
    </svg>
  );
}

export function BowlIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      <path d="M3.5 12h17a8.5 8.5 0 0 1-8.5 7.5A8.5 8.5 0 0 1 3.5 12Z" />
      {/* Two wisps, not three, and at different heights. Three evenly spaced
          curls is the clip-art version; two of unequal length is steam. */}
      <path d="M9 8.5c0-1.2 1.2-1.4 1.2-2.6S9 3.9 9 3.9" />
      <path d="M14 8.5c0-.9.9-1.1.9-2" />
    </svg>
  );
}

export function SunriseIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      {/* A half disc on a horizon rather than a full sun with rays. The rays
          version is midday; the point of this one is the hour. */}
      <path d="M7 15a5 5 0 0 1 10 0" />
      <path d="M3 15h18" />
      <path d="M12 3.5v2.5" />
      <path d="m5.6 7.6 1.7 1.7" />
      <path d="m18.4 7.6-1.7 1.7" />
    </svg>
  );
}
