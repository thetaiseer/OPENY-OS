'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, Moon, Sun } from 'lucide-react';
import OpenyLogo from '@/components/branding/OpenyLogo';
import SelectDropdown from '@/components/ui/SelectDropdown';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-context';
import { useTheme } from '@/lib/theme-context';
import {
  AUTH_WORKSPACE_OPTIONS,
  checkWorkspaceAccess,
  persistSelectedWorkspace,
  readSelectedWorkspace,
  redirectToWorkspace,
  resolveWorkspaceKey,
} from '@/lib/auth-workspace';
import type { WorkspaceKey } from '@/lib/workspace-access';

const ACCESS_DENIED_AR = 'ليس لديك صلاحية للدخول إلى هذا القسم';
const ACCESS_DENIED_EN = 'You do not have access to this workspace';
const ACCESS_DENIED_HINT_AR = 'تواصل مع مدير النظام للحصول على الصلاحية المناسبة';
const SHELL_GLOW = 'transparent';
const FEATURE_GRADIENT = 'var(--surface)';

export default function OfficialAuthLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const signupRequested = searchParams.get('mode') === 'signup' || searchParams.get('invite_only') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  const nextPath = searchParams.get('next');
  const requestedWorkspace = resolveWorkspaceKey(searchParams.get('workspace') ?? '');
  const isSwitchMode = searchParams.get('switch') === '1';

  const accessErrorMessage = `${ACCESS_DENIED_AR}\n${ACCESS_DENIED_EN}\n${ACCESS_DENIED_HINT_AR}`;

  const handleAccessDenied = useCallback(() => {
    setAccessMessage(accessErrorMessage);
    toast(accessErrorMessage, 'error', 6000);
  }, [accessErrorMessage, toast]);

  const ensureWorkspace = () => {
    const key = resolveWorkspaceKey(workspace);
    if (!key) {
      const message = 'Workspace is required.';
      setFormError(message);
      toast(message, 'error');
      return null;
    }
    return key;
  };

  const finalizeAuth = async (userId: string, userEmail: string | null | undefined, selectedWorkspace: WorkspaceKey) => {
    const allowed = await checkWorkspaceAccess(supabase, userId, userEmail, selectedWorkspace);
    if (!allowed) {
      handleAccessDenied();
      return;
    }

    persistSelectedWorkspace(selectedWorkspace);
    setAccessMessage(null);
    toast('Signed in successfully.', 'success');
    redirectToWorkspace(router, selectedWorkspace, nextPath);
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!session || isSwitchMode) {
        setCheckingSession(false);
        if (requestedWorkspace) {
          setWorkspace(requestedWorkspace === 'docs' ? 'OPENY DOCS' : 'OPENY OS');
        }
        return;
      }

      const preferredWorkspace = requestedWorkspace ?? readSelectedWorkspace();
      if (!preferredWorkspace) {
        setCheckingSession(false);
        return;
      }

      const hasAccess = await checkWorkspaceAccess(supabase, session.user.id, session.user.email, preferredWorkspace);
      if (!mounted) return;

      if (hasAccess) {
        persistSelectedWorkspace(preferredWorkspace);
        redirectToWorkspace(router, preferredWorkspace, nextPath);
        return;
      }

      setCheckingSession(false);
      setWorkspace(preferredWorkspace === 'docs' ? 'OPENY DOCS' : 'OPENY OS');
      handleAccessDenied();
    };

    void run();
    return () => { mounted = false; };
  }, [handleAccessDenied, isSwitchMode, nextPath, requestedWorkspace, router, supabase]);

  useEffect(() => {
    if (!signupRequested) return;
    const message = 'Public sign-up is disabled. Ask your workspace owner for an invitation link.';
    setFormError(message);
    toast(message, 'error', 6000);
  }, [signupRequested, toast]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAccessMessage(null);

    const selectedWorkspace = ensureWorkspace();
    if (!selectedWorkspace) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      await fetch('/api/auth/sessions', { method: 'POST', credentials: 'include' }).catch(() => null);
      await finalizeAuth(data.user.id, data.user.email, selectedWorkspace);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network or server error. Please try again.';
      setFormError(message);
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const panelHeading = 'Welcome back to OPENY';
  const panelText = 'Sign in and choose your authorized workspace to continue with confidence.';
  const submitLabel = 'Sign In';

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 os-workspace">
        <Loader2 size={26} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:px-8 os-workspace">
      <div className="mx-auto w-full max-w-7xl min-h-[88vh] flex items-center">
        <section
          className="w-full overflow-hidden rounded-[2rem] border relative"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: 'none',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: SHELL_GLOW }}
          />

          <div className="relative z-10 flex items-center justify-between p-5 sm:p-6 lg:p-7 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <OpenyLogo width={128} height={36} />
              <span className="hidden sm:inline-flex text-xs font-bold uppercase tracking-[0.22em] px-2.5 py-1 rounded-md border" style={{ color: 'var(--accent)', borderColor: 'var(--border)', background: 'var(--accent-soft)' }}>
                Official Authentication
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className="h-9 px-3 rounded-xl border inline-flex items-center justify-center gap-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              <span className="hidden sm:inline text-xs font-medium">{theme === 'dark' ? 'Day' : 'Night'}</span>
            </button>
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 sm:p-7 lg:p-8">
            <div className="lg:col-span-7 rounded-3xl border p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-7" style={{ borderColor: 'var(--border)', background: FEATURE_GRADIENT }}>
              <div>
                <p className="text-xs uppercase tracking-[0.26em]" style={{ color: 'var(--text-secondary)' }}>OPENY Platform</p>
                <h2 className="text-3xl sm:text-[2.5rem] font-semibold mt-3 leading-[1.15]" style={{ color: 'var(--text)' }}>{panelHeading}</h2>
                <p className="text-sm sm:text-base mt-4 max-w-xl" style={{ color: 'var(--text-secondary)' }}>{panelText}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Theme</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>Day / Night experience with one switch</p>
                </div>
                <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Access</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>Workspace rules are validated on sign in</p>
                </div>
                <div className="sm:col-span-2 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <p className="text-xs flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <Lock size={12} />
                    Invite-only access: ask the workspace owner to invite your email address before signing in.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-full rounded-3xl border p-5 sm:p-6 lg:p-7" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                <p className="text-xs font-bold uppercase tracking-[0.22em] mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Sign In
                </p>
                <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
                  Access your workspace
                </h1>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Authenticate and enter OPENY OS or OPENY DOCS based on your assigned access.
                </p>

                <form onSubmit={submit} className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="input-glass w-full h-11 px-3 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Password</label>
                      <Link href="/forgot-password" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                        Forgot password?
                      </Link>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="input-glass w-full h-11 px-3 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Workspace</label>
                    <SelectDropdown
                      value={workspace}
                      onChange={setWorkspace}
                      options={AUTH_WORKSPACE_OPTIONS.map(item => ({ value: item.value, label: item.value }))}
                      placeholder="Select Workspace"
                      fullWidth
                      className="h-11 rounded-xl"
                    />
                  </div>

                  {(formError || accessMessage) && (
                    <div
                      className="rounded-xl px-3 py-2 text-sm whitespace-pre-line border"
                      style={{
                        background: 'var(--color-danger-bg)',
                        border: '1px solid var(--color-danger-border)',
                        color: 'var(--color-danger)',
                      }}
                    >
                      {formError ?? accessMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full h-11 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? 'Please wait…' : submitLabel}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="relative z-10 px-6 pb-6 sm:px-7 sm:pb-7 lg:px-8 lg:pb-8">
            <div className="rounded-2xl border px-4 py-3 text-xs flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              <span>Authentication layer redesigned for clear day/night visual identity.</span>
              <span style={{ color: 'var(--accent)' }}>Secure • Minimal • Invite Controlled</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
