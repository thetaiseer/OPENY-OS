import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import InfoCallout from '@/components/ui/InfoCallout';
import { OWNER_EMAIL } from '@/lib/constants/auth';

export default async function AccessDeniedPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const params = await searchParams;
  const workspace = (params.workspace ?? '').toLowerCase();
  const workspaceLabel = workspace === 'docs' ? 'OPENY DOCS' : 'OPENY OS';
  const requestAccessHref = `mailto:${OWNER_EMAIL}?subject=OPENY%20Workspace%20Access%20Request`;

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
      <div
        className="w-full max-w-md rounded-3xl border px-6 py-7 text-center space-y-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <InfoCallout
          icon={<ShieldAlert size={16} style={{ color: 'var(--accent)' }} />}
          title="Access"
          body={`You do not have permission to access ${workspaceLabel}. Please contact the workspace owner.`}
          className="text-left"
        />
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/?switch=1"
            className="h-10 px-4 rounded-xl border inline-flex items-center text-sm font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Back to workspaces
          </Link>
          <a
            href={requestAccessHref}
            className="h-10 px-4 rounded-xl inline-flex items-center text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Request Access
          </a>
        </div>
      </div>
    </div>
  );
}
