import { Skeleton } from '@/components/ui/primitives';

/**
 * Checkout's placeholder, shaped like checkout.
 *
 * The storefront shows a single hourglass because its pages are prerendered
 * and arrive in milliseconds. Checkout is the opposite case: it waits on the
 * session, the customer's addresses and a server-side quote, so there is a
 * real wait -- and the shell header is already on screen above it. Blocks in
 * the shape of the summary bar and the three sections mean the page that lands
 * fills in where the eye already is instead of jumping into place.
 */
export default function CheckoutLoading() {
  return (
    <div className="co-page" role="status" aria-label="Loading checkout">
      <div className="co-layout">
        <div className="co-summary co-summary-placeholder" aria-hidden>
          <Skeleton className="h-14 rounded-none lg:h-96" />
        </div>
        <div className="co-main">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-6 h-20" />
          <Skeleton className="mt-3 h-64" />
          <Skeleton className="mt-3 h-20" />
        </div>
      </div>
    </div>
  );
}
