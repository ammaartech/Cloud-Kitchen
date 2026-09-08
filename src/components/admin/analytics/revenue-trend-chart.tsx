'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money } from '@/lib/format';

export interface TrendPoint {
  label: string;
  revenue: number;
  orders: number;
}

/**
 * Dual-axis line chart: revenue on the left, order count on the right. Both
 * lines share an x category so a spike in orders that didn't translate into
 * revenue (a rush of cheap items, say) is visible at a glance.
 */
export function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div
      role="img"
      aria-label={`Revenue and order count across ${data.length} periods`}
      className="h-72 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--ck-border)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--ck-text-subtle)"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--ck-border)' }}
          />
          <YAxis
            yAxisId="revenue"
            orientation="left"
            stroke="var(--ck-text-subtle)"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--ck-border)' }}
            tickFormatter={(value: number) => (value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`)}
          />
          <YAxis
            yAxisId="orders"
            orientation="right"
            stroke="var(--ck-text-subtle)"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--ck-border)' }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--ck-surface)',
              border: '1px solid var(--ck-border)',
              borderRadius: 'var(--ck-radius)',
              fontSize: '0.8125rem',
            }}
            labelStyle={{ color: 'var(--ck-text)', fontWeight: 500 }}
            formatter={(value, name) => {
              const n = Number(value ?? 0);
              return name === 'Revenue' ? [money(n), String(name)] : [n, String(name)];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.8125rem', color: 'var(--ck-text-muted)' }}
            iconType="circle"
          />
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="var(--ck-brand)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--ck-brand)' }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="orders"
            type="monotone"
            dataKey="orders"
            name="Orders"
            stroke="var(--ck-warning)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--ck-warning)' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
