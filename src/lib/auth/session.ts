import { cache } from 'react';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import type { AppRole, Permission } from './permissions';

export interface SessionProfile {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: AppRole;
  isActive: boolean;
  permissions: Set<Permission>;
  customerId: string | null;
}

/**
 * Loads the signed-in principal and everything they are allowed to do.
 *
 * Cached per request, so a page that guards several sections does not re-query
 * the profile for each one.
 *
 * The permission set here drives what the UI *renders*. It is never the only
 * check: every mutation is re-authorized server-side by RLS or by the
 * transition trigger, because a hidden button is not a security boundary.
 *
 * **Cost.** This used to be four network hops in a row before any page could
 * start its own reads: a `getUser()` round-trip to the auth server, then the
 * profile, then the grants and the customer row. With the hosted database in
 * another region every hop is a hundred milliseconds or more, and every admin
 * screen paid all four before it fetched a single row of its own.
 *
 * It is now one. `getClaims()` verifies the access token's signature locally
 * against the project's public signing key (fetched once and cached for ten
 * minutes per process); the project issues ES256 tokens, so no request leaves
 * the box for a valid session. If a project were ever switched back to the
 * legacy shared secret, `getClaims()` falls back to `getUser()` on its own, so
 * this is never less safe than the call it replaced. The three table reads
 * that follow are independent of each other and go out together.
 *
 * The grants read fetches every role's permissions rather than one role's.
 * That table is a few dozen rows and never grows with the business, and
 * reading it whole is what lets the query start before the profile has told us
 * which role to ask for. The rows are filtered to the caller's role in memory.
 * Customers hold no rows there at all -- RLS returns nothing to a non-staff
 * caller -- which is the same empty set they had before.
 */
export const getSession = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await serverClient();

  const { data: verified } = await supabase.auth.getClaims();
  const userId = verified?.claims.sub;
  if (!userId) return null;

  const [{ data: profile }, { data: grants }, { data: customer }] = await Promise.all([
    supabase
      .from('auth_profiles')
      .select('id, full_name, email, phone, role, is_active')
      .eq('id', userId)
      .maybeSingle(),
    supabase.from('role_permissions').select('role, permission_code'),
    // Customers have no rows in role_permissions; their access is ownership-based.
    supabase.from('customers').select('id').eq('profile_id', userId).maybeSingle(),
  ]);

  if (!profile || !profile.is_active) return null;

  const permissions = new Set<Permission>();
  for (const grant of grants ?? []) {
    if (grant.role === profile.role) permissions.add(grant.permission_code as Permission);
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role as AppRole,
    isActive: profile.is_active,
    permissions,
    customerId: customer?.id ?? null,
  };
});

export async function requireSession(): Promise<SessionProfile> {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  return session;
}

/**
 * Guards a page on a permission. Redirects rather than throwing, so a staff
 * member who follows a stale link lands somewhere sensible.
 *
 * Also the guard for every admin Server Action. An action is a public POST
 * endpoint that anyone holding its identifier can call, and RLS refusing the
 * write shows up as zero rows affected rather than an error -- which the
 * action would then report as a success. Re-checking the permission at the
 * top of the action is what turns that into "You do not have access to that".
 */
export async function requirePermission(permission: Permission): Promise<SessionProfile> {
  const session = await requireSession();

  if (!session.permissions.has(permission)) {
    redirect('/forbidden');
  }

  return session;
}

export async function requireAnyPermission(
  permissions: Permission[],
): Promise<SessionProfile> {
  const session = await requireSession();

  if (!permissions.some((p) => session.permissions.has(p))) {
    redirect('/forbidden');
  }

  return session;
}

export function can(session: SessionProfile | null, permission: Permission): boolean {
  return session?.permissions.has(permission) ?? false;
}
