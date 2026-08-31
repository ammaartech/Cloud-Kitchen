import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import { serverClient } from '@/lib/supabase/server';
import {
  money,
  dateOnly,
  weekdayList,
  clockTime,
  SUBSCRIPTION_STATUS_LABELS,
  PLAN_TYPE_LABELS,
  KOT_STATUS_LABELS,
} from '@/lib/format';
import { Alert, Badge, Button, Card, EmptyState, Stat } from '@/components/ui/primitives';
import { SubscriptionControls } from '@/components/account/subscription-controls';

export const metadata = { title: 'My account' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await requireSession();
  const supabase = await serverClient();

  if (!session.customerId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title="No subscription yet"
          description="Once you buy a plan, this is where you will manage it."
          action={
            <Link href="/subscriptions">
              <Button>Browse plans</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const [subscriptionsResult, deliveriesResult, invoicesResult, addressesResult] =
    await Promise.all([
      supabase
        .from('subscriptions')
        .select(
          `id, subscription_number, status, price_paid, starts_on, current_period_start,
           current_period_end, delivery_days, grace_period_days, cancelled_at,
           paused_until, pauses_used_this_period,
           subscription_plans ( name, plan_type, billing_period_days, payment_flow ),
           delivery_windows ( label, starts_at, ends_at )`,
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('v_customer_deliveries')
        .select('*')
        .order('scheduled_date', { ascending: true })
        .limit(30),
      supabase
        .from('invoices')
        .select('id, invoice_number, issued_at, total, tax_breakdown')
        .order('issued_at', { ascending: false })
        .limit(10),
      supabase
        .from('customer_addresses')
        .select('id, label, line1, line2, city, postal_code, is_default')
        .eq('is_active', true),
    ]);

  type Subscription = {
    id: string;
    subscription_number: string;
    status: string;
    price_paid: string;
    starts_on: string | null;
    current_period_end: string | null;
    delivery_days: number[];
    grace_period_days: number;
    paused_until: string | null;
    pauses_used_this_period: number;
    subscription_plans: {
      name: string;
      plan_type: string;
      billing_period_days: number;
      payment_flow: string;
    } | null;
    delivery_windows: { label: string; starts_at: string; ends_at: string } | null;
  };

  const subscriptions = (subscriptionsResult.data ?? []) as unknown as Subscription[];
  const active = subscriptions.find((s) => ['active', 'paused', 'past_due'].includes(s.status));

  const deliveries = (deliveriesResult.data ?? []) as Array<{
    id: string;
    scheduled_date: string;
    status: string;
    credits_cost: number;
    window_label: string;
    window_starts_at: string;
    kitchen_status: string | null;
    ticket_code: string | null;
    items: Array<{ name: string; quantity: number }>;
  }>;

  const upcoming = deliveries.filter((d) => ['scheduled', 'released'].includes(d.status));
  const past = deliveries.filter((d) => ['fulfilled', 'skipped', 'cancelled'].includes(d.status));

  const invoices = (invoicesResult.data ?? []) as Array<{
    id: string;
    invoice_number: string;
    issued_at: string;
    total: string;
  }>;

  const addresses = (addressesResult.data ?? []) as Array<{
    id: string;
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    postal_code: string;
    is_default: boolean;
  }>;

  let credits: number | null = null;
  if (active) {
    const { data } = await supabase.rpc('subscription_credit_balance', {
      p_subscription_id: active.id,
    });
    credits = data as number | null;
  }

  /* ------------------------------------------------------------------ */
  /* Actions. Each calls an RPC that re-checks ownership server-side.    */
  /* ------------------------------------------------------------------ */
  async function skipDelivery(formData: FormData) {
    'use server';
    const db = await serverClient();
    await db.rpc('skip_subscription_delivery', {
      p_delivery_id: String(formData.get('deliveryId')),
      p_reason: String(formData.get('reason') ?? '') || null,
    });
    revalidatePath('/account');
  }

  async function pauseSubscription(formData: FormData) {
    'use server';
    const db = await serverClient();
    await db.rpc('pause_subscription', {
      p_subscription_id: String(formData.get('subscriptionId')),
      p_starts_on: String(formData.get('startsOn')),
      p_ends_on: String(formData.get('endsOn')),
      p_reason: String(formData.get('reason') ?? '') || null,
    });
    revalidatePath('/account');
  }

  async function cancelSubscription(formData: FormData) {
    'use server';
    const db = await serverClient();
    await db.rpc('cancel_subscription', {
      p_subscription_id: String(formData.get('subscriptionId')),
      p_reason: String(formData.get('reason') ?? '') || null,
    });
    revalidatePath('/account');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Hello, {session.fullName || 'there'}
          </h1>
          <p className="mt-1 text-muted">Your plan, your deliveries, your history.</p>
        </div>
        <Link href="/subscriptions">
          <Button variant="secondary">Browse plans</Button>
        </Link>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Active subscription                                               */}
      {/* ---------------------------------------------------------------- */}
      {active ? (
        <Card className="mt-8 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    active.status === 'active'
                      ? 'success'
                      : active.status === 'paused'
                        ? 'warning'
                        : 'danger'
                  }
                >
                  {SUBSCRIPTION_STATUS_LABELS[active.status] ?? active.status}
                </Badge>
                <Badge tone="neutral">
                  {PLAN_TYPE_LABELS[active.subscription_plans?.plan_type ?? ''] ?? ''}
                </Badge>
              </div>

              <h2 className="mt-2 text-xl font-semibold">
                {active.subscription_plans?.name ?? 'Subscription'}
              </h2>
              <p className="mt-0.5 text-sm text-muted">{active.subscription_number}</p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              {credits !== null ? (
                <Stat label="Credits left" value={credits} />
              ) : null}
              <Stat
                label="Cycle ends"
                value={
                  <span className="text-lg">
                    {active.current_period_end ? dateOnly(active.current_period_end) : '—'}
                  </span>
                }
              />
            </div>
          </div>

          <dl className="mt-6 grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-subtle">Delivery window</dt>
              <dd className="mt-0.5 font-medium">
                {active.delivery_windows
                  ? `${active.delivery_windows.label} · ${clockTime(active.delivery_windows.starts_at)}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Days</dt>
              <dd className="mt-0.5 font-medium">{weekdayList(active.delivery_days)}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Paid</dt>
              <dd className="mt-0.5 font-medium tabular">{money(active.price_paid)}</dd>
            </div>
          </dl>

          {active.status === 'paused' && active.paused_until ? (
            <div className="mt-4">
              <Alert tone="warning">
                Paused until {dateOnly(active.paused_until)}. Deliveries in that window were
                skipped and their credits returned.
              </Alert>
            </div>
          ) : null}

          <div className="mt-6 border-t border-line pt-5">
            <SubscriptionControls
              subscriptionId={active.id}
              status={active.status}
              pauseAction={pauseSubscription}
              cancelAction={cancelSubscription}
            />
          </div>
        </Card>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="No active subscription"
            description="Pick a plan and your deliveries will show up here."
            action={
              <Link href="/subscriptions">
                <Button>Browse plans</Button>
              </Link>
            }
          />
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Upcoming deliveries                                               */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Upcoming deliveries</h2>

        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing scheduled right now.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {upcoming.map((delivery) => (
              <Card key={delivery.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-40">
                  <p className="font-medium">{dateOnly(delivery.scheduled_date)}</p>
                  <p className="text-sm text-muted">
                    {delivery.window_label} · {clockTime(delivery.window_starts_at)}
                  </p>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted">
                    {delivery.items.map((item) => `${item.quantity}× ${item.name}`).join(', ') ||
                      'Menu to be confirmed'}
                  </p>
                  {delivery.credits_cost > 0 ? (
                    <p className="mt-0.5 text-xs text-subtle">
                      {delivery.credits_cost} credit{delivery.credits_cost === 1 ? '' : 's'}
                    </p>
                  ) : null}
                </div>

                {delivery.status === 'released' ? (
                  <Badge tone="info">
                    {delivery.ticket_code} ·{' '}
                    {KOT_STATUS_LABELS[delivery.kitchen_status ?? ''] ?? 'In the kitchen'}
                  </Badge>
                ) : (
                  // Once a delivery reaches the kitchen it can no longer be
                  // skipped -- the server enforces that, and the UI matches.
                  <form action={skipDelivery}>
                    <input type="hidden" name="deliveryId" value={delivery.id} />
                    <input type="hidden" name="reason" value="Skipped from account" />
                    <Button type="submit" variant="secondary" size="sm">
                      Skip this one
                    </Button>
                  </form>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* History                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Recent deliveries</h2>
          {past.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No history yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {past.slice(0, 8).map((delivery) => (
                <li
                  key={delivery.id}
                  className="flex items-center justify-between gap-3 rounded-ck border border-line bg-surface px-4 py-3 text-sm"
                >
                  <span>{dateOnly(delivery.scheduled_date)}</span>
                  <span className="text-muted">{delivery.window_label}</span>
                  <Badge tone={delivery.status === 'fulfilled' ? 'success' : 'neutral'}>
                    {delivery.status === 'fulfilled' ? 'Delivered' : 'Skipped'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight">Invoices</h2>
          {invoices.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No invoices yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {invoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex items-center justify-between gap-3 rounded-ck border border-line bg-surface px-4 py-3 text-sm"
                >
                  <span className="font-mono text-xs">{invoice.invoice_number}</span>
                  <span className="text-muted">{dateOnly(invoice.issued_at)}</span>
                  <span className="font-medium tabular">{money(invoice.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Addresses                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Saved addresses</h2>
          <Link href="/account/addresses">
            <Button variant="secondary" size="sm">
              Manage addresses
            </Button>
          </Link>
        </div>

        {addresses.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            None saved yet — add one so your next plan has somewhere to go.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <Card key={address.id} className="p-4">
              <div className="flex items-center gap-2">
                <p className="font-medium">{address.label}</p>
                {address.is_default ? <Badge tone="neutral">Default</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-muted">
                {[address.line1, address.line2].filter(Boolean).join(', ')}, {address.city}{' '}
                {address.postal_code}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
