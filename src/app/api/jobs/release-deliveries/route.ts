import { NextResponse } from 'next/server';
import { isAuthorisedJob } from '@/lib/jobs/auth';
import { adminClient } from '@/lib/supabase/admin';

/**
 * Releases scheduled subscription deliveries into the active KOT (PRD 7, 9).
 *
 * Run this on a schedule -- every few minutes is plenty. The RPC decides what
 * is actually due from the configurable lead time, locks rows with SKIP LOCKED
 * and is idempotent, so overlapping runs are safe and a missed run simply
 * catches up on the next one.
 */
export async function POST(request: Request) {
  if (!isAuthorisedJob(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const { data, error } = await adminClient().rpc('release_due_deliveries');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * Scheduled runners (Vercel Cron and most hosted schedulers) issue a GET, and
 * carry the same bearer secret, so the same handler answers both verbs. The
 * work itself is idempotent, which is what makes a GET acceptable here.
 */
export const GET = POST;
