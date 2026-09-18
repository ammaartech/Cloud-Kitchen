'use client';

import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { useGSAP } from '@gsap/react';

/**
 * GSAP for the receipt, and only for the receipt.
 *
 * Its own entry point rather than `site/gsap.ts`, because that one registers
 * ScrollTrigger and SplitText for the browsing pages, and nothing here scrolls
 * a timeline or splits a heading. Importing it would put both on the one route
 * where a slow phone is closest to paying.
 *
 * Nothing the customer sees before a payment succeeds reaches this module.
 * Shakes, counting figures and travelling rings are in `checkout-motion.ts`,
 * written against the Web Animations API, so GSAP is behind the receipt's lazy
 * chunk rather than in the initial checkout bundle. The two plugins the receipt
 * needs are registered in `receipt.tsx`, beside the timeline that uses them.
 *
 * The `ck` curve is created again with the same definition as in
 * `site/gsap.ts`. Creating an ease under an existing name replaces it with an
 * identical one, so whichever module loads first, the flow and the storefront
 * move on the same curve as `--ck-ease` and as `CHECKOUT_EASE`.
 */
gsap.registerPlugin(useGSAP, CustomEase);
CustomEase.create('ck', '0.25,1,0.5,1');

export { gsap, useGSAP };
