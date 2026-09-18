import '@/components/account/account.css';
import { AccountNav } from '@/components/account/account-nav';

// Per-customer, behind a session. Never something a search result should point at.
export const metadata = { robots: { index: false, follow: false } };

/**
 * Customer account shell.
 *
 * It awaits nothing, and that is the whole of its performance story. It used
 * to resolve the session here, and a top-level await in a layout holds every
 * page beneath it -- so a press on a tab showed nothing at all until the
 * profile, and then the page's own reads, had crossed to the database and back.
 * Synchronous, the nav and each page's heading and skeleton are a static shell
 * the router prefetches, and a tab press paints on the next frame while the
 * customer's rows stream into it.
 *
 * The guard did not go anywhere. Every account page calls `requireSession()`
 * inside its own boundary before it renders a row, and `src/proxy.ts` sends a
 * request with no session cookie at all to sign-in before rendering starts.
 */
export default function AccountLayout({ children }: LayoutProps<'/account'>) {
  return (
    <>
      <div className="acct-nav-wrap mx-auto max-w-5xl px-4">
        <AccountNav />
      </div>
      {children}
    </>
  );
}
