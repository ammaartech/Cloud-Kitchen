'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * What each account page looked like the last time it loaded, so its skeleton
 * can draw that page rather than a generic one.
 *
 * A skeleton that does not match what replaces it is worse than none: the
 * customer reads a layout, and then the layout changes under them. The shell
 * is static -- it is prerendered and prefetched, which is why it paints
 * instantly -- so it cannot know whether this customer has a plan or how many
 * addresses they keep. The browser can. Each page writes its outline here once
 * it has rendered, and the next visit's skeleton reads it.
 *
 * Only an outline: counts and which variant of a block was showing. No names,
 * no dates, no amounts -- nothing here says anything about the customer that a
 * glance at their screen would not.
 *
 * `localStorage` may be missing, full or refused (private windows, blocked
 * storage). Every access is guarded, and an unreadable value is simply "no
 * outline yet", which draws the default shape.
 */

export type OverviewShape = {
  /** A live plan: the two-column layout. Otherwise the "once you have a plan" card. */
  plan: boolean;
  /** Which variant the next-delivery panel was in. */
  next: 'skip' | 'lock' | 'progress' | 'empty';
  /** Weekdays (0 = Sunday) the two-week strip had something on. */
  activeWeekdays: number[];
  /** Rows listed under the strip, before "Show more". */
  rows: number;
  more: boolean;
  /** Label-value rows on the plan ticket, and whether the cycle bar showed. */
  facts: number;
  cycle: boolean;
  history: number;
  invoices: number;
};

/** `retired`: whether the note about removed addresses closes the page. */
export type AddressesShape = { customer: boolean; cards: number; retired: boolean };
/** `note`: the line under the review form about dishes still to review. */
export type ReviewsShape = { customer: boolean; cards: number; note: boolean };
export type RefundsShape = { customer: boolean; cards: number; openCase: boolean };

type Shapes = {
  overview: OverviewShape;
  addresses: AddressesShape;
  reviews: ReviewsShape;
  refunds: RefundsShape;
};

type Page = keyof Shapes;

/**
 * How long the page's wrapping texts were, in characters, so a skeleton can
 * set a placeholder of the same length that wraps onto the same number of
 * lines (`TextBone`). `texts` are page-level, a list per selector; `cards`
 * are per card, in order, so an optional line on one card cannot shift the
 * lengths of the next.
 */
export type Measured = {
  texts?: Record<string, number[]>;
  cards?: Array<Record<string, number>>;
};

export type Remembered<P extends Page> = Shapes[P] & Measured;

/** What `RememberShape` should measure, as selectors within the page. */
export type Measure = {
  texts?: Record<string, string>;
  card?: string;
  cardTexts?: Record<string, string>;
};

function textLength(element: Element | null): number {
  return element?.textContent?.replace(/\s+/g, ' ').trim().length ?? 0;
}

function measure(scope: Element, spec: Measure): Measured {
  const out: Measured = {};
  if (spec.texts) {
    out.texts = {};
    for (const [name, selector] of Object.entries(spec.texts)) {
      out.texts[name] = [...scope.querySelectorAll(selector)].map(textLength);
    }
  }
  if (spec.card && spec.cardTexts) {
    const fields = Object.entries(spec.cardTexts);
    out.cards = [...scope.querySelectorAll(spec.card)].map((card) => {
      const lengths: Record<string, number> = {};
      for (const [name, selector] of fields) {
        const found = card.querySelector(selector);
        if (!found) continue;
        lengths[name] = textLength(found);
        // A review or a refund reason keeps the line breaks it was typed with
        // (`white-space: pre-line`); count them, or a four-line note would be
        // drawn as one long paragraph.
        if (getComputedStyle(found).whiteSpace.startsWith('pre')) {
          const breaks = (found.textContent?.trim().match(/\n/g) ?? []).length;
          if (breaks > 0) lengths[`${name}Breaks`] = breaks;
        }
      }
      return lengths;
    });
  }
  return out;
}

const key = (page: Page) => `ck:account-shape:${page}`;

/** Listeners for same-tab writes; `storage` events only cover other tabs. */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function read(page: Page): string | null {
  try {
    return window.localStorage.getItem(key(page));
  } catch {
    return null;
  }
}

/**
 * The last outline of `page`, or null.
 *
 * Null on the server and during hydration, so the prerendered shell and the
 * first client render agree; a remembered outline replaces the default in the
 * very next render. On a client-side navigation -- a tab press, the common
 * case -- there is no hydration, and the remembered outline is the first thing
 * drawn.
 */
export function useShape<P extends Page>(page: P): Remembered<P> | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(page),
    () => null,
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Remembered<P>;
  } catch {
    return null;
  }
}

/**
 * Rendered inside a loaded page: records its outline for the next visit.
 *
 * `measure` is read from the rendered DOM, scoped to this element's parent --
 * the page's own container -- after every render, so an edit that lengthens an
 * address is in the next skeleton without the page having to say so. It is a
 * handful of `textContent` reads, and the write is skipped when nothing changed.
 */
export function RememberShape<P extends Page>({
  page,
  shape,
  measure: spec,
}: {
  page: P;
  shape: Shapes[P];
  measure?: Measure;
}) {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scope = anchor.current?.parentElement;
    const value = JSON.stringify({ ...shape, ...(scope && spec ? measure(scope, spec) : {}) });
    try {
      if (window.localStorage.getItem(key(page)) === value) return;
      window.localStorage.setItem(key(page), value);
    } catch {
      return;
    }
    for (const listener of listeners) listener();
  });

  return <span ref={anchor} hidden />;
}
