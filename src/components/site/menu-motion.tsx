'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/components/ui/button-styles';
import { gsap, ScrollTrigger, SplitText, useGSAP } from './gsap';
import { riseOnScroll, splitHeadings, type Query } from './motion-reveals';
import { VegMark } from './veg-mark';

/** What the pass needs to show a dish. Plain values, so it crosses from the server. */
export type PassDish = {
  id: string;
  name: string;
  description: string;
  price: string;
  facts: string[];
  vegetarian: boolean;
  available: boolean;
  reason: string | null;
  imageUrl: string | null;
};

/**
 * The menu board arriving: hung, painted, lettered.
 *
 * Its strings are drawn down from the nail, the painted border runs round the
 * board in one stroke -- top, right, bottom, left, the way a sign painter
 * would -- and the title is lettered in a character at a time. Everything is
 * already where it will end up; the motion only decides the order it is seen
 * in, and it is done inside about a second.
 *
 * The search and the tally stream into the board after the shell, so they are
 * not part of this: they arrive with the board already up.
 */
export function MenuBoard({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const q = gsap.utils.selector(root) as Query;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const [title] = q('.board-title');
        // Words as well as chars: a bare char split makes every letter its own
        // inline box, so the browser can break "menu" into "me" / "nu" until the
        // split is reverted. Word wrappers keep each word unbreakable.
        const split = SplitText.create(title, { type: 'words,chars', mask: 'chars' });
        const paint = { duration: 0.28, ease: 'none' };

        gsap
          .timeline({ defaults: { ease: 'ck' } })
          .fromTo(
            q('.board-hanger line'),
            { drawSVG: '0%' },
            { drawSVG: '100%', duration: 0.45, stagger: 0.08, ease: 'power2.out' },
            0,
          )
          .fromTo(q('.menu-board'), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.1)
          .fromTo(q('.paint-top'), { scaleX: 0 }, { scaleX: 1, ...paint }, 0.35)
          .fromTo(q('.paint-right'), { scaleY: 0 }, { scaleY: 1, ...paint }, '>')
          .fromTo(q('.paint-bottom'), { scaleX: 0 }, { scaleX: 1, ...paint }, '>')
          .fromTo(q('.paint-left'), { scaleY: 0 }, { scaleY: 1, ...paint }, '>')
          .set(title, { autoAlpha: 1 }, 0.3)
          .fromTo(
            split.chars,
            { yPercent: 110 },
            { yPercent: 0, duration: 0.7, stagger: 0.03, onComplete: () => split.revert() },
            0.3,
          )
          .fromTo(
            q('.board-kicker, .board-lede'),
            { autoAlpha: 0, y: 12 },
            { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.1 },
            0.45,
          );
      });

      return () => mm.revert();
    },
    { scope },
  );

  return (
    <div ref={scope} className="menu-board-hang">
      {children}
    </div>
  );
}

/**
 * The menu itself: the section index, the list, and the pass.
 *
 * The index and the list are server-rendered and arrive as `children`; this
 * adds the pass beside them and wires the three together. It owns one piece of
 * state, which dish is on the pass, and everything else it does is imperative
 * GSAP against the markup it was handed.
 *
 * ## Which section you are in
 *
 * One ScrollTrigger per section, toggling as the section crosses the middle of
 * the viewport, moves the index marker to that section's link. On a phone the
 * index is a horizontal rail stuck under the header, so the marker slides
 * sideways and the rail scrolls itself to keep the current section in view; on
 * a desktop it is a column, and the marker is a bar that travels down it. The
 * links are ordinary anchors, so the index works as a jump list with no
 * JavaScript at all -- this only adds the "you are here".
 *
 * ## Which dish is on the pass
 *
 * Desktop only, and two inputs. Scrolling brings the row crossing the middle of
 * the screen to the pass, which works for a keyboard, a trackpad and a touch
 * screen alike. Pointing at a row overrides that while the pointer is over the
 * list -- otherwise the row under the cursor and the row in the middle of the
 * screen would fight as the page scrolled beneath a still mouse.
 */
export function MenuStage({ dishes, children }: { dishes: PassDish[]; children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const entered = useRef(false);
  // A search swaps the rows under a stage that stays mounted, so the wiring is
  // rebuilt for the new rows -- but the entrance only ever plays once.
  const rows = dishes.map((dish) => dish.id).join();

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const q = gsap.utils.selector(root) as Query;
      const mm = gsap.matchMedia();
      const first = !entered.current;
      entered.current = true;
      if (!first) setActive(0);

      mm.add(
        {
          moving: '(prefers-reduced-motion: no-preference)',
          still: '(prefers-reduced-motion: reduce)',
          wide: '(min-width: 64rem)',
        },
        (context) => {
          const { moving, wide } = context.conditions as { moving: boolean; wide: boolean };
          const cleanups: Array<() => void> = [];

          if (moving && first) {
            splitHeadings(q);
            riseOnScroll(q);
          } else if (moving) {
            // Rows a search brought in are hidden by motion-gate.css until
            // shown; they arrive in place rather than rising again.
            gsap.set(q('[data-enter], [data-rise]'), { autoAlpha: 1, y: 0 });
          }

          cleanups.push(followSections(q, { moving, wide }));
          if (wide) cleanups.push(followDishes(q, setActive));

          return () => cleanups.forEach((cleanup) => cleanup());
        },
      );

      let mounted = true;
      document.fonts?.ready.then(() => {
        if (mounted) ScrollTrigger.refresh();
      });

      return () => {
        mounted = false;
        mm.revert();
      };
    },
    { scope, dependencies: [rows], revertOnUpdate: true },
  );

  /* Marks the row that is on the pass. An attribute rather than a class, so it
     cannot collide with the `className` React owns on the server-rendered row. */
  useEffect(() => {
    const root = scope.current;
    if (!root) return;

    root.querySelectorAll('[data-dish][data-on]').forEach((row) => row.removeAttribute('data-on'));
    root.querySelector(`[data-dish="${active}"]`)?.setAttribute('data-on', '');
  }, [active]);

  return (
    <div ref={scope} className="menu-layout">
      {children}
      {dishes.length > 0 ? <PassWindow dishes={dishes} active={active} /> : null}
    </div>
  );
}

/** Moves the index marker to whichever section is in the middle of the screen. */
function followSections(q: Query, { moving, wide }: { moving: boolean; wide: boolean }) {
  const [rail] = q('.menu-index-list');
  const [marker] = q('.menu-index-marker');
  const links = q('[data-index-link]');
  const sections = q('[data-section]');
  if (!rail || !marker || links.length === 0) return () => {};

  let current = 0;

  const place = (index: number, animate: boolean) => {
    const link = links[index];
    if (!link) return;
    current = index;

    links.forEach((each, i) =>
      i === index ? each.setAttribute('aria-current', 'true') : each.removeAttribute('aria-current'),
    );

    gsap.to(marker, {
      ...(wide
        ? { y: link.offsetTop, height: link.offsetHeight }
        : { x: link.offsetLeft, width: link.offsetWidth }),
      autoAlpha: 1,
      duration: animate && moving ? 0.5 : 0,
      ease: 'ck',
      overwrite: 'auto',
    });

    // The rail is narrower than its links on a phone, so the current one is
    // kept centred in it rather than left wherever the last tap put it.
    if (!wide) {
      rail.scrollTo({
        left: link.offsetLeft - rail.clientWidth / 2 + link.offsetWidth / 2,
        behavior: animate && moving ? 'smooth' : 'auto',
      });
    }
  };

  sections.forEach((section, index) => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => {
        if (self.isActive) place(index, true);
      },
    });
  });

  place(0, false);

  // Offsets change with the layout, so the marker is put back after every
  // refresh -- a resize, a font landing, the rail becoming a column.
  const replace = () => place(current, false);
  ScrollTrigger.addEventListener('refresh', replace);

  return () => ScrollTrigger.removeEventListener('refresh', replace);
}

/** Brings a dish to the pass by scroll position, or by pointing at it. */
function followDishes(q: Query, show: (index: number) => void) {
  const [list] = q('.menu-list');
  const rows = q('[data-dish]');
  if (!list || rows.length === 0) return () => {};

  let pointing = false;

  const onOver = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    const row = (event.target as Element).closest<HTMLElement>('[data-dish]');
    if (row) show(Number(row.dataset.dish));
  };
  const onEnter = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') pointing = true;
  };
  const onLeave = () => {
    pointing = false;
  };

  list.addEventListener('pointerover', onOver);
  list.addEventListener('pointerenter', onEnter);
  list.addEventListener('pointerleave', onLeave);

  rows.forEach((row, index) => {
    ScrollTrigger.create({
      trigger: row,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: (self) => {
        if (self.isActive && !pointing) show(index);
      },
    });
  });

  return () => {
    list.removeEventListener('pointerover', onOver);
    list.removeEventListener('pointerenter', onEnter);
    list.removeEventListener('pointerleave', onLeave);
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * The pass: the window a plate comes through, and the one large photograph on
 * the desktop menu.
 *
 * ## Every photograph is already in it
 *
 * Each dish's photograph is a layer here from the start, stacked and hidden,
 * and changing dish is GSAP bringing one layer up over the last -- uncovered
 * from the bottom edge, settling from a slight zoom. Loading a photograph on
 * demand would put a network wait between pointing at a dish and seeing it,
 * and a wipe that reveals an empty frame is worse than no wipe. The cost is the
 * menu's photographs at pass size, on desktop only: the pass is `display: none`
 * below `lg`, and a lazy image in a box that is not displayed is never fetched.
 *
 * ## It repeats the row
 *
 * Everything written here is also in the list, so the whole pass is hidden from
 * assistive tech. Otherwise a screen reader would hear every dish twice, and
 * the second time out of reading order.
 */
function PassWindow({ dishes, active }: { dishes: PassDish[]; active: number }) {
  const scope = useRef<HTMLElement>(null);
  const shown = useRef<number | null>(null);
  const dish = dishes[active] ?? dishes[0];

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const q = gsap.utils.selector(root) as Query;
      const layers = q('[data-layer]');
      const incoming = q(`[data-layer="${active}"]`)[0];
      const previous = shown.current;
      shown.current = active;

      if (previous === null || previous === active) {
        if (incoming) gsap.set(incoming, { autoAlpha: 1, zIndex: 2 });
        return;
      }

      const outgoing = q(`[data-layer="${previous}"]`)[0];
      gsap.set(
        layers.filter((layer) => layer !== incoming && layer !== outgoing),
        { autoAlpha: 0, zIndex: 0 },
      );
      if (outgoing) gsap.set(outgoing, { zIndex: 1 });

      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!incoming || still) {
        if (incoming) gsap.set(incoming, { autoAlpha: 1, zIndex: 2, clipPath: 'none' });
        if (outgoing) gsap.set(outgoing, { autoAlpha: 0, zIndex: 0 });
        return;
      }

      gsap
        .timeline({ defaults: { ease: 'ck' } })
        .fromTo(
          incoming,
          { autoAlpha: 1, zIndex: 2, clipPath: 'inset(100% 0% 0% 0%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            duration: 0.6,
            overwrite: true,
            onComplete: () => {
              // Unless the visitor has already come back to the dish underneath.
              if (outgoing && shown.current !== previous) gsap.set(outgoing, { autoAlpha: 0, zIndex: 0 });
            },
          },
          0,
        )
        .fromTo(incoming.querySelector('img'), { scale: 1.1 }, { scale: 1, duration: 0.9 }, 0)
        .fromTo(
          q('[data-swap]'),
          { autoAlpha: 0, y: 8 },
          { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.04, overwrite: true },
          0.05,
        );
    },
    { dependencies: [active], scope },
  );

  return (
    <aside ref={scope} className="menu-pass" aria-hidden>
      <div className="pass-frame">
        <p className="pass-label">
          <span>on the pass</span>
          <span className="tabular" data-swap>
            {pad(active + 1)} / {pad(dishes.length)}
          </span>
        </p>

        <div className={cx('pass-photo', !dish.available && 'is-unavailable')}>
          {dishes.map((entry, index) =>
            entry.imageUrl ? (
              <div key={entry.id} className="pass-layer" data-layer={index}>
                <Image
                  src={entry.imageUrl}
                  alt=""
                  fill
                  sizes="(min-width: 64rem) 23rem, 1px"
                  loading="lazy"
                  className="object-cover"
                />
              </div>
            ) : null,
          )}
          {dish.imageUrl ? null : <p className="pass-empty">No photo yet</p>}
        </div>

        <span className="pass-shelf" />

        <div className="pass-copy">
          <div className="pass-title" data-swap>
            <VegMark vegetarian={dish.vegetarian} />
            <p className="pass-name">{dish.name}</p>
            <p className="pass-price tabular">{dish.price}</p>
          </div>
          {dish.description ? (
            <p className="pass-desc" data-swap>
              {dish.description}
            </p>
          ) : null}
          {dish.facts.length > 0 ? (
            <ul className="pass-facts" data-swap>
              {dish.facts.map((fact) => (
                <li key={fact} className="tabular">
                  {fact}
                </li>
              ))}
            </ul>
          ) : null}
          {dish.available ? null : (
            <p className="pass-off" data-swap>
              Off today{dish.reason ? `: ${dish.reason}` : ''}
            </p>
          )}
        </div>
      </div>

      <p className="pass-hint">Scroll the menu, or point at a dish.</p>
    </aside>
  );
}
