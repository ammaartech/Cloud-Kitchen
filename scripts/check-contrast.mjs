/**
 * Contrast and separation guard for the design tokens.
 *
 * Reads the real values out of `src/app/globals.css` rather than keeping a
 * second copy, so it cannot drift from what actually ships. Run it after
 * touching the palette:
 *
 *   npm run check:contrast
 *
 * Two things are checked, because one is not enough:
 *
 *   WCAG contrast   luminance only. Answers "can this be read".
 *   OKLab delta-E   perceptual. Answers "can these two be told apart" -- which
 *                   contrast cannot, since two colours of equal lightness and
 *                   opposite hue score 1.0:1 there. The KOT board depends on
 *                   the brand green and the success green not being confusable.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/app/globals.css'), 'utf8');

/* -------------------------------------------------------------------------- */
/* Token extraction                                                           */
/* -------------------------------------------------------------------------- */

/** Pulls one `--ck-*` block (`:root` or the ops override) into a map. */
function tokens(selector) {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Could not find ${selector} in globals.css`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('\n}', open);
  const body = css.slice(open, close);

  const map = {};
  for (const [, name, value] of body.matchAll(/--ck-([a-z-]+):\s*(#[0-9a-fA-F]{3,8})/g)) {
    map[name] = value;
  }
  return map;
}

const light = tokens(':root {');
const ops = tokens('[data-surface="ops"] {');

/* -------------------------------------------------------------------------- */
/* Colour maths                                                               */
/* -------------------------------------------------------------------------- */

const rgb = (h) => {
  const s = h.replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toLinear = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (h) => {
  const [r, g, b] = rgb(h).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
};

const oklab = (h) => {
  const [r, g, b] = rgb(h).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const deltaE = (a, b) => {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

const WHITE = '#ffffff';

/* -------------------------------------------------------------------------- */
/* The contract                                                               */
/* -------------------------------------------------------------------------- */

/** 4.5:1 for body text, 3:1 for control boundaries and focus rings. */
const pairs = (t, on) => [
  ['text / surface', t.text, t.surface, 4.5],
  ['text / bg', t.text, t.bg, 4.5],
  ['text / sunken', t.text, t['surface-sunken'], 4.5],
  ['muted / surface', t['text-muted'], t.surface, 4.5],
  ['muted / bg', t['text-muted'], t.bg, 4.5],
  ['muted / sunken', t['text-muted'], t['surface-sunken'], 4.5],
  ['subtle / surface', t['text-subtle'], t.surface, 4.5],
  ['subtle / bg', t['text-subtle'], t.bg, 4.5],
  ['subtle / sunken', t['text-subtle'], t['surface-sunken'], 4.5],
  ['brand / surface', t.brand, t.surface, 4.5],
  ['brand / bg', t.brand, t.bg, 4.5],
  // The three states of the soft button, whose label is always `brand`.
  ['brand / brand-soft', t.brand, t['brand-soft'], 4.5],
  ['brand / brand-soft-hover', t.brand, t['brand-soft-hover'], 4.5],
  ['brand / brand-soft-active', t.brand, t['brand-soft-active'], 4.5],
  ['success / success-soft', t.success, t['success-soft'], 4.5],
  ['warning / warning-soft', t.warning, t['warning-soft'], 4.5],
  ['danger / danger-soft', t.danger, t['danger-soft'], 4.5],
  ['info / info-soft', t.info, t['info-soft'], 4.5],
  // Non-text.
  ['border-strong / surface', t['border-strong'], t.surface, 3],
  ['border-strong / bg', t['border-strong'], t.bg, 3],
  ['focus ring / surface', t.brand, t.surface, 3],
  ['focus ring / bg', t.brand, t.bg, 3],
  ...(on === 'light'
    ? [
        // Filled buttons carry white labels on the light surface.
        ['white / brand  (primary)', WHITE, t.brand, 4.5],
        ['white / brand-hover', WHITE, t['brand-hover'], 4.5],
        ['white / danger', WHITE, t.danger, 4.5],
        ['white / success', WHITE, t.success, 4.5],
      ]
    : [
        ['ops accent / surface', t.accent, t.surface, 4.5],
        ['ops success / surface', t.success, t.surface, 4.5],
        ['ops warning / surface', t.warning, t.surface, 4.5],
        ['ops danger / surface', t.danger, t.surface, 4.5],
        ['ops info / surface', t.info, t.surface, 4.5],
      ]),
];

/**
 * Colours a manager or a cook must never confuse mid-rush. 0.10 is a
 * comfortably visible difference in OKLab.
 */
const separations = (t) => [
  ['brand vs success', t.brand, t.success],
  ['brand vs info', t.brand, t.info],
  ['success vs warning', t.success, t.warning],
  ['success vs danger', t.success, t.danger],
  ['source SW vs ZM', t['source-sw'], t['source-zm']],
  ['source ZM vs SX', t['source-zm'], t['source-sx']],
  ['source SW vs SX', t['source-sw'], t['source-sx']],
];

let failures = 0;

function report(title, list, seps) {
  console.log(`\n${title}`);
  console.log('-'.repeat(60));

  for (const [label, fg, bg, min] of list) {
    if (!fg || !bg) {
      console.log(`SKIP  ${label.padEnd(32)} token missing`);
      continue;
    }
    const value = contrast(fg, bg);
    const ok = value >= min;
    if (!ok) failures++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(32)} ${value.toFixed(2)}:1  (min ${min})`,
    );
  }

  for (const [label, a, b] of seps) {
    if (!a || !b) continue;
    const d = deltaE(a, b);
    const ok = d >= 0.1;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(32)} dE ${d.toFixed(3)}  (min 0.100)`);
  }
}

report('LIGHT  storefront + admin', pairs(light, 'light'), separations(light));
report('OPS    kitchen display', pairs(ops, 'ops'), separations({ ...light, ...ops }));

console.log(
  `\n${failures === 0 ? 'All token pairs pass.' : `${failures} failing pair(s).`}`,
);
process.exit(failures === 0 ? 0 : 1);
