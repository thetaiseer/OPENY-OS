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
          <h1 className="text-2xl font-bold text-gray-900">Application Error</h1>
          <p className="text-gray-500">
            {error.message || 'A critical error occurred. Please refresh the page.'}
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-gray-400">Error ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{
              background: '#2563eb',
              color: '#fff',
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
