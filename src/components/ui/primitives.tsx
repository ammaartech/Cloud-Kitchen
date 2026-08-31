import type { ComponentPropsWithoutRef, ReactNode } from 'react';

/** Minimal class joiner. Falsy entries drop out. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

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
/* Button                                                                     */
/* ========================================================================== */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover border-transparent',
  secondary: 'bg-surface text-ink border-line-strong hover:bg-sunken',
  ghost: 'bg-transparent text-muted border-transparent hover:bg-sunken hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90 border-transparent',
  success: 'bg-success text-white hover:opacity-90 border-transparent',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  // Operational screens are used at arm's length on a tablet or kiosk.
  lg: 'h-12 px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-ck border font-medium',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
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
  accent: 'bg-accent-soft text-accent border-transparent',
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
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
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

const CONTROL =
  'w-full rounded-ck border border-line-strong bg-surface px-3 py-2 text-sm text-ink ' +
  'placeholder:text-subtle focus:border-brand focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-subtle';

export function Input({ className, ...rest }: ComponentPropsWithoutRef<'input'>) {
  return <input className={cx(CONTROL, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentPropsWithoutRef<'select'>) {
  return (
    <select className={cx(CONTROL, 'pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: ComponentPropsWithoutRef<'textarea'>) {
  return <textarea className={cx(CONTROL, 'min-h-20 resize-y', className)} {...rest} />;
}

/* ========================================================================== */
/* Loading                                                                    */
/* ========================================================================== */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-ck bg-sunken', className)} aria-hidden />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cx('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      width="16"
      height="16"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
