'use client';

import { useRef, type ReactNode } from 'react';
import { gsap, ScrollTrigger, useGSAP } from './gsap';
import { riseOnScroll, splitHeadings, type Query } from './motion-reveals';

/**
 * The motion layer for `/subscriptions`.
 *
 * Like `HeroStage`, this owns an element only so it has something to scope to;
 * everything inside it is server-rendered and passes straight through. The
 * page marks what moves with attributes and classes, and this file decides how:
 *
 *   `[data-enter]`          arrives with the page (and is gated -- see below)
 *   `[data-split-heading]`  a section heading, said word by word on scroll
 *   `[data-rise]`           rises into place when scrolled to, in batches
 *   `[data-rule]`           a hairline drawn across when scrolled to
 *   `[data-tool]`           marginalia: set down, then left to drift
 *   `.plan-ticket`          printed out, one after another
 *
 * The heading and rise reveals are shared with the menu page and live in
 * `motion-reveals.ts`; what is here is particular to this page.
 *
 * ## Why nothing flashes
 *
 * `motion-gate.css` hides `[data-enter]` and `[data-rise]` before first paint,
 * but only where scripting is enabled and motion is welcome, with a failsafe
 * keyframe that brings content back if the bundle never runs. Every tween
 * therefore animates *to* an explicit visible state (`fromTo`, or `set` then
 * `to`), never `from()`: a `from()` would read the stylesheet's
 * `visibility: hidden` as its end value.
 *
 * ## Why one `matchMedia`
 *
 * `gsap.matchMedia()` is what makes reduced motion a branch rather than a pile
 * of conditionals: the moving branch builds every animation, and when the
 * preference flips mid-visit GSAP reverts all of it -- inline styles, split
 * text and ScrollTriggers -- and runs the other branch. `useGSAP` reverts the
 * lot again on unmount, which is what keeps a client-side navigation away and
 * back from stacking a second set of triggers on the first.
 */
export function SubscriptionsStage({
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
            // Nothing is hidden on this branch -- the gate never matched -- except
            // the marginalia, which are decoration and start transparent in their
            // base rule. They are still part of the page: show them, unmoving.
            gsap.set(q('[data-tool]'), { autoAlpha: 1 });
            return;
          }

          playIntro(q);
          setDownTools(q);
          splitHeadings(q);
          printTickets(q);
          riseOnScroll(q);
        },
      );

      // The ticket faces are `preload: false` and swap in late. Every
      // ScrollTrigger measured its start against the fallback font's layout,
      // so once the real faces land the positions are measured again.
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
 * The headline's two phrases rise out of their own line masks -- the same idea
 * as the hero's roll, a sentence being said rather than a block fading up --
 * and the drawn underline goes under "cook" as the second phrase lands.
 * Everything readable is on screen inside about a second; the rules finishing
 * behind the facts are the only thing that runs past it, and they carry no
 * information.
 */
function playIntro(q: Query) {
  const intro = gsap.timeline({ defaults: { ease: 'ck', duration: 0.8 } });

  intro
    .fromTo(q('.subs-kicker'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0)
    .set(q('.subs-headline'), { autoAlpha: 1 }, 0)
    .fromTo(
      q('[data-intro-line]'),
      { yPercent: 108 },
      { yPercent: 0, duration: 0.95, stagger: 0.1 },
      0.06,
    )
    // The masks pad for descenders but not for the underline, which hangs
    // lower. Once the phrases are home there is nothing left to clip.
    .set(q('.subs-line-mask'), { overflow: 'visible' }, 1.1)
    .fromTo(
      q('.subs-scribble path'),
      { drawSVG: '0%' },
      { drawSVG: '100%', duration: 0.45, stagger: 0.12, ease: 'power2.inOut' },
      0.95,
    )
    .fromTo(
      q('.subs-lede, .subs-offer, .subs-actions'),
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, stagger: 0.08 },
      0.3,
    )
    .fromTo(q('.subs-fact'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, stagger: 0.09 }, 0.4)
    .fromTo(
      q('.subs-fact-rule'),
      { scaleX: 0 },
      { scaleX: 1, transformOrigin: 'left center', duration: 1, stagger: 0.09 },
      0.4,
    );
}

/**
 * The two drawn tools in the intro margins: set down a beat after the copy,
 * then left to drift for as long as the intro is on screen.
 *
 * The drift pauses whenever the intro is scrolled away. An infinite loop nobody
 * can see is still work on every frame, and the page below this is long.
 */
function setDownTools(q: Query) {
  q('[data-tool]').forEach((tool, index) => {
    const lean = index % 2 === 0 ? -1 : 1;
    const settles = 0.7 + index * 0.3;

    gsap.fromTo(
      tool,
      { autoAlpha: 0, y: 28, rotation: 8 * lean },
      { autoAlpha: 1, y: 0, rotation: 0, duration: 1.3, ease: 'ck', delay: settles },
    );

    // Starts the moment the entrance ends, so the two never write `y` at once.
    const drift = gsap.to(tool, {
      y: -22,
      rotation: 3.5 * -lean,
      duration: 6 + index * 1.5,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      delay: settles + 1.3,
    });

    ScrollTrigger.create({
      trigger: tool.parentElement,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? drift.resume() : drift.pause()),
    });
  });
}

/**
 * The plan tickets print.
 *
 * Each paper is uncovered from its top edge down while it slides the same way
 * -- a ticket feeding out of a slot -- its lines settle a beat behind, and the
 * perforation runs across last, just above the stub. The object doing what that
 * object does, which is the test every entrance on this site is held to.
 *
 * `ScrollTrigger.batch` rather than one trigger per ticket: on a wide screen
 * all four enter together and are staggered as a row; on a phone they arrive
 * one at a time as each is reached, and the same code does both.
 *
 * The transform lives on the paper and the hover lift on the ticket around it,
 * so GSAP and the stylesheet transition never write one property on one
 * element.
 */
function printTickets(q: Query) {
  const tickets = q('.plan-ticket');
  if (tickets.length === 0) return;

  gsap.set(tickets, { autoAlpha: 1 });
  gsap.set(q('.ticket-paper'), { clipPath: 'inset(0% 0% 100% 0%)', y: -28 });
  gsap.set(q('.ticket-row, .ticket-total'), { autoAlpha: 0, y: 6 });
  gsap.set(q('.ticket-stub'), { '--perf': 0 });

  ScrollTrigger.batch(tickets, {
    start: 'top 85%',
    once: true,
    onEnter: (batch) => {
      batch.forEach((ticket, index) => {
        const inTicket = gsap.utils.selector(ticket);

        gsap
          .timeline({ delay: index * 0.14, defaults: { ease: 'ck' } })
          .to(inTicket('.ticket-paper'), {
            clipPath: 'inset(0% 0% 0% 0%)',
            y: 0,
            duration: 1.05,
            clearProps: 'clipPath,transform',
          })
          .to(
            inTicket('.ticket-row, .ticket-total'),
            { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06 },
            0.4,
          )
          .to(inTicket('.ticket-stub'), { '--perf': 1, duration: 0.7 }, 0.65);
      });
    },
  });
}
