'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { buttonClasses, cx } from '@/components/ui/button-styles';
import { CloseIcon, SearchIcon } from './icons';

/**
 * Menu search.
 *
 * Still a GET form pointed at `/menu`, so with JavaScript off it submits the
 * way it always did and the URL stays bookmarkable. With JavaScript the submit
 * becomes a client-side navigation inside a transition: the page is not
 * reloaded, the board's entrance does not replay, and `pending` is true for
 * exactly as long as the new results are on their way -- which is what the
 * progress hairline and the dimmed list (`menu.css`) are keyed to.
 *
 * Clearing is an icon inside the field rather than a link under it. It empties
 * the field and, if a search was applied, navigates back to the whole menu.
 *
 * The URL is the source of truth for the value: when `q` changes under the
 * field -- a clear, the back button -- the field follows it.
 */
export function MenuSearch({
  defaultValue = '',
  className,
}: {
  defaultValue?: string;
  className?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [applied, setApplied] = useState(defaultValue);
  const [pending, startTransition] = useTransition();

  if (defaultValue !== applied) {
    setApplied(defaultValue);
    setValue(defaultValue);
  }

  const search = (next: string) => {
    const q = next.trim();
    startTransition(() => {
      router.push((q ? `/menu?q=${encodeURIComponent(q)}` : '/menu') as Route, { scroll: false });
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    search(value);
  };

  const clear = () => {
    setValue('');
    input.current?.focus();
    if (applied) search('');
  };

  return (
    <form
      role="search"
      action="/menu"
      method="get"
      onSubmit={onSubmit}
      aria-busy={pending}
      data-pending={pending ? '' : undefined}
      className={cx(
        'menu-search flex items-center gap-2 rounded-ck border border-line-strong bg-surface p-1.5',
        className,
      )}
    >
      <label htmlFor="menu-search" className="sr-only">
        Search the menu
      </label>

      {/* On a phone the submit button carries the glyph instead; two search
          icons in a 343px-wide field is 28px spent on nothing. */}
      <SearchIcon className="menu-search-glyph ml-2 hidden shrink-0 sm:block" />

      <input
        ref={input}
        id="menu-search"
        name="q"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
        placeholder="Try dosa, ghee, or rice bath"
        className={cx(
          'ml-2 min-w-0 flex-1 bg-transparent py-1.5 text-sm text-ink placeholder:text-placeholder sm:ml-0',
          // The form draws the ring for the whole field, so the input must not
          // draw a second one inside it.
          'focus-visible:outline-none',
        )}
      />

      <button
        type="button"
        onClick={clear}
        aria-label="Clear search"
        data-shown={value ? '' : undefined}
        className="menu-search-clear"
      >
        <CloseIcon />
      </button>

      <button type="submit" className={buttonClasses('primary', 'sm', 'shrink-0 px-3 sm:px-5')}>
        <SearchIcon className="size-4 sm:hidden" />
        <span className="sr-only sm:not-sr-only">Search</span>
      </button>

      <span className="menu-search-progress" aria-hidden />
    </form>
  );
}
