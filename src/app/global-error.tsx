'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global error boundary]', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center font-sans">
          <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">Application Error</h1>
          <p className="text-[color:var(--text-secondary)]">Something went wrong. Please retry.</p>
          {error.digest && (
            <p className="text-[color:var(--text-secondary)]/80 font-mono text-xs">
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: 'var(--text-primary)',
              color: 'var(--accent-foreground)',
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
