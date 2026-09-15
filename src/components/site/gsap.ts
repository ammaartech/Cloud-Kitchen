'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { CustomEase } from 'gsap/CustomEase';
import { useGSAP } from '@gsap/react';

/**
 * The storefront's one GSAP entry point.
 *
 * Every component that animates with GSAP imports from here rather than from
 * `gsap` directly, so the plugins are registered exactly once and the eases
 * below exist before any tween asks for them by name. Registering is also what
 * stops a production build tree-shaking a plugin that is only ever referenced
 * as a string (`drawSVG: '100%'`, `ease: 'ck'`).
 *
 * This is the bundle the Motion library in `hero-motion.tsx` is not: GSAP is
 * loaded by the routes that import this file and by nothing else, so the home
 * page pays none of it.
 */
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin, CustomEase);

/**
 * `--ck-ease`, as a GSAP ease. The stylesheet's curve -- confident
 * deceleration, no bounce -- is the system's motion, and a GSAP entrance on a
 * different curve from the CSS hover beside it reads as two hands. Named
 * rather than inlined so a change to the token is a change here too.
 */
CustomEase.create('ck', '0.25,1,0.5,1');

/**
 * For things that travel between two places on screen rather than arrive in
 * one. An entrance wants to be fast at the start and settle; a journey wants to
 * leave gently and land gently, or it looks thrown.
 */
CustomEase.create('ck-travel', '0.65,0,0.35,1');

export { gsap, ScrollTrigger, SplitText, useGSAP };
