'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/auth-context';
import {
  getCurrentWorkspace,
  getUserWorkspaceMemberships,
  switchWorkspace,
} from '@/lib/workspace-switcher';
import { isGlobalOwnerEmail } from '@/lib/workspace-access';

export default function WorkspaceSwitcher() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [memberships, setMemberships] = useState<Array<{ key: 'os' | 'docs'; label: 'OPENY OS' | 'OPENY DOCS'; hasMembership: boolean }>>([]);
  const [ready, setReady] = useState(false);

  const currentWorkspace = getCurrentWorkspace(pathname);
  const isGlobalOwner = isGlobalOwnerEmail(user.email);

  useEffect(() => {
    if (!user.id) {
      setMemberships([]);
      setReady(true);
      return;
    }

    let mounted = true;
    setReady(false);
    getUserWorkspaceMemberships(supabase, user.id)
      .then(data => {
        if (!mounted) return;
        setMemberships(data);
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        console.warn('[workspace-switcher] Failed to load workspace memberships');
        setMemberships([]);
        setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [supabase, user.id]);

  const access: Record<'os' | 'docs', boolean> = { os: isGlobalOwner, docs: isGlobalOwner };
  memberships.forEach((membership) => {
    access[membership.key] = isGlobalOwner || membership.hasMembership;
  });

  if (loading || !ready) return null;

  return (
    <div
      className="h-10 rounded-full border p-1 inline-flex items-center gap-1"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface-shell)',
        backdropFilter: 'var(--blur-glass)',
        WebkitBackdropFilter: 'var(--blur-glass)',
        boxShadow: 'var(--shadow-xs)',
      }}
      aria-label="Workspace switch"
    >
      {([
        { key: 'os', label: 'OPENY OS' },
        { key: 'docs', label: 'OPENY DOCS' },
      ] as const).map((workspace) => {
        const isCurrent = workspace.key === currentWorkspace;
        const canAccess = access[workspace.key];
        return (
          <button
            key={workspace.key}
            type="button"
            disabled={!canAccess}
            onClick={() => {
              if (isCurrent || !canAccess) return;
              document.documentElement.classList.add('workspace-switching');
              switchWorkspace(router, workspace.key);
            }}
            className="h-7 px-2.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all disabled:opacity-45 disabled:cursor-not-allowed"
            style={{
              background: isCurrent
                ? 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 75%, var(--accent-3)) 100%)'
                : 'var(--surface-2)',
              color: isCurrent ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${isCurrent ? 'transparent' : 'var(--border)'}`,
              boxShadow: isCurrent ? 'var(--glow-accent-sm)' : 'var(--highlight-inset)',
            }}
            title={canAccess ? `Go to ${workspace.label}` : `No access to ${workspace.label}`}
            aria-current={isCurrent ? 'page' : undefined}
          >
            {workspace.label}
          </button>
        );
      })}
    </div>
  );
}
