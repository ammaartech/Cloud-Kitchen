import { serverEnv } from '@/lib/env';

/**
 * The private development lock.
 *
 * While the site is being built, nobody outside the team should be able to use
 * it: not the storefront, not checkout, not the APIs behind them. The lock is
 * enforced in `proxy.ts`, which runs before every page and route, and this
 * module holds the rules it applies -- kept free of request handling so they
 * can be tested on their own.
 *
 * **Who gets in.** A signed-in, active account that is either a Developer Admin
 * or one of the addresses in SITE_LOCK_ALLOWED_EMAILS (the test accounts).
 * The role comes from `auth_profiles`, which a user cannot change for
 * themselves (`guard_profile_privilege_columns`). The email comes from the
 * verified access token, *not* the profile row: a user may edit their own
 * profile's email, so trusting it would let anyone type their way onto the
 * list.
 *
 * **What stays open.** Only what the lock itself needs, and the server-to-
 * server endpoints that carry their own authentication. See `isOpenWhileLocked`.
 */

export interface SiteLock {
  locked: boolean;
  allowedEmails: ReadonlySet<string>;
}

let cached: SiteLock | null = null;

export function siteLock(): SiteLock {
  if (cached) return cached;
  const env = serverEnv();
  cached = {
    locked: env.SITE_LOCKED === 'true',
    allowedEmails: parseEmailList(env.SITE_LOCK_ALLOWED_EMAILS),
  };
  return cached;
}

/** Comma- or whitespace-separated addresses, lower-cased. Junk is dropped. */
export function parseEmailList(raw: string | undefined): ReadonlySet<string> {
  const emails = new Set<string>();
  for (const entry of (raw ?? '').split(/[\s,;]+/)) {
    const email = entry.trim().toLowerCase();
    // An address has something on both sides of the @. `@domain` and `*@domain`
    // wildcards are refused rather than half-supported; see the note in
    // `env.ts`.
    if (/^[^@\s*]+@[^@\s*]+$/.test(email)) emails.add(email);
  }
  return emails;
}

export interface PreviewProfile {
  role: string;
  isActive: boolean;
}

export function hasPreviewAccess(
  tokenEmail: string | null | undefined,
  profile: PreviewProfile | null,
  allowedEmails: ReadonlySet<string>,
): boolean {
  if (!profile || !profile.isActive) return false;
  if (profile.role === 'developer_admin') return true;
  return tokenEmail ? allowedEmails.has(tokenEmail.toLowerCase()) : false;
}

/** Where a visitor without access is sent once they are signed in. */
export const PRIVATE_PREVIEW_PATH = '/private-preview';

/**
 * Paths that answer while the site is locked.
 *
 * - The sign-in page and the refusal page, or nobody could get in or be told
 *   why not.
 * - Sign-out, so a signed-in account without access can switch to one with it.
 * - The session probe the sign-in form calls straight after signing in.
 * - `/robots.txt`, so crawlers read a file rather than a redirect.
 * - Scheduled jobs and provider webhooks. None of them carries a browser
 *   session -- they are Vercel Cron and the payment and marketplace providers
 *   -- and each checks its own secret or signature, so the lock would only
 *   break them. A payment a tester makes still has to be confirmed.
 * - Next's own dev tooling (`/_next/…`, `/__nextjs…`). The build output and
 *   images are already outside the proxy matcher.
 */
export function isOpenWhileLocked(pathname: string): boolean {
  if (pathname === '/sign-in' || pathname.startsWith('/sign-in/')) return true;
  if (pathname === PRIVATE_PREVIEW_PATH) return true;
  if (pathname === '/robots.txt') return true;
  if (pathname === '/api/auth/sign-out') return true;
  if (pathname === '/api/account/session') return true;
  if (pathname.startsWith('/api/jobs/')) return true;
  if (/^\/api\/(payments|marketplace)\/[^/]+\/webhook$/.test(pathname)) return true;
  if (pathname.startsWith('/_next/') || pathname.startsWith('/__nextjs')) return true;
  return false;
}
