import { getSession } from '@/lib/auth/session';
import { landingPathForRole } from '@/lib/auth/permissions';
import { ButtonLink, Card } from '@/components/ui/primitives';
import { SignOutButton } from '@/components/auth/sign-out-button';

export const metadata = { title: 'Not permitted' };

/**
 * Shown when a signed-in user reaches a screen their role does not cover.
 *
 * It says what happened and where they can go, rather than pretending the page
 * does not exist -- staff following an internal link deserve a straight answer.
 */
export default async function ForbiddenPage() {
  const session = await getSession();

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4">
      <Card className="p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">You do not have access to that</h1>
        <p className="mt-2 text-sm text-muted">
          {session
            ? `Your account is set up as ${session.role.replace('_', ' ')}, which does not include this screen. If that looks wrong, the Owner can adjust your permissions.`
            : 'Sign in to continue.'}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {session ? (
            <ButtonLink href={landingPathForRole(session.role)}>Back to your dashboard</ButtonLink>
          ) : (
            <ButtonLink href="/sign-in">Sign in</ButtonLink>
          )}
          <ButtonLink href="/" variant="secondary">Home</ButtonLink>
          {/* Without this, someone signed in as the wrong role has no way out
              of this page except clearing cookies by hand. */}
          {session ? <SignOutButton label="Sign in as someone else" variant="secondary" size="md" /> : null}
        </div>
      </Card>
    </div>
  );
}
