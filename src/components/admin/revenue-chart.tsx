import { money, dateOnly, SOURCE_LABELS } from '@/lib/format';

interface DailyRow {
  business_date: string;
  source: string;
  revenue: string;
}

/**
 * Daily revenue, stacked by channel.
 *
 * Inline SVG rather than a charting library: this is one chart with a fixed
 * shape, and shipping a plotting runtime to draw twenty rectangles would cost
 * more than it returns.
 *
 * Colour follows the PRD's source coding, and the legend carries the literal
 * prefix -- colour is never the only channel indicator (PRD 19).
 */

const SOURCE_ORDER = ['SX', 'SW', 'ZM'] as const;

const SOURCE_FILL: Record<string, string> = {
  SX: 'var(--ck-source-sx)',
  SW: 'var(--ck-source-sw)',
  ZM: 'var(--ck-source-zm)',
};

export function RevenueChart({ daily }: { daily: DailyRow[] }) {
  const byDate = new Map<string, Record<string, number>>();

  for (const row of daily) {
    const bucket = byDate.get(row.business_date) ?? {};
    bucket[row.source] = (bucket[row.source] ?? 0) + Number(row.revenue ?? 0);
    byDate.set(row.business_date, bucket);
  }

  const dates = [...byDate.keys()].sort();

  if (dates.length === 0) {
    return <p className="text-sm text-muted">No revenue recorded yet.</p>;
  }

  const totals = dates.map((date) => {
    const bucket = byDate.get(date) ?? {};
    return SOURCE_ORDER.reduce((sum, source) => sum + (bucket[source] ?? 0), 0);
  });

  const peak = Math.max(...totals, 1);
  const chartHeight = 180;
  const gap = 4;
  const barWidth = Math.max(6, Math.min(40, (720 - gap * dates.length) / dates.length));
  const width = dates.length * (barWidth + gap);

  return (
    <figure>
      <figcaption className="sr-only">
        Daily revenue by channel over the last {dates.length} business days
      </figcaption>

      <div className="overflow-x-auto">
        <svg
          width={width}
          height={chartHeight + 24}
          viewBox={`0 0 ${width} ${chartHeight + 24}`}
          role="img"
          aria-label={`Daily revenue by channel. Peak day ${money(peak)}.`}
          className="min-w-full"
        >
          {dates.map((date, index) => {
            const bucket = byDate.get(date) ?? {};
            let offset = 0;

            return (
              <g key={date} transform={`translate(${index * (barWidth + gap)}, 0)`}>
                {SOURCE_ORDER.map((source) => {
                  const value = bucket[source] ?? 0;
                  if (value <= 0) return null;

                  const height = (value / peak) * chartHeight;
                  const y = chartHeight - offset - height;
                  offset += height;

                  return (
                    <rect
                      key={source}
                      x={0}
                      y={y}
                      width={barWidth}
                      height={height}
                      fill={SOURCE_FILL[source]}
                      rx={1}
                    >
                      <title>{`${dateOnly(date)} · ${SOURCE_LABELS[source]} · ${money(value)}`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}

          <line
            x1={0}
            y1={chartHeight}
            x2={width}
            y2={chartHeight}
            stroke="var(--ck-border)"
            strokeWidth={1}
          />
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-4 text-xs">
          {SOURCE_ORDER.map((source) => (
            <li key={source} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: SOURCE_FILL[source] }}
                aria-hidden
              />
              <span className="font-mono font-medium">{source}</span>
              <span className="text-muted">{SOURCE_LABELS[source]}</span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-subtle">
          {dateOnly(dates[0])} – {dateOnly(dates[dates.length - 1])} · peak {money(peak)}
        </p>
      </div>
    </figure>
  );
}
