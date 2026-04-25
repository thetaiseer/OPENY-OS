'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';

const REDIRECT_DELAY_MS = 2500;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [exchanging, setExchanging] = useState(true);
  const [exchangeErr, setExchangeErr] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    setTimeout(() => router.replace('/'), REDIRECT_DELAY_MS);
  };

  // ── Loading state (exchanging code) ────────────────────────────────────────
  if (exchanging) {
    return (
      <div className="flex h-20 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-accent" />
      </div>
    );
  }

  // ── Error state (bad/expired code) ──────────────────────────────────────────
  if (exchangeErr) {
    return (
      <div className="space-y-4 text-center">
        <XCircle size={40} className="mx-auto text-danger" />
        <div>
          <h2 className="text-base font-semibold text-primary">Reset link invalid</h2>
          <p className="mt-1 text-sm text-secondary">{exchangeErr}</p>
        </div>
        <a
          href="/forgot-password"
          className="inline-block text-sm font-medium text-accent hover:underline"
        >
          Request a new reset link →
        </a>
      </div>
    );
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle size={40} className="mx-auto text-success" />
        <div>
          <h2 className="text-base font-semibold text-primary">Password updated!</h2>
          <p className="mt-1 text-sm text-secondary">Redirecting you to login…</p>
        </div>
      </div>
    );
  }

  // ── Password form ───────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* New password */}
      <div className="space-y-1">
        <div className="relative">
          <Input
            id="password"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            label="New password"
            className="pr-10"
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary transition-opacity hover:opacity-70"
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {/* Confirm password */}
      <div className="space-y-1">
        <div className="relative">
          <Input
            id="confirmPw"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            label="Confirm new password"
            error={confirmPw && confirmPw !== password ? 'Passwords do not match.' : undefined}
            className="pr-10"
            placeholder="Repeat your password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary transition-opacity hover:opacity-70"
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
          >
            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {formError && (
        <p className="border-danger/30 bg-danger/10 rounded-control border px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading || !password || password !== confirmPw}
        className="w-full"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {loading ? 'Updating…' : 'Set new password'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardContent className="space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            OPENY <span className="text-accent">OS</span>
          </h1>
          <p className="mt-1 text-sm text-secondary">Set a new password</p>
        </div>

        <Suspense fallback={<div className="h-32" />}>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
