'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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

function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [validation, setValidation] = useState<ValidationState>({ status: 'loading' });
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
        body: JSON.stringify({
          token,
          fullName: fullName.trim(),
          password,
        }),
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

      router.push('/dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  if (validation.status === 'loading') {
    return <main className="p-6 text-sm">Validating invitation...</main>;
  }

  if (validation.status === 'invalid') {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Invitation error</h1>
        <p className="mt-2 text-sm">{validation.message}</p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          Back to login
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Accept your invitation</h1>
      <p className="mt-2 text-sm">You are invited as {validation.invitation.role ?? 'member'}.</p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm">Email</label>
          <input
            value={validation.invitation.email}
            readOnly
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
            required
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {submitting ? 'Accepting...' : 'Accept invitation'}
        </button>
      </form>
    </main>
  );
}

export default function AcceptInvitePageWrapper() {
  return (
    <Suspense>
      <AcceptInvitePage />
    </Suspense>
  );
}
