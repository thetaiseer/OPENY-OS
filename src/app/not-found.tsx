import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-6">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <h1 className="text-lg font-semibold text-[var(--text)]">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          The page you requested does not exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)]"
        >
          Go to home
        </Link>
      </div>
    </main>
  );
}
