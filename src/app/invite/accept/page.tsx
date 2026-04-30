'use client';

import { type FormEvent, type FocusEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Loader2,
  CheckCircle,
  ArrowLeft,
  Mail,
  User,
  Lock,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

type InvitationPayload = {
  id: string;
  email: string;
  role: string | null;
  expires_at: string;
  full_name?: string;
};

type ValidationState =
  | { status: 'loading' }
  | { status: 'invalid'; message: string }
  | { status: 'valid'; invitation: InvitationPayload };

const supabaseClient = createClient();

function InputField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  readOnly,
  placeholder,
  icon: Icon,
  required,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  icon: LucideIcon;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: 'var(--text)' }}>
        {label}
      </label>
      <div className="relative">
        <Icon
          size={15}
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-secondary)' }}
        />
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          readOnly={readOnly}
          required={required}
          placeholder={placeholder}
          className="h-10 w-full rounded-xl ps-9 pe-3 text-sm outline-none transition-colors"
          style={{
            background: readOnly ? 'var(--surface-2)' : 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            opacity: readOnly ? 0.7 : 1,
          }}
          onFocus={(e: FocusEvent<HTMLInputElement>) => {
            if (!readOnly) e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onBlur={(e: FocusEvent<HTMLInputElement>) => {
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        />
      </div>
    </div>
  );
}

function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [validation, setValidation] = useState<ValidationState>({ status: 'loading' });
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setValidation({ status: 'invalid', message: 'Invalid invitation token.' });
        return;
      }

      const res = await fetch(`/api/invitations/validate?token=${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      const payload = (await res.json().catch(() => ({}))) as {
        invitation?: InvitationPayload;
        error?: string;
        reason?: string;
      };

      if (!res.ok || !payload.invitation) {
        if (payload.reason === 'expired') {
          setValidation({ status: 'invalid', message: 'This invitation has expired.' });
          return;
        }
        setValidation({ status: 'invalid', message: payload.error ?? 'Invalid invitation token.' });
        return;
      }

      setFullName(payload.invitation.full_name ?? '');
      setValidation({ status: 'valid', invitation: payload.invitation });
    };

    void run();
  }, [token]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (validation.status !== 'valid') return;

    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/team/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, fullName: fullName.trim(), password }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? 'Failed to accept invitation.');
        return;
      }

      const signInResult = await supabaseClient.auth.signInWithPassword({
        email: validation.invitation.email,
        password,
      });
      if (signInResult.error) {
        setError(signInResult.error.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm space-y-6 rounded-2xl border p-8 shadow-lg"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            OPENY <span style={{ color: 'var(--accent)' }}>OS</span>
          </h1>
        </div>

        {/* Loading */}
        {validation.status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Validating invitation…
            </p>
          </div>
        )}

        {/* Invalid */}
        {validation.status === 'invalid' && (
          <div className="space-y-4 text-center">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'rgba(239,68,68,0.1)' }}
            >
              <ShieldCheck size={26} style={{ color: '#ef4444' }} />
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
                Invalid invitation
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {validation.message}
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              <ArrowLeft size={13} />
              Back to login
            </Link>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle size={40} className="mx-auto" style={{ color: '#16a34a' }} />
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
                Welcome aboard!
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Redirecting to dashboard…
              </p>
            </div>
          </div>
        )}

        {/* Valid form */}
        {validation.status === 'valid' && !success && (
          <>
            <div className="text-center">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                You&apos;ve been invited as{' '}
                <span className="font-semibold capitalize" style={{ color: 'var(--accent)' }}>
                  {validation.invitation.role ?? 'member'}
                </span>
                . Set your password to get started.
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <InputField
                id="email"
                label="Email"
                type="email"
                value={validation.invitation.email}
                readOnly
                icon={Mail}
              />
              <InputField
                id="fullName"
                label="Full name"
                value={fullName}
                onChange={setFullName}
                placeholder="Your full name"
                icon={User}
                required
              />
              <InputField
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="Min. 8 characters"
                icon={Lock}
                required
              />
              <InputField
                id="confirmPassword"
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repeat your password"
                icon={Lock}
                required
              />

              {error && (
                <p
                  className="rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
                {submitting ? 'Joining…' : 'Accept invitation'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePageWrapper() {
  return (
    <Suspense>
      <AcceptInvitePage />
    </Suspense>
  );
}
