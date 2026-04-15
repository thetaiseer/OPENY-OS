'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [checking, setChecking] = useState(true);

  // Redirect already-authenticated users away from the login page.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const next = searchParams.get('next') ?? '/select-workspace';
        router.replace(next);
      } else {
        setChecking(false);
      }
    });
  }, [supabase, router, searchParams]);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-20">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    // Register session — awaited so the openy-sid cookie is set before navigation
    try {
      const res = await fetch('/api/auth/sessions', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { session?: { id: string } };
        console.log('[login] Session created:', data.session?.id ?? 'no id');
      } else {
        console.warn('[login] Session creation returned', res.status);
      }
    } catch (err) {
      console.warn('[login] Session creation error (login still succeeds):', err);
    }

    const next = searchParams.get('next') ?? '/select-workspace';
    router.push(next);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Email */}
      <div className="space-y-1">
        <label
          htmlFor="email"
          className="text-sm font-medium"
          style={{ color: 'var(--text)' }}
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-colors"
          style={{
            background:   'var(--surface-2)',
            color:        'var(--text)',
            border:       '1px solid var(--border)',
          }}
        />
      </div>

      {/* Password */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-sm font-medium"
            style={{ color: 'var(--text)' }}
          >
            Password
          </label>
          <a
            href="/forgot-password"
            className="text-xs hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full h-10 px-3 pr-10 rounded-lg text-sm outline-none transition-colors"
            style={{
              background: 'var(--surface-2)',
              color:      'var(--text)',
              border:     '1px solid var(--border)',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 rounded-lg px-3 py-2"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div
      className="w-full max-w-sm rounded-2xl border p-8 space-y-6 shadow-lg"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          OPENY <span style={{ color: 'var(--accent)' }}>OS</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Sign in to your workspace
        </p>
      </div>

      <Suspense fallback={<div className="h-40" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
