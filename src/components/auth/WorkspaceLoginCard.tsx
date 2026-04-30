'use client';

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { WorkspaceKey } from '@/lib/workspace-access';

interface Props {
  workspace: WorkspaceKey;
}

export default function WorkspaceLoginCard({ workspace }: Props) {
  return (
    <Suspense
      fallback={
        <div
          className="w-full max-w-sm rounded-3xl border p-7 shadow-xl sm:p-8"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex h-24 items-center justify-center">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
        </div>
      }
    >
      <WorkspaceLoginCardInner workspace={workspace} />
    </Suspense>
  );
}

function WorkspaceLoginCardInner({ workspace }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const workspaceLabel = workspace === 'docs' ? 'OPENY DOCS' : 'OPENY OS';
  const defaultNext = workspace === 'docs' ? '/docs' : '/os/dashboard';

  const checkAndRoute = useCallback(async () => {
    const next = searchParams.get('next') ?? defaultNext;
    const res = await fetch(`/api/auth/workspace-access?workspace=${workspace}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      router.replace('/access-denied?workspace=' + workspace);
      return;
    }
    const data = (await res.json()) as { allowed?: boolean };
    if (!data.allowed) {
      router.replace('/access-denied?workspace=' + workspace);
      return;
    }
    router.replace(next);
    router.refresh();
  }, [defaultNext, router, searchParams, workspace]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await checkAndRoute();
      } else {
        setChecking(false);
      }
    });
  }, [checkAndRoute, supabase.auth]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    await fetch('/api/auth/sessions', { method: 'POST', credentials: 'include' }).catch(() => null);
    await checkAndRoute();
    setLoading(false);
  };

  if (checking) {
    return (
      <div
        className="w-full max-w-sm rounded-3xl border p-7 shadow-xl sm:p-8"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex h-24 items-center justify-center">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-sm rounded-3xl border p-7 shadow-xl sm:p-8"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="mb-6 text-center">
        <p
          className="text-xs uppercase tracking-[0.18em]"
          style={{ color: 'var(--text-secondary)' }}
        >
          {workspaceLabel}
        </p>
        <h1 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text)' }}>
          Sign in
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Access is granted per workspace membership.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-xl px-3 text-sm"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Password
          </label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-xl px-3 pr-10 text-sm"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-secondary)' }}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        {error && (
          <p
            className="rounded-xl px-3 py-2 text-sm text-red-500"
            style={{ background: 'var(--surface-muted)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[var(--accent-foreground)] disabled:opacity-70"
          style={{ background: 'var(--accent)' }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Signing in…' : `Enter ${workspaceLabel}`}
        </button>
      </form>
    </div>
  );
}
