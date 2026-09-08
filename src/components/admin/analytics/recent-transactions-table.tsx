import { Badge, EmptyState } from '@/components/ui/primitives';
import { dateTime, money, SOURCE_LABELS } from '@/lib/format';

export interface RecentTransaction {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  placedAt: string;
  source: string;
  method: string | null;
  total: number;
}

/**
 * Latest 10 transactions in the selected window, newest first. Method is
 * pulled from the associated payment; marketplace orders often lack a local
 * payment record and display "—".
 */
export function RecentTransactionsTable({ rows }: { rows: RecentTransaction[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState title="No transactions" description="No orders were placed in the selected range." />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-xs tracking-wide text-subtle uppercase">
          <tr>
            <th className="px-4 py-3 font-medium">Order</th>
            <th className="px-4 py-3 font-medium">Customer</th>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Channel</th>
            <th className="px-4 py-3 font-medium">Method</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.orderId} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-mono text-xs text-muted">#{row.orderNumber}</td>
              <td className="px-4 py-3 text-ink">{row.customerName ?? '—'}</td>
              <td className="px-4 py-3 text-muted">{dateTime(row.placedAt)}</td>
              <td className="px-4 py-3">
                <Badge
                  tone={row.source === 'SW' ? 'warning' : row.source === 'ZM' ? 'danger' : 'info'}
                >
                  {SOURCE_LABELS[row.source] ?? row.source}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted capitalize">{row.method ?? '—'}</td>
              <td className="px-4 py-3 text-right tabular">{money(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
