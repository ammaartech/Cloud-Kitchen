import type { ReactNode } from 'react';

/**
 * The shell both legal pages sit in.
 *
 * A component rather than two copies of the same markup, and rather than a
 * route group layout, because what is shared is the *typography* and not the
 * route: these two pages want one measure, one heading scale and one way of
 * stamping a date, and a layout file would give them a shared wrapper while
 * leaving each page to set its own headings anyway. The whole point is that
 * `<h2>` means the same thing on both.
 *
 * The measure is `max-w-3xl`, the same as `/about`. Legal prose is the one kind
 * of text on this site somebody reads to find a specific sentence rather than
 * reading through, and a long line makes the return sweep hard -- which is the
 * failure mode of a document being scanned, not skimmed.
 *
 * The date is a prop rather than a build-time `new Date()`. A policy's date is
 * the day its terms last changed, and a page that stamps itself with today
 * every time it is deployed is telling the reader something untrue about
 * whether the terms have moved since they last agreed to them.
 */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  /** The day these terms last changed, not the day the page was built. */
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h1>

      <p className="mt-3 text-xs tracking-caps text-subtle uppercase">
        Last updated {updated}
      </p>

      <p className="mt-6 text-muted text-pretty">{intro}</p>

      {/* `space-y` on the container rather than margins on the children,
          because the children are a flat run of `<h2>` and `<p>` with no
          wrapper per section -- and a flat run is the right shape for a
          document whose sections are only ever one to three paragraphs. The
          headings carry their own extra lead above via `pt-4`, the way
          `/about` does, so a new section is visibly a new section without
          needing a rule drawn across the page. */}
      <div className="mt-8 space-y-4 text-muted text-pretty">{children}</div>
    </div>
  );
}

/** A section heading inside a `LegalPage`. */
export function LegalHeading({ children }: { children: ReactNode }) {
  return <h2 className="pt-6 text-xl font-semibold text-ink">{children}</h2>;
}
