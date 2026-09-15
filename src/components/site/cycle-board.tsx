'use client';

import { useRef } from 'react';
import { buttonClasses } from '@/components/ui/button-styles';
import { gsap, useGSAP } from './gsap';

/**
 * "What a cycle looks like": the four account rules, and a month that acts
 * them out.
 *
 * The rules used to be three captions in a box at the foot of the page, which
 * is the weakest way to explain a mechanism -- "skipping returns your
 * entitlement" is a sentence about something moving, and it is much easier to
 * believe once you have watched it move. So the board plays one cycle: meals
 * are delivered, one day is skipped and its meal travels back to the balance,
 * a week is paused and five more follow it, and then the plan is cancelled and
 * the days left over are struck out while the delivered ones stay put.
 *
 * ## It is an example, and says so
 *
 * The cycle is fixed -- thirty days, weekday deliveries, the skip and pause and
 * cancel on chosen days -- rather than read from a plan, because it is not a
 * plan. It illustrates the rules, is labelled as an example on the board, and
 * the rules beside it are the actual content. That is also why the board is a
 * single `role="img"` with a sentence for a name: a screen reader gets the
 * outcome in words instead of thirty day cells.
 *
 * ## The failure mode
 *
 * The markup is the *finished* month. Every cell renders in its final state and
 * every count at its final value, and GSAP rewinds it to the start of the cycle
 * before playing it forward. So a visitor with no JavaScript, or one who asked
 * for reduced motion, sees the end of the story -- which is the whole story --
 * rather than a blank calendar waiting for an animation that will never run.
 *
 * Each cell's outcome is one custom property, `--on`, from 0 to 1. The
 * stylesheet turns it into whatever that outcome looks like -- a fill, a dashed
 * ring, a hatch wiping across, a dimmed number -- so the timeline only says
 * *when* each day happens and never has to know what happening looks like.
 */

type Role = 'off' | 'delivered' | 'skipped' | 'paused' | 'cancelled';

const CYCLE_LENGTH = 30;
const SKIPPED_DAY = 9;
const PAUSED_FROM = 15;
const PAUSED_TO = 19;
const CANCELLED_FROM = 25;

/** The cycle starts on a Monday, so a day's weekday is its offset mod 7. */
function roleOf(day: number): Role {
  if ((day - 1) % 7 >= 5) return 'off';
  if (day === SKIPPED_DAY) return 'skipped';
  if (day >= PAUSED_FROM && day <= PAUSED_TO) return 'paused';
  if (day >= CANCELLED_FROM) return 'cancelled';
  return 'delivered';
}

const DAYS = Array.from({ length: CYCLE_LENGTH }, (_, index) => ({
  day: index + 1,
  role: roleOf(index + 1),
}));

const daysWhere = (role: Role) =>
  DAYS.filter((entry) => entry.role === role).map((entry) => entry.day);

const DELIVERED = daysWhere('delivered');
const PAUSED = daysWhere('paused');
const CANCELLED = daysWhere('cancelled');
const RETURNED = 1 + PAUSED.length;

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const RULES = [
  {
    title: 'Each delivery draws from your plan',
    body: 'A delivery uses its meal, or its credits, from the cycle you paid for.',
  },
  {
    title: 'Skipping returns your entitlement',
    body: 'Skip a delivery before it reaches the kitchen and the credit goes back to your balance.',
  },
  {
    title: 'Pausing is built in',
    body: 'Going away? Pause the plan. Deliveries in that window are skipped automatically.',
  },
  {
    title: 'Cancel without losing history',
    body: 'Cancelling stops future deliveries. Anything already cooking still arrives, and your records stay.',
  },
] as const;

const LEGEND = [
  { key: 'delivered', label: 'delivered' },
  { key: 'skipped', label: 'skipped' },
  { key: 'paused', label: 'paused' },
  { key: 'cancelled', label: 'not sent' },
] as const;

const BOARD_LABEL =
  `An example ${CYCLE_LENGTH}-day cycle with weekday deliveries. ` +
  `${DELIVERED.length} meals are delivered. One delivery is skipped and ${PAUSED.length} are paused, ` +
  `and all ${RETURNED} of those go back to the balance. The plan is then cancelled, ` +
  `so the last ${CANCELLED.length} deliveries are not sent.`;

export function CycleBoard() {
  const scope = useRef<HTMLDivElement>(null);
  const run = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        run.current = buildRun(root);
        return () => {
          run.current = null;
        };
      });

      return () => mm.revert();
    },
    { scope },
  );

  /* `invalidate()` before the restart so the flights measure where the balance
     is again. The first run measured it wherever the page was laid out then,
     and a window resized since would send every meal to the old spot. */
  function replay() {
    run.current?.invalidate().restart();
  }

  return (
    <div ref={scope} className="cycle-split">
      <ol className="cycle-rules">
        {RULES.map((rule) => (
          <li key={rule.title} className="cycle-rule" data-rise>
            <span className="cycle-rule-bar" aria-hidden />
            <h3>{rule.title}</h3>
            <p>{rule.body}</p>
          </li>
        ))}
      </ol>

      <div data-rise>
        <div className="cycle-board" role="img" aria-label={BOARD_LABEL}>
          <div className="cycle-board-head">
            <div>
              <p className="cycle-board-kicker">example cycle</p>
              <p className="cycle-board-title">{CYCLE_LENGTH} days, weekday deliveries</p>
            </div>

            <div className="cycle-tally">
              <p className="cycle-count">
                <b className="tabular" data-count="delivered">
                  {DELIVERED.length}
                </b>
                delivered
              </p>
              <p className="cycle-count">
                <span className="cycle-pot" />
                <b className="tabular" data-count="returned">
                  {RETURNED}
                </b>
                back in balance
              </p>
            </div>
          </div>

          <div className="cycle-week cycle-weekdays">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday}>{weekday.slice(0, 1)}</span>
            ))}
          </div>

          <div className="cycle-week cycle-grid">
            {DAYS.map(({ day, role }) => (
              <div key={day} className="cycle-day" data-day={day} data-role={role}>
                <span className="cycle-num tabular">{day}</span>
                {role === 'delivered' ? <span className="cycle-fill" /> : null}
                {role === 'skipped' ? <span className="cycle-ring" /> : null}
                {role === 'paused' ? <span className="cycle-hatch" /> : null}
                {role === 'cancelled' ? (
                  <svg className="cycle-strike" viewBox="0 0 40 40" focusable="false">
                    <line x1="11" y1="29" x2="29" y2="11" />
                  </svg>
                ) : null}
                {role === 'off' ? null : <span className="cycle-dot" />}
              </div>
            ))}
          </div>

          <ul className="cycle-legend">
            {LEGEND.map((entry) => (
              <li key={entry.key}>
                <span className="cycle-key" data-key={entry.key} />
                {entry.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="cycle-replay-row">
          <button
            type="button"
            onClick={replay}
            className={buttonClasses('outline', 'sm', 'btn-plain cycle-replay')}
          >
            play the cycle again
          </button>
        </div>
      </div>
    </div>
  );
}

/** Seconds between one day and the next inside a run of deliveries. */
const STEP = 0.1;

function centre(element: Element) {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * The cycle, as one timeline.
 *
 * Built from three verbs -- `deliver`, `sendBack`, `focus` -- that each return
 * where they finish, so the month reads top to bottom in the order it happens,
 * and lengthening one beat moves everything after it instead of overlapping it.
 */
function buildRun(root: HTMLElement) {
  const q = gsap.utils.selector(root) as (selector: string) => HTMLElement[];
  const cell = (day: number) => q(`.cycle-day[data-day="${day}"]`)[0];
  const cells = (days: number[]) => days.map(cell);
  const dots = (days: number[]) => days.map((day) => cell(day).querySelector('.cycle-dot'));

  const [pot] = q('.cycle-pot');
  const [delivered] = q('[data-count="delivered"]');
  const [returned] = q('[data-count="returned"]');
  const bars = q('.cycle-rule-bar');

  const run = gsap.timeline({
    defaults: { ease: 'ck' },
    scrollTrigger: { trigger: q('.cycle-board')[0], start: 'top 70%', once: true },
  });

  /* The start of the month, written twice on purpose. `gsap.set` rewinds the
     board now, before anyone has scrolled to it, so nobody catches the finished
     month and watches it snap back. The copy inside the timeline at position 0
     is what a replay rewinds to. */
  const start: Array<[gsap.TweenTarget, gsap.TweenVars]> = [
    [q('.cycle-day:not([data-role="off"])'), { '--on': 0 }],
    [q('.cycle-dot'), { autoAlpha: 1, scale: 0, x: 0, y: 0 }],
    [q('.cycle-strike line'), { drawSVG: '0%' }],
    [bars, { scaleY: 0 }],
    [[delivered, returned], { textContent: 0 }],
  ];

  for (const [targets, vars] of start) {
    gsap.set(targets, vars);
    run.set(targets, vars, 0);
  }

  const count = (element: HTMLElement, to: number, duration: number, at: number) =>
    run.to(element, { textContent: to, snap: { textContent: 1 }, duration, ease: 'none' }, at);

  /** A run of days delivered: each fills in turn and the count keeps pace. */
  const deliver = (days: number[], at: number, countFrom: number) => {
    run
      .to(cells(days), { '--on': 1, duration: 0.45, stagger: STEP }, at)
      .to(dots(days), { scale: 0, duration: 0.3, stagger: STEP }, at);
    count(delivered, countFrom + days.length, STEP * days.length + 0.25, at);

    return at + STEP * days.length + 0.45;
  };

  /**
   * Meals going back to the balance: each dot lifts out of its day and lands in
   * the pot beside the count, which ticks up as they arrive.
   *
   * The distances are functions, so they are measured when the flight starts
   * rather than when the timeline was built -- by then the fonts have landed and
   * the board is wherever it finally ended up.
   */
  const sendBack = (days: number[], at: number, countFrom: number) => {
    const travelling = dots(days);

    run
      .to(
        travelling,
        {
          x: (_index: number, dot: Element) => centre(pot).x - centre(dot).x,
          y: (_index: number, dot: Element) => centre(pot).y - centre(dot).y,
          duration: 0.8,
          stagger: 0.08,
          ease: 'ck-travel',
        },
        at,
      )
      .to(travelling, { autoAlpha: 0, scale: 0.3, duration: 0.2, stagger: 0.08 }, at + 0.62)
      .fromTo(
        pot,
        { scale: 1 },
        { scale: 1.4, duration: 0.18, repeat: 1, yoyo: true, ease: 'power1.inOut' },
        at + 0.7,
      );
    count(returned, countFrom + days.length, 0.08 * days.length + 0.2, at + 0.7);

    return at + 0.8 + 0.08 * days.length;
  };

  /** Marks which rule the board is acting out; -1 clears the marker. */
  const focus = (rule: number, at: number) => {
    run.to(bars, { scaleY: (index: number) => (index === rule ? 1 : 0), duration: 0.4 }, at);
  };

  const early = DELIVERED.filter((day) => day < SKIPPED_DAY);
  const middle = DELIVERED.filter((day) => day > SKIPPED_DAY && day < PAUSED_FROM);
  const late = DELIVERED.filter((day) => day > PAUSED_TO);

  // The plan starts: a meal set out on every day it will be delivered.
  focus(0, 0);
  run.to(q('.cycle-dot'), { scale: 1, duration: 0.35, stagger: 0.025 }, 0.1);
  let at = deliver(early, 0.9, 0);

  // A skip.
  focus(1, at);
  run.to(cell(SKIPPED_DAY), { '--on': 1, duration: 0.4 }, at + 0.1);
  at = sendBack([SKIPPED_DAY], at + 0.35, 0);
  at = deliver(middle, at + 0.1, early.length);

  // A week away.
  focus(2, at + 0.1);
  run.to(cells(PAUSED), { '--on': 1, duration: 0.5, stagger: 0.07 }, at + 0.2);
  at = sendBack(PAUSED, at + 0.55, 1);
  at = deliver(late, at + 0.1, early.length + middle.length);

  // Cancelled: what is left is struck out, what was delivered stays.
  focus(3, at + 0.1);
  run
    .to(cells(CANCELLED), { '--on': 1, duration: 0.45, stagger: 0.1 }, at + 0.2)
    .to(
      q('.cycle-strike line'),
      { drawSVG: '100%', duration: 0.35, stagger: 0.1, ease: 'power2.inOut' },
      at + 0.2,
    )
    .to(dots(CANCELLED), { autoAlpha: 0, scale: 0, duration: 0.3, stagger: 0.1 }, at + 0.2);
  focus(-1, at + 2);

  return run;
}
