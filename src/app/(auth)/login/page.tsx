'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

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

    // Register session asynchronously (non-blocking — don't fail login on error)
    fetch('/api/auth/sessions', { method: 'POST', credentials: 'include' })
      .then(res => {
        if (res.ok) {
          console.log('[login] ✓ Session registered');
        } else {
          console.warn('[login] Session registration returned', res.status);
        }
      })
      .catch(err => console.warn('[login] Session registration failed:', err));

    const next = searchParams.get('next') ?? '/dashboard';
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
        <label
          htmlFor="password"
          className="text-sm font-medium"
          style={{ color: 'var(--text)' }}
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-colors"
          style={{
            background:   'var(--surface-2)',
            color:        'var(--text)',
            border:       '1px solid var(--border)',
          }}
        />
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
