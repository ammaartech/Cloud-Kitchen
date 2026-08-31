import { NextResponse } from 'next/server';
import { isAuthorisedJob } from '@/lib/jobs/auth';
import { dispatchQueuedNotifications } from '@/lib/notifications';

/**
 * Drains the notification outbox (PRD 15).
 *
 * Deliberately separate from the flows that enqueue messages: a provider
 * outage delays notifications and nothing else. No order, payment or ticket
 * depends on this endpoint succeeding.
 */
export async function POST(request: Request) {
  if (!isAuthorisedJob(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const result = await dispatchQueuedNotifications();
  return NextResponse.json(result);
}

/**
 * Scheduled runners (Vercel Cron and most hosted schedulers) issue a GET, and
 * carry the same bearer secret, so the same handler answers both verbs. The
 * work itself is idempotent, which is what makes a GET acceptable here.
 */
export const GET = POST;
