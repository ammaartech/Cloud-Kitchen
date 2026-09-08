'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface HourBucket {
  /** Hour of day, 0-23. */
  hour: number;
  /** Display label, e.g. "01:00". */
  label: string;
  count: number;
}

/**
 * Order count by hour-of-day (0-23) in the business timezone. 24 fixed slots
 * so an empty hour reads as "we had a quiet 3am", not as "3am is missing".
 */
export function HourBars({ data }: { data: HourBucket[] }) {
  return (
    <div
      role="img"
      aria-label="Order count by hour of day"
      className="h-64 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--ck-border)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--ck-text-subtle)"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--ck-border)' }}
            interval={2}
          />
          <YAxis
            stroke="var(--ck-text-subtle)"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--ck-border)' }}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--ck-brand-soft)' }}
            contentStyle={{
              background: 'var(--ck-surface)',
              border: '1px solid var(--ck-border)',
              borderRadius: 'var(--ck-radius)',
              fontSize: '0.8125rem',
            }}
            formatter={(value) => [Number(value ?? 0), 'Orders']}
          />
          <Bar dataKey="count" fill="var(--ck-brand)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
