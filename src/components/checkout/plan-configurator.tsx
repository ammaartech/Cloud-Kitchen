'use client';

import Image from 'next/image';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { PlanSummary, ProductCard } from '@/lib/data/catalog';
import { clockTime, money, weekdayList, weekdayName, PLAN_TYPE_LABELS } from '@/lib/format';
import { Spinner, cx } from '@/components/ui/primitives';
import { buttonClasses } from '@/components/ui/button-styles';
import { ArrowRightIcon, CheckIcon, TagIcon } from '@/components/site/icons';
import { useChoiceFlip } from './choice-flip';
import { gsap, motionAllowed, shake, useGSAP } from './checkout-gsap';

type DaysMode = 'every' | 'weekdays' | 'custom';
type Section = 'window' | 'days' | 'meals';

const WEEKDAYS = [1, 2, 3, 4, 5];
/** Monday first, the way a working week is read. Values stay Postgres dow. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const DAY_MODES: Array<{ value: DaysMode; label: string }> = [
  { value: 'every', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'custom', label: 'Pick days' },
];

/**
 * Building a plan: the step before checkout, and this product's cart.
 *
 * There is no basket of dishes here -- website orders are subscription
 * deliveries by design -- so the thing a customer "adds to cart" is one plan,
 * set up: when it arrives, which days, and for a pick-your-own plan, which
 * meals. This page is where that is decided, and it hands checkout a finished
 * choice.
 *
 * ## Why it looks like this
 *
 *   - **Numbered steps**, each a question ("When should it arrive?") answered
 *     by tapping, never typing.
 *   - **Presets for days.** Nearly everyone wants every day or weekdays; seven
 *     toggles were a puzzle for the common case. "Pick days" opens them.
 *   - **A dock on phones** with the price and Continue, always in reach, and a
 *     live summary ticket beside the steps on desktop.
 *   - **Continue is never disabled.** A greyed-out button explains nothing. It
 *     stays live, and pressing it early takes the customer to the step that is
 *     unfinished and says what is missing. The dock says it too, before anyone
 *     presses.
 *
 * ## A real form
 *
 * Every choice is a real radio or checkbox named for the server action, so the
 * submission is the form's own data -- no JSON assembled in a click handler --
 * and `useFormStatus` gives the button its pending state for free. Prices are
 * still not computed here: the plan price is the sticker, and checkout asks
 * the server for the real total.
 */
export function PlanConfigurator({
  plan,
  selectableMeals,
  action,
  offer,
  header,
  included,
}: {
  plan: PlanSummary;
  selectableMeals: ProductCard[];
  action: (formData: FormData) => Promise<void>;
  offer: { code: string; name: string } | null;
  header: ReactNode;
  included: ReactNode;
}) {
  const formId = useId();
  const [windowId, setWindowId] = useState(plan.windows[0]?.id ?? '');
  const [daysMode, setDaysMode] = useState<DaysMode>('every');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [meals, setMeals] = useState<string[]>([]);
  const [problem, setProblem] = useState<{ section: Section; full?: string } | null>(null);

  const windowGroup = useRef<HTMLDivElement>(null);
  const modeGroup = useRef<HTMLDivElement>(null);
  const mealsBody = useRef<HTMLDivElement>(null);
  const lastAdded = useRef<string | null>(null);
  const previousRatio = useRef(0);
  const captureWindow = useChoiceFlip(windowGroup, windowId);
  const captureMode = useChoiceFlip(modeGroup, daysMode);

  const needsSelection = plan.planType === 'customer_selected';
  const required = plan.selectableMealCount ?? 0;
  const ratio = required > 0 ? Math.min(meals.length / required, 1) : 0;
  const remaining = needsSelection ? Math.max(required - meals.length, 0) : 0;

  const days =
    daysMode === 'every' ? [] : daysMode === 'weekdays' ? WEEKDAYS : [...customDays].sort((a, b) => a - b);
  const selectedWindow = plan.windows.find((window) => window.id === windowId);

  const blocker: { section: Section; text: string } | null = !windowId
    ? { section: 'window', text: 'Choose a delivery window' }
    : daysMode === 'custom' && customDays.length === 0
      ? { section: 'days', text: 'Pick at least one day' }
      : remaining > 0
        ? { section: 'meals', text: `Pick ${remaining} more meal${remaining === 1 ? '' : 's'}` }
        : null;

  function messageFor(section: Section): string | null {
    if (problem?.section !== section) return null;
    if (problem.full) return problem.full;
    return blocker?.section === section ? `${blocker.text} to continue.` : null;
  }

  // The meter runs to its new length, and a newly chosen meal has its tick
  // written in. Both are answers to a tap, so they run on change only.
  useGSAP(
    () => {
      const fill = mealsBody.current?.querySelector('.cfg-meter-fill');
      const from = previousRatio.current;
      previousRatio.current = ratio;

      if (fill && from !== ratio && motionAllowed()) {
        gsap.fromTo(fill, { '--fill': from }, { '--fill': ratio, duration: 0.45, ease: 'ck' });
      }

      const added = lastAdded.current;
      lastAdded.current = null;
      if (added && motionAllowed()) {
        const card = mealsBody.current?.querySelector(`[data-meal="${added}"]`);
        const tick = card?.querySelector('.cfg-meal-check path');
        if (tick) gsap.fromTo(tick, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.35, ease: 'ck' });
        if (card) gsap.fromTo(card, { scale: 0.98 }, { scale: 1, duration: 0.3, ease: 'back.out(3)', clearProps: 'scale' });
      }
    },
    { dependencies: [meals], revertOnUpdate: false },
  );

  function toggleDay(day: number) {
    setCustomDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );
  }

  function toggleMeal(productId: string, card: Element | null) {
    if (meals.includes(productId)) {
      setMeals(meals.filter((id) => id !== productId));
      if (problem?.full) setProblem(null);
      return;
    }

    if (meals.length >= required) {
      shake(card);
      setProblem({
        section: 'meals',
        full: `You have picked ${required}. Remove one to swap it for this.`,
      });
      return;
    }

    lastAdded.current = productId;
    setMeals([...meals, productId]);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    if (!blocker) {
      setProblem(null);
      return;
    }

    event.preventDefault();
    setProblem({ section: blocker.section });

    const step = document.getElementById(`${formId}-${blocker.section}`);
    step?.scrollIntoView({ block: 'center', behavior: motionAllowed() ? 'smooth' : 'auto' });
    step
      ?.querySelector<HTMLElement>('input:not([disabled]):not(:checked), input:not([disabled])')
      ?.focus({ preventScroll: true });
    shake(step?.querySelector('.cfg-step-body'));
  }

  const kind = PLAN_TYPE_LABELS[plan.planType] ?? plan.planType;
  const daysLabel = daysMode === 'custom' && customDays.length === 0 ? 'Not picked yet' : weekdayList(days);

  return (
    <form id={formId} action={action} onSubmit={submit} noValidate className="cfg-form">
      <input type="hidden" name="planId" value={plan.id} />
      <input type="hidden" name="planSlug" value={plan.slug} />
      {days.map((day) => (
        <input key={day} type="hidden" name="day" value={day} />
      ))}

      <div className="cfg-layout">
        <div className="min-w-0">
          {header}
          {included}

          <ol className="cfg-steps">
            {/* 1. Window ------------------------------------------------ */}
            <li id={`${formId}-window`} className="cfg-step">
              <fieldset>
                <legend className="cfg-step-title">
                  <span className="cfg-step-no" aria-hidden>
                    1
                  </span>
                  When should it arrive?
                </legend>

                <div ref={windowGroup} className="cfg-step-body co-options cfg-windows">
                  {plan.windows.map((window) => (
                    <label key={window.id} className="co-option">
                      <input
                        type="radio"
                        name="deliveryWindowId"
                        value={window.id}
                        checked={windowId === window.id}
                        onChange={() => {
                          captureWindow();
                          setWindowId(window.id);
                        }}
                        className="co-radio"
                      />
                      {windowId === window.id ? (
                        <span className="choice-ring" data-flip-id="plan-window" />
                      ) : null}
                      <span className="co-option-body">
                        <span className="co-option-title">{window.label}</span>
                        <span className="co-option-text tabular">
                          {clockTime(window.startsAt)} to {clockTime(window.endsAt)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {messageFor('window') ? (
                  <p role="alert" className="co-error">
                    {messageFor('window')}
                  </p>
                ) : null}
              </fieldset>
            </li>

            {/* 2. Days -------------------------------------------------- */}
            <li id={`${formId}-days`} className="cfg-step">
              <fieldset>
                <legend className="cfg-step-title">
                  <span className="cfg-step-no" aria-hidden>
                    2
                  </span>
                  Which days?
                </legend>

                <div className="cfg-step-body">
                  <div ref={modeGroup} className="co-switch cfg-days-mode">
                    {DAY_MODES.map((option) => (
                      <label key={option.value} className="co-switch-option">
                        <input
                          type="radio"
                          name="daysMode"
                          value={option.value}
                          checked={daysMode === option.value}
                          onChange={() => {
                            captureMode();
                            setDaysMode(option.value);
                          }}
                          className="sr-only"
                        />
                        {daysMode === option.value ? (
                          <span className="choice-ring" data-flip-id="plan-days-mode" />
                        ) : null}
                        <span className="relative">{option.label}</span>
                      </label>
                    ))}
                  </div>

                  {daysMode === 'custom' ? (
                    <div className="cfg-days" role="group" aria-label="Delivery days">
                      {WEEK_ORDER.map((day) => (
                        <label key={day} className="co-chip cfg-day">
                          <input
                            type="checkbox"
                            checked={customDays.includes(day)}
                            onChange={() => toggleDay(day)}
                            className="sr-only"
                          />
                          {weekdayName(day)}
                        </label>
                      ))}
                    </div>
                  ) : null}

                  <p className="co-hint" aria-live="polite">
                    {daysMode === 'every'
                      ? 'Delivered every day of the cycle.'
                      : daysMode === 'weekdays'
                        ? 'Monday to Friday. Nothing arrives at the weekend.'
                        : customDays.length === 0
                          ? 'Tap the days you want.'
                          : `${customDays.length} day${customDays.length === 1 ? '' : 's'} a week.`}{' '}
                    You can change days later from your account.
                  </p>
                  {messageFor('days') ? (
                    <p role="alert" className="co-error">
                      {messageFor('days')}
                    </p>
                  ) : null}
                </div>
              </fieldset>
            </li>

            {/* 3. Meals (customer-selected plans) ------------------------ */}
            {needsSelection ? (
              <li id={`${formId}-meals`} className="cfg-step">
                <fieldset>
                  <legend className="cfg-step-title">
                    <span className="cfg-step-no" aria-hidden>
                      3
                    </span>
                    Pick {required} meals
                  </legend>

                  <div ref={mealsBody} className="cfg-step-body">
                    <div className="cfg-meter" aria-hidden>
                      <span
                        className="cfg-meter-fill"
                        style={{ '--fill': ratio } as React.CSSProperties}
                      />
                    </div>
                    <p className="cfg-meter-text" aria-live="polite">
                      <strong>
                        {meals.length} of {required}
                      </strong>{' '}
                      picked. We rotate through them across your cycle.
                    </p>

                    <div className="cfg-meals">
                      {selectableMeals.map((product) => {
                        const chosen = meals.includes(product.id);
                        const blocked = !product.isAvailable;

                        return (
                          <label
                            key={product.id}
                            data-meal={product.id}
                            className={cx('cfg-meal', blocked && 'is-unavailable')}
                          >
                            <input
                              type="checkbox"
                              name="meal"
                              value={product.id}
                              checked={chosen}
                              disabled={blocked}
                              onChange={(event) =>
                                toggleMeal(product.id, event.currentTarget.closest('.cfg-meal'))
                              }
                              className="sr-only"
                            />
                            {product.imageUrl ? (
                              <span className="cfg-thumb">
                                <Image
                                  src={product.imageUrl}
                                  alt=""
                                  fill
                                  sizes="56px"
                                  className="object-cover"
                                />
                              </span>
                            ) : null}
                            <span className="cfg-meal-body">
                              <span className="cfg-meal-name block">{product.name}</span>
                              <span className="cfg-meal-meta block">
                                {blocked
                                  ? (product.unavailableReason ?? 'Unavailable today')
                                  : `${product.creditCost} credit${product.creditCost === 1 ? '' : 's'}`}
                              </span>
                            </span>
                            <span className="cfg-meal-check" aria-hidden>
                              <CheckIcon />
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {messageFor('meals') ? (
                      <p role="alert" className="co-error">
                        {messageFor('meals')}
                      </p>
                    ) : null}
                  </div>
                </fieldset>
              </li>
            ) : null}
          </ol>
        </div>

        {/* The plan so far, as its ticket. Desktop only; the dock is the phone's. */}
        <aside className="cfg-summary" aria-label="Your plan so far">
          <div className="co-ticket ticket-stock">
            <p className="ticket-meta">
              <span>{kind}</span>
              <span className="ticket-no">1 of 3</span>
            </p>
            <p className="ticket-name">{plan.name}</p>

            <dl className="co-ticket-block">
              <div className="ticket-row">
                <dt>you get</dt>
                <dd>
                  {plan.planType === 'meal_credits'
                    ? `${plan.creditsPerCycle} credits`
                    : `${plan.mealsPerCycle} meals`}
                </dd>
              </div>
              <div className="ticket-row">
                <dt>window</dt>
                <dd>{selectedWindow ? `${selectedWindow.label}, ${clockTime(selectedWindow.startsAt)}` : 'Not chosen'}</dd>
              </div>
              <div className="ticket-row">
                <dt>days</dt>
                <dd>{daysLabel}</dd>
              </div>
              {needsSelection ? (
                <div className="ticket-row">
                  <dt>meals</dt>
                  <dd className="tabular">
                    {meals.length} of {required}
                  </dd>
                </div>
              ) : null}
              <div className="ticket-row">
                <dt>cycle</dt>
                <dd>
                  {plan.billingPeriodDays} days,{' '}
                  {plan.paymentFlow === 'recurring' ? 'renews' : 'one-time'}
                </dd>
              </div>
            </dl>

            {offer ? (
              <p className="co-ticket-block cfg-offer">
                <TagIcon className="mt-0.5 shrink-0" />
                <span>
                  <strong>{offer.code}</strong> {offer.name}. Checked and applied at checkout if you
                  qualify.
                </span>
              </p>
            ) : null}

            <p className="ticket-total">
              <span className="ticket-total-label">plan price</span>
              <span className="ticket-price tabular">{money(plan.price)}</span>
            </p>
            <p className="co-hint">Plus GST. The total, with any offer, is worked out at checkout.</p>

            <ContinueButton className="cfg-continue" label="Continue to checkout" />
            {blocker ? <p className="cfg-blocker">{blocker.text} to continue.</p> : null}
          </div>
        </aside>
      </div>

      <div className="cfg-dock">
        <p className="cfg-dock-price">
          <span className="cfg-dock-amount tabular">{money(plan.price)}</span>
          <span className="cfg-dock-note" data-blocked={blocker ? '' : undefined} aria-live="polite">
            {blocker ? blocker.text : 'Plus GST, offer applied at checkout'}
          </span>
        </p>
        <ContinueButton label="Continue" />
      </div>
    </form>
  );
}

function ContinueButton({ label, className }: { label: string; className?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={cx(buttonClasses('primary', 'lg'), 'btn-square', className)}
      disabled={pending}
    >
      {pending ? <Spinner /> : null}
      {label}
      {pending ? null : <ArrowRightIcon />}
    </button>
  );
}
