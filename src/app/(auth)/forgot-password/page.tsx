'use client';

import { useState, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

function ForgotPasswordForm() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${APP_URL}/reset-password`,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle size={40} className="mx-auto text-success" />
        <div>
          <h2 className="text-base font-semibold text-primary">Check your email</h2>
          <p className="mt-1 text-sm text-secondary">
            If an account with <strong>{email}</strong> exists, we sent a password reset link.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <ArrowLeft size={14} />
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-primary">
          Email address
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      {error && (
        <p className="border-danger/30 bg-danger/10 rounded-control border px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading || !email} className="w-full">
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {loading ? 'Sending…' : 'Send reset link'}
      </Button>

      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-secondary hover:underline"
        >
          <ArrowLeft size={13} />
          Back to login
        </Link>
      </div>
    </form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardContent className="space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            OPENY <span className="text-accent">OS</span>
          </h1>
          <p className="mt-1 text-sm text-secondary">Reset your password</p>
        </div>

        <Suspense fallback={<div className="h-32" />}>
          <ForgotPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
