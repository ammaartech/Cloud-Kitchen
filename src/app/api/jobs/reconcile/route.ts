import { NextResponse } from 'next/server';
import { isAuthorisedJob } from '@/lib/jobs/auth';
import { adminClient } from '@/lib/supabase/admin';
import { marketplaceAdapter } from '@/lib/marketplace';

/**
 * Two-way marketplace reconciliation (PRD 16).
 *
 * Asks each marketplace what it believes it sent us over a window, compares
 * that with what we hold, and records the differences. It never creates or
 * deletes an order to make the numbers agree -- a discrepancy is a finding for
 * a human, not something to paper over.
 *
 * Each provider is handled independently, so one failing does not stop the
 * other being reconciled.
 */
export async function POST(request: Request) {
  if (!isAuthorisedJob(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const results: Record<string, unknown> = {};

  for (const provider of ['swiggy', 'zomato'] as const) {
    try {
      const adapter = marketplaceAdapter(provider);
      const listed = await adapter.listOrderIds(from, to);

      if (!listed.ok) {
        results[provider] = { skipped: true, reason: listed.reason, state: listed.state };
        continue;
      }

      const { data, error } = await adminClient().rpc('reconcile_marketplace_orders', {
        p_provider: provider,
        p_window_start: from.toISOString(),
        p_window_end: to.toISOString(),
        p_external_ids: listed.data,
      });

      results[provider] = error ? { error: error.message } : { ...data, via: listed.via };
    } catch (error) {
      results[provider] = {
        error: error instanceof Error ? error.message : 'Reconciliation failed',
      };
    }
  }

  return NextResponse.json({ window: { from, to }, results });
}

/**
 * Scheduled runners (Vercel Cron and most hosted schedulers) issue a GET, and
 * carry the same bearer secret, so the same handler answers both verbs. The
 * work itself is idempotent, which is what makes a GET acceptable here.
 */
export const GET = POST;
