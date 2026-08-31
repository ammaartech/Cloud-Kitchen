import { Card, Skeleton } from '@/components/ui/primitives';

/**
 * Shown while an admin page's data resolves.
 *
 * The shape mirrors what is coming -- a heading, then a stack of rows -- so the
 * page does not jump when the real content lands.
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8" role="status" aria-label="Loading">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-4 w-96" />

      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3].map((row) => (
          <Card key={row} className="p-4">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="mt-2 h-3 w-40" />
            <Skeleton className="mt-4 h-9 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
