import '@/components/auth/auth.css';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { landingPathForRole } from '@/lib/auth/permissions';
import { safeNextPath } from '@/lib/auth/redirect';
import { listDemoAccounts } from '@/lib/auth/demo-accounts';
import { SignInPanel } from '@/components/auth/sign-in-panel';

/**
 * These screens are per-user by definition -- a session decides not just what
 * they show but whether you may see them at all -- so there is no static shell
 * to prerender and no point pretending otherwise. `instant = false` says that
 * plainly: this segment is allowed to block.
 *
 * It is a statement about *this* route, not a global escape hatch. The public
 * storefront next door is held to the opposite standard.
 */
export const instant = false;

export const metadata = { title: 'Sign in' };

// The demo panel reads live account rows, so this page must not be cached.

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const params = await searchParams;
  // Only a path on this site is honoured; see `safeNextPath` for why.
  const next = safeNextPath(params.next);

  // Already signed in: go where the link was headed, not only where the role
  // lands, so a stale "Sign in" tab still returns the visitor to their page.
  const session = await getSession();
  if (session) redirect((next ?? landingPathForRole(session.role)) as never);

  // Returns null unless SHOW_DEMO_ACCOUNTS is set, in which case the panel is
  // never rendered and the accounts are never queried.
  const accounts = await listDemoAccounts();

  return <SignInPanel next={next} accounts={accounts} />;
}
