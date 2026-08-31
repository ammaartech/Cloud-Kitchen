/**
 * The one visual definition of a button, shared by everything that needs to
 * look like one: `Button` (a real <button>, client-side so it can react to a
 * pending form) and `ButtonLink` (a real <a>, server-safe). Keeping the
 * classes here means the two can never drift apart.
 */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

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

export function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  className?: string,
): string {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-ck border font-medium',
    'cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}
