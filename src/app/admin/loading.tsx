import { Hourglass } from '@/components/ui/hourglass';

/**
 * Shown while an admin page's data resolves.
 *
 * Centred on the region it is waiting for, matching the storefront's loader --
 * see the note there for why the skeletons that used to be here went.
 */
export default function AdminLoading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="grid min-h-[70svh] place-items-center px-4"
    >
      <Hourglass className="h-16 text-muted" />
    </div>
  );
}
