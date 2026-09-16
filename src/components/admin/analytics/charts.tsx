'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { Donut as DonutImpl } from './donut';
import type { HourBars as HourBarsImpl } from './hour-bars';
import type { RevenueTrendChart as RevenueTrendChartImpl } from './revenue-trend-chart';

/**
 * The analytics charts, loaded only once the page is on screen.
 *
 * Recharts is by a wide margin the heaviest thing this application ships: it
 * builds to a 428 KB chunk (about 110 KB gzipped), which is more than half
 * again the entire React and Next runtime that every other page gets by. Three
 * components import it -- the trend line, the donut and the hour bars -- and all
 * three are used on exactly one route, `/admin/analytics`. Measured against the
 * built output, no other page in the application pulls that chunk.
 *
 * So the cost is already contained to one screen; what it was not is *deferred*.
 * Statically imported, the chunk sat in that route's initial payload and the
 * Owner waited for a charting library to parse before the page could paint --
 * including the figures at the top of it, which are plain numbers in a table
 * and owe recharts nothing.
 *
 * ## Why this file exists at all
 *
 * `next/dynamic` with `ssr: false` is not allowed in a Server Component, and a
 * Server Component that dynamically imports a Client Component does not get
 * automatic code splitting -- both are stated in Next's lazy-loading guide.
 * `admin/analytics/page.tsx` is a Server Component. This module is the Client
 * Component boundary that makes the split legal and effective: it does the
 * dynamic imports, and the page imports these names instead of the real ones.
 *
 * ## Why `ssr: false` is safe here and would not be elsewhere
 *
 * It is the right call on this surface and the wrong one on the storefront, and
 * the difference is worth writing down because the instinct is to apply it
 * everywhere. `/admin/analytics` is behind authentication, is never indexed,
 * and is a tool rather than a document -- nobody reads it with JavaScript off,
 * and there is no no-JS contract to honour. The storefront's equivalents have
 * the opposite shape: `CycleBoard` deliberately renders the finished month so a
 * visitor without JavaScript still sees the outcome, and `HangingPhotos`
 * renders real catalogue photographs into the HTML. Deferring either would
 * delete content from the page rather than delay a library, so neither is
 * touched.
 *
 * ## The placeholders are sized
 *
 * Each fallback reserves exactly the box its chart will occupy -- `h-72` for the
 * trend, `h-64` for the hours, `h-56` for a donut. A lazy component that
 * collapses to nothing and then expands is a layout shift, which is a worse
 * problem than the one this file is solving.
 */

/** A reserved box, so nothing below a chart moves when it arrives. */
function ChartFrame({ className }: { className: string }) {
  return <div aria-hidden className={`animate-pulse rounded-ck bg-sunken ${className}`} />;
}

export const RevenueTrendChart = dynamic<ComponentProps<typeof RevenueTrendChartImpl>>(
  () => import('./revenue-trend-chart').then((mod) => mod.RevenueTrendChart),
  { ssr: false, loading: () => <ChartFrame className="h-72 w-full" /> },
);

export const HourBars = dynamic<ComponentProps<typeof HourBarsImpl>>(
  () => import('./hour-bars').then((mod) => mod.HourBars),
  { ssr: false, loading: () => <ChartFrame className="h-64 w-full" /> },
);

/* The donut is a chart *and* a legend -- see `donut.tsx`, where the list of
   names, values and shares is what a colour-blind reader gets instead of the
   colours. The placeholder mirrors that two-part shape rather than reserving a
   bare square, so the row does not reflow when the legend lands beside it. */
export const Donut = dynamic<ComponentProps<typeof DonutImpl>>(
  () => import('./donut').then((mod) => mod.Donut),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ChartFrame className="h-56 w-full sm:w-56 sm:shrink-0" />
        <ChartFrame className="h-32 w-full flex-1" />
      </div>
    ),
  },
);
