'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, Moon, Sun } from 'lucide-react';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-context';
import { useTheme } from '@/lib/theme-context';
import {
  persistSelectedWorkspace,
  readSelectedWorkspace,
  redirectToWorkspace,
  resolveWorkspaceKey,
} from '@/lib/auth-workspace';
import {
  isGlobalOwnerEmail,
  normalizeWorkspaceKey,
  type WorkspaceKey,
} from '@/lib/workspace-access';

const NO_WORKSPACE_MESSAGE = 'You don’t have access to any workspace yet';
type WorkspaceMembershipRow = { workspace_key: string | null };

export default function OfficialAuthLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  const nextPath = searchParams.get('next');
  const requestedWorkspace = resolveWorkspaceKey(searchParams.get('workspace') ?? '');
  const isSwitchMode = searchParams.get('switch') === '1';

  const loadAssignedWorkspaces = useCallback(
    async (userId: string, userEmail: string | null | undefined): Promise<WorkspaceKey[]> => {
      if (isGlobalOwnerEmail(userEmail)) return ['os', 'docs'];

      const query = await supabase
        .from('workspace_memberships')
        .select('workspace_key')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (query.error) {
        throw new Error('Failed to load workspace memberships');
      }

      const rows = (query.data ?? []) as WorkspaceMembershipRow[];
      const keys = rows
        .map(row => normalizeWorkspaceKey(row.workspace_key))
        .filter((v): v is WorkspaceKey => Boolean(v));

      return [...new Set(keys)];
    },
    [supabase],
  );

  const finalizeAuth = useCallback(
    async (
      userId: string,
      userEmail: string | null | undefined,
      preferredWorkspace: WorkspaceKey | null,
      successToast: boolean,
    ) => {
      try {
        const assignedWorkspaces = await loadAssignedWorkspaces(userId, userEmail);
        if (assignedWorkspaces.length === 0) {
          setAccessMessage(NO_WORKSPACE_MESSAGE);
          toast(NO_WORKSPACE_MESSAGE, 'error', 6000);
          await supabase.auth.signOut();
          return;
        }

        const requested = requestedWorkspace ?? preferredWorkspace;
        const targetWorkspace =
          (requested && assignedWorkspaces.includes(requested) ? requested : null) ??
          assignedWorkspaces[0];

        persistSelectedWorkspace(targetWorkspace);
        setAccessMessage(null);
        if (successToast) {
          toast('Signed in successfully.', 'success');
        }
        redirectToWorkspace(router, targetWorkspace, nextPath);
      } catch (error) {
        console.error('[auth] Failed to finalize workspace access after sign-in:', error);
        const message = 'Unable to load your workspace access right now. Please try again.';
        setAccessMessage(message);
        toast(message, 'error');
      }
    },
    [loadAssignedWorkspaces, nextPath, requestedWorkspace, router, supabase.auth, toast],
  );

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!session || isSwitchMode) {
        setCheckingSession(false);
        return;
      }

      await finalizeAuth(
        session.user.id,
        session.user.email,
        readSelectedWorkspace(),
        false,
      );

      if (mounted) {
        setCheckingSession(false);
      }
    };

    void run();
    return () => { mounted = false; };
  }, [finalizeAuth, isSwitchMode, nextPath, requestedWorkspace, router, supabase]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAccessMessage(null);

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      await fetch('/api/auth/sessions', { method: 'POST', credentials: 'include' }).catch(() => null);
      await finalizeAuth(
        data.user.id,
        data.user.email,
        readSelectedWorkspace(),
        true,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network or server error. Please try again.';
      setFormError(message);
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = 'Sign In';

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(900px 420px at 50% -10%, rgba(59,130,246,0.22), transparent 68%), var(--bg)' }}>
        <Loader2 size={26} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:px-8"
      style={{ background: 'radial-gradient(900px 420px at 50% -10%, rgba(59,130,246,0.22), transparent 68%), var(--bg)' }}
    >
      <div className="mx-auto w-full max-w-6xl min-h-[88vh] flex items-center">
        <section
          className="w-full overflow-hidden rounded-[2rem] border shadow-[0_45px_90px_-52px_rgba(30,64,175,0.5)]"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between p-5 sm:p-6 lg:p-7 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <OpenyLogo width={128} height={36} />
              <span className="hidden sm:inline-flex text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                Official Authentication
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className="h-10 px-3 rounded-xl border inline-flex items-center justify-center gap-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="relative p-5 sm:p-7 lg:p-9 transition-all duration-500">
              <div className="max-w-md mx-auto w-full">
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>
                  Sign In
                </p>
                <h1 className="text-3xl font-semibold mt-2 tracking-tight" style={{ color: 'var(--text)' }}>
                  Access your workspace
                </h1>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Sign in with your assigned account. Workspace access is loaded automatically based on your membership.
                </p>

                <form onSubmit={submit} className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="w-full h-11 rounded-xl px-3 text-sm outline-none transition-all focus:ring-2"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Password</label>
                      <Link href="/forgot-password" className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>
                        Forgot password?
                      </Link>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="w-full h-11 rounded-xl px-3 text-sm outline-none transition-all focus:ring-2"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    />
                  </div>

                  {(formError || accessMessage) && (
                    <div
                      className="rounded-xl px-3 py-2 text-sm whitespace-pre-line"
                      style={{
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.28)',
                        color: '#ef4444',
                      }}
                    >
                      {formError ?? accessMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl font-semibold text-sm text-white inline-flex items-center justify-center gap-2 transition-all disabled:opacity-70 hover:translate-y-[-1px]"
                    style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 45%, #8b5cf6 100%)' }}
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? 'Please wait…' : submitLabel}
                  </button>
                </form>
              </div>
            </div>

            <div
              className="relative p-6 sm:p-8 lg:p-10 transition-all duration-500"
              style={{
                background: 'linear-gradient(145deg, rgba(59,130,246,0.94) 0%, rgba(99,102,241,0.94) 46%, rgba(139,92,246,0.9) 100%)',
              }}
            >
              <div className="relative z-10 h-full flex flex-col justify-between gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/80">OPENY Platform</p>
                  <h2 className="text-3xl sm:text-4xl font-semibold mt-2 text-white leading-tight">Welcome back to OPENY</h2>
                  <p className="text-sm sm:text-base mt-3 text-white/90 max-w-md">
                    Access is provided by your organization administrator.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-white/35 bg-white/10 px-4 py-3">
                    <p className="text-sm text-white font-medium">Contact your workspace admin to get access.</p>
                  </div>
                  <p className="text-xs text-white/80 flex items-center gap-2">
                    <Lock size={12} />
                    One secure session. Workspace access is validated per membership.
                  </p>
                </div>
              </div>
              <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(560px 260px at 80% 10%, rgba(255,255,255,0.35), transparent 65%)' }} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
