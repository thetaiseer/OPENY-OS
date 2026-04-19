'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import {
  canShowWorkspaceSwitcher,
  getCurrentWorkspace,
  getUserWorkspaceMemberships,
  switchWorkspace,
  type WorkspaceMembershipInfo,
} from '@/lib/workspace-switcher';
import { isGlobalOwnerEmail } from '@/lib/workspace-access';

export default function WorkspaceSwitcher() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [memberships, setMemberships] = useState<WorkspaceMembershipInfo[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const currentWorkspace = getCurrentWorkspace(pathname);

  useEffect(() => {
    if (!user.id) {
      setReady(true);
      setMemberships([]);
      return;
    }

    let mounted = true;
    setReady(false);

    getUserWorkspaceMemberships(supabase, user.id)
      .then((data) => {
        if (!mounted) return;
        setMemberships(data);
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setMemberships([]);
        setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [supabase, user.id]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  if (loading || !ready) return null;
  if (!canShowWorkspaceSwitcher(user.email, memberships)) return null;

  const isGlobalOwner = isGlobalOwnerEmail(user.email);
  const currentLabel = currentWorkspace === 'docs' ? 'OPENY DOCS' : 'OPENY OS';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors hover:bg-[var(--surface-2)]"
        style={{ color: 'var(--text-primary)' }}
        onClick={() => setOpen(value => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown size={13} className={open ? 'rotate-180 transition-transform shrink-0' : 'transition-transform shrink-0'} style={{ color: 'var(--text-secondary)' }} />
      </button>

      {open ? (
        <div role="menu" className="workspace-switcher-menu openy-menu-panel absolute right-0 top-full z-50 mt-2 rounded-2xl p-1.5">
          {memberships.map((workspace) => {
            const isCurrent = workspace.key === currentWorkspace;
            const canAccess = isGlobalOwner || workspace.hasMembership;
            return (
              <button
                key={workspace.key}
                type="button"
                role="menuitem"
                disabled={!canAccess}
                onClick={() => {
                  if (isCurrent) return;
                  setOpen(false);
                  switchWorkspace(router, workspace.key);
                }}
                className={`openy-menu-item flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm ${isCurrent ? 'openy-menu-item-active' : ''}`}
                style={{ opacity: canAccess ? 1 : 0.45 }}
              >
                <span className="truncate">{workspace.label}</span>
                {isCurrent ? <Check size={14} style={{ color: 'var(--accent)' }} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
