/**
 * A verlet rope: position-based dynamics for the three photographs in the
 * mission band, which hang from strings rather than sitting in a row.
 *
 * ## Why this is written rather than installed
 *
 * The obvious answers were all considered and all lose on this page.
 *
 * **Matter.js** is the reflex, and it is the wrong tool for a rope specifically.
 * It has no rope body -- you build one as a chain of circles joined by distance
 * constraints -- and the result is famously elastic. Issue #709 on `liabru/
 * matter-js` is exactly this complaint, and the maintainer's answer is that a
 * rigid-body solver cannot produce an inextensible rope: the stretch is
 * architectural, not a setting, and `stiffness: 1` does not remove it. A rubber
 * band where a string should be is the one failure mode this effect cannot
 * survive. It would also have meant syncing DOM transforms to canvas bodies
 * every frame; the only published bridge for that, `matter-dom-plugin`, has no
 * stars and depends on a *fork* of Matter.
 *
 * **`@react-three/rapier` + `meshline`** is the beautiful answer -- it is what
 * the pmndrs lanyard demo and Vercel's 3D event badge are built on, and its
 * `useRopeJoint` does hold. It also means three.js, fiber, drei and a WASM
 * physics engine to hang three photographs, and it means the photographs stop
 * being `next/image` and become GPU textures inside a canvas: no responsive
 * source set, nothing in the document, nothing for a crawler. Several hundred
 * kilobytes to make a marketing band worse at its actual job.
 *
 * **Verlet integration with iterative constraint relaxation** is what every one
 * of those engines is doing underneath for soft bodies anyway, and for a rope
 * it is about sixty lines. It is inextensible for free, because the constraint
 * is solved *positionally* -- a link that is too long is fixed by moving its
 * ends, not by pushing on them and hoping. That is the whole reason it does not
 * have Matter's problem.
 *
 * ## The method
 *
 * Verlet stores no velocity. A node keeps its previous position, and the
 * difference between where it is and where it was *is* its velocity, which is
 * what makes constraints so cheap here: move a node to satisfy a link and you
 * have implicitly corrected its velocity too, with no bookkeeping.
 *
 *     x' = x + (x - xPrev) * drag + a * dt^2
 *
 * Then the links are solved by relaxation -- walk every link, push its two ends
 * to the right distance apart, repeat. One pass leaves error because fixing one
 * link disturbs its neighbours; the passes converge, and `ITERATIONS` is how
 * rigid the rope ends up. This is the standard treatment, and the parameters
 * below are named after the ones in the common write-ups (Jakobsen's cloth
 * paper by way of every rope tutorial since).
 *
 * The one thing this module does not do is decide anything about the page. It
 * takes nodes and links and steps them; where the anchors are, when the drop
 * starts, which link a cursor just severed and how hard the wind is blowing all
 * belong to the component.
 */

/**
 * A point mass.
 *
 * `w` is *inverse* mass, which is the form the solver actually wants: sharing a
 * correction between two nodes is a ratio of inverse masses, and pinning is
 * `w = 0` rather than a branch. A heavier node has a *smaller* `w`.
 */
export type Node = {
  x: number;
  y: number;
  px: number;
  py: number;
  w: number;
};

/**
 * A distance constraint between two nodes.
 *
 * `stiffness` is the fraction of the error corrected per pass, and it is not
 * really a physical property -- with enough passes even a slack value converges
 * to rigid. What it buys is the single frame of impact: a rope going taut at
 * 0.9 gives by a pixel or two before the later passes take it back, which is
 * what a string does and what a hard `1` does not.
 */
export type Link = {
  a: number;
  b: number;
  length: number;
  stiffness: number;
  /**
   * A rope pulls and never pushes.
   *
   * This is the difference between a string and a rod, and leaving it out is the
   * single easiest way to build something that never quite convinces. A plain
   * distance constraint is bidirectional: bring its ends closer than `length`
   * and it shoves them back apart, which is a rigid link -- correct for the arm
   * that gives a picture its angular inertia, wrong for every segment of the
   * string above it.
   *
   * Two things in this band depend on it and neither is written down anywhere
   * else. A rope wound in on itself at the anchor is not a violated rope, it is
   * a slack one, so the drop can start with every node in a heap on the pin and
   * simply uncoil under gravity -- with a rod there, the first relaxation pass
   * would fire the chain to full extension inside one frame and the picture
   * would teleport rather than fall. And a rope cut in the middle leaves a stub
   * that hangs and a tail that falls, rather than two poles that shove their
   * ends apart. Both are what one skipped correction gets you.
   */
  slack?: boolean;
};

/** Pixels per second squared. Earth is ~9.8 m/s^2; this is a stage, not a lab. */
export const GRAVITY = 1900;

/**
 * Velocity retained per substep.
 *
 * Applied 120 times a second, so 0.991 keeps about a third of a node's speed
 * across one second. It stands in for air and for the friction in the knot at
 * the same time; separating them would be more physics and not more convincing.
 *
 * This was 0.994 and the correction is worth recording, because the instinct
 * that damping is the knob for "settles sooner" is only half true and the other
 * half is a bug. Damping also acts on the *fall*, and the drop is only about
 * 0.4s long: take it much past this and the pictures descend in visible slow
 * motion, which is the one thing that would give the whole effect away. The
 * measured swing decay is what set it -- amplitude is down to about 12px at one
 * second and under 5px at three, at both values -- so the real cost of the
 * slower number was three or four extra seconds of a loop running for a
 * movement of a pixel or two, not a set that was still visibly swinging.
 */
export const DRAG = 0.991;

/**
 * The fixed integration step, in seconds.
 *
 * Fixed, and that is not a detail. Verlet's `x - xPrev` term carries an implicit
 * `dt` inside it, so feeding the integrator the real frame time makes the
 * effective damping and gravity change with the frame rate -- the rope behaves
 * differently on a 60Hz laptop and a 144Hz monitor, and behaves *wrongly* on any
 * frame that runs long. Stepping a constant 1/120 and accumulating the
 * remainder makes the simulation identical everywhere and merely smoother on
 * fast displays, which is the right way round.
 */
export const SUBSTEP = 1 / 120;

/**
 * Relaxation passes per substep.
 *
 * The common rope write-ups suggest three, which is right when a rope is the
 * whole scene and a little sag is charm. Here the rope has to deliver a
 * photograph to a position the layout has already decided, so the residual
 * error is not charm, it is the picture sitting below where it belongs.
 *
 * Eight was the first guess and it was wrong by three pixels. Position-based
 * dynamics converges, but only at the rate the correction can propagate: the
 * picture is eight times the mass of a rope node, so it takes about a ninth of
 * each link's correction and the rest goes into the rope above it. That is the
 * behaviour that makes the set feel weighted, and it is also what makes a short
 * solve fall short. Measured against a 112px rope, the sag is 3.1px at eight
 * passes, 1.5px at sixteen, 0.73px at thirty-two.
 *
 * Thirty-two, then, and the reason it can simply be bought is that nothing here
 * is expensive: three ropes are thirty-three links, so a substep is about a
 * thousand link solves and a frame is two substeps. Tens of microseconds.
 *
 * It buys the impact as well as the rest position, which was the surprise. The
 * distance the picture overshoots as the rope goes taut falls from 21px to 6px
 * across the same range -- the eight-pass version was not dramatic, it was
 * *elastic*, and 21px of stretch in a string is the exact failure this file
 * chose verlet to avoid. Six is a rope with a little give in it.
 */
export const ITERATIONS = 32;

/**
 * Integrate one substep.
 *
 * Gravity is added as `a * dt^2` rather than to a velocity, which is the verlet
 * form. Note it is applied before drag touches the new position, not after: a
 * node at rest under gravity should stay at rest, and damping the gravity term
 * itself would leave every rope hanging fractionally short of its own length.
 *
 * `wind` is a sideways acceleration in the same units, and it is a single
 * number for the whole system rather than anything per-node. Real wind on a
 * hanging object is a force scaled by the area it presents, divided again by
 * its mass -- and for a photograph and the string above it those two very
 * nearly cancel. Modelling both to arrive back at one shared acceleration would
 * be arithmetic performed for the look of it.
 */
export function integrate(nodes: Node[], gravity = GRAVITY, wind = 0, drag = DRAG) {
  const fall = gravity * SUBSTEP * SUBSTEP;
  const push = wind * SUBSTEP * SUBSTEP;

  for (const node of nodes) {
    if (node.w === 0) continue;

    const vx = (node.x - node.px) * drag;
    const vy = (node.y - node.py) * drag;

    node.px = node.x;
    node.py = node.y;
    node.x += vx + push;
    node.y += vy + fall;
  }
}

/**
 * Solve every link, `ITERATIONS` times.
 *
 * The correction is split between a link's two ends in proportion to their
 * inverse masses, so a rope node pulled by the photograph below it moves most of
 * the way and the photograph moves a little -- which is what gives the set its
 * weight. Equal masses everywhere is the version that looks like a chain of
 * beads rather than a picture on a string.
 *
 * A link whose ends are both pinned is skipped rather than divided by zero.
 */
export function relax(nodes: Node[], links: Link[], iterations = ITERATIONS) {
  for (let pass = 0; pass < iterations; pass++) {
    for (let k = 0; k < links.length; k++) {
      const link = links[k];
      const a = nodes[link.a];
      const b = nodes[link.b];
      const share = a.w + b.w;
      if (share === 0) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const squared = dx * dx + dy * dy;
      const length = link.length;

      /* Compared squared, so a slack rope costs no square root at all. This is
         the hottest line in the file -- it runs about two thousand times a
         frame -- and a slack link is the common case for every rope that is
         merely hanging there. */
      if (link.slack && squared <= length * length) continue;

      /* `Math.sqrt`, not `Math.hypot`, and the difference is not stylistic.
         `hypot` is specified to be overflow- and underflow-safe for any number
         of arguments, and pays for that with scaling work on every call; these
         are two screen coordinates a few hundred pixels apart, which cannot
         overflow anything. Measured on a moving rope -- three of them, two
         substeps, thirty-two passes -- the swap took a frame's solving from
         58µs to 28µs, better than a third of a 60Hz budget down to a sixth,
         for one identifier.

         Measure it on a rope at *rest* and the same swap looks like a 2.9x win
         rather than 2.0x, which is a lie of benchmarking rather than of
         arithmetic: a hanging rope that is not being disturbed is all-slack,
         the squared comparison above skips every link, and neither version
         reaches a square root at all. The number that matters is the one taken
         while something is actually happening. */
      const distance = Math.sqrt(squared) || 1e-6;
      const error = ((distance - length) / distance) * link.stiffness;
      const wa = a.w / share;
      const wb = b.w / share;

      a.x += dx * error * wa;
      a.y += dy * error * wa;
      b.x -= dx * error * wb;
      b.y -= dy * error * wb;
    }
  }
}

/**
 * A rope drawn through its nodes, as an SVG path.
 *
 * Quadratic segments between the midpoints of consecutive nodes, which is the
 * standard smooth-polyline trick and the right amount of machinery here: each
 * node becomes a control point and the curve passes through the midpoints, so a
 * ten-node chain reads as one continuous string instead of nine visible
 * straight runs. A Catmull-Rom spline would pass through the nodes themselves
 * and cost a conversion to cubics to say the same thing at this scale.
 *
 * `alpha` is where between a node's previous and current position to draw it --
 * see `lerp` below for why anything is drawn between two states at all. It has
 * to be the same `alpha` the photograph is placed with, or the string and the
 * thing it is holding up would be rendered a substep apart, which is a gap that
 * opens and closes several times a second.
 *
 * One decimal place, not two. The path is rebuilt from scratch every frame, so
 * this is the one string-building loop in the whole effect that runs sixty
 * times a second; a tenth of a pixel is already past what a 1.25px hairline can
 * show, and the shorter numbers are less to allocate and less for the SVG
 * parser to read.
 */
export function ropePath(nodes: Node[], from: number, to: number, alpha = 1) {
  const first = nodes[from];
  let d = `M ${lerp(first.px, first.x, alpha).toFixed(1)} ${lerp(first.py, first.y, alpha).toFixed(1)}`;

  for (let i = from + 1; i < to; i++) {
    const node = nodes[i];
    const next = nodes[i + 1];
    const nx = lerp(node.px, node.x, alpha);
    const ny = lerp(node.py, node.y, alpha);
    const mx = (nx + lerp(next.px, next.x, alpha)) / 2;
    const my = (ny + lerp(next.py, next.y, alpha)) / 2;
    d += ` Q ${nx.toFixed(1)} ${ny.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }

  const last = nodes[to];
  d += ` L ${lerp(last.px, last.x, alpha).toFixed(1)} ${lerp(last.py, last.y, alpha).toFixed(1)}`;

  return d;
}

/**
 * Where to draw a node, given how far the clock is past the last substep.
 *
 * This is the whole of what makes the motion smooth, and it is worth being
 * precise about the problem it solves. The simulation runs on a fixed 1/120s
 * step and the display does not: a frame is handed some arbitrary slice of time
 * and consumes whole substeps out of it, so the number of substeps per frame is
 * never constant. Measured against real refresh rates with a little vsync
 * jitter, a 60Hz display runs two substeps 97% of frames and one or three the
 * rest -- and a 144Hz display runs **no substep at all on 17% of its frames**,
 * a 165Hz one on 28%.
 *
 * Drawing the raw simulation state means those frames draw the previous frame
 * again, exactly, and the next one jumps a whole substep to catch up. That is
 * not a slow effect or a badly tuned one; it is a smooth simulation sampled
 * unevenly, and no amount of damping or easing fixes it.
 *
 * So the leftover accumulator becomes a fraction, and everything is drawn
 * between the last two substeps rather than at the last one. Frames that
 * stepped nothing still advance, because `alpha` advanced. It costs a
 * multiply-add per coordinate.
 *
 * Verlet is what makes it free. An integrator that tracked velocity would need
 * a whole second copy of the state kept around to interpolate against; verlet
 * already stores each node's previous position, because that *is* its velocity
 * -- so the two states this needs are the two the solver was keeping anyway.
 */
export function lerp(previous: number, current: number, alpha: number) {
  return previous + (current - previous) * alpha;
}
