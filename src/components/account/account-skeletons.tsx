'use client';

import type { CSSProperties, ReactNode } from 'react';
import { CONTACT } from '@/components/site/contact';
import { ArrowRightIcon, CheckIcon, HomeIcon, LockIcon, WhatsAppIcon } from '@/components/site/icons';
import { Alert, Badge, FieldAction, Input, Select, Textarea } from '@/components/ui/primitives';
import { buttonClasses, type ButtonSize, type ButtonVariant } from '@/components/ui/button-styles';
import { BUSINESS_TIMEZONE } from '@/lib/checkout/schedule';
import {
  useShape,
  type Measured,
  type AddressesShape,
  type OverviewShape,
  type RefundsShape,
  type ReviewsShape,
} from './account-shape';

/**
 * The account pages before their rows arrive.
 *
 * Built from the pages' own markup rather than drawn to resemble it: every
 * block here is the element and class the real page renders, with a grey bar
 * where a value will go. So a line of text is exactly as tall as the line that
 * replaces it, a card has the card's padding, an input has the input's height
 * -- and when the data lands nothing moves; the bars are simply filled in.
 * Anything the page always says (a section title, a field label, the
 * WhatsApp number) is written out for real, because it is already known.
 *
 * What is *not* known up front -- whether this customer has a plan, how many
 * addresses they keep -- comes from the outline each page left last time
 * (`account-shape.ts`). With no outline yet, each skeleton draws the page's
 * most common shape.
 *
 * Keep these in step with the pages. A change to a page's structure that is not
 * made here too is exactly the mismatch these exist to prevent.
 */

/* ------------------------------------------------------------------------ */
/* Pieces                                                                    */
/* ------------------------------------------------------------------------ */

/**
 * A grey bar. Inline by default, sized in `em` so it sits inside a real text
 * element and takes that element's line box -- `<p className="acct-date">`
 * around a `Bone` is exactly one date-line tall. `block` is for things that
 * are boxes rather than text: inputs, buttons.
 */
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

function Bone({ w, h, block, style }: { w: string; h?: string; block?: boolean; style?: CSSProperties }) {
  const bar = (
    <span
      aria-hidden
      className="acct-bone"
      data-block={block ? '' : undefined}
      style={{ width: w, height: h, ...style }}
    />
  );
  if (block) return bar;

  // A zero-width space beside the bar is real text in the parent's font, so
  // the line has the baseline real text would give it. Without it, a row that
  // aligns its items by baseline -- the credits figure, a delivery's date --
  // lines the bars up by their middles instead and comes out shorter than the
  // row that replaces it. One wrapper, so inside a flex row with a `gap` the
  // two are a single item rather than two items with a gap between them.
  return (
    <span>
      {ZERO_WIDTH_SPACE}
      {bar}
    </span>
  );
}

/**
 * What placeholder text is made of. Transparent, so the words never show; they
 * are ordinary English so their letters are ordinary widths. A run of one
 * letter -- "xxxx xxxxxx" -- is measurably wider than prose of the same length
 * and wraps a line early, which is a skeleton one line taller than its page.
 */
const FILLER =
  'the kitchen cooks every meal fresh in the morning and a rider brings it over in time for lunch ';

/**
 * A run of text that is not here yet, as long as the text that will be.
 *
 * `Bone` is a fixed width and never wraps, which is right for a date or a
 * name and wrong for a sentence: on a phone the summary under the greeting
 * runs to two lines, and a one-line bar there is a skeleton that grows when
 * the page lands. This is transparent placeholder text of the remembered
 * length, painted as a bar per line (`.acct-bone-text`), so it breaks where a
 * sentence of that length breaks -- at every width, without knowing any.
 */
function placeholder(chars: number): string {
  const length = Math.max(1, chars);
  return FILLER.repeat(Math.ceil(length / FILLER.length)).slice(0, length).trim() || 'x';
}

/**
 * `breaks`: line breaks the real text was typed with. The length is shared
 * evenly between the lines they make, which is the best guess at where they
 * fell without keeping the text itself.
 */
function TextBone({ chars, breaks = 0 }: { chars: number; breaks?: number }) {
  const lines = breaks + 1;
  const each = Math.max(1, Math.round((chars - breaks) / lines));
  return (
    <span aria-hidden className="acct-bone-text">
      {Array.from({ length: lines }, (_, line) => (
        <span key={line}>
          {line > 0 ? <br /> : null}
          {placeholder(each)}
        </span>
      ))}
    </span>
  );
}

/** A remembered text length, or the page's usual one. */
function lengthOf(shape: Measured | null, name: string, index: number, fallback: number): number {
  return shape?.texts?.[name]?.[index] || fallback;
}

/**
 * A form field: the real label over the real control, disabled.
 *
 * Not a bar drawn to a control's height -- the control itself, so its height
 * is whatever the browser makes it (a textarea's especially is the browser's
 * sum, not a number worth copying). Disabled is `bg-sunken`, which is the
 * skeleton's colour already; `.acct-bone-control` adds the shimmer and takes it
 * out of the pointer's way.
 */
function FieldBone({
  label,
  required,
  hint,
  control = 'input',
  controlClassName,
  className,
}: {
  label: string;
  required?: boolean;
  /** `Field`'s hint line under the control: fixed words, so shown. */
  hint?: string;
  control?: 'input' | 'select' | 'textarea';
  /** Anything the real control is given beyond the primitive's own classes. */
  controlClassName?: string;
  className?: string;
}) {
  const props = {
    disabled: true,
    tabIndex: -1,
    'aria-hidden': true,
    className: controlClassName ? `acct-bone-control ${controlClassName}` : 'acct-bone-control',
  } as const;

  return (
    <div className={className}>
      <span className="block">
        <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-ink">
          {label}
          {required ? <span className="text-danger">*</span> : null}
        </span>
        {control === 'select' ? (
          <Select {...props}>
            {/* Not empty: a customizable select sizes to its option's line box. */}
            <option>&nbsp;</option>
          </Select>
        ) : control === 'textarea' ? (
          <Textarea {...props} />
        ) : (
          <Input {...props} />
        )}
        {hint ? <span className="mt-1 block text-xs text-subtle">{hint}</span> : null}
      </span>
    </div>
  );
}

/**
 * A button: its real box and its real label, with the label transparent and
 * the box grey -- so it is exactly the width of the button that replaces it.
 */
function ButtonBone({
  label,
  variant = 'primary',
  size = 'md',
  className,
}: {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={buttonClasses(variant, size, className ? `acct-bone-button ${className}` : 'acct-bone-button')}
    >
      {label}
    </span>
  );
}

/**
 * A ghost button has no box of its own, only a label on the button's padding,
 * so its skeleton is that padding with a bar the width of the label.
 */
function GhostButtonBone({ label, className }: { label: string; className?: string }) {
  return (
    <span aria-hidden className={buttonClasses('ghost', 'sm', className)}>
      <span className="acct-bone-text">{label}</span>
    </span>
  );
}

/** `Card` from the primitives, reproduced so this file stays a leaf. */
const CARD = 'rounded-ck-lg border border-line bg-surface shadow-ck-sm';

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={className ? `acct-skeleton ${className}` : 'acct-skeleton'}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Overview                                                                  */
/* ------------------------------------------------------------------------ */

const OVERVIEW_DEFAULT: OverviewShape = {
  plan: true,
  next: 'skip',
  activeWeekdays: [1, 2, 3, 4, 5],
  rows: 3,
  more: false,
  facts: 4,
  cycle: true,
  history: 3,
  invoices: 1,
};

/** Today's weekday where the kitchen is, which is where the strip starts. */
function businessWeekday(): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TIMEZONE, weekday: 'short' }).format(
    new Date(),
  );
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

export function OverviewSkeleton() {
  const remembered = useShape('overview');
  const shape = remembered ?? OVERVIEW_DEFAULT;

  return (
    <Frame className="acct-page mx-auto max-w-5xl px-4">
      <header className="acct-head">
        <p className="acct-date">
          <Bone w="8.5rem" />
        </p>
        <p className="acct-hello">
          <Bone w="min(13rem, 70%)" />
        </p>
        <p className="acct-summary">
          <TextBone chars={lengthOf(remembered, 'summary', 0, shape.plan ? 74 : 52)} />
        </p>
      </header>

      {shape.plan ? (
        <div className="acct-grid">
          <div className="acct-main">
            <NextSkeleton kind={shape.next} measured={remembered} />
            <section className="acct-section">
              <div className="acct-section-head">
                <p className="acct-section-title">Next two weeks</p>
                <p className="acct-section-note">
                  <Bone w="12rem" />
                </p>
              </div>
              <StripSkeleton active={remembered ? shape.activeWeekdays : null} />
              {shape.rows > 0 ? (
                <ul className="acct-rows">
                  {Array.from({ length: shape.rows }, (_, row) => (
                    <RowSkeleton key={row} />
                  ))}
                </ul>
              ) : null}
              {shape.more ? (
                <details className="acct-more">
                  <summary tabIndex={-1}>
                    <Bone w="9rem" />
                  </summary>
                </details>
              ) : null}
            </section>
          </div>

          <aside className="acct-aside">
            <PlanSkeleton facts={shape.facts} cycle={shape.cycle} measured={remembered} />
          </aside>
        </div>
      ) : (
        <NoPlanSkeleton measured={remembered} />
      )}

      <div className="acct-records">
        <ListSkeleton
          title="Recent deliveries"
          count={shape.history}
          status
          quiet={lengthOf(remembered, 'historyQuiet', 0, 89)}
        />
        <ListSkeleton title="Invoices" count={shape.invoices} quiet={lengthOf(remembered, 'invoicesQuiet', 0, 71)} />
      </div>

      <nav className="acct-links" aria-hidden>
        <span className="acct-link-row">
          <HomeIcon className="acct-link-icon" />
          <span className="acct-link-text">
            <span className="acct-link-title">Addresses</span>
            <span className="acct-link-sub">
              <Bone w="10rem" />
            </span>
          </span>
          <ArrowRightIcon className="acct-link-arrow" />
        </span>
        <span className="acct-link-row">
          <span className="acct-link-icon acct-link-glyph">₹</span>
          <span className="acct-link-text">
            <span className="acct-link-title">Refunds</span>
            <span className="acct-link-sub">Something wrong with a delivery</span>
          </span>
          <ArrowRightIcon className="acct-link-arrow" />
        </span>
        <span className="acct-link-row">
          <WhatsAppIcon className="acct-link-icon" />
          <span className="acct-link-text">
            <span className="acct-link-title">Help</span>
            <span className="acct-link-sub">WhatsApp {CONTACT.whatsappDisplay}</span>
          </span>
          <ArrowRightIcon className="acct-link-arrow" />
        </span>
      </nav>
    </Frame>
  );
}

/** `NextDelivery`, in whichever of its four states it was last in. */
function NextSkeleton({ kind, measured }: { kind: OverviewShape['next']; measured: Measured | null }) {
  return (
    <section className="acct-next">
      <p className="acct-label">Next delivery</p>
      <div className="acct-next-body">
        {kind === 'empty' ? (
          <p className="acct-next-empty">
            <TextBone chars={lengthOf(measured, 'empty', 0, 110)} />
          </p>
        ) : (
          <>
            <p className="acct-next-day">
              <Bone w="9rem" />
            </p>
            <p className="acct-next-when">
              <TextBone chars={lengthOf(measured, 'when', 0, 32)} />
            </p>
            <p className="acct-next-dishes">
              <TextBone chars={lengthOf(measured, 'dishes', 0, 26)} />
            </p>
            {kind === 'skip' ? (
              <div className="acct-next-foot">
                {/* Real text length, so on a phone it pushes the button onto
                    its own line exactly when the real sentence does. The lock
                    icon is kept for the same reason: it takes its width. */}
                <p className="acct-next-lock">
                  <LockIcon className="acct-inline-icon" />
                  <TextBone chars={lengthOf(measured, 'lock', 0, 42)} />
                </p>
                {/* `SkipControl` at `md`: a 40px button. */}
                <ButtonBone label="Skip this delivery" variant="secondary" />
              </div>
            ) : kind === 'lock' ? (
              <p className="acct-next-lock">
                <LockIcon className="acct-inline-icon" />
                <TextBone chars={lengthOf(measured, 'lock', 0, 72)} />
              </p>
            ) : (
              <div className="acct-progress">
                <p className="acct-progress-now">
                  <Bone w="8rem" />
                </p>
                <ol className="acct-progress-steps">
                  {Array.from({ length: 5 }, (_, step) => (
                    <li key={step}>
                      <span className="acct-progress-dot" />
                      <span className="acct-progress-label">
                        <Bone w="3rem" />
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * The fourteen days. Today is the first cell and carries its marker; days the
 * plan delivers on are bordered cells and days it does not are open ones, from
 * the weekdays the strip had on last time. Before that is known (the server's
 * render, a first visit) every day is drawn bordered.
 */
function StripSkeleton({ active }: { active: number[] | null }) {
  const start = active ? businessWeekday() : -1;

  return (
    <div className="acct-strip">
      <ol className="acct-days">
        {Array.from({ length: 14 }, (_, offset) => {
          const rest = active !== null && start >= 0 && !active.includes((start + offset) % 7);
          return (
            <li key={offset} className="acct-day" data-kind={rest ? 'rest' : 'bone'} data-today={offset === 0 ? '' : undefined}>
              <span className="acct-day-cell">
                <span className="acct-day-name">
                  <Bone w="1.5rem" />
                </span>
                <span className="acct-day-num">
                  <Bone w="1.125rem" />
                </span>
                {/* Present but unpainted, so the cell is the real cell's height. */}
                <span className="acct-day-mark" />
              </span>
            </li>
          );
        })}
      </ol>
      {/* The key is the same every time, so it is simply shown. */}
      <ul className="acct-legend" aria-hidden>
        <li data-kind="delivery">
          <span className="acct-day-mark" />
          Delivery
        </li>
        <li data-kind="kitchen">
          <span className="acct-day-mark" />
          With the kitchen
        </li>
        <li data-kind="skipped">
          <span className="acct-day-mark">
            <span className="acct-day-strike" />
          </span>
          Skipped
        </li>
        <li data-kind="paused">
          <span className="acct-day-mark" />
          Paused
        </li>
      </ul>
    </div>
  );
}

/** `DeliveryRow`, with the small skip button most rows end in. */
function RowSkeleton() {
  return (
    <li className="acct-row">
      <div className="acct-row-when">
        <p className="acct-row-day">
          <span className="acct-row-date">
            <Bone w="6.5rem" />
          </span>
        </p>
        <p className="acct-row-meta">
          <Bone w="7.5rem" />
        </p>
      </div>
      <p className="acct-row-dishes">
        <Bone w="min(16rem, 90%)" />
      </p>
      <div className="acct-row-end">
        <ButtonBone label="Skip" variant="secondary" size="sm" />
      </div>
    </li>
  );
}

/** The plan ticket: the same stock, the same rows, bars for the values. */
function PlanSkeleton({ facts, cycle, measured }: { facts: number; cycle: boolean; measured: Measured | null }) {
  const labels = ['window', 'days', 'delivering to', 'this cycle'].slice(4 - Math.max(2, Math.min(4, facts)));

  return (
    <section className="acct-plan ticket-stock">
      <header className="acct-plan-head">
        <p className="ticket-meta">
          <Bone w="4.5rem" />
          <Bone w="5.5rem" />
        </p>
        <p className="ticket-name">
          <Bone w="10rem" />
        </p>
        {/* The dot is kept (in grey): it is the line's first item, so it is
            what the line's baseline -- and therefore its height -- comes from. */}
        <p className="acct-plan-status">
          <span className="acct-plan-status-dot" style={{ backgroundColor: 'var(--ck-surface-sunken)' }} />
          <Bone w="3rem" />
        </p>
      </header>

      <div className="acct-credits">
        <p className="acct-credits-figure">
          <span className="acct-credits-value">
            <Bone w="2.25rem" />
          </span>
          <span className="acct-credits-unit">
            <Bone w="6rem" />
          </span>
        </p>
        <div className="acct-meter" />
      </div>

      <dl className="acct-plan-facts">
        {labels.map((label) => (
          <div key={label} className="ticket-row">
            <dt>{label}</dt>
            <dd>
              <Bone w="6rem" />
            </dd>
          </div>
        ))}
      </dl>

      {cycle ? (
        <div className="acct-cycle">
          <div className="acct-cycle-bar" />
          <p className="acct-cycle-note">
            <Bone w="9rem" />
          </p>
        </div>
      ) : null}

      <p className="ticket-total acct-plan-total">
        <span className="ticket-total-label">
          <Bone w="7rem" />
        </span>
        <span className="ticket-price">
          <Bone w="4rem" />
        </span>
      </p>

      <div className="acct-controls">
        <div className="acct-controls-row">
          <ButtonBone label="Pause deliveries" variant="secondary" size="sm" />
          <GhostButtonBone label="Cancel plan" />
        </div>
        <p className="acct-controls-note">
          <TextBone chars={lengthOf(measured, 'note', 0, 45)} />
        </p>
      </div>
    </section>
  );
}

function NoPlanSkeleton({ measured }: { measured: Measured | null }) {
  return (
    <section className="acct-empty">
      <div>
        <p className="acct-empty-title">
          <TextBone chars={lengthOf(measured, 'emptyTitle', 0, 46)} />
        </p>
        <ul className="acct-empty-list">
          {[51, 55, 66].map((fallback, item) => (
            <li key={item}>
              <CheckIcon className="acct-inline-icon" />
              <span>
                <TextBone chars={lengthOf(measured, 'emptyItems', item, fallback)} />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="acct-empty-actions">
        <ButtonBone label="See the plans" className="btn-square" />
        <ButtonBone label="Today’s menu" variant="outline" className="btn-square" />
      </div>
    </section>
  );
}

function ListSkeleton({
  title,
  count,
  status,
  quiet,
}: {
  title: string;
  count: number;
  status?: boolean;
  /** Length of the sentence shown instead of the list when it is empty. */
  quiet: number;
}) {
  // Invoice numbers are set in the mono face, a size down from a date.
  return (
    <section className="acct-section">
      <div className="acct-section-head">
        <p className="acct-section-title">{title}</p>
      </div>
      {count === 0 ? (
        <p className="acct-quiet">
          <TextBone chars={quiet} />
        </p>
      ) : (
        <ul className="acct-list">
          {Array.from({ length: count }, (_, row) => (
            <li key={row} className="acct-list-row">
              <span className="acct-list-main">
                <span className={status ? 'acct-list-title' : 'acct-list-title acct-mono'}>
                  <Bone w="8rem" />
                </span>
                <span className="acct-list-sub">
                  <Bone w="11rem" />
                </span>
              </span>
              <span className={status ? 'acct-list-status' : 'acct-list-amount'}>
                <Bone w="4rem" />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* The form pages                                                            */
/* ------------------------------------------------------------------------ */

/** `EmptyState`: a dashed box with a line and a sentence. */
function EmptySkeleton({ action }: { action?: boolean }) {
  return (
    <div className="rounded-ck-lg border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="text-sm">
        <Bone w="9rem" />
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm">
        <Bone w="min(18rem, 90%)" />
      </p>
      {action ? (
        <div className="mt-4 flex justify-center">
          <ButtonBone label="Browse plans" />
        </div>
      ) : null}
    </div>
  );
}

/** The `<details>` line at the foot of an editable card. */
function DetailsSkeleton({ label }: { label: string }) {
  return (
    <div className="acct-details mt-3 border-t border-line pt-3">
      <span className="acct-details-summary">{label}</span>
    </div>
  );
}

const ADDRESSES_DEFAULT: AddressesShape = { customer: true, cards: 1, retired: false };

/** What a first visit assumes a card holds: the default, not in use, no note. */
const ADDRESS_CARD_DEFAULT: Record<string, number> = { label: 4, default: 7, whom: 24, where: 70, remove: 6 };

export function AddressesSkeleton() {
  const remembered = useShape('addresses');
  const shape = remembered ?? ADDRESSES_DEFAULT;
  const cards = remembered?.cards ?? Array.from({ length: shape.cards }, () => ADDRESS_CARD_DEFAULT);

  if (!shape.customer) {
    return (
      <Frame>
        <EmptySkeleton action />
      </Frame>
    );
  }

  return (
    <Frame>
      {cards.length === 0 ? (
        <EmptySkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((card, index) => (
            <div key={index} className={`${CARD} h-full p-4`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">
                  <TextBone chars={card.label || 4} />
                </p>
                {'default' in card ? <Badge tone="brand">Default</Badge> : null}
                {'inUse' in card ? <Badge tone="success">In use by a plan</Badge> : null}
              </div>
              <p className="mt-1 text-sm">
                <TextBone chars={card.whom || 24} />
              </p>
              <p className="mt-1 text-sm">
                <TextBone chars={card.where || 70} />
              </p>
              {card.note ? (
                <p className="mt-2 rounded-ck bg-sunken px-3 py-2 text-xs">
                  <TextBone chars={card.note} />
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {'makeDefault' in card ? <GhostButtonBone label="Make default" /> : null}
                {'remove' in card ? (
                  <GhostButtonBone label="Remove" className="ml-auto" />
                ) : (
                  <span className="ml-auto text-xs text-subtle">Used by a live plan: change the plan first</span>
                )}
              </div>
              <DetailsSkeleton label="Edit this address" />
            </div>
          ))}
        </div>
      )}

      <div className={`${CARD} mt-8 p-5`}>
        <h2 className="mb-4 font-semibold">Add an address</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <FieldBone label="Label" hint="Home, Office, Mum’s…" />
          <FieldBone label="Recipient" required />
          <FieldBone label="Phone" required />
          <FieldBone label="Address line 1" required className="sm:col-span-2" />
          <FieldBone label="Landmark" />
          <FieldBone label="Address line 2" className="sm:col-span-3" />
          <FieldBone label="City" required />
          <FieldBone label="State" required />
          <FieldBone label="Postcode" required />
          <FieldBone
            label="Delivery instructions"
            hint="Anything the rider needs to know. This reaches the kitchen too."
            control="textarea"
            controlClassName="min-h-16"
            className="sm:col-span-3"
          />
          <span className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" disabled tabIndex={-1} aria-hidden className="acct-bone-control h-4 w-4" />
            Make this my default
          </span>
          <FieldAction>
            <ButtonBone label="Save address" />
          </FieldAction>
        </div>
      </div>

      {shape.retired ? (
        <p className="mt-4 text-xs">
          <TextBone chars={90} />
        </p>
      ) : null}
    </Frame>
  );
}

const REVIEWS_DEFAULT: ReviewsShape = { customer: true, cards: 0, note: true };

/** A badge (`Badge`): its box and padding, a bar for the word. */
function BadgeBone({ chars }: { chars: number }) {
  return (
    <span className="inline-flex items-center rounded-ck-sm border border-line px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      <TextBone chars={chars} />
    </span>
  );
}

export function ReviewsSkeleton() {
  const remembered = useShape('reviews');
  const shape = remembered ?? REVIEWS_DEFAULT;
  const cards = remembered?.cards ?? Array.from({ length: shape.cards }, () => ({}) as Record<string, number>);

  if (!shape.customer) {
    return (
      <Frame>
        <EmptySkeleton action />
      </Frame>
    );
  }

  return (
    <Frame>
      <div className={`${CARD} p-5`}>
        <h2 className="mb-4 font-semibold">Write a review</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldBone label="What is this about?" control="select" />
          <FieldBone label="Rating" required control="select" />
          <FieldBone label="Title" className="sm:col-span-2" />
          <FieldBone label="Your review" required control="textarea" className="sm:col-span-2" />
          <div>
            <ButtonBone label="Submit review" />
          </div>
        </div>
        {shape.note ? (
          <p className="mt-4 text-xs">
            <TextBone chars={lengthOf(remembered, 'formNote', 0, 99)} />
          </p>
        ) : null}
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">What you have written</h2>
        {cards.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {cards.map((card, index) => (
              <div key={index} className={`${CARD} p-4`}>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Five stars whatever the rating, so the row is the real width. */}
                  <span aria-hidden className="text-line-strong">
                    ★★★★★
                  </span>
                  <span className="text-xs">
                    <Bone w="2.25rem" />
                  </span>
                  <BadgeBone chars={card.status || 7} />
                  {'verified' in card ? <BadgeBone chars={8} /> : null}
                </div>
                <p className="mt-2 font-medium">
                  <TextBone chars={card.title || 20} />
                </p>
                <p className="mt-1 text-sm">
                  <TextBone chars={card.body || 60} breaks={card.bodyBreaks} />
                </p>
                <p className="mt-2 text-xs">
                  <TextBone chars={card.meta || 60} />
                </p>
                <DetailsSkeleton label="Edit or withdraw" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* The same words the page closes on: they are fixed, so they are shown. */}
      <div className="mt-8">
        <Alert tone="info">
          Editing a published review sends it back to be checked before it reappears. That keeps
          the menu honest for everyone reading it.
        </Alert>
      </div>
    </Frame>
  );
}

const REFUNDS_DEFAULT: RefundsShape = { customer: true, cards: 0, openCase: false };

export function RefundsSkeleton() {
  const remembered = useShape('refunds');
  const shape = remembered ?? REFUNDS_DEFAULT;
  const cards = remembered?.cards ?? Array.from({ length: shape.cards }, () => ({}) as Record<string, number>);

  if (!shape.customer) {
    return (
      <Frame>
        <EmptySkeleton action />
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="mb-6">
        <Alert tone="info">
          Raising a request opens a case. It does not cancel your plan or issue a refund by
          itself. Refund terms are still being finalised, so we will come back to you with what we
          can do.
        </Alert>
      </div>

      <div className={`${CARD} p-5`}>
        <h2 className="mb-4 font-semibold">Raise a request</h2>
        {shape.openCase ? (
          <Alert tone="warning">
            You already have a request open. Add to it by getting in touch rather than raising a
            second one.
          </Alert>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FieldBone label="Which subscription?" control="select" />
          <FieldBone label="Amount you are asking for" hint="Leave blank if you are not sure." />
          <FieldBone label="What happened?" required control="textarea" className="sm:col-span-2" />
          <div>
            <ButtonBone label="Raise request" />
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Your requests</h2>
        {cards.length === 0 ? (
          <p className="mt-3 text-sm text-muted">You have not raised any.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {cards.map((card, index) => (
              <div key={index} className={`${CARD} p-4`}>
                <div className="flex flex-wrap items-center gap-2">
                  <BadgeBone chars={card.status || 4} />
                  {'amount' in card ? (
                    <span className="text-sm">
                      <TextBone chars={card.amount} />
                    </span>
                  ) : null}
                  <span className="text-xs">
                    <TextBone chars={card.when || 20} />
                  </span>
                </div>
                <p className="mt-2 text-sm">
                  <TextBone chars={card.reason || 60} breaks={card.reasonBreaks} />
                </p>
                <p className="mt-2 text-xs">
                  <TextBone chars={card.note || 30} />
                </p>
                {'reply' in card ? (
                  <p className="mt-2 rounded-ck bg-sunken px-3 py-2 text-sm">
                    <TextBone chars={card.reply} />
                  </p>
                ) : null}
                {'withdraw' in card ? (
                  <div className="mt-3">
                    <GhostButtonBone label="Withdraw this request" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </Frame>
  );
}
