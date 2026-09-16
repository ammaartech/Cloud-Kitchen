'use client';

import { useRef, type ReactNode } from 'react';
import { gsap, ScrollTrigger, useGSAP } from './gsap';
import { riseOnScroll, setDownTools, splitHeadings, type Query } from './motion-reveals';

/**
 * The motion layer for `/about`.
 *
 * Built the way `SubscriptionsStage` is, and for the same reasons -- the note
 * at the top of `subscriptions-motion.tsx` is the long version of the contract,
 * and this file only adds what is particular to this page:
 *
 *   `[data-enter]`          arrives with the page, gated by `motion-gate.css`
 *   `[data-split-heading]`  a section heading, said word by word on scroll
 *   `[data-rise]`           rises into place when scrolled to, in batches
 *   `[data-rule]`           a hairline drawn across when scrolled to
 *   `[data-tool]`           marginalia: set down, then left to drift
 *   `.story-spine`          the day's thread, drawn as the day is scrolled
 *   `.story-hour`           one moment in the day, arriving as the thread reaches it
 *
 * Everything in that first group is shared with `/subscriptions` and `/menu`
 * and lives in `motion-reveals.ts`. A section heading is said the same way on
 * every page; two copies of that would drift apart the first time one was tuned.
 *
 * ## The one thing this page does that no other page does
 *
 * `drawDay` scrubs a drawn line to the scroll position rather than playing it
 * on a clock. That is the only scrubbed animation on the storefront, and the
 * exception is the subject: this section is a sequence of times, and the reader
 * moves through it at their own pace. A timed draw would either outrun a slow
 * reader or finish before a fast one arrived. Tying it to the scroll makes the
 * page's own scrollbar the clock, which is what the content already is.
 *
 * Everything readable is still on screen without it. The thread is decoration
 * -- it repeats the order the times are already printed in -- so it starts
 * undrawn in its base rule and can only ever appear by animating, while the
 * hours themselves are content that no base rule hides. The rule this whole
 * codebase holds to.
 */
export function AboutStage({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const q = gsap.utils.selector(root) as Query;
      const mm = gsap.matchMedia();

      mm.add(
        {
          moving: '(prefers-reduced-motion: no-preference)',
          still: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          if (context.conditions?.still) {
            // Nothing is hidden on this branch -- the gate never matched --
            // except the decoration, which starts transparent or undrawn in its
            // own base rule and would otherwise never appear. Both are part of
            // the page: show them, unmoving.
            gsap.set(q('[data-tool]'), { autoAlpha: 1 });
            gsap.set(q('.story-spine-line'), { drawSVG: '100%' });
            gsap.set(q('.story-hour-dot'), { scale: 1 });
            return;
          }

          playIntro(q);
          setDownTools(q);
          splitHeadings(q);
          drawDay(q);
          riseOnScroll(q);
        },
      );

      // Zodiak and Cabinet are `preload: false` and swap in late, so every
      // ScrollTrigger measured its start against the fallback font's layout.
      // Once the real faces land, the positions are measured again.
      let mounted = true;
      document.fonts?.ready.then(() => {
        if (mounted) ScrollTrigger.refresh();
      });

      return () => {
        mounted = false;
        mm.revert();
      };
    },
    { scope },
  );

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}

/**
 * The page arriving: one timeline, so the pieces are placed against each other
 * rather than each guessing a delay.
 *
 * The headline's phrases rise out of their own line masks -- the same idea as
 * the hero's roll and the subscriptions intro, a sentence being said rather
 * than a block fading up -- and the drawn underline goes under "one" as the
 * second phrase lands, because one is the entire argument of this page.
 *
 * Everything readable is on screen inside about a second. The rules finishing
 * behind the facts are the only thing that runs past it, and they carry no
 * information.
 */
function playIntro(q: Query) {
  const intro = gsap.timeline({ defaults: { ease: 'ck', duration: 0.8 } });

  intro
    .fromTo(q('.story-kicker'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0)
    .set(q('.story-headline'), { autoAlpha: 1 }, 0)
    .fromTo(
      q('[data-intro-line]'),
      { yPercent: 108 },
      { yPercent: 0, duration: 0.95, stagger: 0.1 },
      0.06,
    )
    // The masks pad for descenders but not for the underline, which hangs
    // lower. Once the phrases are home there is nothing left to clip.
    .set(q('.story-line-mask'), { overflow: 'visible' }, 1.1)
    .fromTo(
      q('.story-scribble path'),
      { drawSVG: '0%' },
      { drawSVG: '100%', duration: 0.45, stagger: 0.12, ease: 'power2.inOut' },
      0.95,
    )
    .fromTo(
      q('.story-lede, .story-actions'),
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, stagger: 0.08 },
      0.3,
    )
    .fromTo(q('.story-fact'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, stagger: 0.09 }, 0.4)
    .fromTo(
      q('.story-fact-rule'),
      { scaleX: 0 },
      { scaleX: 1, transformOrigin: 'left center', duration: 1, stagger: 0.09 },
      0.4,
    );
}

/**
 * The day drawn as it is read.
 *
 * One line runs down the column of hours and is drawn to the scroll position;
 * each hour's marker fills as the line reaches it. The two are deliberately not
 * the same animation. The line is scrubbed, so it tracks the scrollbar exactly.
 * The markers are `once` triggers, so a marker that has been reached stays
 * filled when the reader scrolls back up -- one that emptied on the way up
 * would be saying the kitchen had un-cooked something.
 *
 * `end: 'bottom 65%'` rather than `bottom bottom`: the line has to finish while
 * the last hour is still comfortably on screen. Ending it at the section's true
 * bottom means the final segment is drawn during the scroll that is already
 * carrying the section off the top of the window, so the one moment the
 * sequence resolves is the one moment nobody is looking at it.
 */
function drawDay(q: Query) {
  const [spine] = q('.story-spine');
  const [line] = q('.story-spine-line');

  if (spine && line) {
    gsap.fromTo(
      line,
      { drawSVG: '0%' },
      {
        drawSVG: '100%',
        ease: 'none',
        scrollTrigger: {
          trigger: spine,
          start: 'top 62%',
          end: 'bottom 65%',
          // A little lag, so a trackpad flick draws a line that keeps going for
          // a moment after the wheel stops rather than stopping dead with it.
          // The same reason the hero's scroll progress is spring-smoothed.
          scrub: 0.6,
        },
      },
    );
  }

  const hours = q('.story-hour');
  if (hours.length === 0) return;

  hours.forEach((hour) => {
    const inHour = gsap.utils.selector(hour);

    ScrollTrigger.create({
      trigger: hour,
      start: 'top 68%',
      once: true,
      onEnter: () => {
        gsap
          .timeline({ defaults: { ease: 'ck' } })
          // `back.out` on the marker and nothing else. It is the one element
          // here that is a dot rather than a word -- a shape can overshoot and
          // settle without anybody having to read it mid-flight, which is the
          // same reason the step badges on the home page are the only thing in
          // that row that travels.
          .fromTo(
            inHour('.story-hour-dot'),
            { scale: 0 },
            { scale: 1, duration: 0.5, ease: 'back.out(2)' },
            0,
          )
          .fromTo(
            inHour('.story-hour-time'),
            { autoAlpha: 0, x: -8 },
            { autoAlpha: 1, x: 0, duration: 0.5 },
            0.06,
          )
          .fromTo(
            inHour('.story-hour-body > *'),
            { autoAlpha: 0, y: 10 },
            { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.07 },
            0.12,
          );
      },
    });
  });
}
