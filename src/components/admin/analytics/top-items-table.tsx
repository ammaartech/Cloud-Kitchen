import { EmptyState } from '@/components/ui/primitives';
import { money } from '@/lib/format';

export interface TopItem {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
}

/**
 * Top selling items table. Server-rendered; no interaction on the rows.
 * Sorted by quantity descending, top 10 by convention (bounded upstream).
 */
export function TopItemsTable({ items }: { items: TopItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState title="No items sold" description="Nothing was ordered in the selected range." />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-xs tracking-wide text-subtle uppercase">
          <tr>
            <th className="px-4 py-3 font-medium">Product</th>
            <th className="px-4 py-3 text-right font-medium">Qty</th>
            <th className="px-4 py-3 text-right font-medium">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.productId} className="border-b border-line last:border-0">
              <td className="px-4 py-3 text-ink">{item.productName}</td>
              <td className="px-4 py-3 text-right tabular">{item.quantity}</td>
              <td className="px-4 py-3 text-right tabular">{money(item.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
