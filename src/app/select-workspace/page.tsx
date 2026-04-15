'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ArrowRight, Lock, Layers3, FolderKanban } from 'lucide-react';

export default function SelectWorkspacePage() {
  const { role, loading } = useAuth();
  const isOwner = useMemo(() => role === 'owner', [role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10" style={{ background: 'var(--bg)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>OPENY PLATFORM</p>
          <h1 className="text-3xl sm:text-4xl font-semibold mt-2" style={{ color: 'var(--text)' }}>Choose your workspace</h1>
          <p className="text-sm mt-3 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            Enter OPENY OS for operations or OPENY DOCS for the private documentation environment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Link
            href="/os/dashboard"
            className="group rounded-3xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'var(--accent-soft)' }}>
              <Layers3 size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>OPENY OS</h2>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              Operational, team-oriented workspace for delivery, clients, tasks, reports, and execution.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>
              Enter OPENY OS <ArrowRight size={15} />
            </div>
          </Link>

          {isOwner ? (
            <Link
              href="/docs/dashboard"
              className="group rounded-3xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'var(--surface-2)' }}>
                <FolderKanban size={22} style={{ color: 'var(--accent)' }} />
              </div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>OPENY DOCS</h2>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                Private, focused documentation space for owner-only notes, documents, folders, archive, and settings.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>
                Enter OPENY DOCS <ArrowRight size={15} />
              </div>
            </Link>
          ) : (
            <div className="rounded-3xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'var(--surface-2)' }}>
                <Lock size={22} style={{ color: 'var(--text-secondary)' }} />
              </div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>OPENY DOCS</h2>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                Owner-only private environment. Your role grants access to OPENY OS only.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
