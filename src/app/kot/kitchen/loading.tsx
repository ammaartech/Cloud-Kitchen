import { Hourglass } from '@/components/ui/hourglass';

/**
 * Shown the instant the kitchen display is navigated to, while the session
 * and the board resolve. On the ops surface from the first frame, so the
 * screen does not flash light before it turns dark.
 */
export default function KitchenLoading() {
  return (
    <div
      data-surface="ops"
      role="status"
      aria-label="Loading the kitchen display"
      className="grid min-h-dvh place-items-center bg-bg px-4 text-ink"
    >
      <Hourglass className="h-16 text-muted" />
    </div>
  );
}
