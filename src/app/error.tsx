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
    console.error('[global-error-boundary]', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <h1 className="text-lg font-semibold text-[var(--text)]">Something went wrong</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          We hit an unexpected error while rendering this page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
