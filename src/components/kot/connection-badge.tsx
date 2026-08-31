'use client';

import type { ConnectionState } from '@/lib/realtime/use-kot-board';
import { Badge, Spinner } from '@/components/ui/primitives';
import { timeOnly } from '@/lib/format';

/**
 * States the realtime connection plainly (PRD 11, PRD 19).
 *
 * A board that has quietly stopped updating is worse than one that says it has
 * stopped, so "reconnecting" and "offline" are shown as prominently as "live".
 */
export function ConnectionBadge({
  state,
  lastSyncedAt,
}: {
  state: ConnectionState;
  lastSyncedAt: Date | null;
}) {
  if (state === 'live') {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
          Live
        </Badge>
      </div>
    );
  }

  if (state === 'connecting') {
    return (
      <Badge tone="neutral">
        <Spinner className="h-3 w-3" />
        Connecting
      </Badge>
    );
  }

  if (state === 'reconnecting') {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="warning">
          <Spinner className="h-3 w-3" />
          Reconnecting
        </Badge>
        {lastSyncedAt ? (
          <span className="text-xs text-subtle">last update {timeOnly(lastSyncedAt)}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge tone="danger">Offline</Badge>
      <span className="text-xs text-danger">
        This board is not updating. Do not rely on it.
      </span>
    </div>
  );
}
