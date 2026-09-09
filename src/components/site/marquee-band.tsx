'use client';

import { useRef } from 'react';
import { useInView } from 'motion/react';
import { cx } from '@/components/ui/button-styles';
import {
  BowlIcon,
  HomeIcon,
  LeafIcon,
  PotIcon,
  SunriseIcon,
} from '@/components/site/icons';

/**
 * The band between the steps and the menu.
 *
 * There was a seam there and nothing in it: "How a subscription works" ends on
 * four short captions and "what we cook" opens on a heading, so the page went
 * from an explanation straight into a grid with no beat between them. A band
 * that moves is the right thing to put in a gap like that -- it is not asking
 * to be read, it is telling the eye that one part of the page has ended.
 *
 * ## What it says
 *
 * Five claims, each with the mark that means it, and all five are things said
 * elsewhere on the site in longer form. That is the test a marquee has to pass:
 * a strip of moving words that introduces new information is information nobody
 * can read, because it is leaving the screen. These are reminders, and a
 * reminder can be missed.
 *
 * ## How it moves
 *
 * One CSS animation translating the track by exactly half its width, with the
 * list rendered twice. At -50% the second copy sits precisely where the first
 * one started, so the loop has no seam and needs no measurement, no `requestAnimationFrame`
 * and no resize handling -- the numbers are percentages of the track's own
 * width, whatever that turns out to be.
 *
 * It runs continuously rather than tracking the scroll position. Scroll-linked
 * movement means the band is still when the page is, which on a band whose only
 * job is to look alive is the one state it must not have.
 *
 * ## Why it waits
 *
 * The animation is created paused and started by a class, so the loop is not
 * running down the page while the visitor is four sections above it. The
 * observer is `once`: the band does not stop again on the way back up, because
 * a marquee that halts as it leaves the viewport is a thing that looks broken
 * in every screenshot taken of it.
 *
 * `aria-hidden` on the whole band, and it is not laziness. Every phrase here
 * is already on the page in a sentence a screen reader will reach; announcing
 * ten duplicated fragments between two sections would be reading out the
 * furniture. The second copy of the list is furniture even visually.
 */

const CLAIMS = [
  { icon: SunriseIcon, label: 'Cooked this morning' },
  { icon: HomeIcon, label: 'Home-style, always' },
  { icon: LeafIcon, label: 'Bought fresh for the day' },
  { icon: PotIcon, label: 'One small menu' },
  { icon: BowlIcon, label: 'Delivered warm' },
] as const;

function Run({ 'aria-hidden': ariaHidden }: { 'aria-hidden'?: boolean }) {
  return (
    <div className="marquee-run" aria-hidden={ariaHidden}>
      {CLAIMS.map(({ icon: Icon, label }) => (
        <span key={label} className="marquee-item">
          <Icon className="marquee-icon" />
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}

export function MarqueeBand({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  /* `amount: 0` -- any part of the band counts. A marquee that waits until it
     is 20% visible starts a fifth of a band late, and the first thing the
     visitor sees is a row that was already moving before they got to it, which
     is the opposite of the effect. */
  const seen = useInView(ref, { once: true, amount: 0 });

  return (
    <div
      ref={ref}
      aria-hidden
      className={cx('marquee', seen && 'is-running', className)}
    >
      <div className="marquee-track">
        <Run />
        {/* The seam-filler. Identical to the first run and hidden from the
            accessibility tree twice over -- the band is already `aria-hidden`,
            but this stays marked in case that ever comes off. */}
        <Run aria-hidden />
      </div>
    </div>
  );
}
