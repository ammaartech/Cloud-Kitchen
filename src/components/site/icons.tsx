import { cx } from '@/components/ui/primitives';

/**
 * The storefront's icon set. Deliberately tiny -- there is no icon library in
 * this project, and two hand-drawn glyphs on one 24-unit grid with one stroke
 * weight beat pulling in a dependency for a search field and an arrow.
 */

const BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-5', className)} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg {...BASE} className={cx('size-4', className)} aria-hidden>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
