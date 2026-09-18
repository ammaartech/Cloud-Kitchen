import { cache } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
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
/**
 * The signed-in user's id, verified and nothing more.
 *
 * `getClaims()` checks the token's signature against the cached signing key,
 * so this costs no network hop for a valid session. That is what makes it
 * useful on its own: a page can start the reads it scopes by user the moment
 * the request arrives, in parallel with `getSession()`'s profile round trip,
 * instead of queued behind it. It is not a guard -- a deactivated profile still
 * has a valid token -- so a page that uses it still awaits `requireSession()`
 * before it renders anything.
 */
export const getUserId = cache(async (): Promise<string | null> => {
  // See `getSession` below: the expiry check reads the clock.
  await connection();

  const supabase = await serverClient();
  const { data: verified } = await supabase.auth.getClaims();
  return verified?.claims.sub ?? null;
});

export const getSession = cache(async (): Promise<SessionProfile | null> => {
  /*
   * Nothing past this line may run while a shell is being prerendered.
   *
   * Verifying the access token locally means comparing its expiry against the
   * clock, and `Date.now()` is a different answer on every render -- so Cache
   * Components refuses to bake it into a static shell rather than shipping one
   * built against a moment that has passed. The prefetch pass hits this too,
   * which is what made `/account` throw on navigation and, after a sign-out,
   * on the refresh that follows it.
   *
   * `connection()` holds the helper until a real request is in hand. That is
   * not a concession: "who is asking" has no answer before there is a request,
   * and every caller here is already request-bound by the cookie read below.
   * It belongs in the helper rather than in each of the thirty-odd callers,
   * and it keeps the guards (`requireSession`, `requirePermission`) covered by
   * construction.
   */
  await connection();

  const [supabase, userId] = await Promise.all([serverClient(), getUserId()]);
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
