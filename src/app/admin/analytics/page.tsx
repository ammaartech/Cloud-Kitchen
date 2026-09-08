import type { Route } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { money, duration } from '@/lib/format';
import { ButtonLink, Card, EmptyState, SectionHeading, Stat } from '@/components/ui/primitives';
import { RangeChips } from '@/components/admin/analytics/range-chips';
import { CategorySelect } from '@/components/admin/analytics/category-select';
import { RevenueTrendChart, type TrendPoint } from '@/components/admin/analytics/revenue-trend-chart';
import { Donut } from '@/components/admin/analytics/donut';
import { HourBars, type HourBucket } from '@/components/admin/analytics/hour-bars';
import { TopItemsTable, type TopItem } from '@/components/admin/analytics/top-items-table';
import {
  RecentTransactionsTable,
  type RecentTransaction,
} from '@/components/admin/analytics/recent-transactions-table';
import { QueuePill } from '@/components/admin/analytics/queue-pill';
import {
  RANGE_LABELS,
  filterQueryString,
  resolveFilters,
} from '@/app/admin/analytics/_lib/filters';

/**
 * Per-user, permission-gated. Nothing here prerenders.
 */
export const instant = false;
export const metadata = { title: 'Analytics' };

interface OrderRow {
  order_id: string;
  order_number: string | number;
  source: string;
  business_date: string;
  placed_at: string | null;
  revenue: string | null;
  estimated_food_cost: string | null;
  channel_fees: string | null;
  prep_seconds: number | null;
  customer_id: string | null;
  customer_name_snapshot: string | null;
}

interface ItemRow {
  order_id: string;
  business_date: string;
  source: string;
  product_id: string | null;
  product_name: string;
  category_slug: string | null;
  category_name: string | null;
  quantity: number;
  line_subtotal: string | null;
}

interface PaymentRow {
  order_id: string | null;
  subscription_id: string | null;
  method: string | null;
  amount: string;
  business_date: string;
}

interface FirstOrderRow {
  customer_id: string;
  first_order_business_date: string;
}

const HOUR_LABEL = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  hour12: false,
});

function hourOfDay(iso: string): number {
  return Number(HOUR_LABEL.format(new Date(iso)));
}

/**
 * Weighted average across per-order sample rows, so a channel with 5 orders
 * doesn't drown out a channel with 500. Mirrors the helper in
 * /admin/page.tsx.
 */
function weightedAverage(rows: OrderRow[], key: 'prep_seconds'): number | null {
  const withValue = rows.filter((row) => row[key] !== null && row[key] !== undefined);
  if (withValue.length === 0) return null;
  return (
    withValue.reduce((sum, row) => sum + Number(row[key] ?? 0), 0) / withValue.length
  );
}

const DAY_LABEL = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
});

export default async function AnalyticsPage({
  searchParams,
}: PageProps<'/admin/analytics'>) {
  await requirePermission(PERMISSIONS.analyticsView);
  const raw = await searchParams;
  const filters = resolveFilters(raw);
  const supabase = await serverClient();

  // ---------------------------------------------------------------------------
  // Fetch everything in parallel. Filters below are the standard IST business
  // date bounds; `all` skips the bounds entirely.
  // ---------------------------------------------------------------------------
  let orderQuery = supabase
    .from('v_analytics_orders')
    .select(
      'order_id, order_number, source, business_date, placed_at, revenue, estimated_food_cost, channel_fees, prep_seconds, customer_id, customer_name_snapshot',
    );
  let itemQuery = supabase
    .from('v_analytics_order_items')
    .select(
      'order_id, business_date, source, product_id, product_name, category_slug, category_name, quantity, line_subtotal',
    );
  let paymentQuery = supabase
    .from('v_analytics_payments')
    .select('order_id, subscription_id, method, amount, business_date');

  if (filters.startDate && filters.endDate) {
    orderQuery = orderQuery.gte('business_date', filters.startDate).lte('business_date', filters.endDate);
    itemQuery = itemQuery.gte('business_date', filters.startDate).lte('business_date', filters.endDate);
    paymentQuery = paymentQuery
      .gte('business_date', filters.startDate)
      .lte('business_date', filters.endDate);
  }

  const [
    orderRes,
    itemRes,
    paymentRes,
    categoryRes,
    queueRes,
  ] = await Promise.all([
    orderQuery,
    itemQuery,
    paymentQuery,
    supabase.from('categories').select('slug, name').eq('is_active', true).order('sort_order'),
    supabase
      .from('v_kot_tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP']),
  ]);

  const allOrders = (orderRes.data ?? []) as unknown as OrderRow[];
  const allItems = (itemRes.data ?? []) as unknown as ItemRow[];
  const payments = (paymentRes.data ?? []) as unknown as PaymentRow[];
  const categories = (categoryRes.data ?? []) as Array<{ slug: string; name: string }>;
  const queueCount = queueRes.count ?? 0;

  // ---------------------------------------------------------------------------
  // Category scoping. When a category is selected we narrow to the orders that
  // contained at least one item in that category. Payment methods and customer
  // retention deliberately stay unscoped -- payment is order-level and
  // retention is customer-level, so a category filter can't apply honestly.
  // ---------------------------------------------------------------------------
  const filteredItems = filters.categorySlug
    ? allItems.filter((item) => item.category_slug === filters.categorySlug)
    : allItems;

  const visibleOrderIds = filters.categorySlug
    ? new Set(filteredItems.map((item) => item.order_id))
    : null;

  const orders = visibleOrderIds
    ? allOrders.filter((row) => visibleOrderIds.has(row.order_id))
    : allOrders;

  // ---------------------------------------------------------------------------
  // KPI numbers.
  // ---------------------------------------------------------------------------
  const marketplaceOrders = orders.filter((row) => row.source === 'SW' || row.source === 'ZM');
  const subscriptionOrders = orders.filter((row) => row.source === 'SX');

  const grossRevenue = orders.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0);
  const totalChannelFees = orders.reduce((sum, row) => sum + Number(row.channel_fees ?? 0), 0);
  const totalFoodCost = orders.reduce(
    (sum, row) => sum + Number(row.estimated_food_cost ?? 0),
    0,
  );
  const estProfit = grossRevenue - totalChannelFees - totalFoodCost;
  const orderVolume = orders.length;
  const avgPrepSeconds = weightedAverage(orders, 'prep_seconds');

  const marketplaceRevenue = marketplaceOrders.reduce(
    (sum, row) => sum + Number(row.revenue ?? 0),
    0,
  );
  const marketplaceAov = marketplaceOrders.length
    ? marketplaceRevenue / marketplaceOrders.length
    : null;

  // Subscription AOV = retail food value shipped per SX order.
  const subscriptionOrderIds = new Set(subscriptionOrders.map((row) => row.order_id));
  const subscriptionItemTotal = filteredItems
    .filter((item) => subscriptionOrderIds.has(item.order_id))
    .reduce((sum, item) => sum + Number(item.line_subtotal ?? 0), 0);
  const subscriptionAov = subscriptionOrders.length
    ? subscriptionItemTotal / subscriptionOrders.length
    : null;

  // ---------------------------------------------------------------------------
  // Revenue & Order trend. Bucket by hour for `today`; by day otherwise.
  // ---------------------------------------------------------------------------
  const trend: TrendPoint[] = (() => {
    if (filters.range === 'today') {
      const buckets = new Array(24).fill(null).map((_, hour) => ({
        label: `${String(hour).padStart(2, '0')}:00`,
        revenue: 0,
        orders: 0,
      }));
      for (const row of orders) {
        if (!row.placed_at) continue;
        const h = hourOfDay(row.placed_at);
        buckets[h].revenue += Number(row.revenue ?? 0);
        buckets[h].orders += 1;
      }
      return buckets;
    }
    const byDate = new Map<string, { revenue: number; orders: number }>();
    for (const row of orders) {
      const entry = byDate.get(row.business_date) ?? { revenue: 0, orders: 0 };
      entry.revenue += Number(row.revenue ?? 0);
      entry.orders += 1;
      byDate.set(row.business_date, entry);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        label: DAY_LABEL.format(new Date(`${date}T12:00:00Z`)),
        revenue: value.revenue,
        orders: value.orders,
      }));
  })();

  // ---------------------------------------------------------------------------
  // Payment methods donut. Category filter deliberately ignored (see above).
  // ---------------------------------------------------------------------------
  const methodBuckets = new Map<string, number>();
  for (const p of payments) {
    const key = normaliseMethod(p.method);
    methodBuckets.set(key, (methodBuckets.get(key) ?? 0) + Number(p.amount));
  }
  const paymentSlices = [...methodBuckets.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  // ---------------------------------------------------------------------------
  // Customer retention. Unscoped by category. Excludes null customers (called
  // out below the donut).
  // ---------------------------------------------------------------------------
  const rangeCustomerIds = new Set<string>();
  let marketplaceGuestOrders = 0;
  for (const row of allOrders) {
    if (row.customer_id) rangeCustomerIds.add(row.customer_id);
    else marketplaceGuestOrders += 1;
  }
  const firstOrders =
    rangeCustomerIds.size > 0
      ? await supabase
          .from('v_analytics_customer_first_order')
          .select('customer_id, first_order_business_date')
          .in('customer_id', [...rangeCustomerIds])
      : { data: [] as FirstOrderRow[] };
  const firstOrderMap = new Map<string, string>();
  for (const row of (firstOrders.data ?? []) as unknown as FirstOrderRow[]) {
    firstOrderMap.set(row.customer_id, row.first_order_business_date);
  }
  let newCount = 0;
  let returningCount = 0;
  const rangeStartBound = filters.startDate ?? '0000-01-01';
  for (const customerId of rangeCustomerIds) {
    const first = firstOrderMap.get(customerId);
    if (!first) continue;
    if (first >= rangeStartBound) newCount += 1;
    else returningCount += 1;
  }
  const retentionSlices =
    newCount + returningCount === 0
      ? []
      : [
          { name: 'New Customers', value: newCount },
          { name: 'Returning', value: returningCount },
        ];

  // ---------------------------------------------------------------------------
  // Category trends donut. Always over the un-category-filtered items so the
  // donut *is* the comparison. Capped at 6 slices with an 'Other' overflow.
  // ---------------------------------------------------------------------------
  const categoryBuckets = new Map<string, Set<string>>();
  for (const item of allItems) {
    const key = item.category_name ?? 'Uncategorised';
    const bucket = categoryBuckets.get(key) ?? new Set<string>();
    bucket.add(item.order_id);
    categoryBuckets.set(key, bucket);
  }
  const sortedCategories = [...categoryBuckets.entries()]
    .map(([name, ids]) => ({ name, value: ids.size }))
    .sort((a, b) => b.value - a.value);
  const categorySlices =
    sortedCategories.length > 6
      ? [
          ...sortedCategories.slice(0, 5),
          {
            name: 'Other',
            value: sortedCategories.slice(5).reduce((sum, s) => sum + s.value, 0),
          },
        ]
      : sortedCategories;

  // ---------------------------------------------------------------------------
  // Peak business hours.
  // ---------------------------------------------------------------------------
  const hourBuckets: HourBucket[] = new Array(24).fill(null).map((_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    count: 0,
  }));
  for (const row of orders) {
    if (!row.placed_at) continue;
    hourBuckets[hourOfDay(row.placed_at)].count += 1;
  }

  // ---------------------------------------------------------------------------
  // Top selling items. Grouped by product_id. Top 10 by quantity.
  // ---------------------------------------------------------------------------
  const itemBuckets = new Map<string, TopItem>();
  for (const item of filteredItems) {
    const key = item.product_id ?? item.product_name;
    const existing = itemBuckets.get(key) ?? {
      productId: key,
      productName: item.product_name,
      quantity: 0,
      revenue: 0,
    };
    existing.quantity += item.quantity;
    existing.revenue += Number(item.line_subtotal ?? 0);
    itemBuckets.set(key, existing);
  }
  const topItems = [...itemBuckets.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // ---------------------------------------------------------------------------
  // Recent transactions. Newest 10 in the window; join method via payments.
  // ---------------------------------------------------------------------------
  const paymentsByOrder = new Map<string, string | null>();
  for (const p of payments) {
    if (p.order_id && !paymentsByOrder.has(p.order_id)) {
      paymentsByOrder.set(p.order_id, p.method);
    }
  }
  const recent: RecentTransaction[] = [...orders]
    .filter((row) => row.placed_at)
    .sort((a, b) => (a.placed_at! < b.placed_at! ? 1 : -1))
    .slice(0, 10)
    .map((row) => ({
      orderId: row.order_id,
      orderNumber: String(row.order_number),
      customerName: row.customer_name_snapshot,
      placedAt: row.placed_at!,
      source: row.source,
      method: paymentsByOrder.get(row.order_id) ?? null,
      total: Number(row.revenue ?? 0),
    }));

  // ---------------------------------------------------------------------------
  const categoryOptions = [{ slug: 'all', name: 'All Categories' }, ...categories];
  const exportHref = `/admin/analytics/export${filterQueryString(filters)}` as Route;
  const rangeLabel = RANGE_LABELS[filters.range];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header ------------------------------------------------------------- */}
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="grid h-11 w-11 place-items-center rounded-ck-lg bg-brand-soft text-brand">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
            <path
              d="M3 17l6-6 4 4 7-9"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Analytics</h1>
          <p className="text-sm text-muted">Real-time point of sale metrics</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <QueuePill count={queueCount} />
          <ButtonLink href={exportHref} variant="secondary" size="sm" prefetch={false}>
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
              <path
                d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Excel / CSV
          </ButtonLink>
        </div>
      </Card>

      {/* Filters ------------------------------------------------------------ */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <RangeChips />
        <CategorySelect options={categoryOptions} />
      </div>

      {/* KPI strip ---------------------------------------------------------- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="p-5">
          <Stat label="Gross Revenue" value={money(grossRevenue)} hint={rangeLabel} />
        </Card>
        <Card className="p-5">
          <Stat
            label="Est. Profit"
            value={money(estProfit)}
            tone={estProfit >= 0 ? 'positive' : 'negative'}
          />
        </Card>
        <Card className="p-5">
          <Stat label="Order Volume" value={orderVolume} />
        </Card>
        <Card className="p-5">
          <Stat label="Prep Time Avg" value={duration(avgPrepSeconds)} hint="Accepted to ready" />
        </Card>
        <Card className="p-5">
          <Stat
            label="Subscription AOV"
            value={money(subscriptionAov)}
            hint="Food value per delivery"
          />
        </Card>
        <Card className="p-5">
          <Stat label="Marketplace AOV" value={money(marketplaceAov)} hint="Swiggy + Zomato" />
        </Card>
      </div>

      {/* Trend + Payment methods ------------------------------------------- */}
      <section className="mt-8 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <SectionHeading
            title="Revenue & Order Trend"
            description="Performance metrics across the selected time period."
          />
          {trend.length === 0 ? (
            <EmptyState
              title="No data yet"
              description="Once orders arrive in this range, revenue and volume will chart here."
            />
          ) : (
            <RevenueTrendChart data={trend} />
          )}
        </Card>
        <Card className="p-5">
          <SectionHeading
            title="Payment Methods"
            description={
              filters.categorySlug
                ? 'Breakdown by collection type · Not affected by category filter'
                : 'Breakdown by collection type'
            }
          />
          {paymentSlices.length === 0 ? (
            <EmptyState
              title="No verified payments"
              description="Verified subscription and marketplace payments will show here."
            />
          ) : (
            <Donut
              data={paymentSlices}
              ariaLabel="Payment method breakdown"
              format="money"
            />
          )}
        </Card>
      </section>

      {/* Retention + Category + Peak Hours --------------------------------- */}
      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <SectionHeading
            title="Customer Retention"
            description={
              filters.categorySlug
                ? 'New vs Returning · Not affected by category filter'
                : 'New vs Returning Customers'
            }
          />
          {retentionSlices.length === 0 ? (
            <EmptyState
              title="No identified customers"
              description="Retention is computed from orders linked to a customer record."
            />
          ) : (
            <>
              <Donut
                data={retentionSlices}
                ariaLabel="New versus returning customers"
                palette={['var(--ck-brand)', 'var(--ck-warning)']}
              />
              {marketplaceGuestOrders > 0 ? (
                <p className="mt-3 text-xs text-subtle">
                  {marketplaceGuestOrders} marketplace order
                  {marketplaceGuestOrders === 1 ? '' : 's'} excluded — no customer identity.
                </p>
              ) : null}
            </>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeading
            title="Category Trends"
            description="Popularity by category (orders)"
          />
          {categorySlices.length === 0 ? (
            <EmptyState
              title="No items sold"
              description="Nothing was ordered in the selected range."
            />
          ) : (
            <Donut
              data={categorySlices}
              ariaLabel="Order share by category"
              palette={[
                'var(--ck-warning)',
                'var(--ck-brand)',
                'var(--ck-info)',
                'var(--ck-accent)',
                'var(--ck-danger)',
                'var(--ck-brand-hover)',
              ]}
            />
          )}
        </Card>

        <Card className="p-5">
          <SectionHeading title="Peak Business Hours" description="Orders placed by time of day" />
          {orders.length === 0 ? (
            <EmptyState title="No orders yet" description="Hourly distribution appears with data." />
          ) : (
            <HourBars data={hourBuckets} />
          )}
        </Card>
      </section>

      {/* Top items + Recent transactions ----------------------------------- */}
      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-5">
          <SectionHeading
            title="Top Selling Items"
            description="Highest volume products"
            action={
              <ButtonLink href={exportHref} variant="secondary" size="sm" prefetch={false}>
                Export
              </ButtonLink>
            }
          />
          <TopItemsTable items={topItems} />
        </Card>
        <Card className="p-5">
          <SectionHeading title="Recent Transactions" description="Latest 10 orders in this period" />
          <RecentTransactionsTable rows={recent} />
        </Card>
      </section>

      <p className="mt-6 text-xs text-subtle">
        Revenue for subscription (SX) orders is recognised at payment time, so the trend chart and
        marketplace AOV reflect Swiggy and Zomato only. Subscription AOV shows the retail food
        value of each delivery.
      </p>
    </div>
  );
}

function normaliseMethod(method: string | null): string {
  if (!method) return 'Other';
  const key = method.toLowerCase();
  if (key.includes('upi')) return 'UPI';
  if (key.includes('card')) return 'Card';
  if (key.includes('net')) return 'Netbanking';
  if (key.includes('wallet')) return 'Wallet';
  if (key.includes('cash')) return 'Cash';
  return method.charAt(0).toUpperCase() + method.slice(1);
}
