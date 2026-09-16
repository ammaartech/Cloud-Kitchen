'use client';

import type { TicketItem } from '@/lib/kot/items';
import { Skeleton } from '@/components/ui/primitives';

/**
 * The lines the kitchen actually cooks.
 *
 * Purely presentational. The rows come from the shared items store (see
 * `lib/kot/items-store.ts`), which reads them in bulk for the whole board;
 * this component never fetches. `undefined` means the read is still on its
 * way, and the card holds the lines' shape until it lands.
 */
export function TicketItems({
  items,
  size = 'sm',
}: {
  items: TicketItem[] | undefined;
  size?: 'sm' | 'lg';
}) {
  if (items === undefined) {
    return (
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="mt-3 text-xs text-subtle">No items recorded on this ticket.</p>;
  }

  return (
    <ul className={size === 'lg' ? 'mt-4 space-y-3' : 'mt-3 space-y-1.5'}>
      {items.map((item) => (
        <li key={item.id} className="flex gap-2">
          <span
            className={
              size === 'lg'
                ? 'min-w-8 font-mono text-xl font-bold tabular text-accent'
                : 'min-w-6 font-mono text-sm font-semibold tabular text-muted'
            }
          >
            {item.quantity}×
          </span>

          <div className="min-w-0">
            <p className={size === 'lg' ? 'text-xl leading-tight font-medium' : 'text-sm'}>
              {item.name}
            </p>

            {item.variants?.length ? (
              <p className={size === 'lg' ? 'text-base text-muted' : 'text-xs text-subtle'}>
                {item.variants.map((variant) => variant.name).filter(Boolean).join(' · ')}
              </p>
            ) : null}

            {item.add_ons?.length ? (
              <p className={size === 'lg' ? 'text-base text-muted' : 'text-xs text-subtle'}>
                + {item.add_ons.map((addOn) => addOn.name).filter(Boolean).join(', ')}
              </p>
            ) : null}

            {item.special_instructions ? (
              <p
                className={
                  size === 'lg'
                    ? 'mt-1 rounded bg-warning-soft px-2 py-1 text-base font-medium text-warning'
                    : 'text-xs text-warning'
                }
              >
                {item.special_instructions}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
