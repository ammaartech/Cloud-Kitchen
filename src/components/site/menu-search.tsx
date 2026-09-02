import type { CSSProperties } from 'react';
import { buttonClasses, cx } from '@/components/ui/button-styles';
import { SearchIcon } from './icons';

/**
 * Menu search.
 *
 * A plain GET form pointed at `/menu`, so it works with JavaScript disabled,
 * is bookmarkable, and needs no client component. The menu page reads `q` and
 * filters against it -- this control is never decorative.
 *
 * `hero` is the pill that sits on the home page's tinted ground; `inline` is
 * the ordinary field on the menu page itself, where the visitor refines a
 * search they have already run.
 */
export function MenuSearch({
  defaultValue = '',
  tone = 'inline',
  className,
  style,
}: {
  defaultValue?: string;
  tone?: 'hero' | 'inline';
  className?: string;
  /** Pass-through for the hero's entrance delay; see `.hero-enter`. */
  style?: CSSProperties;
}) {
  const hero = tone === 'hero';
  const id = hero ? 'hero-menu-search' : 'menu-search';

  return (
    <form
      role="search"
      action="/menu"
      method="get"
      style={style}
      className={cx(
        'flex items-center gap-2 border border-line-strong bg-surface',
        'focus-within:outline-2 focus-within:outline-brand focus-within:outline-offset-2',
        // The hero field is the first thing on this page a visitor can put a
        // cursor in, so focus lifts it off the ground rather than only ringing
        // it. Shadow only -- a transform here would fight the entrance
        // keyframe the hero hands down through `className`.
        hero
          ? 'rounded-full p-2 shadow-ck transition-shadow duration-300 ease-ck focus-within:shadow-ck-lg'
          : 'rounded-ck p-1.5',
        className,
      )}
    >
      <label htmlFor={id} className="sr-only">
        Search the menu
      </label>

      {/* On a phone the submit button carries the glyph instead; two search
          icons in a 343px-wide field is 28px spent on nothing. */}
      <SearchIcon className="ml-2 hidden shrink-0 text-muted sm:block" />

      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoComplete="off"
        placeholder="Try paneer, dal, or high protein"
        // 16px on the hero field, because anything smaller makes iOS zoom the
        // page on focus. The form draws the focus ring for both controls, so
        // the input suppresses its own rather than nesting two.
        className={cx(
          'ml-2 min-w-0 flex-1 bg-transparent text-ink placeholder:text-placeholder sm:ml-0',
          // The form draws the ring for the whole pill, so the input must not
          // draw a second one inside it. This opt-out was already written and
          // was doing nothing until the base ring moved into `@layer base` --
          // an unlayered rule beats a utility whatever the specificity, so the
          // pill was ringed once around itself and again around the field.
          'focus-visible:outline-none',
          hero ? 'py-2 text-base' : 'py-1.5 text-sm',
        )}
      />

      <button
        type="submit"
        className={buttonClasses('primary', hero ? 'md' : 'sm', 'shrink-0 px-3 sm:px-5')}
      >
        <SearchIcon className="size-4 sm:hidden" />
        <span className="sr-only sm:not-sr-only">Search</span>
      </button>
    </form>
  );
}
