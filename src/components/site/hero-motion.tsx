'use client';

import {
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
  type PointerEvent,
  type ReactNode,
} from 'react';
import {
  LazyMotion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';
// Motion 13 exports the minimal components one element at a time from this
// entry rather than as an `m` namespace. Naming the two we use is also the
// point of importing from here at all: `motion.div` statically pulls in the
// gesture and layout engines, where these carry none until `LazyMotion` hands
// them a feature bundle.
import { div as MotionDiv, span as MotionSpan } from 'motion/react-m';
import { cx } from '@/components/ui/button-styles';

/**
 * The hero's interactive motion layer.
 *
 * The division of labour here is deliberate and worth stating once, because it
 * is the thing most likely to be undone by someone tidying up later.
 *
 * Anything that has to be right at *first paint* is CSS -- the headline roll
 * and the entrance stagger, both in `globals.css`. Keyframes run
 * off the stylesheet, before hydration, on a page that is prerendered; a
 * JavaScript entrance animation on this surface would mean the hero holds
 * still until the bundle lands, which is exactly the load-time win this
 * project already paid for. It matters most for the first gateway card: it
 * carries the `priority` photograph and is the LCP candidate, so its entrance
 * moves it but never fades it -- an element at `opacity: 0` does not count as
 * painted.
 *
 * Anything that responds to a *person* is Motion -- scroll position, pointer
 * position, and whether a thing is on screen yet. None of it can happen before
 * hydration by definition, so
 * none of it is on the critical path, and springs give it a settle that
 * stepped CSS easing cannot. The library costs this route roughly 26 KB
 * gzipped across two `async` chunks: ~18 KB for the hooks and minimal
 * components imported below, and ~8 KB for the feature bundle behind
 * `LazyMotion` (see `motion-features.ts`). Neither blocks paint. If that
 * budget ever has to come back, this file is the whole of it -- delete it and
 * the hero degrades to the CSS layer rather than breaking.
 *
 * The courier at the foot of the file is the one thing that sits across the
 * line: his ride is still CSS keyframes, because it is a fixed piece of
 * choreography rather than a response to an input, but *when* it starts is
 * scripted -- he parks below the fold, and a stylesheet cannot yet ask whether
 * anyone has scrolled far enough to be looking at him.
 *
 * `useReducedMotion` is honoured by suppressing the motion values at source
 * rather than by branching the tree, so the markup is identical either way.
 */

const loadFeatures = () => import('./motion-features').then((mod) => mod.default);

/** Scroll progress through the hero: 0 at rest, 1 once it has left. */
const HeroScrollContext = createContext<MotionValue<number> | null>(null);

/**
 * The hero section, and the origin of every scroll-linked value beneath it.
 *
 * This owns the `<section>` element rather than sitting inside one so it has a
 * ref to measure against; its children are still server-rendered and pass
 * straight through.
 *
 * The progress value is spring-smoothed before anyone reads it. Raw scroll
 * progress is exact but it is also as jerky as the input device -- a trackpad
 * flick, or a mouse wheel's discrete steps, show up as stutter in anything
 * bound to it. The spring costs a few milliseconds of lag behind the true
 * scroll position and buys motion that keeps gliding after the wheel stops.
 */
export function HeroStage({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    // From the hero sitting flush at the top of the viewport to its bottom edge
    // reaching the top -- the whole of its departure, and nothing before it.
    offset: ['start start', 'end start'],
  });

  const smoothed = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 32,
    mass: 0.35,
    restDelta: 0.0005,
  });

  return (
    <LazyMotion features={loadFeatures} strict>
      <HeroScrollContext.Provider value={reduced ? null : smoothed}>
        <section ref={ref} className={className}>
          {children}
        </section>
      </HeroScrollContext.Provider>
    </LazyMotion>
  );
}

/**
 * One plane of the hero, drifting as the section leaves.
 *
 * `depth` multiplies the travel, and the whole point is that the layers
 * disagree: the copy leaves faster than the cards, the cards faster than the
 * courier. Parallax is the difference between the numbers, not the numbers
 * themselves -- give every layer the same depth and the hero simply scrolls,
 * which is what it did before.
 *
 * `fade` is how much opacity the layer has spent by the time the hero is gone.
 * Every layer keeps most of it: a hero that dissolves to nothing draws
 * attention to the scrolling rather than to what is arriving underneath.
 */
export function HeroLayer({
  depth = 1,
  fade = 0,
  className,
  children,
}: {
  depth?: number;
  fade?: number;
  className?: string;
  children: ReactNode;
}) {
  const progress = useContext(HeroScrollContext);

  // Hooks cannot be called conditionally, so a reduced-motion visitor gets a
  // value that never moves rather than a different set of hooks.
  const still = useMotionValue(0);
  const source = progress ?? still;

  const y = useTransform(source, [0, 1], [0, -110 * depth]);
  const opacity = useTransform(source, [0, 0.85], [1, 1 - fade]);

  return (
    <MotionDiv style={{ y, opacity }} className={className}>
      {children}
    </MotionDiv>
  );
}

/** How far the card leans into the pointer, in degrees at the far corner. */
const TILT = 5.5;
/**
 * How far the photograph lags behind the card, in pixels at the far corner.
 *
 * Bounded by geometry rather than by taste, and the two numbers below are a
 * pair -- change one and check the other. The photograph is pinned flush into
 * the card's bottom-right corner and the card clips it, so any inward drift
 * uncovers card background along those two edges. `PHOTO_REST_SCALE` is what
 * pays for it: the drifting box is the size of the card, so scaling it about
 * its centre pushes the pinned corner outward by 4% of the card's width and
 * height, and that overhang has to exceed the drift on both axes.
 *
 * The binding case is the card's height, which is fixed at `min-h-72` (288px):
 * 288 x 0.04 = 11.5px of cover for 10px of drift. Width is only tighter than
 * that on a card narrower than 250px, and the cards are single-column and
 * full-width below `lg` -- so a card that narrow is a phone, where the drift
 * never runs at all.
 */
const PHOTO_DRIFT = 10;
/** Constant, so the cover above cannot lag the drift while two springs settle. */
const PHOTO_REST_SCALE = 1.08;

const POINTER_SPRING = { stiffness: 260, damping: 26, mass: 0.6 } as const;
const LIFT_SPRING = { stiffness: 200, damping: 30, mass: 0.8 } as const;

type PhotoDrift = {
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
};

const PhotoDriftContext = createContext<PhotoDrift | null>(null);

/**
 * The gateway card's pointer response.
 *
 * A card that only changes on `:hover` announces that it is a link. A card that
 * tracks the pointer reads as a physical object under the visitor's hand, and
 * on a surface whose whole job is to make two destinations inviting, that is
 * worth the interaction budget.
 *
 * Three things move against each other, which is what stops it reading as a
 * novelty tilt: the card leans, the photograph inside it drifts the *opposite*
 * way -- so it sits behind the card rather than painted onto it -- and a soft
 * brand-tinted sheen tracks the cursor across the surface.
 *
 * Every value is a spring rather than a tween. The pointer is a step function;
 * springs are what turn a stream of discrete positions into something that
 * appears to have weight, and they resolve on their own when the pointer
 * leaves rather than needing an exit animation.
 *
 * Touch is excluded on purpose. A tilt keyed to `pointermove` fires once on a
 * tap, so a phone would get a card that jolts as it is pressed -- motion with
 * no information in it. `pointerType` is checked rather than a media query
 * because a hybrid laptop is both.
 */
export function TiltCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();

  // -0.5 .. 0.5 from the card's centre, on each axis.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  // 0 at rest, 1 while the card is engaged -- the single gate for everything
  // that should only be visible during the interaction.
  const engaged = useMotionValue(0);

  const sx = useSpring(px, POINTER_SPRING);
  const sy = useSpring(py, POINTER_SPRING);
  const lift = useSpring(engaged, LIFT_SPRING);

  const rotateX = useTransform(sy, [-0.5, 0.5], [TILT, -TILT]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-TILT, TILT]);
  const y = useTransform(lift, [0, 1], [0, -6]);
  const scale = useTransform(lift, [0, 1], [1, 1.012]);

  // The sheen, in per-cent of the card, tracking the pointer.
  const sheenX = useTransform(sx, [-0.5, 0.5], [8, 92]);
  const sheenY = useTransform(sy, [-0.5, 0.5], [8, 92]);
  const sheen = useMotionTemplate`radial-gradient(38rem 38rem at ${sheenX}% ${sheenY}%, var(--ck-brand-soft), transparent 62%)`;
  const sheenOpacity = useTransform(lift, [0, 1], [0, 0.7]);

  // The photograph, drifting against the lean so it reads as sitting deeper.
  const photoX = useTransform(sx, [-0.5, 0.5], [PHOTO_DRIFT, -PHOTO_DRIFT]);
  const photoY = useTransform(sy, [-0.5, 0.5], [PHOTO_DRIFT, -PHOTO_DRIFT]);
  const photoScale = useTransform(lift, [0, 1], [PHOTO_REST_SCALE, PHOTO_REST_SCALE + 0.07]);

  function track(event: PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType !== 'mouse') return;

    const box = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - box.left) / box.width - 0.5);
    py.set((event.clientY - box.top) / box.height - 0.5);
    engaged.set(1);
  }

  function release() {
    px.set(0);
    py.set(0);
    engaged.set(0);
  }

  function engage() {
    if (!reduced) engaged.set(1);
  }

  return (
    <MotionDiv
      onPointerMove={track}
      onPointerLeave={release}
      // A keyboard visitor never fires a pointer event, so the lift is bound to
      // focus as well -- otherwise tabbing to the card is the one way of
      // reaching it that gets no acknowledgement at all. The lean stays at rest
      // there, because there is no pointer for it to lean towards.
      onFocus={engage}
      onBlur={release}
      style={{
        rotateX,
        rotateY,
        y,
        scale,
        // Declared on the card rather than as a `perspective` on its parent: a
        // perspective set on an ancestor is a single shared vanishing point for
        // every child that transforms, and these two cards share a grid row --
        // which would lean them towards each other instead of towards the
        // pointer that is actually over one of them.
        transformPerspective: 1400,
      }}
      className={className}
    >
      {/* Above the card's own background, below its content. The photograph
          sits at `-z-10`, which puts it under both. */}
      <MotionSpan
        aria-hidden
        style={{ backgroundImage: sheen, opacity: sheenOpacity }}
        className="pointer-events-none absolute inset-0 z-[-5] rounded-[inherit]"
      />

      <PhotoDriftContext.Provider value={{ x: photoX, y: photoY, scale: photoScale }}>
        {children}
      </PhotoDriftContext.Provider>
    </MotionDiv>
  );
}

/**
 * The card's photograph, wired to the drift its card is publishing.
 *
 * Separate from `TiltCard` because the photograph is a `next/image` several
 * levels down the card's markup, and the card should not have to know where it
 * sits. Outside a `TiltCard` this is an inert wrapper, so the photograph never
 * depends on the tilt existing.
 */
export function DriftingPhoto({ children }: { children: ReactNode }) {
  const drift = useContext(PhotoDriftContext);
  const still = useMotionValue(0);
  // Outside a `TiltCard` there is no drift to cover, so the photograph sits at
  // its natural size rather than at `PHOTO_REST_SCALE`.
  const rest = useMotionValue(1);

  return (
    <MotionDiv
      style={{
        x: drift?.x ?? still,
        y: drift?.y ?? still,
        scale: drift?.scale ?? rest,
      }}
      className="pointer-events-none absolute inset-0 -z-10"
    >
      {children}
    </MotionDiv>
  );
}

/**
 * The arrow on the card's call to action, leaning the way the pointer is.
 *
 * Small enough to be missed, which is the intention -- it is the detail that
 * makes the lean read as one object responding, rather than as a card with an
 * animation stuck on it. It travels *with* the lean while the photograph
 * travels against it, so the two ends of the card separate slightly.
 */
export function DriftingArrow({ children }: { children: ReactNode }) {
  const drift = useContext(PhotoDriftContext);
  const still = useMotionValue(0);
  const x = useTransform(drift?.x ?? still, (value) => value * -0.34);

  return (
    <MotionSpan style={{ x }} className="inline-flex">
      {children}
    </MotionSpan>
  );
}


/* The three arguments `DeliveryRun` hands `useSyncExternalStore`, hoisted so
   they are stable identities rather than new closures on every render -- a
   changing `subscribe` makes the hook resubscribe each time. Nothing here is
   really a store: the only question being asked is "am I in a browser yet", and
   the answer changes exactly once, at hydration, so there is nothing to
   subscribe to. */
const NEVER_CHANGES = () => () => {};
const ON_CLIENT = () => true;
const ON_SERVER = () => false;

/**
 * The delivery run, held at the kerb until the strip is on screen.
 *
 * This is the one piece of the entrance that is *not* on the CSS clock, and the
 * reason is where it sits: on the rule at the bottom of the hero, which on a
 * laptop is a hundred-odd pixels below the fold. Timed off the headline roll,
 * the courier finished riding at ~3.5s while the visitor was still reading the
 * sentence at the top -- so by the time anyone scrolled down to the road, the
 * delivery had already been and gone. An arrival nobody sees is not an
 * arrival, and the run is several times longer now than it was then, which
 * only widens the window in which it can be missed.
 *
 * All this component owns is the ref and the class. The windows and the scene
 * -- the road, the houses, the courier -- both arrive as slots from the server
 * component that lays them out, so two drawings, an inline SVG and a
 * data-driven list of delivery times all stay out of the client bundle.
 * Everything they do is keyframes hanging off `is-running`.
 *
 * `useInView` is a bare `IntersectionObserver` hook -- no feature bundle, and
 * already in this chunk -- so the run costs nothing beyond the observer itself.
 * `once`, because this is an arrival and not a status: a courier who re-rides
 * every time the hero scrolls back past would be the idle loop the
 * stylesheet's note is careful to rule out.
 *
 * `amount` is deliberately partial rather than `all`. The lane sits flush on
 * the section's bottom edge, so on a short viewport its last few pixels may
 * never clear the fold at all, and a threshold it cannot reach is a courier who
 * never comes.
 *
 * The base rules keep the scene invisible and the whole sequence lives in the
 * class, which keeps the failure mode the way the stylesheet already has it:
 * where this never runs -- no JavaScript, no observer -- nothing appears,
 * rather than a fully drawn scene popping in parked and then snapping back to
 * the kerb once hydration catches up.
 */
export function DeliveryRun({ windows, scene }: { windows: ReactNode; scene: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const running = useInView(ref, { once: true, amount: 0.55 });

  // Two states, not one, and the second exists entirely to keep the delivery
  // times safe. The drawing can hide itself in a base rule because it is
  // decoration -- where nothing runs, nothing should appear. The times cannot:
  // they are content, and a base rule that hides them would hide them for good
  // on any page whose JavaScript never arrives.
  //
  // So the hiding is done by a class that only exists once this component is
  // alive in a browser. Scripting is proven by the class being there at all,
  // which means the failures that matter -- no JavaScript, a blocked bundle, an
  // error during hydration -- leave the times exactly where the server put them:
  // on the page, at full size, readable. The cost is that the server's first
  // paint shows them before hydration hides them, and that is invisible in
  // practice: this strip is at the very bottom of the hero, under the fold on
  // any normal viewport, so by the time it is scrolled to hydration is long
  // done.
  //
  // `useSyncExternalStore` rather than the usual mounted flag in an effect.
  // It is the same idea -- server says no, client says yes -- but it is a
  // *render-time* difference React already understands rather than a state
  // write scheduled after paint, so hydration resolves it in one pass instead
  // of rendering the unarmed markup and then immediately re-rendering it.
  const armed = useSyncExternalStore(NEVER_CHANGES, ON_CLIENT, ON_SERVER);

  return (
    <div className={cx('delivery-run', armed && 'is-armed', running && 'is-running')}>
      {windows}

      {/* The observer goes on the lane and the class goes on the wrapper, which
          is why this takes two slots rather than `children`. The wrapper is in
          flow and only as tall as the windows, so watching *it* would start the
          run while the road was still below the fold -- the exact failure this
          component exists to prevent. The lane is the strip itself, so it is
          the thing that has to be on screen.

          `aria-hidden` stops here rather than on the wrapper: the drawing is
          decoration and repeats what the windows above already say in words,
          but those windows are the delivery times and have to stay readable. */}
      <div ref={ref} className="courier-lane" aria-hidden>
        {scene}
      </div>
    </div>
  );
}
