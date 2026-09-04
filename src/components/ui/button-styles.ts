/**
 * The one visual definition of a button, shared by everything that needs to
 * look like one: `Button` (a real <button>, client-side so it can react to a
 * pending form) and `ButtonLink` (a real <a>, server-safe). Keeping the
 * classes here means the two can never drift apart.
 *
 * Three weights carry the whole system, in the order the eye should find them:
 *
 *   primary    filled brand    the one obvious action on a screen
 *   secondary  soft brand tint the reasonable alternative
 *   outline    hairline        a third choice, or an action on a tinted ground
 *                              where a soft fill would disappear
 *
 * plus `ghost` for toolbar-weight actions and `danger`/`success` where the
 * outcome, not the emphasis, is the point.
 *
 * Every variant defines default, hover, active and disabled. Colours come from
 * tokens rather than ramp steps so the ops surface flips them; each state was
 * checked at 4.5:1 on both surfaces.
 *
 * The press is the one thing here that is not colour. Every button in this
 * system used to answer a press by changing shade, which is a state *report*
 * rather than a response -- the interface tells you afterwards that something
 * was pressed, instead of moving under the finger while it is being pressed.
 * `active:scale-[0.97]` is the response, and it is on the shared definition
 * rather than on the buttons that seemed to want it, because a system where
 * only some buttons give under the finger is worse than one where none do:
 * the ones that do not read as broken.
 *
 * 0.97 rather than something more visible. The scale takes the label and the
 * icons with it -- that is what makes it read as one object being pushed
 * rather than a box resizing around its contents -- so three per cent is
 * already a legible amount of travel on a control the size of a word.
 */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-brand text-white hover:bg-brand-hover active:bg-ink',
  secondary:
    'border-transparent bg-brand-soft text-brand hover:bg-brand-soft-hover active:bg-brand-soft-active',
  outline:
    'border-line-strong bg-surface text-brand hover:bg-brand-soft active:bg-brand-soft-active',
  ghost: 'border-transparent bg-transparent text-muted hover:bg-sunken hover:text-ink',
  danger: 'border-transparent bg-danger text-white hover:opacity-90 active:opacity-80',
  success: 'border-transparent bg-success text-white hover:opacity-90 active:opacity-80',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3.5 text-sm',
  md: 'h-10 px-5 text-sm',
  // Operational screens are used at arm's length on a tablet or kiosk.
  lg: 'h-12 px-7 text-base',
};

export function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  className?: string,
): string {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-full border font-medium',
    // The properties are named rather than left to `transition-colors`, which
    // would not carry the press, and rather than `all`, which would carry
    // everything including layout properties nothing here should be animating.
    //
    // `scale`, not `transform`, and that is a Tailwind v4 detail worth writing
    // down because it fails silently. v4 compiles `scale-[0.97]` to the
    // independent `scale:` property rather than to `transform: scale(...)`.
    // Listing `transform` here therefore transitions a property this button
    // never sets: the press still worked, but it snapped in and snapped back
    // with no easing at all, which is the one thing a press should not do.
    //
    // 150ms sits inside the 100-160ms a press wants: below it the button reads
    // as twitchy, above it the response arrives after the finger has left.
    'cursor-pointer transition-[scale,color,background-color,border-color] duration-150 ease-ck',
    'active:scale-[0.97]',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45',
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}
