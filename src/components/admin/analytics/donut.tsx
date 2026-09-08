'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { money } from '@/lib/format';

export interface DonutSlice {
  name: string;
  value: number;
}

const DEFAULT_PALETTE = [
  'var(--ck-brand)',
  'var(--ck-warning)',
  'var(--ck-accent)',
  'var(--ck-info)',
  'var(--ck-danger)',
  'var(--ck-brand-hover)',
];

/**
 * Reusable donut. Used for Payment Methods, Customer Retention, and Category
 * Trends. Renders as chart + legend so a colour-blind reader still gets the
 * name, value and share of every slice.
 *
 * `format` is a serialisable discriminator rather than a function -- server
 * components can't hand a function to a client component across the RSC
 * boundary. Formatting decisions live here instead.
 */
export type DonutFormat = 'money' | 'count';

function formatValue(value: number, format: DonutFormat): string {
  return format === 'money' ? money(value) : String(Math.round(value));
}

export function Donut({
  data,
  palette = DEFAULT_PALETTE,
  ariaLabel,
  format = 'count',
}: {
  data: DonutSlice[];
  palette?: string[];
  ariaLabel: string;
  format?: DonutFormat;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div role="img" aria-label={ariaLabel} className="h-56 w-full sm:w-56 sm:shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="60%"
              outerRadius="90%"
              stroke="var(--ck-surface)"
              strokeWidth={2}
              paddingAngle={data.length > 1 ? 2 : 0}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={palette[index % palette.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--ck-surface)',
                border: '1px solid var(--ck-border)',
                borderRadius: 'var(--ck-radius)',
                fontSize: '0.8125rem',
              }}
              formatter={(value, name) => [formatValue(Number(value ?? 0), format), String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex-1 space-y-1.5 text-sm">
        {data.map((slice, index) => {
          const pct = total ? (slice.value / total) * 100 : 0;
          return (
            <li key={slice.name} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: palette[index % palette.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-ink">{slice.name}</span>
              <span className="tabular text-muted">{formatValue(slice.value, format)}</span>
              <span className="w-10 text-right text-xs tabular text-subtle">
                {pct.toFixed(pct < 10 ? 1 : 0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
