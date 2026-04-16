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
  const [memberships, setMemberships] = useState<WorkspaceMembershipInfo[]>([]);
  const [ready, setReady] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const currentWorkspace = getCurrentWorkspace(pathname);

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

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  if (loading || !ready) return null;

  const canShow = canShowWorkspaceSwitcher(user.email, memberships);
  if (!canShow) return null;

  const isGlobalOwner = isGlobalOwnerEmail(user.email);
  const currentLabel = currentWorkspace === 'docs' ? 'OPENY DOCS' : 'OPENY OS';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="h-9 max-w-[126px] sm:max-w-none px-2.5 sm:px-3 rounded-lg border text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 sm:gap-2 transition-colors hover:bg-[var(--surface-2)]"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={currentLabel}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-secondary)' }} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 min-w-[180px] rounded-xl border shadow-lg overflow-hidden"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="py-1">
            {memberships.map(workspace => {
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
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-45"
                  style={{
                    color: isCurrent ? 'var(--accent)' : 'var(--text)',
                    background: isCurrent ? 'var(--accent-soft)' : 'transparent',
                    fontWeight: isCurrent ? 600 : 500,
                  }}
                >
                  <span className="truncate">{workspace.label}</span>
                  {isCurrent && <Check size={14} className="shrink-0" style={{ color: 'var(--accent)' }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
