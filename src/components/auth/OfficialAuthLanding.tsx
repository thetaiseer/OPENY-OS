'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2, Lock, Moon, Sun } from 'lucide-react';
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

type Mode = 'signin' | 'signup';

const ACCESS_DENIED_AR = 'ليس لديك صلاحية للدخول إلى هذا القسم';
const ACCESS_DENIED_EN = 'You do not have access to this workspace';
const ACCESS_DENIED_HINT_AR = 'تواصل مع مدير النظام للحصول على الصلاحية المناسبة';

export default function OfficialAuthLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAccessMessage(null);

    const selectedWorkspace = ensureWorkspace();
    if (!selectedWorkspace) return;

    if (mode === 'signup') {
      if (!fullName.trim()) {
        const message = 'Full name is required.';
        setFormError(message);
        toast(message, 'error');
        return;
      }
      if (password !== confirmPassword) {
        const message = 'Password mismatch.';
        setFormError(message);
        toast(message, 'error');
        return;
      }
      if (password.length < 8) {
        const message = 'Password must be at least 8 characters.';
        setFormError(message);
        toast(message, 'error');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        await fetch('/api/auth/sessions', { method: 'POST', credentials: 'include' }).catch(() => null);
        await finalizeAuth(data.user.id, data.user.email, selectedWorkspace);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: fullName.trim(), full_name: fullName.trim() },
        },
      });
      if (error) throw error;

      const userId = data.user?.id;
      const userEmail = data.user?.email;
      const session = data.session;

      if (!userId) {
        toast('Signup completed. Please verify your email, then sign in.', 'success', 6000);
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
        return;
      }

      if (session) {
        await fetch('/api/auth/sessions', { method: 'POST', credentials: 'include' }).catch(() => null);
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          await fetch('/api/auth/sessions', { method: 'POST', credentials: 'include' }).catch(() => null);
        }
      }

      await finalizeAuth(userId, userEmail, selectedWorkspace);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network or server error. Please try again.';
      setFormError(message);
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const panelHeading = mode === 'signin' ? 'Welcome back to OPENY' : 'Create your OPENY account';
  const panelText = mode === 'signin'
    ? 'Sign in and choose your authorized workspace to continue with confidence.'
    : 'Join the platform and continue to your authorized OPENY workspace instantly.';
  const submitLabel = mode === 'signin' ? 'Sign In' : 'Sign Up';

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 os-workspace">
        <Loader2 size={26} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:px-8 os-workspace">
      <div className="mx-auto w-full max-w-6xl min-h-[88vh] flex items-center">
        <section
          className="w-full overflow-hidden rounded-[2rem] border"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--glass-shadow-xl, 0 24px 80px rgba(79,70,229,0.20))',
          }}
        >
          <div className="flex items-center justify-between p-5 sm:p-6 lg:p-7 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <OpenyLogo width={128} height={36} />
              <span className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border" style={{ color: 'var(--accent)', borderColor: 'var(--border)', background: 'var(--accent-soft)' }}>
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
              <span className="hidden sm:inline text-xs font-medium">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className={`relative p-5 sm:p-7 lg:p-9 transition-all duration-500 ${mode === 'signup' ? 'lg:order-2' : ''}`}>
              <div className="max-w-md mx-auto w-full">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  {mode === 'signin' ? 'Sign In' : 'Sign Up'}
                </p>
                <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
                  {mode === 'signin' ? 'Access your workspace' : 'Start with OPENY'}
                </h1>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {mode === 'signin'
                    ? 'Authenticate and enter OPENY OS or OPENY DOCS based on your assigned access.'
                    : 'Create your account details, select workspace, and continue if your membership is active.'}
                </p>

                <form onSubmit={submit} className="mt-6 space-y-4">
                  {mode === 'signup' && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Full name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        required={mode === 'signup'}
                        className="input-glass w-full h-11 px-3 text-sm"
                      />
                    </div>
                  )}

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
                      {mode === 'signin' && (
                        <Link href="/forgot-password" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                          Forgot password?
                        </Link>
                      )}
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="input-glass w-full h-11 px-3 text-sm"
                    />
                  </div>

                  {mode === 'signup' && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Confirm password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required={mode === 'signup'}
                        className="input-glass w-full h-11 px-3 text-sm"
                        style={confirmPassword && confirmPassword !== password ? { borderColor: 'var(--color-danger)' } : {}}
                      />
                    </div>
                  )}

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

            <div
              className={`relative p-6 sm:p-8 lg:p-10 transition-all duration-500 ${mode === 'signup' ? 'lg:order-1' : ''}`}
              style={{
                background: 'linear-gradient(145deg, rgba(59,130,246,0.94) 0%, rgba(99,102,241,0.94) 46%, rgba(139,92,246,0.9) 100%)',
              }}
            >
              <div className="relative z-10 h-full flex flex-col justify-between gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/80">OPENY Platform</p>
                  <h2 className="text-3xl sm:text-4xl font-semibold mt-2 text-white leading-tight">{panelHeading}</h2>
                  <p className="text-sm sm:text-base mt-3 text-white/90 max-w-md">{panelText}</p>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === 'signin' ? 'signup' : 'signin');
                      setFormError(null);
                      setAccessMessage(null);
                    }}
                    className="h-11 px-5 rounded-xl border border-white/35 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-white/10 transition-colors"
                  >
                    {mode === 'signin' ? 'Create account' : 'Back to sign in'}
                    <ArrowRight size={15} />
                  </button>
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
