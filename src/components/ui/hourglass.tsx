import { cx } from './button-styles';

/**
 * The hourglass: sand drains, the glass turns over, the sand drains again.
 *
 * The one looping animation in the system, and the exception is the point of
 * it. Everything else here runs once and stops, because a thing that moves
 * forever beside content competes with the content. A loading indicator is the
 * opposite case: it is not decoration next to the answer, it *is* the answer
 * until the real one arrives, and an indicator that stops moving says the
 * opposite of what it is there to say.
 *
 * Colour follows the palette rather than the artwork it came from. The frame is
 * `currentColor`, so it takes the ink of whatever it is placed in and follows
 * the ops surface when that flips; the sand is `--ck-accent`, the ramp's 600
 * step, which is the token this system already uses for fills. The original's
 * coral would have been the only warm hue on the site.
 *
 * Sized by height alone. The drawing is taller than it is wide, so a square
 * box would letterbox it and every caller would be reserving width it never
 * uses; `w-auto` lets the intrinsic ratio supply the rest. Override the height
 * and the width follows.
 *
 * Decorative, and `aria-hidden` accordingly -- the caller owns the `role` and
 * the label, because only the caller knows what is loading. `Hourglass` never
 * announces anything by itself.
 */

/**
 * The turn, and why the sand never has to be put back.
 *
 * At the end of a drain the glass rotates half a turn, which carries the full
 * chamber from the bottom to the top -- and that is the next cycle's starting
 * position, so nothing is reset. When the loop wraps, two things snap at once
 * and both snaps are invisible: the rotation returns from 180 to 0 degrees,
 * which cannot be seen because the frame is symmetrical about its own centre,
 * and the sand returns from the lower chamber to the upper one, which cannot be
 * seen because the rotation had already carried it there.
 *
 * That symmetry is load-bearing. Anything added to this drawing that reads
 * differently upside down -- a base wider than the cap, a highlight on one side
 * -- turns an invisible snap into a visible jump every few seconds.
 *
 * The geometry below is a set: the caps sit at y=4 and y=48, the waist is at
 * their midpoint y=26, and the two chamber clips stop just short of it. The
 * travel distances in `globals.css` are measured off these numbers, so moving
 * a cap means re-measuring the drain and the fill.
 */
export function Hourglass({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 52"
      className={cx('hourglass h-12 w-auto', className)}
      fill="none"
      aria-hidden
    >
      <defs>
        {/* The interiors, inset from the stroke so sand never paints over the
            glass. Each is the cone it fills, so the level can be animated with
            a plain rectangle sliding behind it -- no path morphing, and the
            sand takes the chamber's shape for free. */}
        <clipPath id="ck-hourglass-upper">
          <path d="M12.5 8h19L22 24.8Z" />
        </clipPath>
        <clipPath id="ck-hourglass-lower">
          <path d="M22 27.2 31.5 44h-19Z" />
        </clipPath>
      </defs>

      <g className="hourglass-body">
        {/* Upper chamber. The rectangle starts covering the cone and slides
            down out of it, so the sand's surface drops toward the neck and the
            last of it disappears at the tip -- which is how a real one empties,
            and the reason the level is animated rather than the shape. */}
        <g clipPath="url(#ck-hourglass-upper)">
          <rect className="hourglass-sand-upper" x="0" y="0" width="44" height="26" />
        </g>

        {/* The falling stream. Clipped to the lower cone so it can stay a plain
            bar: the clip is what keeps it inside the glass, and what tapers it
            to nothing as it meets the neck. */}
        <rect
          className="hourglass-stream"
          clipPath="url(#ck-hourglass-lower)"
          x="20.9"
          y="25"
          width="2.2"
          height="20"
          rx="1.1"
        />

        {/* Lower chamber, filling from below by the same trick inverted. */}
        <g clipPath="url(#ck-hourglass-lower)">
          <rect className="hourglass-sand-lower" x="0" y="44" width="44" height="28" />
        </g>

        {/* The glass itself, drawn over the sand so the stroke covers the edge
            where each clip stops. Both curves pass through the same waist point
            so the neck closes exactly. */}
        <g
          stroke="currentColor"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 6c0 9.5 11 16 11 20s-11 10.5-11 20" />
          <path d="M33 6c0 9.5-11 16-11 20s11 10.5 11 20" />
          <path d="M9 4h26" />
          <path d="M9 48h26" />
        </g>
      </g>
    </svg>
  );
}
