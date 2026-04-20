'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Small delay lets users see success feedback before redirecting.
const REDIRECT_DELAY_MS = 1200;

type ValidationState =
  | { status: 'loading' }
  | { status: 'invalid'; message: string }
  | {
    status: 'valid';
    invitation: {
      email: string;
      role: string | null;
      full_name?: string;
      expires_at: string;
    };
  };

type ValidateResponse = { error?: string; reason?: string; invitation?: { full_name?: string } };
type AcceptResponse = { error?: string; email?: string; workspaces?: Array<'os' | 'docs'> };

function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return `${token.slice(0, 2)}...${token.slice(-2)}`;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function formatRole(value: string | null | undefined): string {
  return (value ?? 'team_member')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

const supabaseClient = createClient();

export default function InvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [validation, setValidation] = useState<ValidationState>({ status: 'loading' });
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      console.log('[invite/page] Token received from URL:', maskToken(token));
      if (!token) {
        setValidation({ status: 'invalid', message: 'Invalid or already used invitation' });
        return;
      }

      setValidation({ status: 'loading' });
      const encodedToken = encodeURIComponent(token);
      console.log('[invite/page] Token sent to backend:', maskToken(token));
      const res = await fetch(`/api/invitations/validate?token=${encodedToken}`, { cache: 'no-store' });
      const payload = await res.json().catch(() => ({} as ValidateResponse));

      if (!res.ok || !payload?.invitation) {
        if (payload?.reason === 'expired') {
          setValidation({ status: 'invalid', message: 'This invitation has expired' });
          return;
        }
        setValidation({ status: 'invalid', message: 'Invalid or already used invitation' });
        return;
      }

      setFullName(payload.invitation.full_name ?? '');
      setValidation({ status: 'valid', invitation: payload.invitation });
    };

    // Fire-and-forget: result updates component state internally.
    void run();
  }, [token]);

  const onAccept = async (event: FormEvent) => {
    event.preventDefault();
    if (validation.status !== 'valid') return;

    setSubmitError(null);
    setSubmitMessage(null);

    if (password && password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }
    if (password && password.length < 8) {
      setSubmitError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      console.log('[invite/page] Token sent to backend:', maskToken(token));
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: password || undefined,
          full_name: fullName || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({} as AcceptResponse));

      if (!res.ok) {
        setSubmitError(payload.error ?? 'Failed to accept invitation.');
        return;
      }

      if (password) {
        await supabaseClient.auth.signInWithPassword({
          email: validation.invitation.email,
          password,
        });
      }

      const acceptedWorkspaces = (payload.workspaces ?? []).filter((workspace: 'os' | 'docs'): workspace is 'os' | 'docs' => workspace === 'os' || workspace === 'docs');
      const redirectTarget = acceptedWorkspaces.length > 1
        ? '/?switch=1'
        : acceptedWorkspaces.length === 1
          ? `/?workspace=${acceptedWorkspaces[0]}`
          : '/?workspace=os';

      setSubmitMessage('Invitation accepted successfully. Redirecting…');
      setTimeout(() => {
        router.push(redirectTarget);
      }, REDIRECT_DELAY_MS);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg, #f9fafb)' }}>
      <div className="w-full max-w-md rounded-2xl border shadow-xl overflow-hidden" style={{ background: '#ffffff', borderColor: '#e5e7eb' }}>
        <div className="px-8 py-7 text-center" style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)' }}>
          <h1 className="text-2xl font-bold text-white tracking-tight">OPENY OS</h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Team Invitation
          </p>
        </div>

        <div className="px-8 py-8 space-y-4">
          {validation.status === 'loading' ? (
            <p className="text-sm text-center" style={{ color: '#6b7280' }}>Validating invitation…</p>
          ) : null}

          {validation.status === 'invalid' ? (
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-bold" style={{ color: '#111827' }}>{validation.message}</h2>
              <Link
                href="/"
                className="inline-block h-10 px-6 rounded-lg text-sm font-semibold text-white leading-10"
                style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)' }}
              >
                Go to Login →
              </Link>
            </div>
          ) : null}

          {validation.status === 'valid' ? (
            <form className="space-y-3" onSubmit={onAccept}>
              <p className="text-sm" style={{ color: '#374151' }}>
                <strong>Email:</strong> {validation.invitation.email}
              </p>
              <p className="text-sm" style={{ color: '#374151' }}>
                <strong>Role:</strong> {formatRole(validation.invitation.role)}
              </p>
              <input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full h-10 rounded-lg border px-3 text-sm"
                style={{ borderColor: '#d1d5db' }}
              />
              <input
                type="password"
                placeholder="Set password (required for new users)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-10 rounded-lg border px-3 text-sm"
                style={{ borderColor: '#d1d5db' }}
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full h-10 rounded-lg border px-3 text-sm"
                style={{ borderColor: '#d1d5db' }}
              />

              {submitError ? (
                <p className="text-sm rounded-lg border px-3 py-2" style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' }}>
                  {submitError}
                </p>
              ) : null}
              {submitMessage ? (
                <p className="text-sm rounded-lg border px-3 py-2" style={{ color: '#166534', borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                  {submitMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)' }}
              >
                {submitting ? 'Accepting…' : 'Accept Invitation'}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
