import { Badge } from '@/components/ui/primitives';

/**
 * Live KOT queue depth. Live-ish rather than live: it reflects whatever the
 * page render saw. Refreshing the page (or switching filters) refreshes it.
 */
export function QueuePill({ count }: { count: number }) {
  return <Badge tone={count > 0 ? 'warning' : 'success'}>Queue: {count}</Badge>;
}
