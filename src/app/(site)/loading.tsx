import { Hourglass } from '@/components/ui/hourglass';

/**
 * Storefront placeholder.
 *
 * This used to be a grid of skeletons shaped like the meal cards that were
 * coming, on the argument that a placeholder matching the content's shape stops
 * the page jumping when it lands. That argument is still true, and it lost to a
 * plainer one: the storefront's pages are prerendered and arrive in
 * milliseconds, so a full page of grey blocks was a heavier thing to show than
 * the wait it was covering. One mark in the middle of the screen says the same
 * word and says it more quietly.
 *
 * `min-h` rather than `h`, and `svh` rather than `vh`: this fills the main
 * region between the header and the footer, and on a phone `vh` is measured
 * against the viewport with the browser's chrome retracted -- which puts the
 * centre of a full-height box below the centre of the screen you are actually
 * looking at.
 */
export default function SiteLoading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="grid min-h-[70svh] place-items-center px-4"
    >
      <Hourglass className="h-16 text-muted" />
    </div>
  );
}
