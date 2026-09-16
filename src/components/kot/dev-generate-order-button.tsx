'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/primitives';

/**
 * Dev-only helper rendered in the KOT manager header when SHOW_DEV_TOOLS=true.
 * Creates a fresh marketplace order with placed_at=now() so the live board has
 * a realistic ticket to walk through in local / preview testing.
 *
 * Kept intentionally small and outline-styled so it is never mistaken for an
 * operational button.
 */
export function DevGenerateOrderButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/dev/generate-test-order', { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? 'Could not create test order');
        return;
      }
      // The realtime subscription surfaces the new ticket on its own. The
      // board's state lives in the client now, so a server refresh would
      // re-run the whole page render and change nothing on screen.
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={generate}
        title="Dev: creates a fresh Swiggy or Zomato ticket via ingest_marketplace_order"
      >
        {busy ? 'Creating…' : '+ Test order'}
      </Button>
    </div>
  );
}
