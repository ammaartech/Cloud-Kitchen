import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';

/**
 * Dev-only: conjure a fresh marketplace ticket with placed_at = now() so the
 * live board has something recent to work with. Guarded by SHOW_DEV_TOOLS
 * (same posture as SHOW_DEMO_ACCOUNTS) rather than NODE_ENV, because deployed
 * previews run NODE_ENV='production' but still want dev affordances.
 *
 * The endpoint routes the fake order through the same `ingest_marketplace_order`
 * RPC that real Swiggy / Zomato webhooks hit, so the resulting ticket is
 * indistinguishable from a real one on the board.
 */
export async function POST(request: Request) {
  const env = serverEnv();
  if (env.SHOW_DEV_TOOLS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const sourceParam = url.searchParams.get('source');
  const provider: 'swiggy' | 'zomato' =
    sourceParam === 'SW' ? 'swiggy' :
    sourceParam === 'ZM' ? 'zomato' :
    Math.random() < 0.5 ? 'swiggy' : 'zomato';

  const db = adminClient();

  const { data: products, error: productError } = await db
    .from('products')
    .select('id, name, base_price')
    .eq('is_available', true)
    .eq('is_published', true)
    .limit(50);

  if (productError || !products || products.length === 0) {
    return NextResponse.json(
      { error: productError?.message ?? 'No published products to seed from' },
      { status: 500 },
    );
  }

  const product = products[Math.floor(Math.random() * products.length)] as {
    id: string;
    name: string;
    base_price: number | string;
  };
  const quantity = 1 + Math.floor(Math.random() * 2);
  const unitPrice = Number(product.base_price);
  const subtotal = unitPrice * quantity;
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const grand = Math.round((subtotal + tax) * 100) / 100;

  const now = new Date();
  const externalOrderId = `TEST-${provider.slice(0, 2).toUpperCase()}-${now.getTime()}`;

  const { data, error } = await db.rpc('ingest_marketplace_order', {
    p_provider: provider,
    p_external_order_id: externalOrderId,
    p_items: [
      {
        product_id: product.id,
        name: product.name,
        quantity,
        unit_price: unitPrice,
      },
    ],
    p_totals: {
      subtotal,
      delivery_fee: 0,
      tax_total: tax,
      grand_total: grand,
    },
    p_customer: {
      name: 'Test Customer',
      phone: '+919820000000',
    },
    p_payload: { status: 'placed', dev: true },
    p_external_event_id: `${externalOrderId}-EVT-1`,
    p_placed_at: now.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    provider,
    externalOrderId,
    result: data,
  });
}
