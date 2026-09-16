import '@/components/site/motion-gate.css';
import '@/components/site/ticket.css';
import '@/components/site/subscriptions.css';
import { byPriceAscending, listPlans, listPublicOffers, type PlanSummary } from '@/lib/data/catalog';
import { clockTime, money, PLAN_TYPE_LABELS } from '@/lib/format';
import { ButtonLink } from '@/components/ui/primitives';
import { buttonClasses } from '@/components/ui/button-styles';
import { SubscriptionsStage } from '@/components/site/subscriptions-motion';
import { PlanTicket } from '@/components/site/plan-ticket';
import { CycleBoard } from '@/components/site/cycle-board';

export const metadata = {
  title: 'Subscriptions',
  description: 'Prepaid meal plans, delivered on your schedule.',
};

/** What is true at checkout, taken from the promises the plan page already makes. */
const BEFORE_YOU_PAY = [
  {
    title: 'Nothing is charged until you confirm',
    body: 'You set the plan up first. Payment is the last step of checkout, and not before.',
  },
  {
    title: 'A failed payment creates nothing',
    body: 'If a payment does not go through, no subscription is created and no food is scheduled.',
  },
  {
    title: 'Offers are checked on our side',
    body: 'An eligible offer is applied at checkout for you, and we verify eligibility before anything is charged.',
  },
] as const;

/** Every delivery window any plan offers, once each, earliest first. */
function windowsAcross(plans: PlanSummary[]) {
  const byId = new Map(plans.flatMap((plan) => plan.windows).map((window) => [window.id, window]));
  return [...byId.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * The subscriptions page: where the plans are compared and one is chosen.
 *
 * Built from the home page's materials rather than the admin's, which is what
 * it was before -- a white card grid with badges and a grey definition list,
 * the same components the Owner edits plans with. Four bands, each on one of
 * the storefront's stocks:
 *
 *   intro    the sunken ground the hero sits on, a headline with a drawn
 *            underline, and the three facts somebody arrives wanting
 *   plans    grid paper, as on the home page, with each plan a kitchen ticket
 *   cycle    dotted stock, and the account rules acted out on a month
 *   before   what is true at checkout, closing onto the dark footer
 *
 * The motion is GSAP, and all of it lives in `SubscriptionsStage` and
 * `CycleBoard`; this file only marks what moves. The note at the top of
 * `subscriptions-motion.tsx` covers why none of it can flash or leave content
 * hidden.
 */
export default async function SubscriptionsPage() {
  const [plans, offers] = await Promise.all([listPlans(), listPublicOffers()]);
  const sorted = byPriceAscending(plans);
  const cheapest = sorted[0];
  const offer = offers[0];
  const windows = windowsAcross(sorted);
  const kinds = [
    ...new Set(
      sorted.map((plan) => (PLAN_TYPE_LABELS[plan.planType] ?? plan.planType).toLowerCase()),
    ),
  ];

  return (
    <SubscriptionsStage className="subs-page motion-stage">
      {/* ---------------------------------------------------------------- */}
      {/* Intro                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="subs-intro border-b border-line bg-sunken">
        <span className="tool-mark tool-spatula" data-tool aria-hidden />
        <span className="tool-mark tool-grater" data-tool aria-hidden />

        <div className="landing-container subs-intro-inner mx-auto max-w-6xl px-4">
          <div className="subs-intro-split">
            <div>
              <p className="subs-kicker" data-enter>
                Subscriptions
              </p>

              {/* Two phrases, each in its own mask so each rises out of its own
                  line. No `text-balance`: the phrases are the lines. */}
              <h1 className="subs-headline" data-enter>
                <span className="subs-line-mask">
                  <span className="subs-line" data-intro-line>
                    Pick a plan.
                  </span>
                </span>{' '}
                <span className="subs-line-mask">
                  <span className="subs-line" data-intro-line>
                    We{' '}
                    <span className="subs-marked">
                      cook
                      <svg
                        className="subs-scribble"
                        viewBox="0 0 200 28"
                        aria-hidden
                        focusable="false"
                      >
                        <path d="M4 17C38 9 96 6 150 9S190 15 196 11" />
                        <path d="M30 23C70 19 128 18 176 21" />
                      </svg>
                    </span>{' '}
                    to it.
                  </span>
                </span>
              </h1>

              <p className="subs-lede text-pretty" data-enter>
                Every plan is prepaid for one cycle. You choose the delivery window and the
                days, and you can skip, pause or cancel from your account.
              </p>

              {offer ? (
                <p className="subs-offer" data-enter>
                  <span className="subs-offer-code">{offer.code}</span>
                  <span>
                    <strong>{offer.name}.</strong> Applied at checkout if your account
                    qualifies. We check on our side.
                  </span>
                </p>
              ) : null}

              {sorted.length > 0 ? (
                <div className="subs-actions" data-enter>
                  {/* A plain anchor: a jump down this page, not a route. */}
                  <a href="#plans" className={buttonClasses('outline', 'lg', 'btn-plain')}>
                    compare the plans
                  </a>
                </div>
              ) : null}
            </div>

            {sorted.length > 0 ? (
              <dl className="subs-facts">
                {cheapest ? (
                  <div className="subs-fact" data-enter>
                    <dt>
                      <span className="subs-fact-rule" aria-hidden />
                      from
                    </dt>
                    <dd>
                      <span className="subs-fact-value tabular">{money(cheapest.price)}</span>
                      <span className="subs-fact-note">
                        for {cheapest.billingPeriodDays} days, on {cheapest.name}
                      </span>
                    </dd>
                  </div>
                ) : null}

                <div className="subs-fact" data-enter>
                  <dt>
                    <span className="subs-fact-rule" aria-hidden />
                    plans
                  </dt>
                  <dd>
                    <span className="subs-fact-value tabular">{sorted.length}</span>
                    <span className="subs-fact-note">{kinds.join(', ')}</span>
                  </dd>
                </div>

                {windows.length > 0 ? (
                  <div className="subs-fact" data-enter>
                    <dt>
                      <span className="subs-fact-rule" aria-hidden />
                      delivered
                    </dt>
                    <dd>
                      <span className="subs-fact-value subs-fact-words">
                        {windows.map((window) => window.label.toLowerCase()).join(' · ')}
                      </span>
                      <span className="subs-fact-note">
                        {windows
                          .map(
                            (window) =>
                              `${clockTime(window.startsAt)} to ${clockTime(window.endsAt)}`,
                          )
                          .join(', ')}
                      </span>
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Plans                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section id="plans" className="section-anchor paper-grid border-b border-line bg-surface">
        <div className="landing-container landing-spacing mx-auto max-w-6xl px-4">
          <div className="subs-section-head">
            <h2 className="section-display font-semibold" data-enter data-split-heading>
              every plan, side by side
            </h2>
            <p className="subs-section-lede text-pretty" data-rise>
              Cheapest first. Every ticket lists the same things in the same order, so they
              are easy to compare.
            </p>
          </div>

          {sorted.length === 0 ? (
            <p className="mt-10 text-sm text-muted">
              No plans are published yet. Check back shortly.
            </p>
          ) : (
            /* Cheapest first, the same order the home page notes are in. Two
               surfaces showing the same plans in two different orders is worse
               than either order on its own. */
            <ul className="ticket-grid" role="list">
              {sorted.map((plan, index) => (
                <PlanTicket key={plan.id} plan={plan} index={index} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* What a cycle looks like                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="texture-dots border-b border-line">
        <div className="landing-container landing-spacing mx-auto max-w-6xl px-4">
          <div className="subs-section-head">
            <h2 className="section-display font-semibold" data-enter data-split-heading>
              what a cycle looks like
            </h2>
            <p className="subs-section-lede text-pretty" data-rise>
              An example month with weekday deliveries, and what a skip, a pause and a
              cancellation each do to it.
            </p>
          </div>

          <CycleBoard />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Before you pay                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-sunken">
        <div className="landing-container landing-spacing mx-auto max-w-6xl px-4">
          <div className="subs-assure-split">
            <h2 className="section-display font-semibold" data-enter data-split-heading>
              before you pay
            </h2>

            <ol className="subs-assure-list">
              {BEFORE_YOU_PAY.map((item, index) => (
                <li key={item.title} className="subs-assure-item" data-rise>
                  <span className="subs-rule" data-rule aria-hidden />
                  <span className="subs-assure-no tabular" aria-hidden>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="subs-closing" data-rise>
            <p>Not sure yet? See what the kitchen cooks first.</p>
            <ButtonLink href="/menu" variant="outline" size="lg" className="btn-plain btn-wide">
              see the full menu
            </ButtonLink>
          </div>
        </div>
      </section>
    </SubscriptionsStage>
  );
}
