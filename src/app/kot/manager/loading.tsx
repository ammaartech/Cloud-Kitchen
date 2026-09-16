import { Hourglass } from '@/components/ui/hourglass';

/**
 * Shown the instant the manager's board is navigated to, while the session
 * and the live tickets resolve. Without it the link from the admin shell sat
 * on the old page until the whole server render had finished.
 */
export default function ManagerLoading() {
  return (
    <div
      role="status"
      aria-label="Loading the KOT board"
      className="grid min-h-dvh place-items-center bg-bg px-4 text-ink"
    >
      <Hourglass className="h-16 text-muted" />
    </div>
  );
}
