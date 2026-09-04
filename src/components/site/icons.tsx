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

   Legibility at 18px is what shapes them. Each is two or three elements, no
   detail smaller than about a fifth of the grid, and nothing that depends on a
   thin line surviving. The pot is the one that had to be simplified hardest:
   handles and a lid knob are what make a pot obviously a pot at 48px, and at
   18px they close up into a smudge. A rim, a body and two ticks of steam is
   what is left when everything that cannot be seen is taken out.
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
