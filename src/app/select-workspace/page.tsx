'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { ArrowRight, FolderKanban, Layers3, Lock, Moon, Sun } from 'lucide-react';

type WorkspaceCard = {
  key: 'os' | 'docs';
  title: string;
  subtitle: string;
  route: string;
  icon: ReactNode;
};

export default function SelectWorkspacePage() {
  const router = useRouter();
  const { user, loading, workspaceAccess, hasWorkspaceAccess } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [entering, setEntering] = useState<'os' | 'docs' | null>(null);

  const cards = useMemo<WorkspaceCard[]>(() => ([
    {
      key: 'os',
      title: 'OPENY OS',
      subtitle: 'Operations workspace for execution, delivery, and team workflows.',
      route: '/os/dashboard',
      icon: <Layers3 size={22} />,
    },
    {
      key: 'docs',
      title: 'OPENY DOCS',
      subtitle: 'Documentation workspace for contracts, records, and internal docs.',
      route: '/docs/dashboard',
      icon: <FolderKanban size={22} />,
    },
  ]), []);

  const isAuthenticated = Boolean(user.id && user.email);

  const handleEnter = (key: 'os' | 'docs', route: string) => {
    if (!isAuthenticated) {
      router.push(`/${key}/login?next=${encodeURIComponent(route)}`);
      return;
    }
    if (!hasWorkspaceAccess(key)) {
      router.push(`/access-denied?workspace=${key}`);
      return;
    }
    setEntering(key);
    router.push(route);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen px-4 py-6 sm:px-6 sm:py-10 transition-opacity duration-200 ${entering ? 'opacity-90' : 'opacity-100'}`}
      style={{ background: 'radial-gradient(860px 380px at 50% -10%, rgba(59,130,246,0.16), transparent 70%), var(--bg)' }}
    >
      <div className="max-w-5xl mx-auto min-h-[88vh] flex items-center justify-center">
        <div className="w-full rounded-[2rem] border px-5 py-6 sm:px-8 sm:py-9 lg:px-10 lg:py-10 shadow-[0_28px_70px_-44px_rgba(15,23,42,0.45)]" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-7 sm:mb-9">
            <div className="inline-flex items-center gap-3">
              <OpenyLogo width={118} height={34} />
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                Platform
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className="h-10 w-10 sm:w-auto sm:px-3 rounded-xl border inline-flex items-center justify-center sm:gap-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>

          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>OPENY WORKSPACES</p>
            <h1 className="text-3xl sm:text-4xl font-semibold mt-3 tracking-tight" style={{ color: 'var(--text)' }}>Choose your workspace</h1>
            <p className="text-sm sm:text-base mt-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Your account can access OPENY OS, OPENY DOCS, or both, based on explicit workspace permissions.
            </p>
          </div>

          <div className="mt-8 sm:mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {cards.map(card => {
              const allowed = hasWorkspaceAccess(card.key);
              const isEntering = entering === card.key;
              return (
                <button
                  key={card.key}
                  onClick={() => handleEnter(card.key, card.route)}
                  className={`group text-left rounded-2xl border p-5 sm:p-6 transition-all duration-200 ease-out ${
                    isEntering ? 'scale-[0.99] translate-y-0' : 'hover:-translate-y-0.5 hover:scale-[1.01]'
                  }`}
                  style={{
                    background: 'var(--surface)',
                    borderColor: allowed ? 'var(--border)' : 'rgba(148,163,184,0.45)',
                    boxShadow: allowed ? '0 20px 42px -36px rgba(37,99,235,0.8)' : 'none',
                    opacity: allowed ? 1 : 0.88,
                  }}
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: allowed ? 'var(--accent-soft)' : 'var(--surface-2)', color: allowed ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {allowed ? card.icon : <Lock size={20} />}
                  </div>
                  <h2 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>{card.title}</h2>
                  <p className="text-sm mt-2 leading-relaxed min-h-[40px]" style={{ color: 'var(--text-secondary)' }}>
                    {card.subtitle}
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: allowed ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {allowed ? `Enter ${card.title}` : 'No access yet'}
                    <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-xs sm:text-sm mt-7 text-center" style={{ color: 'var(--text-secondary)' }}>
            {workspaceAccess.isGlobalOwner
              ? 'Global owner access enabled for both workspaces.'
              : 'Workspace access is permission-based and can be granted independently for OPENY OS and OPENY DOCS.'}
          </p>
        </div>
      </div>
    </div>
  );
}
