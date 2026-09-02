import { buttonClasses, cx } from '@/components/ui/button-styles';
import { SearchIcon } from './icons';

/**
 * Menu search.
 *
 * A plain GET form pointed at `/menu`, so it works with JavaScript disabled,
 * is bookmarkable, and needs no client component. The menu page reads `q` and
 * filters against it -- this control is never decorative.
 *
 * One tone, and it used to be two. The other was a pill for the home page's
 * hero, which is now a call to action instead: searching a menu is something a
 * visitor does once they are already looking at it, not the first thing a
 * kitchen that cooks one menu a day should ask for. The hero variant went with
 * it rather than staying here unused.
 */
export function MenuSearch({
  defaultValue = '',
  className,
}: {
  defaultValue?: string;
  className?: string;
}) {
  return (
    <form
      role="search"
      action="/menu"
      method="get"
      className={cx(
        'flex items-center gap-2 rounded-ck border border-line-strong bg-surface p-1.5',
        'focus-within:outline-2 focus-within:outline-brand focus-within:outline-offset-2',
        className,
      )}
    >
      <label htmlFor="menu-search" className="sr-only">
        Search the menu
      </label>

      {/* On a phone the submit button carries the glyph instead; two search
          icons in a 343px-wide field is 28px spent on nothing. */}
      <SearchIcon className="ml-2 hidden shrink-0 text-muted sm:block" />

      <input
        id="menu-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoComplete="off"
        placeholder="Try paneer, dal, or high protein"
        className={cx(
          'ml-2 min-w-0 flex-1 bg-transparent py-1.5 text-sm text-ink placeholder:text-placeholder sm:ml-0',
          // The form draws the ring for the whole field, so the input must not
          // draw a second one inside it. This opt-out was already written and
          // was doing nothing until the base ring moved into `@layer base` --
          // an unlayered rule beats a utility whatever the specificity, so the
          // field was ringed once around itself and again around the input.
          'focus-visible:outline-none',
        )}
      />

      <button type="submit" className={buttonClasses('primary', 'sm', 'shrink-0 px-3 sm:px-5')}>
        <SearchIcon className="size-4 sm:hidden" />
        <span className="sr-only sm:not-sr-only">Search</span>
      </button>
    </form>
  );
}
