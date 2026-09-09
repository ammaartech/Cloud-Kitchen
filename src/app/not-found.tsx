import type { CSSProperties } from 'react';
import { ButtonLink } from '@/components/ui/primitives';
import './not-found.css';

export const metadata = { title: 'Not found' };

/**
 * Renders for a bad URL, and for anything a page resolves with `notFound()`:
 * a plan slug that no longer exists, an archived dish, a customer id that was
 * never real.
 *
 * This is the root boundary, so it renders inside `app/layout.tsx` and nothing
 * else. There is no storefront shell around it and no header to navigate from,
 * which is why the three links below are not decoration. They are the only way
 * off this page, and a 404 that a visitor has to use the back button to escape
 * is a 404 that loses them.
 *
 * The choreography is documented in `not-found.css`. The short version: one
 * curve, one distance, one interval, so the page arrives as a single wave
 * rather than six things that each animate.
 */

/** One interval per element, so the wave's spacing lives in a single place. */
function at(step: number): CSSProperties {
  return { '--nf-at': `${step * 80}ms` } as CSSProperties;
}

export default function NotFound() {
  return (
    <div className="nf flex flex-1 items-center justify-center px-4 py-20">
      <div className="w-full max-w-md text-center">
        {/* The mark. Two digits and a plate, sharing a baseline.

            `aria-label` on the group and `aria-hidden` on the parts: read out
            piece by piece this is "4", an unlabelled graphic, then "4", which
            is not what anybody sees. It is one glyph, so it is announced as
            one. */}
        <p className="nf-mark" role="img" aria-label="404">
          <span aria-hidden className="nf-digit nf-rise" style={at(0)}>
            4
          </span>

          <svg
            aria-hidden
            className="nf-plate"
            viewBox="0 0 100 150"
            fill="none"
          >
            {/* Steam first in source order so it paints behind the rim. */}
            <path className="nf-steam nf-steam-1" d="M34 46C29 38 39 33 34 25" />
            <path className="nf-steam nf-steam-2" d="M50 46C45 36 55 29 50 17" />
            <path className="nf-steam nf-steam-3" d="M66 46C61 38 71 33 66 25" />

            <g style={at(1)}>
              <circle className="nf-ring nf-ring-outer" cx="50" cy="100" r="46" />
              <circle className="nf-ring nf-ring-inner" cx="50" cy="100" r="30" />
            </g>
          </svg>

          <span aria-hidden className="nf-digit nf-rise" style={at(2)}>
            4
          </span>
        </p>

        <h1
          className="nf-rise mt-8 text-2xl font-semibold tracking-tight text-balance"
          style={at(3)}
        >
          This page is off the menu.
        </h1>

        <p className="nf-rise mt-3 text-muted text-pretty" style={at(4)}>
          The link may be old, or the dish it pointed to is no longer served.
          Nothing is wrong on your end.
        </p>

        <div
          className="nf-rise mt-8 flex flex-wrap justify-center gap-2"
          style={at(5)}
        >
          <ButtonLink href="/">Home</ButtonLink>
          <ButtonLink href="/menu" variant="secondary">
            See the menu
          </ButtonLink>
          <ButtonLink href="/subscriptions" variant="secondary">
            Subscription plans
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
