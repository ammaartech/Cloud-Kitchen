import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { landingPathForRole } from '@/lib/auth/permissions';
import { listDemoAccounts } from '@/lib/auth/demo-accounts';
import { SignInPanel } from '@/components/auth/sign-in-panel';

export const metadata = { title: 'Sign in' };

// The demo panel reads live account rows, so this page must not be cached.
export const dynamic = 'force-dynamic';

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const session = await getSession();
  if (session) redirect(landingPathForRole(session.role));

  const params = await searchParams;
  const next = typeof params.next === 'string' ? params.next : null;

  // Returns null unless SHOW_DEMO_ACCOUNTS is set, in which case the panel is
  // never rendered and the accounts are never queried.
  const accounts = await listDemoAccounts();

  return <SignInPanel next={next} accounts={accounts} />;
}
