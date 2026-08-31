'use client';

import { useEffect } from 'react';
import { Alert, Button, ButtonLink, Card } from '@/components/ui/primitives';

/**
 * Route-level error boundary (PRD 19).
 *
 * Two rules shape what this says. It offers a real retry, because most of what
 * fails here is a transient database or network call and reloading genuinely
 * fixes it. And it never claims the underlying action succeeded -- if a form
 * threw on the way to the server, the customer has to know the work did not
 * land.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The message is not shown to the user; the digest is what ties this
    // screen to the server log entry.
    console.error('[route error]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <Card className="p-8">
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          This page could not be loaded. Nothing you were doing has been saved, so it is safe to
          try again.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="secondary">Go to the home page</ButtonLink>
        </div>

        {error.digest ? (
          <div className="mt-6">
            <Alert tone="info">
              If you need to report this, the reference is{' '}
              <span className="font-mono">{error.digest}</span>.
            </Alert>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
