'use client';

import { useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase/client';
import { Skeleton } from '@/components/ui/primitives';

interface Item {
  id: string;
  name: string;
  quantity: number;
  variants: Array<{ group?: string; name?: string }>;
  add_ons: Array<{ name?: string }>;
  special_instructions: string | null;
}

/**
 * The lines the kitchen actually cooks.
 *
 * Read from `v_kot_ticket_items`, which masks unit price and line total unless
 * the reader holds `orders.view_financial` -- so a Kitchen session receives no
 * money at all, rather than receiving it and being trusted not to render it
 * (PRD 5.4, PRD 17).
 *
 * Fetched per ticket rather than joined into the board query: the board is the
 * thing that must stay fast under a realtime firehose, and most tickets are
 * never expanded.
 */
export function TicketItems({
  ticketId,
  orderId,
  size = 'sm',
}: {
  ticketId: string;
  orderId: string;
  size?: 'sm' | 'lg';
}) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await browserClient()
        .from('v_kot_ticket_items')
        .select('id, name, quantity, variants, add_ons, special_instructions')
        .eq('order_id', orderId);

      if (active) setItems((data ?? []) as Item[]);
    }

    void load();

    return () => {
      active = false;
    };
  }, [orderId, ticketId]);

  if (items === null) {
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
