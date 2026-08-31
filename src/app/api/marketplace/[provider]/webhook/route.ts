import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';
import { marketplaceAdapter, type MarketplaceProvider } from '@/lib/marketplace';

/**
 * Inbound marketplace webhook (PRD 16).
 *
 * Order of operations matters here:
 *
 *   1. Read the **raw** body. Parsing first would change the bytes the
 *      signature was computed over.
 *   2. Verify the signature. An unverified payload is rejected outright -- we
 *      never ingest an order because something claimed to be Swiggy.
 *   3. Hand it to the ingestion RPC, which is idempotent on the provider's own
 *      event and order ids, so replays are harmless.
 *
 * A failure on one provider's endpoint has no effect on the other, or on the
 * website: they share nothing but the KOT they eventually write to.
 */
export async function POST(request: Request, context: RouteContext<'/api/marketplace/[provider]/webhook'>) {
  const { provider } = await context.params;

  if (provider !== 'swiggy' && provider !== 'zomato') {
    return NextResponse.json({ error: 'Unknown marketplace' }, { status: 404 });
  }

  const rawBody = await request.text();
  const adapter = marketplaceAdapter(provider as MarketplaceProvider);
  const result = await adapter.verifyWebhook(rawBody, request.headers);

  if (!result.signatureValid) {
    // Recorded so a misconfigured or hostile sender is visible to the Owner,
    // then refused.
    await adminClient()
      .from('integration_events')
      .insert({
        provider,
        direction: 'inbound',
        event_type: 'webhook.rejected',
        payload: { reason: result.reason },
        signature_valid: false,
        status: 'failed',
        error: result.reason ?? 'Signature verification failed',
      });

    return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
  }

  const db = adminClient();

  try {
    if (result.kind === 'order.new' && result.order) {
      const order = result.order;

      const { data, error } = await db.rpc('ingest_marketplace_order', {
        p_provider: provider,
        p_external_order_id: order.externalOrderId,
        p_items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          product_id: item.productId ?? null,
          instructions: item.instructions ?? null,
        })),
        p_totals: {
          subtotal: order.totals.subtotal,
          discount_total: order.totals.discountTotal ?? 0,
          delivery_fee: order.totals.deliveryFee ?? 0,
          tax_total: order.totals.taxTotal ?? 0,
          grand_total: order.totals.grandTotal,
        },
        p_customer: {
          name: order.customer.name ?? null,
          phone: order.customer.phone ?? null,
          address: order.customer.address ?? null,
          delivery_instructions: order.customer.deliveryInstructions ?? null,
        },
        p_payload: order.raw,
        p_external_event_id: order.externalEventId ?? null,
        p_placed_at: order.placedAt,
      });

      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    if ((result.kind === 'order.status' || result.kind === 'order.cancelled') && result.statusUpdate) {
      const update = result.statusUpdate;

      const { data, error } = await db.rpc('sync_marketplace_order_status', {
        p_provider: provider,
        p_external_order_id: update.externalOrderId,
        p_external_status: update.status,
        p_external_event_id: update.externalEventId ?? null,
        p_payload: JSON.parse(rawBody),
      });

      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    // Verified, but not something we act on. Recorded rather than discarded.
    await db.from('integration_events').insert({
      provider,
      direction: 'inbound',
      event_type: 'webhook.unhandled',
      payload: JSON.parse(rawBody),
      signature_valid: true,
      status: 'ignored',
    });

    return NextResponse.json({ handled: false, reason: result.reason ?? 'Unrecognised event' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ingestion failed';

    // Trips this provider's breaker only.
    await db.rpc('record_integration_failure', { p_provider: provider, p_error: message });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
