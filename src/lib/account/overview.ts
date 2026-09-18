import type { serverClient } from '@/lib/supabase/server';
import { businessDate, addDays } from '@/lib/checkout/schedule';
import { PLAN_TYPE_LABELS, SUBSCRIPTION_STATUS_LABELS, weekdayList } from '@/lib/format';
import {
  buildSchedule,
  cycleProgress,
  lockInstant,
  type PauseRange,
  type ScheduleDay,
  type UpcomingDelivery,
} from './schedule';

type Db = Awaited<ReturnType<typeof serverClient>>;

/** How many future deliveries the overview reads. Two weeks of two windows, with room. */
const UPCOMING_LIMIT = 30;
const HISTORY_LIMIT = 8;
const INVOICE_LIMIT = 8;

/**
 * The fallbacks for the four rules the page reads, used only if a setting is
 * missing or unreadable. They match the seeded values, so a gap in the table
 * shows the customer the kitchen's real defaults rather than zeros.
 */
const DEFAULT_RULES = {
  releaseLeadMinutes: 120,
  maxPausesPerPeriod: 2,
  maxPauseDays: 5,
  skipReturnsCredit: true,
};

export type LivePlanStatus = 'active' | 'paused' | 'past_due';

export type PlanView = {
  id: string;
  number: string;
  name: string;
  typeLabel: string;
  status: LivePlanStatus;
  statusLabel: string;
  /** From the ledger. Null if the balance could not be read, never a guess. */
  credits: number | null;
  /** What a full cycle grants, for the meter. Null where the plan has no count. */
  creditsPerCycle: number | null;
  cycleStart: string | null;
  cycleEnd: string | null;
  progress: { ratio: number; daysLeft: number; totalDays: number } | null;
  window: { label: string; startsAt: string; endsAt: string } | null;
  days: string;
  deliveringTo: string | null;
  pricePaid: string;
  renewsOn: string | null;
  pausedUntil: string | null;
  pauses: { used: number; allowed: number; maxDays: number };
  skipReturnsCredit: boolean;
  /** Past due only: the last day deliveries continue before the plan lapses. */
  graceUntil: string | null;
};

export type HistoryEntry = {
  id: string;
  date: string;
  windowLabel: string;
  status: 'fulfilled' | 'skipped' | 'cancelled';
  items: Array<{ name: string; quantity: number }>;
};

export type InvoiceEntry = { id: string; number: string; issuedAt: string; total: string };

export type AccountOverview = {
  today: string;
  /** The render's clock, so the islands compare deadlines against the same moment. */
  now: string;
  name: string;
  hasCustomer: boolean;
  plan: PlanView | null;
  /** The most recent plan that ended, so a lapsed customer is told what happened to it. */
  ended: { name: string; statusLabel: string; on: string | null } | null;
  awaitingPayment: boolean;
  upcoming: UpcomingDelivery[];
  schedule: ScheduleDay[];
  pauses: PauseRange[];
  history: HistoryEntry[];
  invoices: InvoiceEntry[];
  addresses: { total: number; defaultLabel: string | null };
  maxPauseDays: number;
  /** How long before its window a delivery locks, for describing the skip rule. */
  leadMinutes: number;
  /** Whether a skip returns its credit, from settings -- so the no-plan page never promises it wrongly. */
  skipReturnsCredit: boolean;
};

type SubscriptionRow = {
  id: string;
  subscription_number: string;
  status: string;
  price_paid: string;
  current_period_start: string | null;
  current_period_end: string | null;
  next_renewal_at: string | null;
  payment_flow: string;
  delivery_days: number[];
  grace_period_days: number;
  past_due_since: string | null;
  paused_until: string | null;
  pauses_used_this_period: number;
  cancelled_at: string | null;
  updated_at: string;
  plan_snapshot: { name?: string } | null;
  subscription_plans: {
    name: string;
    plan_type: string;
    credits_per_cycle: number | null;
    meals_per_cycle: number | null;
    max_pauses_per_period: number | null;
    max_pause_days: number | null;
    skip_returns_credit: boolean | null;
  } | null;
  delivery_windows: { label: string; starts_at: string; ends_at: string } | null;
  customer_addresses: { label: string } | null;
};

type DeliveryRow = {
  id: string;
  scheduled_date: string;
  status: string;
  credits_cost: number;
  window_label: string;
  window_starts_at: string;
  kitchen_status: string | null;
  ticket_code: string | null;
  prep_eta_minutes: number | null;
  items: Array<{ name: string; quantity: number }> | null;
};

const LIVE: readonly string[] = ['active', 'paused', 'past_due'];

function settingNumber(rows: Array<{ key: string; value: unknown }>, key: string, fallback: number) {
  const value = rows.find((row) => row.key === key)?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function settingBoolean(rows: Array<{ key: string; value: unknown }>, key: string, fallback: boolean) {
  const value = rows.find((row) => row.key === key)?.value;
  return typeof value === 'boolean' ? value : fallback;
}

type SessionLike = { customerId: string | null; fullName: string | null };

/**
 * Everything the account overview shows, read in one round of parallel queries
 * -- and that round runs alongside the session lookup, not after it.
 *
 * The database is a long way from the server, so every sequential hop is a few
 * hundred milliseconds the customer watches. This used to be three in a row:
 * the session's profile, then the subscriptions, then the credit balance for
 * whichever of them was live. Now it is one. `session` may arrive as a promise
 * so the reads can start before it resolves, and the balance is summed from the
 * ledger rows of the customer's live plans (RLS lets a customer read their own)
 * instead of an RPC that could only be called once the live plan's id was known.
 *
 * `userId` is the verified token subject, and the unbounded reads name it
 * through `customers.profile_id`. RLS already confines a customer to their own
 * rows; the explicit filter is for staff, whose permissions would otherwise
 * let a visit to their own account page read every subscription in the
 * business before being told they have no customer record.
 */
export async function loadAccountOverview(
  supabase: Db,
  session: SessionLike | Promise<SessionLike>,
  userId: string,
  now: Date = new Date(),
): Promise<AccountOverview> {
  const today = businessDate(now);

  const reads = Promise.all([
    session,
    supabase
      .from('subscriptions')
      .select(
        `id, subscription_number, status, price_paid, current_period_start, current_period_end,
         next_renewal_at, payment_flow, delivery_days, grace_period_days, past_due_since,
         paused_until, pauses_used_this_period, cancelled_at, updated_at, plan_snapshot,
         subscription_plans ( name, plan_type, credits_per_cycle, meals_per_cycle,
                              max_pauses_per_period, max_pause_days, skip_returns_credit ),
         delivery_windows ( label, starts_at, ends_at ),
         customer_addresses ( label ),
         customers!inner ( profile_id )`,
      )
      .eq('customers.profile_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('subscription_credit_ledger')
      .select('subscription_id, credits, subscriptions!inner ( status, customers!inner ( profile_id ) )')
      .in('subscriptions.status', LIVE as string[])
      .eq('subscriptions.customers.profile_id', userId),
    supabase
      .from('v_customer_deliveries')
      .select(
        'id, scheduled_date, status, credits_cost, window_label, window_starts_at, kitchen_status, ticket_code, prep_eta_minutes, items',
      )
      .in('status', ['scheduled', 'released', 'skipped'])
      // A released delivery stays upcoming until the kitchen closes it, even
      // if it was yesterday's late window; a skipped one only counts ahead.
      .or(`scheduled_date.gte.${today},status.eq.released`)
      .order('scheduled_date', { ascending: true })
      .order('window_starts_at', { ascending: true })
      .limit(UPCOMING_LIMIT),
    supabase
      .from('v_customer_deliveries')
      .select('id, scheduled_date, status, window_label, items')
      .in('status', ['fulfilled', 'skipped', 'cancelled'])
      .or(`status.eq.fulfilled,scheduled_date.lt.${today}`)
      .order('scheduled_date', { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from('invoices')
      .select('id, invoice_number, issued_at, total')
      .order('issued_at', { ascending: false })
      .limit(INVOICE_LIMIT),
    supabase
      .from('customer_addresses')
      .select('label, is_default, customers!inner ( profile_id )')
      .eq('is_active', true)
      .eq('customers.profile_id', userId),
    supabase
      .from('subscription_pauses')
      .select('starts_on, ends_on, subscriptions!inner ( customers!inner ( profile_id ) )')
      .is('cancelled_at', null)
      .gte('ends_on', today)
      .eq('subscriptions.customers.profile_id', userId),
    supabase
      .from('business_settings')
      .select('key, value')
      .in('key', [
        'kot.release_lead_time_minutes',
        'subscription.max_pauses_per_period',
        'subscription.max_pause_days',
        'subscription.skip_returns_credit',
      ]),
  ]);

  const [
    who,
    subscriptionsResult,
    ledgerResult,
    upcomingResult,
    historyResult,
    invoicesResult,
    addressesResult,
    pausesResult,
    settingsResult,
  ] = await reads;

  const name = who.fullName?.trim().split(/\s+/)[0] || 'there';

  if (!who.customerId) {
    return {
      today,
      now: now.toISOString(),
      name,
      hasCustomer: false,
      plan: null,
      ended: null,
      awaitingPayment: false,
      upcoming: [],
      schedule: [],
      pauses: [],
      history: [],
      invoices: [],
      addresses: { total: 0, defaultLabel: null },
      maxPauseDays: DEFAULT_RULES.maxPauseDays,
      leadMinutes: DEFAULT_RULES.releaseLeadMinutes,
      skipReturnsCredit: DEFAULT_RULES.skipReturnsCredit,
    };
  }

  const subscriptions = (subscriptionsResult.data ?? []) as unknown as SubscriptionRow[];

  const settings = (settingsResult.data ?? []) as Array<{ key: string; value: unknown }>;
  const leadMinutes = settingNumber(settings, 'kot.release_lead_time_minutes', DEFAULT_RULES.releaseLeadMinutes);

  const live = subscriptions.find((row) => LIVE.includes(row.status)) ?? null;
  const planRow = live?.subscription_plans ?? null;

  // The same sum `subscription_credit_balance` takes, over the rows RLS already
  // lets this customer read. A failed read is an unknown balance, never zero.
  const credits =
    live && !ledgerResult.error
      ? ((ledgerResult.data ?? []) as Array<{ subscription_id: string; credits: number }>)
          .filter((row) => row.subscription_id === live.id)
          .reduce((sum, row) => sum + row.credits, 0)
      : null;

  const upcoming: UpcomingDelivery[] = ((upcomingResult.data ?? []) as DeliveryRow[]).map((row) => ({
    id: row.id,
    date: row.scheduled_date,
    status: row.status as UpcomingDelivery['status'],
    windowLabel: row.window_label,
    windowStartsAt: row.window_starts_at,
    creditsCost: row.credits_cost,
    items: row.items ?? [],
    kitchenStatus: row.kitchen_status,
    ticketCode: row.ticket_code,
    prepEtaMinutes: row.prep_eta_minutes,
    locksAt:
      row.status === 'scheduled'
        ? lockInstant(row.scheduled_date, row.window_starts_at, leadMinutes)
        : null,
  }));

  const pauses: PauseRange[] = ((pausesResult.data ?? []) as Array<{ starts_on: string; ends_on: string }>).map(
    (row) => ({ startsOn: row.starts_on, endsOn: row.ends_on }),
  );

  const maxPauseDays =
    planRow?.max_pause_days ?? settingNumber(settings, 'subscription.max_pause_days', DEFAULT_RULES.maxPauseDays);

  let plan: PlanView | null = null;
  if (live) {
    const status = live.status as LivePlanStatus;
    plan = {
      id: live.id,
      number: live.subscription_number,
      name: planRow?.name ?? live.plan_snapshot?.name ?? 'Your plan',
      typeLabel: PLAN_TYPE_LABELS[planRow?.plan_type ?? ''] ?? '',
      status,
      statusLabel: SUBSCRIPTION_STATUS_LABELS[status] ?? status,
      credits,
      creditsPerCycle: planRow?.credits_per_cycle ?? planRow?.meals_per_cycle ?? null,
      cycleStart: live.current_period_start,
      cycleEnd: live.current_period_end,
      progress: cycleProgress(live.current_period_start, live.current_period_end, today),
      window: live.delivery_windows
        ? {
            label: live.delivery_windows.label,
            startsAt: live.delivery_windows.starts_at,
            endsAt: live.delivery_windows.ends_at,
          }
        : null,
      days: weekdayList(live.delivery_days),
      deliveringTo: live.customer_addresses?.label ?? null,
      pricePaid: live.price_paid,
      renewsOn: live.payment_flow === 'recurring' ? live.next_renewal_at : null,
      pausedUntil: live.paused_until && live.paused_until >= today ? live.paused_until : null,
      pauses: {
        used: live.pauses_used_this_period,
        allowed:
          planRow?.max_pauses_per_period ??
          settingNumber(settings, 'subscription.max_pauses_per_period', DEFAULT_RULES.maxPausesPerPeriod),
        maxDays: maxPauseDays,
      },
      skipReturnsCredit:
        planRow?.skip_returns_credit ??
        settingBoolean(settings, 'subscription.skip_returns_credit', DEFAULT_RULES.skipReturnsCredit),
      graceUntil:
        status === 'past_due' && live.past_due_since
          ? addDays(live.past_due_since.slice(0, 10), live.grace_period_days)
          : null,
    };
  }

  const lastEnded = live
    ? null
    : subscriptions.find((row) => row.status === 'cancelled' || row.status === 'expired') ?? null;

  const addressRows = (addressesResult.data ?? []) as Array<{ label: string; is_default: boolean }>;

  return {
    today,
    now: now.toISOString(),
    name,
    hasCustomer: true,
    plan,
    ended: lastEnded
      ? {
          name: lastEnded.subscription_plans?.name ?? lastEnded.plan_snapshot?.name ?? 'Your plan',
          statusLabel: SUBSCRIPTION_STATUS_LABELS[lastEnded.status] ?? lastEnded.status,
          on: (lastEnded.cancelled_at ?? lastEnded.current_period_end ?? lastEnded.updated_at)?.slice(0, 10) ?? null,
        }
      : null,
    awaitingPayment: subscriptions.some((row) => row.status === 'pending_payment'),
    upcoming,
    schedule: plan
      ? buildSchedule({ today, deliveries: upcoming, pauses, cycleEnd: plan.cycleEnd })
      : [],
    pauses,
    history: ((historyResult.data ?? []) as DeliveryRow[]).map((row) => ({
      id: row.id,
      date: row.scheduled_date,
      windowLabel: row.window_label,
      status: row.status as HistoryEntry['status'],
      items: row.items ?? [],
    })),
    invoices: ((invoicesResult.data ?? []) as Array<{
      id: string;
      invoice_number: string;
      issued_at: string;
      total: string;
    }>).map((row) => ({ id: row.id, number: row.invoice_number, issuedAt: row.issued_at, total: row.total })),
    addresses: {
      total: addressRows.length,
      defaultLabel: addressRows.find((row) => row.is_default)?.label ?? null,
    },
    maxPauseDays,
    leadMinutes,
    skipReturnsCredit: settingBoolean(settings, 'subscription.skip_returns_credit', DEFAULT_RULES.skipReturnsCredit),
  };
}
