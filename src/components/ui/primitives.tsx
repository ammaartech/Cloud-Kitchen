import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import Link from 'next/link';
import { buttonClasses, cx, type ButtonSize, type ButtonVariant } from './button-styles';

export { cx };
export { Button } from './button';
export { ConfirmButton } from './confirm-button';
export { Spinner } from './spinner';

/* ========================================================================== */
/* Surfaces                                                                   */
/* ========================================================================== */

export function Card({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cx(
        'rounded-ck-lg border border-line bg-surface shadow-ck-sm',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ========================================================================== */
/* Button-shaped link                                                         */
/* ========================================================================== */

/**
 * A navigation styled as a button.
 *
 * A real `<a>`, not a `<button>` wrapped in a `<Link>` -- nesting one
 * interactive element inside another is invalid HTML, confuses screen readers
 * about what a single tab stop does, and breaks open-in-new-tab. Anything that
 * *goes somewhere* uses this; anything that *does something* uses `Button`.
 */
export function ButtonLink<RouteType>({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof Link<RouteType>> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

/* ========================================================================== */
/* Badges                                                                     */
/* ========================================================================== */

type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-muted border-line',
  brand: 'bg-brand-soft text-brand border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  // The palette is monochrome, so `accent` cannot differ from `brand` by hue.
  // It reads as the quieter of the two: paler fill, hairline edge. Its label is
  // `brand` rather than `accent`, which would sit at 4.06:1 on this tint.
  accent: 'bg-accent-soft text-brand border-line',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-ck-sm border px-2 py-0.5',
        'text-xs font-medium whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Card background tint that identifies where a ticket came from at a glance
 * (PRD 4). Subscription deliveries take precedence over the marketplace source
 * -- the fulfilment path is what matters on the board, not the storefront the
 * plan was bought on. Colour is a hint here, not a signal: the SourceTag and
 * `#SUB-…` label carry the actual identity.
 */
export function sourceCardTone(source: string, isSubscription: boolean): string {
  if (isSubscription) return 'bg-info-soft!';
  if (source === 'SW') return 'bg-sw-soft!';
  if (source === 'ZM') return 'bg-zm-soft!';
  return '';
}

/**
 * Source marker for a KOT ticket.
 *
 * Always renders the literal prefix alongside the colour, because colour must
 * never be the only source indicator (PRD 19) -- a colour-blind manager, or a
 * washed-out kitchen screen, still reads "SW".
 */
export function SourceTag({
  source,
  ticketCode,
  size = 'md',
}: {
  source: string;
  ticketCode?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const styles: Record<string, string> = {
    SW: 'bg-sw-soft text-sw border-sw/30',
    ZM: 'bg-zm-soft text-zm border-zm/30',
    SX: 'bg-sx-soft text-sx border-sx/30',
  };

  const sizes = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-lg px-2.5 py-1',
  };

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md border font-mono font-semibold tabular',
        styles[source] ?? 'bg-sunken text-muted border-line',
        sizes[size],
      )}
    >
      {ticketCode ?? source}
    </span>
  );
}

/* ========================================================================== */
/* Feedback                                                                   */
/* ========================================================================== */

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: ReactNode;
}) {
  const tones = {
    info: 'bg-info-soft border-info/30 text-info',
    success: 'bg-success-soft border-success/30 text-success',
    warning: 'bg-warning-soft border-warning/30 text-warning',
    danger: 'bg-danger-soft border-danger/30 text-danger',
  };

  return (
    <div className={cx('rounded-ck border px-4 py-3 text-sm', tones[tone])} role="status">
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1 opacity-90' : 'opacity-90'}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-ck-lg border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/**
 * A figure with its label. `hint` carries the caveat -- an estimate built on
 * dummy cost assumptions should say so rather than looking like a fact
 * (PRD 12).
 */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative';
}) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-subtle uppercase">{label}</p>
      <p
        className={cx(
          'mt-1 text-2xl font-semibold tabular',
          tone === 'positive' && 'text-success',
          tone === 'negative' && 'text-danger',
          (!tone || tone === 'default') && 'text-ink',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

/* ========================================================================== */
/* Forms                                                                      */
/* ========================================================================== */

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-danger">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-subtle">{hint}</span>
      ) : null}
    </label>
  );
}

/**
 * A cell in a grid of `Field`s holding something that is not a field -- a
 * submit button, almost always -- which has to line up with the *controls*
 * rather than with the row.
 *
 * A grid row is as tall as its tallest cell, and a `Field` carrying a `hint` is
 * a line taller than one without. So `items-end` on a button's cell aligned it
 * to the bottom of somebody else's hint and dropped it clear of the inputs it
 * belongs to -- "Create dish" sitting a line below the four boxes it submits.
 * `items-start` would have been wrong in the same way, raising it by the height
 * of a label. Neither edge of the row is the one that matters: the control is.
 *
 * So the cell reproduces a `Field`'s own shape -- a label-sized spacer, then
 * the thing -- and is built from the same classes the real label uses rather
 * than from the 26px they happen to add up to, so the two cannot drift apart if
 * that type ever changes. The spacer is empty and `aria-hidden`: a button says
 * what it does itself, and an invisible label read out is noise.
 *
 * `self-start` so the cell sizes to its contents instead of stretching to the
 * row, which is what would put the spacer back at the mercy of the tallest
 * cell.
 */
export function FieldAction({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('self-start', className)}>
      <span aria-hidden className="mb-1.5 block text-sm font-medium">
        &nbsp;
      </span>
      {/* 2.375rem is what a regular control comes to: a 20px line, 16px of
          padding, 2px of border. Centring against that height rather than
          simply stacking means a `sm` button and a `md` one both line up with
          the field beside them, instead of only whichever one happens to be
          38px tall. */}
      <div className="flex min-h-[2.375rem] items-center gap-2">{children}</div>
    </div>
  );
}

const CONTROL =
  'w-full rounded-ck-sm border border-line-strong bg-surface px-3.5 text-sm text-ink ' +
  // Quieter than any other text in the system, and the point of it: a
  // placeholder here is an example of what to type, and it has to be obviously
  // provisional rather than look like a value the field already holds. Every
  // control that gets one also carries a real <label>, so nothing is said only
  // here -- see `--ck-text-placeholder`.
  'placeholder:text-placeholder transition-colors duration-150 ease-ck ' +
  // No `outline-none`. It used to be here, and it never did anything: the base
  // focus ring in `globals.css` was unlayered and outranked it. Now that the
  // ring is in `@layer base` this opt-out would genuinely take effect, and the
  // only focus indicator left would be a border changing from grey to green --
  // which is a colour change alone, and not enough on its own. The ring is the
  // indicator; the border is what confirms which control has it.
  'hover:border-brand/50 focus:border-brand ' +
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-subtle';

/**
 * How tall a control is, deliberately kept *out* of `CONTROL` and behind a prop
 * rather than left to the caller's `className`.
 *
 * `cx` is a plain join, not a Tailwind-aware merge, so two utilities from the
 * same family both survive into the attribute and the winner is decided by the
 * order they appear in the generated stylesheet -- not by the order they were
 * written. `.py-2` is emitted after `.py-0`, so a caller asking for
 * `className="h-8 py-0"` got `h-8` *and* `py-2`: a 32px box, less 2px of
 * border, less 16px of padding, leaving a 14px content box to draw a 20px
 * line in. That is why the analytics category filter was rendering with the
 * descenders sliced off its label. The override was not losing to specificity,
 * it was never applying at all, which is the kind of failure that looks like a
 * font bug and gets chased in the wrong file.
 *
 * So the base string no longer carries vertical padding and there is exactly
 * one `py` on any control. A future compact control asks for it by name.
 */
const CONTROL_HEIGHTS = {
  regular: 'py-2',
  // Pinned to 32px so it lines up with the chip-shaped range filters it sits
  // beside on the analytics bar, which set their own `h-8`.
  compact: 'h-8 py-0',
} as const;

type ControlProps = { compact?: boolean };

export function Input({
  className,
  compact,
  ...rest
}: ComponentPropsWithoutRef<'input'> & ControlProps) {
  return (
    <input
      className={cx(CONTROL, CONTROL_HEIGHTS[compact ? 'compact' : 'regular'], className)}
      {...rest}
    />
  );
}

export function Select({
  className,
  children,
  compact,
  ...rest
}: ComponentPropsWithoutRef<'select'> & ControlProps) {
  return (
    <select
      /* `ck-select` rather than a `pr-8` utility, and it carries the drop-down
         styling too -- see the note over it in `globals.css`. The end padding
         has to change depending on whether the browser is drawing the arrow or
         we are, and a utility cannot answer a `@supports` query. */
      className={cx(CONTROL, CONTROL_HEIGHTS[compact ? 'compact' : 'regular'], 'ck-select', className)}
      {...rest}
    >
      {children}
    </select>
  );
}

/* No `compact` here on purpose: a textarea is sized by how much someone has to
   write in it, and every caller already says that with `min-h-*`. */
export function Textarea({ className, ...rest }: ComponentPropsWithoutRef<'textarea'>) {
  return (
    <textarea
      className={cx(CONTROL, CONTROL_HEIGHTS.regular, 'min-h-20 resize-y', className)}
      {...rest}
    />
  );
}

/* ========================================================================== */
/* Loading                                                                    */
/* ========================================================================== */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-ck bg-sunken', className)} aria-hidden />;
}
