import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { OWNER_EMAIL } from '@/lib/constants/auth';

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const params = await searchParams;
  const workspace = (params.workspace ?? '').toLowerCase();
  const workspaceLabel = workspace === 'docs' ? 'OPENY DOCS' : 'OPENY OS';
  const requestAccessHref = `mailto:${OWNER_EMAIL}?subject=OPENY%20Workspace%20Access%20Request`;

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-3xl border px-6 py-7 text-center shadow-[0_20px_50px_-32px_rgba(15,23,42,0.45)]"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'var(--surface-2)' }}
        >
          <ShieldAlert size={22} style={{ color: 'var(--accent)' }} />
        </div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
          Access denied
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          You do not have permission to access {workspaceLabel}. Please contact the workspace owner.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/?switch=1"
            className="inline-flex h-10 items-center rounded-xl border px-4 text-sm font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Back to workspaces
          </Link>
          <a
            href={requestAccessHref}
            className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
            style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            Request Access
          </a>
        </div>
      </div>
    </div>
  );
}
