'use client';

import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { Flip } from 'gsap/Flip';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { useGSAP } from '@gsap/react';

/**
 * GSAP for the buying flow: the plan page and checkout.
 *
 * Its own entry point rather than `site/gsap.ts`, because that one registers
 * ScrollTrigger and SplitText for the browsing pages, and nothing here scrolls
 * a timeline or splits a heading. Importing it would put both on the one route
 * where a slow phone is closest to paying.
 *
 * What is registered is what the flow actually does:
 *
 *   - **Flip**, for things that move because a choice moved them: the ring
 *     that follows the selected option, the price rows that make room when an
 *     offer line arrives.
 *   - **DrawSVG**, for a check being written when a step completes.
 *   - **ScrambleText**, once, for the subscription number arriving on the
 *     receipt.
 *
 * The `ck` curve is created again with the same definition as in
 * `site/gsap.ts`. Creating an ease under an existing name replaces it with an
 * identical one, so whichever module loads first, the flow and the storefront
 * move on the same curve as `--ck-ease`.
 */
gsap.registerPlugin(useGSAP, Flip, DrawSVGPlugin, ScrambleTextPlugin, CustomEase);
CustomEase.create('ck', '0.25,1,0.5,1');

export { gsap, Flip, useGSAP };

/**
 * Motion in the flow is feedback, never an entrance, and it still steps aside
 * for anyone who has asked for less of it. Checked at the moment of animating
 * rather than once, so the setting can change without a reload.
 */
export function motionAllowed(): boolean {
  return (
    typeof window !== 'undefined' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * A refusal: a short sideways shake on the thing that said no.
 *
 * Paired with a message every time -- the shake says "here", the words say
 * "why". It is 360ms and a few pixels, long enough to catch the eye that was
 * on the button and short enough to be over before anyone reads it.
 */
export function shake(target: Element | null | undefined): void {
  if (!target || !motionAllowed()) return;

  gsap.killTweensOf(target, 'x');
  gsap.fromTo(
    target,
    { x: 0 },
    { keyframes: { x: [0, -6, 6, -4, 4, -2, 0] }, duration: 0.36, ease: 'none', clearProps: 'x' },
  );
}

/**
 * A figure running from its old value to its new one, so a changed total is
 * seen to change rather than silently being different.
 *
 * It writes into the element's existing text node rather than setting
 * `textContent`. React rendered that node and keeps a reference to it;
 * replacing it would leave React updating a detached node, and the next real
 * change to the figure would never reach the screen.
 */
export function countTo(
  element: HTMLElement,
  from: number,
  to: number,
  format: (value: number) => string,
): void {
  const write = (text: string) => {
    const node = element.firstChild;
    if (node && node.nodeType === Node.TEXT_NODE) node.nodeValue = text;
    else element.textContent = text;
  };

  const proxy = { value: from };
  gsap.killTweensOf(proxy);

  if (!motionAllowed() || from === to) {
    write(format(to));
    return;
  }

  write(format(from));
  gsap.to(proxy, {
    value: to,
    duration: 0.6,
    ease: 'ck',
    onUpdate: () => write(format(Math.round(proxy.value * 100) / 100)),
    onComplete: () => write(format(to)),
  });
}
