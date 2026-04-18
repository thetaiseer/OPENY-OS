'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { User, KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface AccountMenuProps {
  placement: 'header' | 'sidebar';
  children: React.ReactNode;
  panelClassName?: string;
  menuContent?: (helpers: { closeMenu: () => void }) => React.ReactNode;
}

export default function AccountMenu({ placement, children, panelClassName, menuContent }: AccountMenuProps) {
  const { user, role, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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

  async function handleSignOut() {
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOut();
    } catch (error: unknown) {
      setSignOutError(error instanceof Error ? error.message : 'Sign out failed');
      setSigningOut(false);
    }
  }

  const placementClass = placement === 'header' ? 'right-0 top-full mt-2' : 'left-0 bottom-full mb-2';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {children}
      </button>

      {open ? (
        <div role="menu" className={`openy-menu-panel absolute z-50 min-w-[240px] overflow-visible rounded-2xl ${placementClass} ${panelClassName ?? ''}`}>
          {menuContent ? (
            <div className="max-h-[42vh] overflow-y-auto border-b p-2.5" style={{ borderColor: 'var(--border)' }}>
              {menuContent({ closeMenu: () => setOpen(false) })}
            </div>
          ) : null}
          <div className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
            {loading ? (
              <p className="text-xs text-[var(--text-secondary)]">Loading account…</p>
            ) : (
              <>
                <p className="truncate text-sm font-semibold">{user.name || user.email}</p>
                <p className="truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
                <span className="mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  {role}
                </span>
              </>
            )}
          </div>

          <div className="py-1.5">
            <Link href="/account" onClick={() => setOpen(false)} className="openy-menu-item flex items-center gap-2 px-3 py-2 text-sm">
              <User size={14} /> Account Settings
            </Link>
            <Link href="/change-password" onClick={() => setOpen(false)} className="openy-menu-item flex items-center gap-2 px-3 py-2 text-sm">
              <KeyRound size={14} /> Change Password
            </Link>
          </div>

          {signOutError ? (
            <div className="mx-3 mb-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--color-danger-border)', color: 'var(--color-danger)' }}>
              {signOutError}
            </div>
          ) : null}

          <div className="border-t p-1.5" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="openy-menu-item flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
              style={{ color: 'var(--color-danger)' }}
            >
              <LogOut size={14} /> {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
