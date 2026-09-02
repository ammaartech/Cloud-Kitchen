import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { money, duration, dateOnly, SOURCE_LABELS } from '@/lib/format';
import { Alert, Badge, Card, EmptyState, SectionHeading, Stat } from '@/components/ui/primitives';
import { RevenueChart } from '@/components/admin/revenue-chart';

/**
 * These screens are per-user by definition -- a session decides not just what
 * they show but whether you may see them at all -- so there is no static shell
 * to prerender and no point pretending otherwise. `instant = false` says that
 * plainly: this segment is allowed to block.
 *
 * It is a statement about *this* route, not a global escape hatch. The public
 * storefront next door is held to the opposite standard.
 */
export const instant = false;

export const metadata = { title: 'Overview' };

interface DashboardRow {
  source: string;
  order_count: string;
  revenue: string;
  estimated_food_cost: string;
  channel_fees: string;
  estimated_profit: string;
  avg_prep_seconds: string | null;
  avg_order_seconds: string | null;
  avg_pickup_wait_seconds: string | null;
  avg_delivery_seconds: string | null;
}

interface DailyRow {
  business_date: string;
  source: string;
  order_count: number;
  revenue: string;
  estimated_profit: string;
}

export default async function AdminOverviewPage() {
  await requirePermission(PERMISSIONS.analyticsView);
  const supabase = await serverClient();

  const [dashboardResult, dailyResult, costResult] = await Promise.all([
    supabase.from('v_owner_dashboard').select('*'),
    supabase
      .from('v_kot_metrics_daily')
      .select('business_date, source, order_count, revenue, estimated_profit')
      .order('business_date', { ascending: true }),
    supabase.from('cost_settings').select('label, is_dummy_data').eq('is_active', true),
  ]);

  const rows = (dashboardResult.data ?? []) as unknown as DashboardRow[];
  const daily = (dailyResult.data ?? []) as unknown as DailyRow[];
  const costs = (costResult.data ?? []) as Array<{ label: string; is_dummy_data: boolean }>;

  const usesDummyCosts = costs.some((cost) => cost.is_dummy_data);

  const totals = rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + Number(row.revenue ?? 0),
      orders: acc.orders + Number(row.order_count ?? 0),
      profit: acc.profit + Number(row.estimated_profit ?? 0),
      foodCost: acc.foodCost + Number(row.estimated_food_cost ?? 0),
      fees: acc.fees + Number(row.channel_fees ?? 0),
    }),
    { revenue: 0, orders: 0, profit: 0, foodCost: 0, fees: 0 },
  );

  // Averages across sources weighted by order count, so a quiet channel does
  // not drag the headline number as hard as a busy one.
  const weighted = (key: keyof DashboardRow) => {
    const withData = rows.filter((row) => row[key] !== null);
    if (withData.length === 0) return null;

    const totalOrders = withData.reduce((sum, row) => sum + Number(row.order_count ?? 0), 0);
    if (totalOrders === 0) return null;

    return (
      withData.reduce(
        (sum, row) => sum + Number(row[key] ?? 0) * Number(row.order_count ?? 0),
        0,
      ) / totalOrders
    );
  };

  const latestDate = daily.length ? daily[daily.length - 1].business_date : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Business overview</h1>
        <p className="mt-1 text-muted">
          Revenue separated by channel, with operational timings from the KOT.
          {latestDate ? ` Latest data: ${dateOnly(latestDate)}.` : ''}
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No trading data yet"
            description="Once orders start flowing through the KOT, revenue and timings appear here."
          />
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <Stat label="Total revenue" value={money(totals.revenue)} />
            </Card>
            <Card className="p-5">
              <Stat label="Orders" value={totals.orders} />
            </Card>
            <Card className="p-5">
              <Stat
                label="Estimated profit"
                value={money(totals.profit)}
                tone={totals.profit >= 0 ? 'positive' : 'negative'}
                hint={usesDummyCosts ? 'Uses placeholder cost assumptions' : undefined}
              />
            </Card>
            <Card className="p-5">
              <Stat
                label="Avg prep time"
                value={duration(weighted('avg_prep_seconds'))}
                hint="Accepted to ready"
              />
            </Card>
          </div>

          {usesDummyCosts ? (
            <div className="mt-4">
              <Alert tone="warning" title="Profit figures are estimates">
                Commission, payment fees, packaging and food cost are still the placeholder
                assumptions seeded with the system. Revenue and timings are real; profit is
                only as good as those inputs. Replace them in Settings — no code change is
                needed.
              </Alert>
            </div>
          ) : null}

          {/* ------------------------------------------------------------ */}
          {/* Revenue by source (PRD 12)                                    */}
          {/* ------------------------------------------------------------ */}
          <section className="mt-10">
            <SectionHeading
              title="Revenue by channel"
              description="Website revenue is recognised when a subscription payment is verified; marketplace revenue comes from the platform order totals."
            />

            <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
              <Card className="p-5">
                <RevenueChart daily={daily} />
              </Card>

              <div className="space-y-3">
                {rows.map((row) => {
                  const share = totals.revenue
                    ? (Number(row.revenue) / totals.revenue) * 100
                    : 0;

                  return (
                    <Card key={row.source} className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              background:
                                row.source === 'SW'
                                  ? 'var(--ck-source-sw)'
                                  : row.source === 'ZM'
                                    ? 'var(--ck-source-zm)'
                                    : 'var(--ck-source-sx)',
                            }}
                            aria-hidden
                          />
                          {SOURCE_LABELS[row.source] ?? row.source}
                        </span>
                        <span className="text-xs text-subtle">{row.source}</span>
                      </div>

                      <p className="mt-2 text-xl font-semibold tabular">
                        {money(row.revenue)}
                      </p>
                      <p className="text-xs text-subtle">
                        {Math.round(share)}% of revenue · {row.order_count} orders
                      </p>

                      <dl className="mt-3 space-y-1 border-t border-line pt-3 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-muted">Food cost</dt>
                          <dd className="tabular">{money(row.estimated_food_cost)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted">Channel fees</dt>
                          <dd className="tabular">{money(row.channel_fees)}</dd>
                        </div>
                        <div className="flex justify-between font-medium">
                          <dt>Est. profit</dt>
                          <dd
                            className={
                              Number(row.estimated_profit) >= 0
                                ? 'tabular text-success'
                                : 'tabular text-danger'
                            }
                          >
                            {money(row.estimated_profit)}
                          </dd>
                        </div>
                      </dl>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------------ */}
          {/* Operational timings                                           */}
          {/* ------------------------------------------------------------ */}
          <section className="mt-10">
            <SectionHeading
              title="Operational timings"
              description="Measured from the KOT timestamps. Blank means those timestamps do not exist for that channel yet."
            />

            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs tracking-wide text-subtle uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Channel</th>
                    <th className="px-4 py-3 text-right font-medium">Orders</th>
                    <th className="px-4 py-3 text-right font-medium">Prep</th>
                    <th className="px-4 py-3 text-right font-medium">Order time</th>
                    <th className="px-4 py-3 text-right font-medium">Pickup wait</th>
                    <th className="px-4 py-3 text-right font-medium">Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.source} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            tone={
                              row.source === 'SW'
                                ? 'warning'
                                : row.source === 'ZM'
                                  ? 'danger'
                                  : 'info'
                            }
                          >
                            {row.source}
                          </Badge>
                          {SOURCE_LABELS[row.source] ?? row.source}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular">{row.order_count}</td>
                      <td className="px-4 py-3 text-right tabular">
                        {duration(row.avg_prep_seconds)}
                      </td>
                      <td className="px-4 py-3 text-right tabular">
                        {duration(row.avg_order_seconds)}
                      </td>
                      <td className="px-4 py-3 text-right tabular">
                        {duration(row.avg_pickup_wait_seconds)}
                      </td>
                      <td className="px-4 py-3 text-right tabular">
                        {duration(row.avg_delivery_seconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <p className="mt-2 text-xs text-subtle">
              Prep time is accepted → ready. Order time is created → completed. Subscription
              deliveries carry no per-order timings until they pass through the kitchen.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
