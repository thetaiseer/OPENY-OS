'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--danger-soft)]">
        <svg
          className="h-6 w-6 text-[color:var(--destructive)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
          Something went wrong
        </h2>
        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
          Something went wrong. Please retry.
        </p>
        {error.digest && (
          <p className="text-[color:var(--text-secondary)]/80 mt-1 font-mono text-xs">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-[color:var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
