'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { KeyRound, LogOut, Settings, Shield, UserCircle2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useLang } from '@/context/lang-context';
import { cn } from '@/lib/cn';

function formatRole(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function UserAccountMenu() {
  const { user, role, signOut, loading } = useAuth();
  const { t, dir } = useLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      setOpen(false);
    }
  };

  const displayName = user.name?.trim() || user.email || '—';
  const email = user.email?.trim() || '';
  const avatarUrl = user.avatar?.trim();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('accountMenuAria')}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={loading}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border bg-surface text-secondary transition-colors hover:bg-[color:var(--surface-elevated)] hover:text-primary disabled:opacity-50 sm:h-11 sm:w-11"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote profile URLs (R2 / Supabase)
          <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <UserCircle2 className="h-5 w-5" />
        )}
      </button>

      {open ? (
        <div
          role="menu"
          dir={dir}
          className={cn(
            'absolute z-[100] mt-2 w-[min(calc(100vw-1.5rem),280px)] overflow-hidden rounded-2xl border p-1.5 shadow-lg',
            'end-0 top-full',
          )}
          style={{
            background: 'color-mix(in srgb, var(--surface) 94%, white 6%)',
            borderColor: 'var(--border)',
            boxShadow: '0 16px 40px rgba(15,23,42,0.16)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="border-b px-3 py-2.5" style={{ borderColor: 'var(--border)' }}>
            <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {displayName}
            </p>
            {email ? (
              <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                {email}
              </p>
            ) : null}
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              <span className="font-semibold">{t('userRole')}: </span>
              {formatRole(role)}
            </p>
          </div>

          <div className="py-1">
            <Link
              role="menuitem"
              href="/settings/profile"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-[color:var(--surface-elevated)]"
              style={{ color: 'var(--text)' }}
              onClick={() => setOpen(false)}
            >
              <Settings size={16} style={{ color: 'var(--accent)' }} />
              {t('settings')}
            </Link>
            <Link
              role="menuitem"
              href="/settings/password"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-[color:var(--surface-elevated)]"
              style={{ color: 'var(--text)' }}
              onClick={() => setOpen(false)}
            >
              <KeyRound size={16} style={{ color: 'var(--accent)' }} />
              {t('changePassword')}
            </Link>
            <Link
              role="menuitem"
              href="/security/sessions"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-[color:var(--surface-elevated)]"
              style={{ color: 'var(--text)' }}
              onClick={() => setOpen(false)}
            >
              <Shield size={16} style={{ color: 'var(--accent)' }} />
              {t('securitySessionsMenu')}
            </Link>
          </div>

          <div className="border-t pt-1" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-rose-500/10 disabled:opacity-50"
              style={{ color: '#b91c1c' }}
            >
              <LogOut size={16} />
              {signingOut ? t('signingOut') : t('logout')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
