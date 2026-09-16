'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { gsap as GsapInstance } from 'gsap';

type Gsap = typeof GsapInstance;

/**
 * GSAP for the account overview, loaded when it is about to be needed.
 *
 * The overview is a task surface: nothing on it moves until the customer does
 * something -- skips a meal, opens the pause form -- so there is no reason for
 * the animation library to sit on the page's first load. It is fetched the
 * first time a pointer or focus arrives inside the overview (or once the page
 * goes idle), which is always before the round trip of an action can finish,
 * and every animation checks for it synchronously: if it is not there yet, the
 * change simply happens without moving. Nothing is ever hidden waiting for it.
 *
 * Its own entry rather than `site/gsap.ts` or `checkout/checkout-gsap.ts`:
 * this page needs the core and the `ck` curve, and none of the plugins those
 * two register.
 */

let loading: Promise<Gsap> | null = null;
let loaded: Gsap | null = null;

export function warmMotion(): Promise<Gsap> {
  if (!loading) {
    loading = Promise.all([import('gsap'), import('gsap/CustomEase')]).then(
      ([{ gsap }, { CustomEase }]) => {
        gsap.registerPlugin(CustomEase);
        // The same definition as `--ck-ease` and the storefront's `ck`, so the
        // account moves on the curve the rest of the site does.
        CustomEase.create('ck', '0.25,1,0.5,1');
        loaded = gsap;
        return gsap;
      },
    );
  }
  return loading;
}

/**
 * GSAP, if it has loaded and motion is welcome right now. Checked at the moment
 * of animating rather than once, so the reduced-motion setting can change
 * without a reload.
 */
export function readyMotion(): Gsap | null {
  if (!loaded || typeof window === 'undefined') return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return loaded;
}

/**
 * A scope for one island's animations: everything run through `animate` is
 * collected in a GSAP context bound to the island's root and reverted when it
 * unmounts, so a tween can never outlive the element it was moving.
 *
 * `animate` returns false when nothing ran, which callers use to fall back to
 * the plain state change.
 */
export function useMotion<T extends HTMLElement>() {
  const scope = useRef<T>(null);
  const context = useRef<gsap.Context | null>(null);

  useEffect(
    () => () => {
      context.current?.revert();
      context.current = null;
    },
    [],
  );

  const animate = useCallback((run: (gsap: Gsap, root: T) => void): boolean => {
    const gsap = readyMotion();
    const root = scope.current;
    if (!gsap || !root) return false;

    context.current ??= gsap.context(() => {}, root);
    context.current.add(() => run(gsap, root));
    return true;
  }, []);

  return { scope, animate };
}

/**
 * A number running from its old value to its new one, written into the text
 * node React rendered rather than replacing it -- React keeps a reference to
 * that node, and swapping it out would strand the next real update.
 */
export function countText(gsap: Gsap, element: HTMLElement, from: number, to: number): void {
  const write = (value: number) => {
    const node = element.firstChild;
    const text = String(value);
    if (node && node.nodeType === Node.TEXT_NODE) node.nodeValue = text;
    else element.textContent = text;
  };

  const proxy = { value: from };
  write(from);
  gsap.to(proxy, {
    value: to,
    duration: 0.6,
    ease: 'ck',
    onUpdate: () => write(Math.round(proxy.value)),
    onComplete: () => write(to),
  });
}

/** A short sideways shake on the thing that said no, always paired with the reason. */
export function shake(gsap: Gsap, target: Element): void {
  gsap.killTweensOf(target, 'x');
  gsap.fromTo(
    target,
    { x: 0 },
    { keyframes: { x: [0, -6, 6, -4, 4, -2, 0] }, duration: 0.36, ease: 'none', clearProps: 'x' },
  );
}
