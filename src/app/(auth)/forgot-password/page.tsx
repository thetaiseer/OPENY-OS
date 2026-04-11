'use client';

import { useState, FormEvent, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

function ForgotPasswordForm() {
  const supabase = createClient();

  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${APP_URL}/reset-password` },
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle size={40} className="mx-auto" style={{ color: '#16a34a' }} />
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Check your email
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            If an account with <strong>{email}</strong> exists, we sent a password reset link.
          </p>
        </div>
        <a
          href="/login"
          className="inline-flex items-center gap-1 text-sm hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          <ArrowLeft size={14} />
          Back to login
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Email address
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
            background: 'var(--surface-2)',
            color:      'var(--text)',
            border:     '1px solid var(--border)',
          }}
          placeholder="you@example.com"
        />
      </div>

      {error && (
        <p
          className="text-sm rounded-lg px-3 py-2"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color:      '#ef4444',
            border:     '1px solid rgba(239,68,68,0.25)',
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !email}
        className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {loading ? 'Sending…' : 'Send reset link'}
      </button>

      <div className="text-center">
        <a
          href="/login"
          className="inline-flex items-center gap-1 text-sm hover:underline"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={13} />
          Back to login
        </a>
      </div>
    </form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div
      className="w-full max-w-sm rounded-2xl border p-8 space-y-6 shadow-lg"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          OPENY <span style={{ color: 'var(--accent)' }}>OS</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Reset your password
        </p>
      </div>

      <Suspense fallback={<div className="h-32" />}>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
