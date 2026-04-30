'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, Moon, Sun } from 'lucide-react';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { openyAppChromeLogoDimensions } from '@/lib/openy-brand';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/context/toast-context';
import { useTheme } from '@/context/theme-context';
import {
  persistSelectedWorkspace,
  readSelectedWorkspace,
  redirectToWorkspace,
  resolveWorkspaceKey,
} from '@/lib/auth-workspace';
import {
  getWorkspaceLabel,
  isGlobalOwnerEmail,
  normalizeWorkspaceKey,
  type WorkspaceKey,
} from '@/lib/workspace-access';

const NO_WORKSPACE_MESSAGE = 'You are not part of any workspace';
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
  const [workspaceChoices, setWorkspaceChoices] = useState<WorkspaceKey[]>([]);
  const [selectingWorkspace, setSelectingWorkspace] = useState(false);

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
        .map((row) => normalizeWorkspaceKey(row.workspace_key))
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
          setWorkspaceChoices([]);
          setAccessMessage(NO_WORKSPACE_MESSAGE);
          toast(
            `${NO_WORKSPACE_MESSAGE} Contact your workspace admin to get access.`,
            'error',
            6000,
          );
          await supabase.auth.signOut();
          return;
        }

        const requested = requestedWorkspace ?? preferredWorkspace;
        const shouldShowWorkspaceSelection =
          assignedWorkspaces.length > 1 && (isSwitchMode || !requested);
        if (shouldShowWorkspaceSelection) {
          setWorkspaceChoices(assignedWorkspaces);
          setAccessMessage(null);
          if (successToast) {
            toast('Signed in successfully. Choose a workspace to continue.', 'success');
          }
          return;
        }
        const targetWorkspace =
          (requested && assignedWorkspaces.includes(requested) ? requested : null) ??
          assignedWorkspaces[0];

        setWorkspaceChoices([]);
        persistSelectedWorkspace(targetWorkspace);
        setAccessMessage(null);
        if (successToast) {
          toast('Signed in successfully.', 'success');
        }
        redirectToWorkspace(router, targetWorkspace, nextPath);
      } catch (error) {
        console.error(
          '[OfficialAuthLanding] Failed to finalize workspace access after sign-in:',
          error,
        );
        const message = 'Unable to load your workspace access right now. Please try again.';
        setAccessMessage(message);
        toast(message, 'error');
      }
    },
    [
      isSwitchMode,
      loadAssignedWorkspaces,
      nextPath,
      requestedWorkspace,
      router,
      supabase.auth,
      toast,
    ],
  );

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!session) {
        setCheckingSession(false);
        return;
      }

      await finalizeAuth(
        session.user.id,
        session.user.email,
        isSwitchMode ? null : readSelectedWorkspace(),
        false,
      );

      if (mounted) {
        setCheckingSession(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
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

      await fetch('/api/auth/sessions', { method: 'POST', credentials: 'include' }).catch(
        () => null,
      );
      await finalizeAuth(data.user.id, data.user.email, readSelectedWorkspace(), true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Network or server error. Please try again.';
      setFormError(message);
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceSelect = (workspace: WorkspaceKey) => {
    setSelectingWorkspace(true);
    persistSelectedWorkspace(workspace);
    redirectToWorkspace(router, workspace, nextPath);
  };

  if (checkingSession) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{
          background:
            'radial-gradient(900px 420px at 50% -10%, rgba(59,130,246,0.22), transparent 68%), var(--bg)',
        }}
      >
        <Loader2 size={26} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:px-8"
      style={{
        background:
          'radial-gradient(900px 420px at 50% -10%, rgba(59,130,246,0.22), transparent 68%), var(--bg)',
      }}
    >
      <div className="mx-auto flex min-h-[88vh] w-full max-w-6xl items-center">
        <section
          className="w-full overflow-hidden rounded-[2rem] border shadow-[0_45px_90px_-52px_rgba(30,64,175,0.5)]"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div
            className="flex items-center justify-between border-b p-5 sm:p-6 lg:p-7"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <OpenyLogo
                {...openyAppChromeLogoDimensions(40)}
                className="max-w-[min(100%,220px)]"
              />
              <span
                className="hidden rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] sm:inline-flex"
                style={{
                  color: 'var(--text-secondary)',
                  borderColor: 'var(--border)',
                  background: 'var(--surface-2)',
                }}
              >
                Official Authentication
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="relative p-5 transition-all duration-500 sm:p-7 lg:p-9">
              <div className="mx-auto w-full max-w-md">
                <p
                  className="text-xs uppercase tracking-[0.2em]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Sign In
                </p>
                <h1
                  className="mt-2 text-3xl font-semibold tracking-tight"
                  style={{ color: 'var(--text)' }}
                >
                  Access your workspace
                </h1>
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Sign in with your assigned account. Only invited team members with active
                  workspace membership can access OPENY.
                </p>

                {workspaceChoices.length > 0 ? (
                  <div className="mt-6 space-y-3">
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Select a workspace to continue.
                    </p>
                    {workspaceChoices.map((workspace) => (
                      <button
                        key={workspace}
                        type="button"
                        disabled={selectingWorkspace}
                        onClick={() => handleWorkspaceSelect(workspace)}
                        className="h-11 w-full rounded-xl border px-4 text-left text-sm font-semibold transition-colors hover:bg-[var(--surface-2)] disabled:opacity-70"
                        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                      >
                        {getWorkspaceLabel(workspace)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <form onSubmit={submit} className="mt-6 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="openy-control h-11 w-full px-4 text-sm text-primary outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          Password
                        </label>
                        <Link
                          href="/forgot-password"
                          className="text-xs hover:underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="openy-control h-11 w-full px-4 text-sm text-primary outline-none"
                      />
                    </div>

                    {(formError || accessMessage) && (
                      <div
                        className="whitespace-pre-line rounded-xl px-3 py-2 text-sm"
                        style={{
                          background: 'var(--surface-muted)',
                          border: '1px solid rgba(239,68,68,0.28)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {formError ?? accessMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="openy-modal-btn-primary inline-flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-[var(--accent-foreground)] disabled:opacity-70"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                      {loading ? 'Please wait…' : 'Sign In'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div
              className="relative p-6 transition-all duration-500 sm:p-8 lg:p-10"
              style={{
                background:
                  'linear-gradient(145deg, rgba(59,130,246,0.94) 0%, rgba(99,102,241,0.94) 46%, rgba(139,92,246,0.9) 100%)',
              }}
            >
              <div className="relative z-10 flex h-full flex-col justify-between gap-6">
                <div>
                  <p className="text-[var(--accent-foreground)]/80 text-xs uppercase tracking-[0.2em]">
                    OPENY Platform
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold leading-tight text-[var(--accent-foreground)] sm:text-4xl">
                    Welcome back to OPENY
                  </h2>
                  <p className="text-[var(--accent-foreground)]/90 mt-3 max-w-md text-sm sm:text-base">
                    Access is granted only by the owner/admin through team invitation inside OPENY.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-white/35 bg-white/10 px-4 py-3">
                    <p className="text-sm font-medium text-[var(--accent-foreground)]">
                      No public sign up. Ask your owner/admin to invite you first.
                    </p>
                  </div>
                  <p className="text-[var(--accent-foreground)]/80 flex items-center gap-2 text-xs">
                    <Lock size={12} />
                    One secure session. Workspace access is validated per membership.
                  </p>
                </div>
              </div>
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  background:
                    'radial-gradient(560px 260px at 80% 10%, rgba(255,255,255,0.35), transparent 65%)',
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
