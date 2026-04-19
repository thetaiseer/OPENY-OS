'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { BadgeCheck, Loader2, Lock, ShieldCheck } from 'lucide-react';
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

export default function OfficialAuthLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const hasForcedDarkMode = useRef(false);
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

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

  useEffect(() => {
    if (hasForcedDarkMode.current) return;
    hasForcedDarkMode.current = true;
    if (theme !== 'dark') setTheme('dark');
  }, [setTheme, theme]);

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
  const submitButtonClassName = clsx(
    'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white',
    'bg-gradient-to-r from-[#3b82f6] via-[#2563eb] to-[#1d4ed8]',
    'shadow-[0_14px_40px_rgba(37,99,235,0.38)] transition-all duration-200',
    'hover:brightness-110 hover:shadow-[0_16px_52px_rgba(59,130,246,0.45)] active:scale-[0.985] disabled:opacity-70',
  );

  if (checkingSession) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#050505] px-4 os-workspace">
        <div className="absolute inset-0 bg-[radial-gradient(80rem_40rem_at_12%_-20%,rgba(37,99,235,0.16),transparent_55%),radial-gradient(80rem_42rem_at_90%_120%,rgba(29,78,216,0.14),transparent_58%)]" />
        <div className="relative flex min-h-screen items-center justify-center">
          <Loader2 size={26} className="animate-spin text-blue-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 os-workspace">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(72rem_42rem_at_10%_-18%,rgba(37,99,235,0.18),transparent_55%),radial-gradient(72rem_42rem_at_92%_118%,rgba(29,78,216,0.15),transparent_58%)]" />

      <div className="relative mx-auto flex min-h-[88vh] w-full max-w-6xl items-center">
        <motion.section
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        >
          <div className="absolute inset-0 bg-[radial-gradient(60rem_26rem_at_78%_-20%,rgba(96,165,250,0.13),transparent_60%)]" />
          <div className="relative z-10 grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-12 lg:gap-10 lg:p-10">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-3">
                <OpenyLogo width={132} height={38} />
                <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-100/85">
                  Official Authentication
                </span>
              </div>

              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.24em] text-blue-100/55">OPENY Workspace</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-[2.7rem]">{panelHeading}</h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-blue-100/72 sm:text-base">{panelText}</p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-blue-100/85">
                  <BadgeCheck size={14} strokeWidth={1.5} className="text-blue-300" />
                  Optimized for dark mode
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-blue-100/85">
                  <ShieldCheck size={14} strokeWidth={1.5} className="text-blue-300" />
                  Access validated against workspace policies
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-blue-100/85">
                  <Lock size={14} strokeWidth={1.5} className="text-blue-300" />
                  Invite-only access managed by workspace owners
                </span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-full rounded-3xl border border-white/10 bg-black/25 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl sm:p-6 lg:p-7">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100/50">Sign In</p>
                <h2 className="text-2xl font-bold tracking-tight text-white">Access your workspace</h2>
                <p className="mt-2 text-sm leading-relaxed text-blue-100/68">
                  Authenticate to enter OPENY OS or OPENY DOCS based on your assigned access.
                </p>

                <form onSubmit={submit} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-blue-100/60">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 text-sm text-white outline-none placeholder:text-blue-100/35 transition focus:border-blue-400/70 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.18)]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-blue-100/60">Password</label>
                      <Link href="/forgot-password" className="text-xs font-semibold text-blue-300 transition hover:text-blue-200">
                        Forgot password?
                      </Link>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 text-sm text-white outline-none placeholder:text-blue-100/35 transition focus:border-blue-400/70 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.18)]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-blue-100/60">Workspace</label>
                    <SelectDropdown
                      value={workspace}
                      onChange={setWorkspace}
                      options={AUTH_WORKSPACE_OPTIONS.map(item => ({ value: item.value, label: item.value }))}
                      placeholder="Select Workspace"
                      fullWidth
                      className="h-12 rounded-xl border border-white/10 bg-white/[0.02] text-white"
                    />
                  </div>

                  {(formError || accessMessage) && (
                    <div className="whitespace-pre-line rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                      {formError ?? accessMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className={submitButtonClassName}
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? 'Please wait…' : submitLabel}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
