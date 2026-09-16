import Link from 'next/link';
import type { PlanSummary } from '@/lib/data/catalog';
import { money, PLAN_TYPE_LABELS } from '@/lib/format';
import { ArrowRightIcon } from './icons';

/** What each plan shape means, in plain terms rather than jargon. */
const PLAN_TYPE_EXPLAINER: Record<string, string> = {
  fixed_meals: 'We decide the menu. You get a set number of meals in the cycle.',
  meal_credits: 'You get a bank of credits and spend them whenever you want.',
  scheduled_meals: 'A menu that changes by day of the week, on a fixed schedule.',
  customer_selected: 'You pick your meals from our pool, and we repeat them.',
};

/**
 * One plan, as a kitchen ticket.
 *
 * The home page pins the plans up as notes, which is right for a wall you walk
 * past. This page is where somebody decides, and the object for that is the
 * one the kitchen already runs on: a ticket. A ticket is a list of what is
 * being ordered with a total at the bottom, which is exactly the shape of a
 * comparison -- the same rows, in the same order, with dotted leaders running
 * each label to its value -- and it has a stub you tear off to act on it.
 *
 * ## Read across, not down
 *
 * The ticket is five rows -- head, how it works, the facts, the total, the
 * stub -- and they sit on the grid's rows through `subgrid`. So on a wide
 * screen the four totals share one baseline and the four stubs another,
 * however long a plan's name or tagline runs, and a price can be compared by
 * moving the eye sideways. Where subgrid is unsupported the rows fall back to
 * auto and each ticket is simply as tall as it needs to be.
 *
 * ## One link, the size of the ticket
 *
 * The stub is the only interactive element, and its `::after` is stretched over
 * the whole paper, so the ticket is one tab stop and one target. The stub's
 * label carries the plan's name for a screen reader, because four links that
 * all say "choose this plan" are four links that say nothing.
 *
 * Kept a server component. Everything that moves on it is driven from
 * `subscriptions-motion.tsx` by class name, so the ticket ships no JavaScript
 * of its own.
 */
export function PlanTicket({ plan, index }: { plan: PlanSummary; index: number }) {
  const kind = PLAN_TYPE_LABELS[plan.planType] ?? plan.planType;
  const isCredits = plan.planType === 'meal_credits';
  const entitlement = isCredits ? `${plan.creditsPerCycle} credits` : `${plan.mealsPerCycle} meals`;
  const windows = plan.windows.length
    ? plan.windows.map((window) => window.label.toLowerCase()).join(', ')
    : 'any window';
  const nameId = `plan-${plan.slug}`;

  return (
    <li className="plan-ticket" data-enter>
      <article className="ticket-paper ticket-stock" aria-labelledby={nameId}>
        <header className="ticket-head">
          <p className="ticket-meta">
            <span>{kind}</span>
            <span className="ticket-no" aria-hidden>
              #{String(index + 1).padStart(2, '0')}
            </span>
          </p>
          <h3 id={nameId} className="ticket-name">
            {plan.name}
          </h3>
          <p className="ticket-tagline">{plan.tagline}</p>
        </header>

        <p className="ticket-how">{PLAN_TYPE_EXPLAINER[plan.planType] ?? plan.description}</p>

        <div className="ticket-facts">
          <dl>
            <div className="ticket-row">
              <dt>you get</dt>
              <dd className="tabular">{entitlement}</dd>
            </div>
            <div className="ticket-row">
              <dt>cycle</dt>
              <dd className="tabular">{plan.billingPeriodDays} days</dd>
            </div>
            <div className="ticket-row">
              <dt>billing</dt>
              <dd>{plan.paymentFlow === 'recurring' ? 'renews automatically' : 'one-time'}</dd>
            </div>
            <div className="ticket-row">
              <dt>windows</dt>
              <dd>{windows}</dd>
            </div>
          </dl>

          {isCredits ? (
            <p className="ticket-row ticket-note">
              Premium dishes cost more than one credit. The exact cost is shown on each meal.
            </p>
          ) : null}
        </div>

        <p className="ticket-total">
          <span className="ticket-total-label">per {plan.billingPeriodDays} days</span>
          <span className="ticket-price tabular">{money(plan.price)}</span>
        </p>

        <Link href={`/subscriptions/${plan.slug}`} className="ticket-stub">
          <span>
            choose this plan<span className="sr-only">: {plan.name}</span>
          </span>
          <ArrowRightIcon className="ticket-stub-arrow" />
        </Link>
      </article>
    </li>
  );
}
