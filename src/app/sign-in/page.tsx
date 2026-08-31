import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { landingPathForRole } from '@/lib/auth/permissions';
import { SignInForm } from '@/components/auth/sign-in-form';
import { Card } from '@/components/ui/primitives';

export const metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const session = await getSession();
  if (session) redirect(landingPathForRole(session.role));

  const params = await searchParams;
  const next = typeof params.next === 'string' ? params.next : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold">
        <span
          className="grid h-8 w-8 place-items-center rounded-ck bg-brand text-sm font-bold text-white"
          aria-hidden
        >
          CK
        </span>
        Cloud Kitchen
      </Link>

      <Card className="p-6">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Staff and customers use the same sign-in. You will land on the right screen.
        </p>

        <div className="mt-6">
          <SignInForm next={next} />
        </div>
      </Card>

      <p className="mt-6 text-center text-xs text-subtle">
        Buying a plan? You do not need an account first — we create one during checkout.
      </p>
    </div>
  );
}
