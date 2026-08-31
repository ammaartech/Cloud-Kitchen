import { timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';

/**
 * Guards the scheduled-job endpoints.
 *
 * These run with the service role and can release deliveries into the kitchen,
 * so they are protected by a shared secret rather than a user session. The
 * comparison is constant-time: a timing oracle on this header would be enough
 * to recover the secret over many requests.
 */
export function isAuthorisedJob(request: Request): boolean {
  const expected = serverEnv().CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : header;

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
