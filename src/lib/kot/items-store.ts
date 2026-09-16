'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { browserClient } from '@/lib/supabase/client';
import { loadTicketItems, type ItemsByOrder, type TicketItem } from './items';

/**
 * A client-side cache of ticket items, shared by every board on the page.
 *
 * Items are immutable once an order exists (see `items.ts`), so a line read
 * once is good for the life of the tab. The store holds them keyed by order,
 * coalesces every request made within a frame into one batched read, and
 * survives client-side navigation between the manager and kitchen screens --
 * a ticket already seen on one costs nothing on the other.
 *
 * It is a module rather than a context so the server-rendered board can seed
 * it before the first client render (`primeTicketItems`), and so the realtime
 * hook can ask for a new ticket's items the moment the ticket arrives, without
 * waiting for the card to mount first.
 */

const cache = new Map<string, TicketItem[]>();
const listeners = new Set<() => void>();
const inflight = new Set<string>();
let pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let version = 0;
let failures = 0;

/**
 * Enough for a fortnight of a busy kitchen left open on one tab. Past it the
 * oldest entries go; a Map iterates in insertion order, which is old-to-new.
 */
const MAX_CACHED_ORDERS = 3000;

/** Requests made within this window go out as one read. */
const COALESCE_MS = 30;

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): number {
  return version;
}

function trim(): void {
  if (cache.size <= MAX_CACHED_ORDERS) return;
  const excess = cache.size - MAX_CACHED_ORDERS;
  let removed = 0;
  for (const key of cache.keys()) {
    if (removed >= excess) break;
    cache.delete(key);
    removed += 1;
  }
}

/**
 * Seeds the cache with rows the server already read. Idempotent, and it never
 * overwrites: the first copy of an order's lines is as good as any later one.
 * It does not notify -- it runs during a render, before anything has
 * subscribed, and a subscriber that mounts afterwards reads the cache anyway.
 */
export function primeTicketItems(items: ItemsByOrder): void {
  for (const [orderId, rows] of items) {
    if (!cache.has(orderId)) cache.set(orderId, rows);
  }
  trim();
}

/** Asks for whichever of these orders are not yet known. */
export function requestTicketItems(orderIds: Iterable<string>): void {
  for (const id of orderIds) {
    if (!cache.has(id) && !inflight.has(id)) pending.add(id);
  }
  if (pending.size > 0 && timer === null) timer = setTimeout(flush, COALESCE_MS);
}

async function flush(): Promise<void> {
  timer = null;
  const ids = [...pending];
  pending = new Set();
  if (ids.length === 0) return;

  for (const id of ids) inflight.add(id);

  try {
    const loaded = await loadTicketItems(browserClient(), ids);
    for (const [orderId, rows] of loaded) cache.set(orderId, rows);
    trim();
    failures = 0;
  } catch {
    // A read that failed is retried, and keeps being retried, because a
    // kitchen display has to recover from a dropped connection on its own.
    // The wait doubles each time and is capped at half a minute, so a long
    // outage is not a request storm when the network returns.
    failures += 1;
    for (const id of ids) pending.add(id);
    timer = setTimeout(flush, Math.min(30_000, 1000 * 2 ** failures));
  } finally {
    for (const id of ids) inflight.delete(id);
    notify();
  }
}

/** The items for one order: an array once known, `undefined` while a read is on its way. */
export function itemsFor(orderId: string): TicketItem[] | undefined {
  return cache.get(orderId);
}

/**
 * Subscribes a component to the store and requests whatever it is missing.
 *
 * Returns the current version, which changes whenever a read lands, so a
 * component that calls this and then reads `itemsFor` re-renders with the new
 * lines. The array identity of `orderIds` changes every render; only the
 * contents drive the request.
 */
export function useTicketItems(orderIds: readonly string[]): number {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  const key = orderIds.join(',');

  useEffect(() => {
    if (key) requestTicketItems(key.split(','));
  }, [key]);

  return current;
}
