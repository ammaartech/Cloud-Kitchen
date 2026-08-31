'use client';

/**
 * Last-resort boundary: catches a failure in the root layout itself, when even
 * the shell could not render. It has to supply its own <html> and <body>, and
 * it deliberately depends on nothing -- no fonts, no design tokens, no shared
 * components -- because whatever broke may be one of those.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: '#fafaf9',
          color: '#1c1917',
        }}
      >
        <main style={{ maxWidth: '32rem', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>The site failed to load</h1>
          <p style={{ marginTop: '0.75rem', color: '#57534e', fontSize: '0.875rem' }}>
            Something went wrong before the page could be built. Reloading usually clears it.
          </p>

          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.625rem 1.25rem',
              border: 0,
              borderRadius: '0.5rem',
              background: '#1c1917',
              color: 'white',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>

          {error.digest ? (
            <p style={{ marginTop: '1.5rem', color: '#78716c', fontSize: '0.75rem' }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
