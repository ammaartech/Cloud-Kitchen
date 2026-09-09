import { NextResponse, type NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { getSession } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { serverClient } from '@/lib/supabase/server';
import { SOURCE_LABELS } from '@/lib/format';
import {
  RANGE_LABELS,
  resolveFilters,
  type AnalyticsFilters,
} from '@/app/admin/analytics/_lib/filters';

/**
 * Owner Analytics workbook export.
 *
 * One request, one `.xlsx`, seven sheets -- each answers one question the
 * owner asked in the UI, so the workbook opens as a set of small readable
 * sheets rather than one crowded dump.
 *
 * The filter set (`range`, `category`) exactly mirrors the on-screen page:
 * whatever the owner is looking at is what they download. Auth is checked
 * inline here because a route handler must return a Response -- redirecting
 * via `requirePermission` would break the download.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !session.permissions.has(PERMISSIONS.analyticsView)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const rawParams: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    rawParams[key] = value;
  });
  const filters = resolveFilters(rawParams);
  const supabase = await serverClient();

  const [orderRes, itemRes, paymentRes] = await Promise.all([
    buildOrderQuery(supabase, filters),
    buildItemQuery(supabase, filters),
    buildPaymentQuery(supabase, filters),
  ]);

  const orders = (orderRes.data ?? []) as OrderRow[];
  const items = (itemRes.data ?? []) as ItemRow[];
  const payments = (paymentRes.data ?? []) as PaymentRow[];

  const scopedItems = filters.categorySlug
    ? items.filter((row) => row.category_slug === filters.categorySlug)
    : items;
  const visibleOrderIds = filters.categorySlug
    ? new Set(scopedItems.map((row) => row.order_id))
    : null;
  const scopedOrders = visibleOrderIds
    ? orders.filter((row) => visibleOrderIds.has(row.order_id))
    : orders;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Infinity Kitchens Admin';
  wb.created = new Date();

  writeSummary(wb, filters, scopedOrders, scopedItems);
  writeRevenueByDay(wb, scopedOrders, payments);
  writeOrders(wb, scopedOrders, payments);
  writeTopItems(wb, scopedItems);
  writePaymentMethods(wb, payments);
  writePeakHours(wb, scopedOrders);
  writeRetention(wb, orders);

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `analytics-${filters.range}-${stamp}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/* ========================================================================= */
/* Types                                                                     */
/* ========================================================================= */

type Supa = Awaited<ReturnType<typeof serverClient>>;

interface OrderRow {
  order_id: string;
  order_number: string | number;
  source: string;
  business_date: string;
  placed_at: string | null;
  revenue: string | null;
  estimated_food_cost: string | null;
  channel_fees: string | null;
  customer_id: string | null;
  customer_name_snapshot: string | null;
}

interface ItemRow {
  order_id: string;
  business_date: string;
  source: string;
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

/* ========================================================================= */
/* Queries                                                                   */
/* ========================================================================= */

function buildOrderQuery(supabase: Supa, filters: AnalyticsFilters) {
  let query = supabase
    .from('v_analytics_orders')
    .select(
      'order_id, order_number, source, business_date, placed_at, revenue, estimated_food_cost, channel_fees, customer_id, customer_name_snapshot',
    );
  if (filters.startDate && filters.endDate) {
    query = query.gte('business_date', filters.startDate).lte('business_date', filters.endDate);
  }
  return query;
}

function buildItemQuery(supabase: Supa, filters: AnalyticsFilters) {
  let query = supabase
    .from('v_analytics_order_items')
    .select(
      'order_id, business_date, source, product_name, category_slug, category_name, quantity, line_subtotal',
    );
  if (filters.startDate && filters.endDate) {
    query = query.gte('business_date', filters.startDate).lte('business_date', filters.endDate);
  }
  return query;
}

function buildPaymentQuery(supabase: Supa, filters: AnalyticsFilters) {
  let query = supabase
    .from('v_analytics_payments')
    .select('order_id, subscription_id, method, amount, business_date');
  if (filters.startDate && filters.endDate) {
    query = query.gte('business_date', filters.startDate).lte('business_date', filters.endDate);
  }
  return query;
}

/* ========================================================================= */
/* Sheet builders                                                            */
/* ========================================================================= */

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF386155' } },
  alignment: { vertical: 'middle' },
};

function styleHeader(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).eachCell((cell) => {
    Object.assign(cell, HEADER_STYLE);
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function autoWidth(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    if (!col) return;
    let max = col.header ? String(col.header).length : 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value == null ? '' : String(cell.value);
      if (v.length > max) max = v.length;
    });
    col.width = Math.min(48, Math.max(10, max + 2));
  });
}

function writeSummary(
  wb: ExcelJS.Workbook,
  filters: AnalyticsFilters,
  orders: OrderRow[],
  items: ItemRow[],
) {
  const sheet = wb.addWorksheet('Summary');
  sheet.columns = [
    { header: 'Metric', key: 'metric' },
    { header: 'Value', key: 'value' },
  ];

  const marketplaceOrders = orders.filter((r) => r.source === 'SW' || r.source === 'ZM');
  const subscriptionOrders = orders.filter((r) => r.source === 'SX');
  const grossRevenue = sumNum(orders.map((r) => r.revenue));
  const channelFees = sumNum(orders.map((r) => r.channel_fees));
  const foodCost = sumNum(orders.map((r) => r.estimated_food_cost));

  const marketplaceRevenue = sumNum(marketplaceOrders.map((r) => r.revenue));
  const subscriptionOrderIds = new Set(subscriptionOrders.map((r) => r.order_id));
  const subscriptionItemTotal = sumNum(
    items.filter((i) => subscriptionOrderIds.has(i.order_id)).map((i) => i.line_subtotal),
  );

  const rows: Array<[string, string | number]> = [
    ['Date range', RANGE_LABELS[filters.range]],
    ['Category', filters.categorySlug ?? 'All'],
    ['Generated at (IST)', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
    ['Gross Revenue (INR)', round2(grossRevenue)],
    ['Estimated Profit (INR)', round2(grossRevenue - channelFees - foodCost)],
    ['Order Volume', orders.length],
    [
      'Subscription AOV (INR)',
      subscriptionOrders.length ? round2(subscriptionItemTotal / subscriptionOrders.length) : 0,
    ],
    [
      'Marketplace AOV (INR)',
      marketplaceOrders.length ? round2(marketplaceRevenue / marketplaceOrders.length) : 0,
    ],
  ];
  rows.forEach(([metric, value]) => sheet.addRow({ metric, value }));

  styleHeader(sheet);
  autoWidth(sheet);
}

function writeRevenueByDay(
  wb: ExcelJS.Workbook,
  orders: OrderRow[],
  payments: PaymentRow[],
) {
  const sheet = wb.addWorksheet('Revenue by Day');
  sheet.columns = [
    { header: 'Date', key: 'date' },
    { header: 'Marketplace Revenue', key: 'mkt' },
    { header: 'Subscription Revenue', key: 'sub' },
    { header: 'Orders', key: 'orders' },
    { header: 'Est. Profit', key: 'profit' },
  ];

  const map = new Map<
    string,
    { mkt: number; sub: number; orders: number; fees: number; food: number }
  >();
  const bump = (date: string) => {
    const e = map.get(date) ?? { mkt: 0, sub: 0, orders: 0, fees: 0, food: 0 };
    map.set(date, e);
    return e;
  };
  for (const row of orders) {
    const e = bump(row.business_date);
    e.mkt += Number(row.revenue ?? 0);
    e.orders += 1;
    e.fees += Number(row.channel_fees ?? 0);
    e.food += Number(row.estimated_food_cost ?? 0);
  }
  for (const p of payments) {
    if (!p.subscription_id) continue;
    const e = bump(p.business_date);
    e.sub += Number(p.amount);
  }

  [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, e]) => {
      sheet.addRow({
        date,
        mkt: round2(e.mkt),
        sub: round2(e.sub),
        orders: e.orders,
        profit: round2(e.mkt - e.fees - e.food),
      });
    });

  styleHeader(sheet);
  autoWidth(sheet);
}

function writeOrders(
  wb: ExcelJS.Workbook,
  orders: OrderRow[],
  payments: PaymentRow[],
) {
  const sheet = wb.addWorksheet('Orders');
  sheet.columns = [
    { header: 'Order #', key: 'num' },
    { header: 'Placed At (IST)', key: 'time' },
    { header: 'Channel', key: 'channel' },
    { header: 'Customer', key: 'customer' },
    { header: 'Method', key: 'method' },
    { header: 'Revenue', key: 'revenue' },
  ];

  const methodByOrder = new Map<string, string | null>();
  for (const p of payments) {
    if (p.order_id && !methodByOrder.has(p.order_id)) methodByOrder.set(p.order_id, p.method);
  }

  [...orders]
    .sort((a, b) => (a.placed_at ?? '').localeCompare(b.placed_at ?? ''))
    .forEach((row) => {
      sheet.addRow({
        num: `#${row.order_number}`,
        time: row.placed_at
          ? new Date(row.placed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          : '',
        channel: SOURCE_LABELS[row.source] ?? row.source,
        customer: row.customer_name_snapshot ?? '',
        method: methodByOrder.get(row.order_id) ?? '',
        revenue: round2(Number(row.revenue ?? 0)),
      });
    });

  styleHeader(sheet);
  autoWidth(sheet);
}

function writeTopItems(wb: ExcelJS.Workbook, items: ItemRow[]) {
  const sheet = wb.addWorksheet('Top Items');
  sheet.columns = [
    { header: 'Product', key: 'product' },
    { header: 'Category', key: 'category' },
    { header: 'Qty', key: 'qty' },
    { header: 'Revenue', key: 'revenue' },
  ];

  const buckets = new Map<
    string,
    { product: string; category: string; qty: number; revenue: number }
  >();
  for (const item of items) {
    const key = item.product_name;
    const e = buckets.get(key) ?? {
      product: item.product_name,
      category: item.category_name ?? 'Uncategorised',
      qty: 0,
      revenue: 0,
    };
    e.qty += item.quantity;
    e.revenue += Number(item.line_subtotal ?? 0);
    buckets.set(key, e);
  }

  [...buckets.values()]
    .sort((a, b) => b.qty - a.qty)
    .forEach((row) =>
      sheet.addRow({
        product: row.product,
        category: row.category,
        qty: row.qty,
        revenue: round2(row.revenue),
      }),
    );

  styleHeader(sheet);
  autoWidth(sheet);
}

function writePaymentMethods(wb: ExcelJS.Workbook, payments: PaymentRow[]) {
  const sheet = wb.addWorksheet('Payment Methods');
  sheet.columns = [
    { header: 'Method', key: 'method' },
    { header: 'Txn Count', key: 'count' },
    { header: 'Amount', key: 'amount' },
    { header: 'Share (%)', key: 'share' },
  ];

  const total = sumNum(payments.map((p) => p.amount));
  const buckets = new Map<string, { count: number; amount: number }>();
  for (const p of payments) {
    const key = p.method?.toUpperCase() ?? 'OTHER';
    const e = buckets.get(key) ?? { count: 0, amount: 0 };
    e.count += 1;
    e.amount += Number(p.amount);
    buckets.set(key, e);
  }

  [...buckets.entries()]
    .sort(([, a], [, b]) => b.amount - a.amount)
    .forEach(([method, e]) =>
      sheet.addRow({
        method,
        count: e.count,
        amount: round2(e.amount),
        share: total ? Number(((e.amount / total) * 100).toFixed(2)) : 0,
      }),
    );

  styleHeader(sheet);
  autoWidth(sheet);
}

function writePeakHours(wb: ExcelJS.Workbook, orders: OrderRow[]) {
  const sheet = wb.addWorksheet('Peak Hours');
  sheet.columns = [
    { header: 'Hour (IST)', key: 'hour' },
    { header: 'Order Count', key: 'count' },
  ];

  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hour12: false,
  });
  const counts = new Array(24).fill(0);
  for (const row of orders) {
    if (!row.placed_at) continue;
    const h = Number(fmt.format(new Date(row.placed_at)));
    counts[h] += 1;
  }
  counts.forEach((count, hour) =>
    sheet.addRow({ hour: `${String(hour).padStart(2, '0')}:00`, count }),
  );

  styleHeader(sheet);
  autoWidth(sheet);
}

function writeRetention(wb: ExcelJS.Workbook, orders: OrderRow[]) {
  const sheet = wb.addWorksheet('Customer Retention');
  sheet.columns = [
    { header: 'Bucket', key: 'bucket' },
    { header: 'Count', key: 'count' },
  ];

  const customerIds = new Set<string>();
  let guestOrders = 0;
  for (const row of orders) {
    if (row.customer_id) customerIds.add(row.customer_id);
    else guestOrders += 1;
  }

  sheet.addRow({ bucket: 'Identified customers in range', count: customerIds.size });
  sheet.addRow({ bucket: 'Marketplace guest orders (no customer id)', count: guestOrders });

  styleHeader(sheet);
  autoWidth(sheet);
}

/* ========================================================================= */
/* Utilities                                                                 */
/* ========================================================================= */

function sumNum(values: Array<string | number | null | undefined>): number {
  let total = 0;
  for (const value of values) total += Number(value ?? 0);
  return total;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
