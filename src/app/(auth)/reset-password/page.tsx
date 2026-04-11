'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';

const REDIRECT_DELAY_MS = 2500;

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const [exchanging,  setExchanging]  = useState(true);
  const [exchangeErr, setExchangeErr] = useState<string | null>(null);
  const [password,    setPassword]    = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [formError,   setFormError]   = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);

  // Exchange the PKCE code from the URL for a session.
  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setExchangeErr('Invalid or missing reset link. Please request a new password reset.');
      setExchanging(false);
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setExchangeErr(
          error.message.includes('expired') || error.message.includes('invalid')
            ? 'This reset link has expired or is invalid. Please request a new one.'
            : error.message,
        );
      }
      setExchanging(false);
    });
  }, [supabase, searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPw) {
      setFormError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    setSuccess(true);
    // Give the user a moment to read the success message, then redirect.
    setTimeout(() => router.replace('/login'), REDIRECT_DELAY_MS);
  };

  // ── Loading state (exchanging code) ────────────────────────────────────────
  if (exchanging) {
    return (
      <div className="flex items-center justify-center h-20">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  // ── Error state (bad/expired code) ──────────────────────────────────────────
  if (exchangeErr) {
    return (
      <div className="text-center space-y-4">
        <XCircle size={40} className="mx-auto" style={{ color: '#dc2626' }} />
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Reset link invalid
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {exchangeErr}
          </p>
        </div>
        <a
          href="/forgot-password"
          className="inline-block text-sm font-medium hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Request a new reset link →
        </a>
      </div>
    );
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle size={40} className="mx-auto" style={{ color: '#16a34a' }} />
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Password updated!
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Redirecting you to login…
          </p>
        </div>
      </div>
    );
  }

  // ── Password form ───────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* New password */}
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          New password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full h-10 px-3 pr-10 rounded-lg text-sm outline-none transition-colors"
            style={{
              background: 'var(--surface-2)',
              color:      'var(--text)',
              border:     '1px solid var(--border)',
            }}
            placeholder="At least 8 characters"
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

      {/* Confirm password */}
      <div className="space-y-1">
        <label htmlFor="confirmPw" className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Confirm new password
        </label>
        <div className="relative">
          <input
            id="confirmPw"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            className="w-full h-10 px-3 pr-10 rounded-lg text-sm outline-none transition-colors"
            style={{
              background: 'var(--surface-2)',
              color:      'var(--text)',
              border:     `1px solid ${confirmPw && confirmPw !== password ? '#fca5a5' : 'var(--border)'}`,
            }}
            placeholder="Repeat your password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(v => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
          >
            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {confirmPw && confirmPw !== password && (
          <p className="text-xs" style={{ color: '#ef4444' }}>Passwords do not match.</p>
        )}
      </div>

      {formError && (
        <p
          className="text-sm rounded-lg px-3 py-2"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color:      '#ef4444',
            border:     '1px solid rgba(239,68,68,0.25)',
          }}
        >
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !password || password !== confirmPw}
        className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {loading ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
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
          Set a new password
        </p>
      </div>

      <Suspense fallback={<div className="h-32" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
