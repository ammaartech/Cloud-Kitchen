import Link from 'next/link';
import type { Route } from 'next';
import { ButtonLink } from '@/components/ui/primitives';
import { CONTACT } from '@/components/site/contact';
import { ArrowRightIcon, CheckIcon, HomeIcon, WhatsAppIcon } from '@/components/site/icons';
import { calendarDate } from '@/lib/checkout/schedule';
import { clockTime, dateOnly, money } from '@/lib/format';
import { kitchenStep, relativeDay, skipDeadline, type UpcomingDelivery } from '@/lib/account/schedule';
import type { AccountOverview as Model, PlanView } from '@/lib/account/overview';
import type { AccountAction } from '@/lib/account/action-state';
import { AccountStage } from './account-stage';
import { Enter } from './account-shell';
import { RememberShape, type OverviewShape } from './account-shape';
import { CreditsFigure } from './credits-figure';
import { DeliveryRow, NextDelivery } from './deliveries';
import { PlanControls } from './plan-controls';
import { ScheduleStrip } from './schedule-strip';

/** Rows shown before the rest of the upcoming list folds behind "Show more". */
const VISIBLE_ROWS = 5;

export type AccountActions = {
  skip: AccountAction;
  pause: AccountAction;
  cancel: AccountAction;
};

/**
 * The account overview, as one composition over a plain model.
 *
 * The page reads the database and hands this a model; this decides nothing
 * about data and everything about arrangement. Keeping those apart is what
 * lets the whole page be checked against a fixed set of rows, and it is why
 * the actions arrive as props rather than being imported: the component does
 * not know or care which server function answers a skip.
 *
 * ## The order is the order of the questions
 *
 * 1. **What is happening?** One sentence under the greeting: the plan's state
 *    and the next meal, in words.
 * 2. **Is food coming, and can I change it?** The next delivery, with its
 *    deadline and its skip, then the next two weeks as dates.
 * 3. **What am I on?** The plan, as the same ticket it was bought on, with the
 *    balance and the two bigger changes -- pause and cancel.
 * 4. **What happened?** Past deliveries and invoices, as lists.
 * 5. **Everything else.** Addresses, reviews, refunds and help, one press away,
 *    because the overview is where people come looking for all of them.
 *
 * Server-rendered throughout. The islands are the parts that answer a press:
 * the skip, the pause and cancel forms, the calendar that previews a pause and
 * the balance that counts when credits come back.
 */
export function AccountOverview({ model, actions }: { model: Model; actions: AccountActions }) {
  const { plan, upcoming, today } = model;
  const next = upcoming.find((delivery) => delivery.status !== 'skipped') ?? null;
  const rest = upcoming.filter((delivery) => delivery.id !== next?.id);

  return (
    <AccountStage>
      <RememberShape page="overview" shape={outline(model, next, rest.length)} measure={OUTLINE_TEXTS} />
      <div className="acct-page mx-auto max-w-5xl px-4">
        <header className="acct-head acct-enter" style={{ '--i': 0 } as React.CSSProperties}>
          <p className="acct-date">{longDate(today)}</p>
          <h1 className="acct-hello">Hello, {model.name}</h1>
          <p className="acct-summary">{summary(model, next)}</p>
        </header>

        {plan ? (
          <div className="acct-grid">
            <Enter index={1} className="acct-main">
              <NextDelivery
                delivery={next}
                emptyNote={emptyNote(plan)}
                today={today}
                now={model.now}
                returnsCredits={plan.skipReturnsCredit}
                skipAction={actions.skip}
              />

              <section className="acct-section" aria-labelledby="acct-weeks-title">
                <div className="acct-section-head">
                  <h2 id="acct-weeks-title" className="acct-section-title">
                    Next two weeks
                  </h2>
                  {plan.window ? (
                    <p className="acct-section-note">
                      {plan.days}, {plan.window.label.toLowerCase()} from {clockTime(plan.window.startsAt)}
                    </p>
                  ) : null}
                </div>
                <ScheduleStrip days={model.schedule} />

                {rest.length > 0 ? (
                  <>
                    <ul className="acct-rows" aria-label="Coming up">
                      {rest.slice(0, VISIBLE_ROWS).map((delivery) => (
                        <DeliveryRow
                          key={delivery.id}
                          delivery={delivery}
                          today={today}
                          now={model.now}
                          returnsCredits={plan.skipReturnsCredit}
                          skipAction={actions.skip}
                        />
                      ))}
                    </ul>
                    {rest.length > VISIBLE_ROWS ? (
                      <details className="acct-more">
                        <summary>
                          Show {rest.length - VISIBLE_ROWS} more{' '}
                          {rest.length - VISIBLE_ROWS === 1 ? 'delivery' : 'deliveries'}
                        </summary>
                        <ul className="acct-rows">
                          {rest.slice(VISIBLE_ROWS).map((delivery) => (
                            <DeliveryRow
                              key={delivery.id}
                              delivery={delivery}
                              today={today}
                              now={model.now}
                              returnsCredits={plan.skipReturnsCredit}
                              skipAction={actions.skip}
                            />
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </>
                ) : null}
              </section>
            </Enter>

            <aside className="acct-aside acct-enter" style={{ '--i': 2 } as React.CSSProperties} aria-label="Your plan">
              <PlanTicket plan={plan} model={model} actions={actions} />
            </aside>
          </div>
        ) : (
          <Enter index={1}>
            <NoPlan model={model} />
          </Enter>
        )}

        <Enter index={3} className="acct-records">
          <History model={model} />
          <Invoices model={model} />
        </Enter>

        <Enter index={4}>
          <AccountLinks model={model} />
        </Enter>
      </div>
    </AccountStage>
  );
}

/** The texts whose length decides how many lines they wrap to. */
const OUTLINE_TEXTS = {
  texts: {
    summary: '.acct-summary',
    when: '.acct-next-when',
    dishes: '.acct-next-dishes',
    lock: '.acct-next-lock',
    empty: '.acct-next-empty',
    note: '.acct-controls-note',
    emptyTitle: '.acct-empty-title',
    emptyItems: '.acct-empty-list li',
    historyQuiet: '[aria-labelledby="acct-history-title"] .acct-quiet',
    invoicesQuiet: '[aria-labelledby="acct-invoices-title"] .acct-quiet',
  },
};

/**
 * The page's outline, for the next visit's skeleton (`OverviewSkeleton`). It
 * mirrors the decisions this file and `deliveries.tsx` make about which
 * variant of each block to draw, so the skeleton picks the same one.
 */
function outline(model: Model, next: UpcomingDelivery | null, restCount: number): OverviewShape {
  const { plan } = model;
  let nextKind: OverviewShape['next'] = 'empty';
  if (next) {
    if (next.status === 'released') nextKind = kitchenStep(next.kitchenStatus) === null ? 'lock' : 'progress';
    else nextKind = skipDeadline(next.locksAt, new Date(model.now), model.today) ? 'skip' : 'lock';
  }

  return {
    plan: plan !== null,
    next: nextKind,
    activeWeekdays: [
      ...new Set(
        model.schedule
          .filter((day) => day.kind !== 'rest')
          .map((day) => new Date(`${day.date}T00:00:00Z`).getUTCDay()),
      ),
    ],
    rows: Math.min(restCount, VISIBLE_ROWS),
    more: restCount > VISIBLE_ROWS,
    facts: plan ? (plan.window ? 1 : 0) + 2 + (plan.cycleStart && plan.cycleEnd ? 1 : 0) : 0,
    cycle: Boolean(plan?.progress),
    history: model.history.length,
    invoices: model.invoices.length,
  };
}

function longDate(today: string): string {
  const [year, month, day] = today.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function summary(model: Model, next: UpcomingDelivery | null): React.ReactNode {
  const { plan } = model;

  if (!plan) {
    if (model.awaitingPayment) return 'Your plan is waiting for its payment to be confirmed.';
    if (model.ended) {
      return (
        <>
          Your <strong>{model.ended.name}</strong> plan is {model.ended.statusLabel.toLowerCase()}
          {model.ended.on ? ` as of ${calendarDate(model.ended.on)}` : ''}.
        </>
      );
    }
    return 'You do not have a plan yet. Everything about one will live on this page.';
  }

  if (plan.status === 'paused') {
    return (
      <>
        Your <strong>{plan.name}</strong> plan is paused
        {plan.pausedUntil ? (
          <>
            {' '}
            until <strong>{calendarDate(plan.pausedUntil)}</strong>
          </>
        ) : null}
        .
      </>
    );
  }

  if (plan.status === 'past_due') {
    return (
      <>
        The payment for <strong>{plan.name}</strong> is overdue.
        {plan.graceUntil ? <> Deliveries continue until {calendarDate(plan.graceUntil)}.</> : null}
      </>
    );
  }

  if (!next) {
    return (
      <>
        Your <strong>{plan.name}</strong> plan is active, with nothing scheduled right now.
      </>
    );
  }

  return (
    <>
      Your <strong>{plan.name}</strong> plan is active. Next up:{' '}
      <strong>
        {relativeDay(next.date, model.today).replace(/^(Today|Tomorrow)$/, (word) => word.toLowerCase())}
        {', '}
        {next.windowLabel.toLowerCase()} from {clockTime(next.windowStartsAt)}
      </strong>
      .
    </>
  );
}

function emptyNote(plan: PlanView): string {
  if (plan.status === 'paused' && plan.pausedUntil) {
    return `Paused until ${calendarDate(plan.pausedUntil)}. Deliveries on the days after that go ahead as planned.`;
  }
  return 'Nothing is scheduled in the next two weeks. If that is not what you expected, message us and we will look.';
}

/**
 * The plan, as the ticket it was bought on.
 *
 * Checkout draws the plan as a kitchen ticket and prints the receipt on the
 * same stock; this is that ticket again, now carrying what the customer has
 * left of it. Cabinet for everything counted, Zodiak for the name -- the
 * storefront's rule for when the kitchen is the one speaking.
 */
function PlanTicket({ plan, model, actions }: { plan: PlanView; model: Model; actions: AccountActions }) {
  return (
    <section className="acct-plan ticket-stock" aria-labelledby="acct-plan-title">
      <header className="acct-plan-head">
        <p className="ticket-meta">
          <span>{plan.typeLabel || 'Your plan'}</span>
          <span className="ticket-no">{plan.number}</span>
        </p>
        <h2 id="acct-plan-title" className="ticket-name">
          {plan.name}
        </h2>
        <p className="acct-plan-status" data-status={plan.status}>
          <span className="acct-plan-status-dot" aria-hidden />
          {plan.statusLabel}
          {plan.status === 'paused' && plan.pausedUntil ? ` until ${calendarDate(plan.pausedUntil)}` : ''}
        </p>
      </header>

      {plan.status === 'past_due' ? (
        <p className="acct-plan-alert" role="note">
          {plan.graceUntil
            ? `Deliveries continue until ${calendarDate(plan.graceUntil)} while it is sorted.`
            : 'Deliveries continue for a short grace period while it is sorted.'}{' '}
          <a className="acct-link" href={CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer">
            Message us
          </a>
        </p>
      ) : null}

      <CreditsFigure credits={plan.credits} perCycle={plan.creditsPerCycle} />

      <dl className="acct-plan-facts">
        {plan.window ? (
          <div className="ticket-row">
            <dt>window</dt>
            <dd>
              {plan.window.label}, {clockTime(plan.window.startsAt)}–{clockTime(plan.window.endsAt)}
            </dd>
          </div>
        ) : null}
        <div className="ticket-row">
          <dt>days</dt>
          <dd>{plan.days}</dd>
        </div>
        <div className="ticket-row">
          <dt>delivering to</dt>
          <dd>
            <Link href="/account/addresses" className="acct-link">
              {plan.deliveringTo ?? 'Choose an address'}
            </Link>
          </dd>
        </div>
        {plan.cycleStart && plan.cycleEnd ? (
          <div className="ticket-row">
            <dt>this cycle</dt>
            <dd className="tabular">
              {calendarDate(plan.cycleStart).replace(/^\w+, /, '')} – {calendarDate(plan.cycleEnd).replace(/^\w+, /, '')}
            </dd>
          </div>
        ) : null}
      </dl>

      {plan.progress ? (
        <div className="acct-cycle">
          <div className="acct-cycle-bar" aria-hidden>
            <span style={{ '--acct-fill': plan.progress.ratio } as React.CSSProperties} />
          </div>
          <p className="acct-cycle-note tabular">
            {plan.progress.daysLeft === 0
              ? 'Last day of this cycle'
              : `${plan.progress.daysLeft} ${plan.progress.daysLeft === 1 ? 'day' : 'days'} left in this cycle`}
          </p>
        </div>
      ) : null}

      <p className="ticket-total acct-plan-total">
        <span className="ticket-total-label">
          {plan.renewsOn ? `renews ${dateOnly(plan.renewsOn)}` : 'paid for this cycle'}
        </span>
        <span className="ticket-price tabular">{money(plan.pricePaid)}</span>
      </p>

      <PlanControls
        subscriptionId={plan.id}
        planName={plan.name}
        status={plan.status}
        pausedUntil={plan.pausedUntil}
        pauses={plan.pauses}
        returnsCredits={plan.skipReturnsCredit}
        today={model.today}
        // Only what the pause preview and the cancel count read. The full rows
        // are already in the payload once, for the list; sending them again
        // to a second island would double that part of it.
        upcoming={model.upcoming.map(({ date, status, creditsCost }) => ({ date, status, creditsCost }))}
        pauseAction={actions.pause}
        cancelAction={actions.cancel}
      />
    </section>
  );
}

/**
 * No plan: the page says what it will do once there is one, using the
 * kitchen's actual rules, and offers the one step that gets there.
 */
function NoPlan({ model }: { model: Model }) {
  const lead =
    model.leadMinutes % 60 === 0
      ? `${model.leadMinutes / 60} ${model.leadMinutes === 60 ? 'hour' : 'hours'}`
      : `${model.leadMinutes} minutes`;

  return (
    <section className="acct-empty" aria-labelledby="acct-empty-title">
      <div>
        <h2 id="acct-empty-title" className="acct-empty-title">
          {model.ended ? 'Start again whenever you like' : 'Once you have a plan, this is where you run it'}
        </h2>
        <ul className="acct-empty-list">
          <li>
            <CheckIcon className="acct-inline-icon" />
            See every delivery for the next two weeks, day by day.
          </li>
          <li>
            <CheckIcon className="acct-inline-icon" />
            Skip a meal up to {lead} before its window
            {model.skipReturnsCredit ? ', and get the credit back' : ''}.
          </li>
          <li>
            <CheckIcon className="acct-inline-icon" />
            Pause for up to {model.maxPauseDays} days when you are away, or cancel from here.
          </li>
        </ul>
      </div>
      <div className="acct-empty-actions">
        <ButtonLink href="/subscriptions" className="btn-square">
          See the plans
        </ButtonLink>
        <ButtonLink href={'/menu' as Route} variant="outline" className="btn-square">
          Today&rsquo;s menu
        </ButtonLink>
      </div>
    </section>
  );
}

const HISTORY_TEXT = { fulfilled: 'Delivered', skipped: 'Skipped', cancelled: 'Called off' } as const;

function History({ model }: { model: Model }) {
  return (
    <section className="acct-section" aria-labelledby="acct-history-title">
      <div className="acct-section-head">
        <h2 id="acct-history-title" className="acct-section-title">
          Recent deliveries
        </h2>
        {model.history.some((entry) => entry.status === 'fulfilled') ? (
          <Link href="/account/reviews" className="acct-link acct-section-link">
            Review a meal
          </Link>
        ) : null}
      </div>

      {model.history.length === 0 ? (
        <p className="acct-quiet">
          Meals you have received will be listed here, with a way to tell the kitchen how they were.
        </p>
      ) : (
        <ul className="acct-list">
          {model.history.map((entry) => (
            <li key={entry.id} className="acct-list-row" data-status={entry.status}>
              <span className="acct-list-main">
                <span className="acct-list-title">{calendarDate(entry.date)}</span>
                <span className="acct-list-sub">
                  {entry.windowLabel}
                  {entry.items.length > 0 ? ` · ${entry.items.map((item) => item.name).join(', ')}` : ''}
                </span>
              </span>
              <span className="acct-list-status">
                {entry.status === 'fulfilled' ? <CheckIcon className="acct-inline-icon" /> : null}
                {HISTORY_TEXT[entry.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Invoices({ model }: { model: Model }) {
  return (
    <section className="acct-section" aria-labelledby="acct-invoices-title">
      <div className="acct-section-head">
        <h2 id="acct-invoices-title" className="acct-section-title">
          Invoices
        </h2>
      </div>

      {model.invoices.length === 0 ? (
        <p className="acct-quiet">An invoice is raised for every payment, and each one will be listed here.</p>
      ) : (
        <ul className="acct-list">
          {model.invoices.map((invoice) => (
            <li key={invoice.id} className="acct-list-row">
              <span className="acct-list-main">
                <span className="acct-list-title acct-mono">{invoice.number}</span>
                <span className="acct-list-sub">{dateOnly(invoice.issuedAt)}</span>
              </span>
              <span className="acct-list-amount tabular">{money(invoice.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AccountLinks({ model }: { model: Model }) {
  const addresses =
    model.addresses.total === 0
      ? 'None saved yet'
      : `${model.addresses.defaultLabel ? `${model.addresses.defaultLabel} is your default` : 'No default set'} · ${model.addresses.total} saved`;

  return (
    <nav className="acct-links" aria-label="More in your account">
      <Link href="/account/addresses" className="acct-link-row">
        <HomeIcon className="acct-link-icon" />
        <span className="acct-link-text">
          <span className="acct-link-title">Addresses</span>
          <span className="acct-link-sub">{addresses}</span>
        </span>
        <ArrowRightIcon className="acct-link-arrow" />
      </Link>
      <Link href="/account/refunds" className="acct-link-row">
        <span className="acct-link-icon acct-link-glyph" aria-hidden>
          ₹
        </span>
        <span className="acct-link-text">
          <span className="acct-link-title">Refunds</span>
          <span className="acct-link-sub">Something wrong with a delivery</span>
        </span>
        <ArrowRightIcon className="acct-link-arrow" />
      </Link>
      <a href={CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer" className="acct-link-row">
        <WhatsAppIcon className="acct-link-icon" />
        <span className="acct-link-text">
          <span className="acct-link-title">Help</span>
          <span className="acct-link-sub">WhatsApp {CONTACT.whatsappDisplay}</span>
        </span>
        <ArrowRightIcon className="acct-link-arrow" />
      </a>
    </nav>
  );
}
