import '@/components/site/motion-gate.css';
import '@/components/site/about.css';
import type { ReactNode } from 'react';
import { listDeliveryWindows, listMenu, type DeliveryWindow } from '@/lib/data/catalog';
import { clockTime } from '@/lib/format';
import { ButtonLink } from '@/components/ui/primitives';
import { buttonClasses } from '@/components/ui/button-styles';
import { AboutStage } from '@/components/site/about-motion';
import { CONTACT } from '@/components/site/contact';
import { FaqItem } from '@/components/site/faq';

export const metadata = {
  title: 'About',
  description: 'One kitchen, one small menu, and why the constraint is deliberate.',
};

/**
 * Why the menu is small, as four rules rather than a paragraph.
 *
 * Each one is a thing this application actually does, not a claim about
 * intentions: the menu really is one day's list, dishes really are marked
 * unavailable with a reason instead of being substituted, and the subscription
 * really is what tells the kitchen the number before the day starts. A page
 * that says the kitchen is careful is marketing; a page that says what the
 * carefulness consists of can be checked.
 */
const RULES = [
  {
    title: 'We buy for the day, not for the week',
    body: 'A short list is a list we can shop for the same morning we cook it. A long one has to be bought ahead and held, which is the decision that puts a freezer between the market and your plate.',
  },
  {
    title: 'We cook in batches that finish',
    body: 'Every batch is sized to the orders already in. Nothing is cooked speculatively and held warm for hours in case somebody wants it, because that is the point at which food stops being home food.',
  },
  {
    title: 'The subscription is how we know the number',
    body: 'This is the real reason we sell plans rather than one-off meals. Knowing how many portions are going out before the day starts is what lets the two rules above be true at all.',
  },
  {
    title: 'If a dish is off, we say so and why',
    body: 'A dish the kitchen cannot make today is marked unavailable on the menu with the reason next to it. We do not quietly substitute something else and let you find out when it arrives.',
  },
] as const;

/**
 * The questions people ask before they start a plan.
 *
 * Every answer is a restatement of something the product already commits to
 * elsewhere, not a new promise made here: delivery zones, skips, cancellation
 * and refunds are the Terms page in plainer words, and "when am I charged" is
 * the checkout's own order of steps. If the terms change, these change with
 * them -- an FAQ that disagrees with the terms is the one a customer quotes
 * back at you.
 */
const FAQS: readonly { question: string; answer: ReactNode }[] = [
  {
    question: 'How does a meal plan work?',
    answer:
      'You pick a plan, choose your delivery window and the days you want food, and pay for one cycle up front. We cook to that plan, which is how the kitchen knows how many portions to make before the day starts.',
  },
  {
    question: 'Where do you deliver?',
    answer:
      'Single and small orders are delivered in North Bangalore only. Bulk orders can go anywhere in Bangalore. If your address is outside our zone, we will tell you before anything is charged.',
  },
  {
    question: 'Can I skip a meal or pause my plan?',
    answer:
      'Yes, both from your account. A skipped meal goes back to your balance instead of being lost, and a paused plan picks up where it left off. It needs to reach us before the kitchen starts on that window; after that the food is already cooking, so the skip applies to your next delivery.',
  },
  {
    question: 'How do I cancel?',
    answer:
      'From your account, at any time. Cancelling stops the next renewal. The cycle you have already paid for runs to its end, and the meals left on it stay available until then.',
  },
  {
    question: 'When will I be charged?',
    answer:
      'Payment is the last step of checkout, after your plan is set up. If a payment does not go through, no subscription is created and no food is scheduled. Payments are handled by our payment gateway, so we never see your card number, UPI PIN or bank details.',
  },
  {
    question: 'What happens if a dish is not available?',
    answer:
      'It is marked unavailable on the menu with the reason next to it. We never quietly swap in something else for what you chose.',
  },
  {
    question: 'I have a food allergy. Can I still order?',
    answer:
      'Please tell us before you start a plan. Our kitchen handles dairy, nuts, gluten and other common allergens, so we cannot guarantee that any dish is free of traces of them.',
  },
  {
    question: 'What if my order arrives wrong or late?',
    answer: (
      <>
        Tell us within 24 hours, with a photo if you can, and we will refund that meal or
        credit it back to your balance. Refunds go back to the method you paid with. The
        quickest way to reach us is WhatsApp on{' '}
        <a href={CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer">
          {CONTACT.whatsappDisplay}
        </a>
        .
      </>
    ),
  },
];

/**
 * A clock time, some number of minutes earlier.
 *
 * The delivery windows carry a real `cutoff_minutes_before`, so the moment
 * orders close for a window is a fact in the database rather than a time
 * somebody typed into this page. Doing the arithmetic here is what keeps it
 * that way: change the cutoff in the admin and this page's day changes with it.
 *
 * Plain string arithmetic on `HH:MM:SS` rather than a `Date`, because these are
 * wall-clock times with no date attached -- constructing a `Date` to subtract
 * from one would invent a day, a timezone and an offset that the column does
 * not have. Wrapping with `+ 24 * 60` covers a cutoff that reaches back past
 * midnight, which is the only case the modulo has to survive.
 */
function minutesBefore(time: string, minutes: number): string {
  const [hours = 0, mins = 0] = time.split(':').map(Number);
  const total = (hours * 60 + mins - minutes + 24 * 60) % (24 * 60);

  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`;
}

/** One moment in the kitchen's day, as the timeline renders it. */
type Moment = {
  /** `HH:MM:SS`, and what the list is sorted on. */
  at: string;
  title: string;
  body: string;
  note?: string;
};

/**
 * The kitchen's day, derived entirely from the delivery windows.
 *
 * Two moments per window -- the cutoff, then the window itself -- flattened and
 * sorted into one clock. Nothing here is written by hand, which is the whole
 * reason the section is worth having: a kitchen that publishes a fourth window
 * gets a fourth pair of moments in the right place on this page, and a kitchen
 * that changes a cutoff sees the page change. A timeline with the hours typed
 * into it would be wrong the first time somebody touched the admin.
 */
function dayFrom(windows: DeliveryWindow[]): Moment[] {
  return windows
    .flatMap((window): Moment[] => {
      const label = window.label.toLowerCase();

      return [
        {
          at: minutesBefore(window.starts_at, window.cutoff_minutes_before),
          title: `Orders for ${label} close`,
          body: `Everything ordered by now is on the ${label} list, and the list is what the kitchen shops and cooks to. After this the day is counted and nothing is added to it.`,
          note: `${window.cutoff_minutes_before} minutes before the window opens`,
        },
        {
          at: window.starts_at,
          title: `${window.label} goes out`,
          body: `Cooked for this window rather than earlier in the day, packed as it is finished, and sent while it is still warm. Deliveries run until ${clockTime(window.ends_at)}.`,
        },
      ];
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * About.
 *
 * The page this replaces was five paragraphs in a `max-w-3xl` column: true,
 * readable, and indistinguishable from the legal pages either side of it. Two
 * of those paragraphs were the argument and three were policy, and the policy
 * ones were saying quietly what `/privacy` and `/terms` say properly.
 *
 * What is here instead is the argument, at the length an argument deserves, on
 * the storefront's own materials -- the same four bands, stocks and section
 * heads `/subscriptions` is built from, so this reads as part of the site
 * rather than as a document hosted on it.
 *
 * Every figure is read from the database. The dish count, the vegetarian note
 * and the entire day-by-the-clock section are derived from the menu and the
 * delivery windows, so none of them can drift out of date the way a hand-typed
 * "we cook 20 dishes" would. Where the kitchen has published nothing, the
 * section renders nothing rather than a placeholder.
 *
 * The motion is GSAP and all of it lives in `AboutStage`; this file only marks
 * what moves. The note at the top of `about-motion.tsx` covers why none of it
 * can flash or leave content hidden.
 */
export default async function AboutPage() {
  const [menu, windows] = await Promise.all([listMenu(), listDeliveryWindows()]);

  const available = menu.filter((product) => product.isAvailable);
  const vegetarian = available.filter((product) => product.isVegetarian);
  const day = dayFrom(windows);

  /* The same reading the hero makes of the same rows: a kitchen where some
     dishes are vegetarian is telling you how many, and a kitchen where all of
     them are is telling you what kind of kitchen it is. "26 of 26" is a number
     that has not noticed itself. */
  const vegetarianNote =
    vegetarian.length === 0
      ? null
      : vegetarian.length === available.length
        ? 'every one of them vegetarian'
        : `${vegetarian.length} of them vegetarian`;

  return (
    <AboutStage className="story-page motion-stage">
      {/* ---------------------------------------------------------------- */}
      {/* Intro                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="story-intro border-b border-line bg-sunken">
        <span className="tool-mark tool-spoon-knife" data-tool aria-hidden />
        <span className="tool-mark tool-grater" data-tool aria-hidden />

        <div className="landing-container story-intro-inner mx-auto max-w-6xl px-4">
          <div className="story-intro-split">
            <div>
              <p className="story-kicker" data-enter>
                About
              </p>

              {/* Two phrases, each in its own mask so each rises out of its
                  own line. No `text-balance`: the phrases are the lines. */}
              <h1 className="story-headline" data-enter>
                <span className="story-line-mask">
                  <span className="story-line" data-intro-line>
                    One kitchen.
                  </span>
                </span>{' '}
                <span className="story-line-mask">
                  <span className="story-line" data-intro-line>
                    One{' '}
                    <span className="story-marked">
                      small
                      <svg
                        className="story-scribble"
                        viewBox="0 0 200 28"
                        aria-hidden
                        focusable="false"
                      >
                        <path d="M5 18C40 10 98 7 152 10S191 16 195 12" />
                        <path d="M28 24C68 20 126 19 174 22" />
                      </svg>
                    </span>{' '}
                    menu.
                  </span>
                </span>
              </h1>

              <p className="story-lede text-pretty" data-enter>
                We are a single kitchen serving a single neighbourhood. Not a chain, not a
                franchise, and not a marketplace listing a thousand dishes it does not
                cook. The constraint is the product, and everything below is what it buys.
              </p>

              <div className="story-actions" data-enter>
                <a href="#day" className={buttonClasses('outline', 'lg', 'btn-plain')}>
                  see how a day runs
                </a>
                <ButtonLink
                  href="/menu"
                  variant="outline"
                  size="lg"
                  className="btn-plain"
                  transitionTypes={['nav-forward']}
                >
                  today&rsquo;s menu
                </ButtonLink>
              </div>
            </div>

            <dl className="story-facts">
              {available.length > 0 ? (
                <div className="story-fact" data-enter>
                  <dt>
                    <span className="story-fact-rule" aria-hidden />
                    cooking
                  </dt>
                  <dd>
                    <span className="story-fact-value tabular">{available.length}</span>
                    <span className="story-fact-note">
                      dishes on the menu today
                      {vegetarianNote ? `, ${vegetarianNote}` : ''}
                    </span>
                  </dd>
                </div>
              ) : null}

              {windows.length > 0 ? (
                <div className="story-fact" data-enter>
                  <dt>
                    <span className="story-fact-rule" aria-hidden />
                    delivered
                  </dt>
                  <dd>
                    <span className="story-fact-value story-fact-words">
                      {windows.map((window) => window.label.toLowerCase()).join(' · ')}
                    </span>
                    <span className="story-fact-note">
                      {windows
                        .map(
                          (window) =>
                            `${clockTime(window.starts_at)} to ${clockTime(window.ends_at)}`,
                        )
                        .join(', ')}
                    </span>
                  </dd>
                </div>
              ) : null}

              <div className="story-fact" data-enter>
                <dt>
                  <span className="story-fact-rule" aria-hidden />
                  kitchens
                </dt>
                <dd>
                  <span className="story-fact-value tabular">1</span>
                  <span className="story-fact-note">
                    in North Bangalore, cooking everything on this menu itself
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Why the menu is small                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="section-anchor paper-grid border-b border-line bg-surface">
        <div className="landing-container landing-spacing mx-auto max-w-6xl px-4">
          <div className="story-section-head">
            <h2 className="section-display font-semibold" data-enter data-split-heading>
              why the menu is small
            </h2>
            <p className="story-section-lede text-pretty" data-rise>
              It is the decision every other decision here follows from. Four things become
              possible once the list is short enough to hold in your head.
            </p>
          </div>

          <ol className="story-rules">
            {RULES.map((rule, index) => (
              <li key={rule.title} className="story-rule" data-rise>
                <span className="story-rule-line" data-rule aria-hidden />
                <span className="story-rule-no tabular" aria-hidden>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{rule.title}</h3>
                <p>{rule.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* A day, by the clock                                               */}
      {/* ---------------------------------------------------------------- */}
      {/* Rendered only where the kitchen has published windows. A timeline of
          a day with no hours in it is worse than no timeline. */}
      {day.length > 0 ? (
        <section id="day" className="section-anchor texture-dots border-b border-line">
          <div className="landing-container landing-spacing mx-auto max-w-6xl px-4">
            <div className="story-section-head">
              <h2 className="section-display font-semibold" data-enter data-split-heading>
                a day, by the clock
              </h2>
              <p className="story-section-lede text-pretty" data-rise>
                Every time below is read from the kitchen&rsquo;s own schedule rather than
                written on this page, so it is the day that is actually being run.
              </p>
            </div>

            <ol className="story-day">
              {/* The thread, drawn as the day is scrolled. Decoration -- it
                  repeats the order the times are already printed in -- so it
                  is `aria-hidden` and starts undrawn, and the list below is
                  complete and readable without it. `preserveAspectRatio` is
                  what lets one path description stretch to a list of any
                  height; `vector-effect` keeps the stroke its real width
                  while that happens. */}
              <svg
                className="story-spine"
                viewBox="0 0 2 1000"
                preserveAspectRatio="none"
                aria-hidden
                focusable="false"
              >
                <path className="story-spine-line" d="M1 0 V1000" />
              </svg>

              {day.map((moment) => (
                <li key={`${moment.at}-${moment.title}`} className="story-hour">
                  <p className="story-hour-time tabular">{clockTime(moment.at)}</p>
                  <span className="story-hour-dot" aria-hidden />
                  <div className="story-hour-body">
                    <h3>{moment.title}</h3>
                    <p>{moment.body}</p>
                    {moment.note ? <span className="story-hour-note">{moment.note}</span> : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Common questions                                                  */}
      {/* ---------------------------------------------------------------- */}
      <section id="faq" className="section-anchor texture-contour border-b border-line">
        <div className="landing-container landing-spacing mx-auto max-w-6xl px-4">
          <div className="story-section-head">
            <h2 className="section-display font-semibold" data-enter data-split-heading>
              common questions
            </h2>
            <p className="story-section-lede text-pretty" data-rise>
              The things people ask most before they start a plan. If yours is not here,
              message us on WhatsApp.
            </p>
          </div>

          <div className="faq-list">
            {FAQS.map((faq, index) => (
              <FaqItem
                key={faq.question}
                number={String(index + 1).padStart(2, '0')}
                question={faq.question}
              >
                <p>{faq.answer}</p>
              </FaqItem>
            ))}
            {/* The rule under the last question, so the list closes the way
                every row in it opens. */}
            <span className="story-rule-line faq-list-end" data-rule aria-hidden />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Closing                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-sunken">
        <div className="landing-container landing-spacing mx-auto max-w-6xl px-4">
          <div className="story-section-head">
            <h2 className="section-display font-semibold" data-enter data-split-heading>
              come and eat
            </h2>
            <p className="story-section-lede text-pretty" data-rise>
              The menu changes daily and the plans are prepaid for one cycle. You can skip,
              pause or cancel any of it from your account.
            </p>
          </div>

          <div className="story-closing" data-rise>
            <ButtonLink
              href="/subscriptions"
              variant="outline"
              size="lg"
              className="btn-plain btn-wide"
              transitionTypes={['nav-forward']}
            >
              see the plans
            </ButtonLink>
          </div>
        </div>
      </section>
    </AboutStage>
  );
}
