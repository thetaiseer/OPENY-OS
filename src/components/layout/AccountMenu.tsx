'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { User as UserIcon, KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface AccountMenuProps {
  /**
   * 'header'  — dropdown opens below and aligns to the right (top-right avatar)
   * 'sidebar' — dropdown opens above and aligns to the left (bottom-left sidebar area)
   */
  placement: 'header' | 'sidebar';
  children: React.ReactNode;
}

export default function AccountMenu({ placement, children }: AccountMenuProps) {
  const { user, role, loading, signOut } = useAuth();
  const [open, setOpen]           = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open]);

  async function handleSignOut() {
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOut();
      // signOut in auth-context redirects to /login on success
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign out failed';
      setSignOutError(message);
      setSigningOut(false);
    }
  }

  const dropdownPositionClass =
    placement === 'header'
      ? 'right-0 top-full mt-2'
      : 'left-0 bottom-full mb-2';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg"
        aria-expanded={open}
        aria-haspopup="menu"
        type="button"
      >
        {children}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute ${dropdownPositionClass} z-50 min-w-[230px] rounded-xl border shadow-lg overflow-hidden`}
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {/* User info header */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full animate-pulse" style={{ background: 'var(--surface-2)' }} />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 rounded animate-pulse w-24" style={{ background: 'var(--surface-2)' }} />
                  <div className="h-2.5 rounded animate-pulse w-32" style={{ background: 'var(--surface-2)' }} />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: 'var(--accent)' }}
                >
                  {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                    {user.name || user.email}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {user.email}
                  </p>
                  <span
                    className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-xs font-semibold capitalize"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    {role}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text)' }}
            >
              <UserIcon size={15} className="shrink-0" style={{ color: 'var(--text-secondary)' }} />
              Account Settings
            </Link>
            <Link
              href="/change-password"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text)' }}
            >
              <KeyRound size={15} className="shrink-0" style={{ color: 'var(--text-secondary)' }} />
              Change Password
            </Link>
          </div>

          {/* Sign out error toast */}
          {signOutError && (
            <div
              className="mx-3 mb-2 px-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              {signOutError}
            </div>
          )}

          <div className="border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50"
              style={{ color: '#ef4444' }}
            >
              <LogOut size={15} className="shrink-0" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

