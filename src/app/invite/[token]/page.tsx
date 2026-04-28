import Link from 'next/link';
import { getServiceClient } from '@/lib/supabase/service-client';

type PageProps = { params: Promise<{ token: string }> };

export default async function InviteTokenPage({ params }: PageProps) {
  const { token } = await params;
  const normalizedToken = decodeURIComponent(token).trim();
  const db = getServiceClient();

  const { data: invitation } = await db
    .from('invitations')
    .select('email, role, status, expires_at, workspace:workspaces(name)')
    .eq('token', normalizedToken)
    .maybeSingle();

  const workspaceValue = (
    invitation as { workspace?: { name?: string } | Array<{ name?: string }> }
  )?.workspace;

  const notFound = !invitation;
  const expired = invitation ? new Date(invitation.expires_at).getTime() <= Date.now() : false;
  const accepted = invitation ? invitation.status === 'accepted' : false;
  const invalid = notFound || expired || accepted || invitation?.status !== 'pending';
  const workspaceName =
    (Array.isArray(workspaceValue) ? workspaceValue[0]?.name : workspaceValue?.name) ?? 'OPENY';

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-lg">
        <h1 className="text-xl font-semibold text-primary">OPENY Invitation</h1>
        {invalid ? (
          <div className="mt-3 space-y-4">
            <p className="text-sm text-secondary">
              {notFound
                ? 'Invalid invitation token.'
                : expired
                  ? 'This invitation has expired.'
                  : accepted
                    ? 'This invitation was already accepted.'
                    : 'This invitation is no longer active.'}
            </p>
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-primary"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <p className="text-sm text-secondary">
              You are invited to join <strong>{workspaceName}</strong> as{' '}
              <strong>{invitation.role}</strong>.
            </p>
            <p className="text-sm text-secondary">
              Continue to sign in with <strong>{invitation.email}</strong>, then accept this
              invitation.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/?next=${encodeURIComponent(`/invite/${normalizedToken}`)}`}
                className="inline-flex h-10 items-center rounded-lg bg-[color:var(--accent)] px-4 text-sm font-semibold text-white"
              >
                Continue with email login
              </Link>
              <Link
                href={`/invite/accept?token=${encodeURIComponent(normalizedToken)}`}
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-primary"
              >
                Open accept invitation
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
