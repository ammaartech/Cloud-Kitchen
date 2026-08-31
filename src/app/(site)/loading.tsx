import { Skeleton } from '@/components/ui/primitives';

/** Storefront placeholder: a heading and a grid of meal cards. */
export default function SiteLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((card) => (
          <div key={card} className="overflow-hidden rounded-ck-lg border border-line">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-1 h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
