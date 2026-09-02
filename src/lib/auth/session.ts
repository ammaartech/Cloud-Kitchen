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
 */
export const getSession = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await serverClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('auth_profiles')
    .select('id, full_name, email, phone, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;

  // The grants and the customer row are independent: one is keyed by role and
  // the other by profile, and neither reads the other's result. Awaiting them
  // in sequence only meant the second round-trip waited out the first for no
  // reason -- and this runs in the site layout, so every signed-in page view
  // paid for it before anything below the header could start rendering.
  //
  // The profile lookup above genuinely does have to come first: it is what
  // supplies `profile.role` to the grants query, and what decides whether
  // there is any point issuing either.
  const [{ data: grants }, { data: customer }] = await Promise.all([
    supabase.from('role_permissions').select('permission_code').eq('role', profile.role),
    // Customers have no rows in role_permissions; their access is ownership-based.
    supabase.from('customers').select('id').eq('profile_id', user.id).maybeSingle(),
  ]);

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role as AppRole,
    isActive: profile.is_active,
    permissions: new Set((grants ?? []).map((g) => g.permission_code as Permission)),
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
