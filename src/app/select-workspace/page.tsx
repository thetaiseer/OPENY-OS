'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { useTheme } from '@/lib/theme-context';
import { ArrowRight, Lock, Layers3, FolderKanban, Moon, Sun } from 'lucide-react';

export default function SelectWorkspacePage() {
  const { role, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isOwner = useMemo(() => role === 'owner', [role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:py-14"
      style={{
        background: 'radial-gradient(1000px 420px at 50% -20%, rgba(37,99,235,0.14), transparent 65%), var(--bg)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 sm:mb-10 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <OpenyLogo width={122} height={34} />
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'var(--surface)' }}>
              Platform
            </span>
          </div>
          <button
            onClick={toggleTheme}
            className="h-10 px-3 rounded-xl border inline-flex items-center gap-2 text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
          </button>
        </div>

        <div className="rounded-3xl border p-5 sm:p-8 lg:p-10 shadow-[0_16px_44px_-24px_rgba(15,23,42,0.35)]" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="max-w-3xl mb-7 sm:mb-9">
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>OPENY PLATFORM</p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mt-2 leading-tight" style={{ color: 'var(--text)' }}>Choose your workspace</h1>
            <p className="text-sm sm:text-base mt-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Access OPENY OS for operations and execution, or OPENY DOCS for private documentation workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
            <Link
              href="/os/dashboard"
              className="group rounded-2xl border p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(37,99,235,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-300"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-4 sm:mb-5" style={{ background: 'var(--accent-soft)' }}>
                <Layers3 size={22} style={{ color: 'var(--accent)' }} />
              </div>
              <h2 className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text)' }}>OPENY OS</h2>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Team operations workspace for clients, tasks, content, calendar, assets, and reporting.
              </p>
              <div className="mt-5 sm:mt-6 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                Enter OPENY OS <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>

            {isOwner ? (
              <Link
                href="/docs/dashboard"
                className="group rounded-2xl border p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-300"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-4 sm:mb-5" style={{ background: 'var(--surface-2)' }}>
                  <FolderKanban size={22} style={{ color: 'var(--accent)' }} />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text)' }}>OPENY DOCS</h2>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Owner-only documentation space for contracts, invoices, private notes, folders, and archive.
                </p>
                <div className="mt-5 sm:mt-6 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                  Enter OPENY DOCS <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ) : (
              <div className="rounded-2xl border p-5 sm:p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-4 sm:mb-5" style={{ background: 'var(--surface-2)' }}>
                  <Lock size={22} style={{ color: 'var(--text-secondary)' }} />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text)' }}>OPENY DOCS</h2>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  This workspace is available to owner role only. You currently have OPENY OS access.
                </p>
              </div>
            )}
          </div>

          <p className="text-xs sm:text-sm mt-7 text-center sm:text-left" style={{ color: 'var(--text-secondary)' }}>
            Need help choosing? OPENY OS is for operations. OPENY DOCS is for private business documentation.
          </p>
        </div>
      </div>
    </div>
  );
}
