import Image from 'next/image';
import Link from 'next/link';
import '@/components/site/ticket.css';
import '@/components/checkout/checkout.css';
import { CheckoutProgress, CheckoutStage } from '@/components/checkout/checkout-stage';
import { LockIcon } from '@/components/site/icons';

/**
 * The checkout shell: an enclosed header, and nothing else around the task.
 *
 * No storefront navigation, no offer strip, no footer. Every link out of a
 * checkout is a way to lose the purchase halfway through, and a customer who
 * wants to leave has the mark (home) and the "Edit plan" link in the summary.
 * What the header does carry is the two things that keep people going: how far
 * along they are, and that this is the secure part.
 *
 * Synchronous on purpose, like the storefront layout: it awaits nothing, so
 * the header is HTML before the page's session and pricing reads finish.
 */
export default function CheckoutLayout({ children }: LayoutProps<'/checkout'>) {
  return (
    <CheckoutStage>
      <header className="co-header">
        <div className="co-header-bar">
          <Link href="/" className="co-header-mark" aria-label="Infinity Kitchens home">
            <Image
              src="/brand/mark-green.png"
              alt=""
              width={933}
              height={416}
              sizes="63px"
              loading="eager"
              className="h-7 w-auto"
            />
            <span className="wordmark hidden sm:inline">INFINITY KITCHENS</span>
          </Link>

          <CheckoutProgress className="co-header-progress" />

          <p className="co-header-secure">
            <LockIcon />
            <span>Secure checkout</span>
          </p>
        </div>
      </header>

      <main className="co-main-region">{children}</main>
    </CheckoutStage>
  );
}
