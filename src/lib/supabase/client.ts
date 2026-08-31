'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

/**
 * Browser client. Holds the anon key only.
 *
 * Used for realtime subscriptions on the operational screens; the same RLS
 * policies that govern reads govern which change events reach this client, so
 * a Kitchen session receives ticket changes and nothing else (PRD 11).
 */
let client: ReturnType<typeof createBrowserClient> | null = null;

export function browserClient() {
  if (!client) {
    client = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  }
  return client;
}
