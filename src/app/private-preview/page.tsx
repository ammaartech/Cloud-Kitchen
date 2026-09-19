import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { landingPathForRole } from '@/lib/auth/permissions';
import { hasPreviewAccess, siteLock } from '@/lib/auth/site-lock';
import { ButtonLink, Card } from '@/components/ui/primitives';
import { SignOutButton } from '@/components/auth/sign-out-button';

/**
 * These screens are per-user by definition -- a session decides not just what
 * they show but whether you may see them at all -- so there is no static shell
 * to prerender and no point pretending otherwise. `instant = false` says that
 * plainly: this segment is allowed to block.
 */
export const instant = false;

export const metadata = { title: 'Private preview', robots: { index: false, follow: false } };

/**
 * Where the site lock sends an account that is signed in but not on the list.
 *
 * A signed-out visitor never sees this -- the lock sends them to sign-in -- so
 * this is for someone who has an account and is owed a straight answer about
 * why it is not getting them in, and a way to switch to one that will.
 */
export default async function PrivatePreviewPage() {
  const lock = siteLock();
  if (!lock.locked) redirect('/');

  const session = await getSession();
  if (!session) redirect('/sign-in');

  // Only for the wording, and deliberately not a redirect. The lock decides in
  // `proxy.ts`, against the email in the verified token rather than this
  // profile row; if the two ever disagreed, a redirect from here would bounce
  // between this page and the lock forever.
  if (hasPreviewAccess(session.email, session, lock.allowedEmails)) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">You have preview access</h1>
          <p className="mt-2 text-sm text-muted">
            The site is in private development, and your account is allowed in.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href={landingPathForRole(session.role)}>Continue</ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4">
      <Card className="p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Infinity Kitchens is not open yet</h1>
        <p className="mt-2 text-sm text-muted">
          The site is in private development. While it is being built, only developer accounts and
          approved test accounts can use it
          {session.email ? (
            <>
              , and <span className="font-medium text-ink">{session.email}</span> is not one of them
            </>
          ) : null}
          .
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <SignOutButton label="Sign in with a different account" variant="primary" size="md" />
        </div>
      </Card>
    </div>
  );
}
