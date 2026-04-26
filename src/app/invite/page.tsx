'use client';

import { FormEvent, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { normalizeWorkspaceKey } from '@/lib/workspace-access';
import { useTheme } from '@/context/theme-context';
import {
  OPENY_LOGO_DARK_URL,
  OPENY_LOGO_LIGHT_URL,
  openyAppChromeLogoDimensions,
} from '@/lib/openy-brand';
import { cn } from '@/lib/cn';
import Button from '@/components/ui/Button';

const REDIRECT_DELAY_MS = 1200;

type ValidationState =
  | { status: 'loading' }
  | { status: 'invalid'; message: string }
  | { status: 'error'; message: string }
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

function formatRole(value: string | null | undefined): string {
  return (value ?? 'team_member')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const supabaseClient = createClient();

const fieldClass = cn(
  'h-11 w-full rounded-[var(--radius-control)] border px-3 text-sm outline-none transition-[box-shadow,border-color]',
  'focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--accent)_35%,transparent)]',
  'placeholder:text-[color:var(--text-tertiary)]',
);

function InvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const token = searchParams.get('token') ?? '';

  const [validation, setValidation] = useState<ValidationState>({ status: 'loading' });
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const logoSrc = theme === 'dark' ? OPENY_LOGO_DARK_URL : OPENY_LOGO_LIGHT_URL;
  const logoDims = openyAppChromeLogoDimensions(36);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setValidation({ status: 'invalid', message: 'Invalid or already used invitation' });
        return;
      }

      setValidation({ status: 'loading' });
      const encodedToken = encodeURIComponent(token);
      const res = await fetch(`/api/invitations/validate?token=${encodedToken}`, {
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => ({}) as ValidateResponse);

      if (!res.ok || !payload?.invitation) {
        if (res.status >= 500) {
          setValidation({
            status: 'error',
            message: 'We could not validate this invitation right now. Please try again.',
          });
          return;
        }
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
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: password || undefined,
          full_name: fullName || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}) as AcceptResponse);

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

      const acceptedWorkspaces = (payload.workspaces ?? [])
        .map((workspace: unknown) => normalizeWorkspaceKey(workspace))
        .filter(
          (workspace: unknown): workspace is 'os' | 'docs' =>
            workspace === 'os' || workspace === 'docs',
        );
      const redirectTarget =
        acceptedWorkspaces.length > 1
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

  const fieldStyle = {
    borderColor: 'var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text-primary)',
  } as const;

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col items-center justify-center p-4 sm:p-6"
      style={{ background: 'var(--bg-base)' }}
    >
      <button
        type="button"
        onClick={toggleTheme}
        className="openy-soft-transition absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border transition-colors"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface)',
          color: 'var(--text-secondary)',
        }}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          <Sun size={20} strokeWidth={1.75} />
        ) : (
          <Moon size={20} strokeWidth={1.75} />
        )}
      </button>

      <div
        className={cn(
          'openy-surface w-full max-w-md overflow-hidden rounded-[var(--radius-card)]',
          'openy-motion-card shadow-[var(--shadow-md)]',
        )}
      >
        <div
          className="flex flex-col items-center border-b px-6 pb-7 pt-8 text-center"
          style={{ borderColor: 'var(--border)' }}
        >
          <Image
            src={logoSrc}
            width={logoDims.width}
            height={logoDims.height}
            alt="OPENY"
            className="w-auto max-w-[min(100%,280px)] object-contain"
            decoding="async"
            unoptimized
          />
          <h1
            className="mt-5 text-lg font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Team invitation
          </h1>
          <p
            className="mt-1 max-w-sm text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            Join your workspace on OPENY OS. Complete the form below to activate your account.
          </p>
        </div>

        <div className="space-y-4 px-6 py-8 sm:px-8">
          {validation.status === 'loading' ? (
            <p className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              Validating invitation…
            </p>
          ) : null}

          {validation.status === 'invalid' ? (
            <div className="space-y-5 text-center">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {validation.message}
              </h2>
              <Link
                href="/"
                className={cn(
                  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-control border font-medium leading-normal transition-all duration-150',
                  'border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--accent-contrast)]',
                  'shadow-[0_10px_24px_rgba(47,93,255,0.24)] hover:bg-[color:var(--accent-hover)] active:translate-y-[1px]',
                )}
              >
                Go to login
              </Link>
            </div>
          ) : null}

          {validation.status === 'error' ? (
            <div className="space-y-5 text-center">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {validation.message}
              </h2>
              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => window.location.reload()}
              >
                Try again
              </Button>
            </div>
          ) : null}

          {validation.status === 'valid' ? (
            <form className="space-y-4" onSubmit={onAccept}>
              <div
                className="rounded-[var(--radius-control)] border px-4 py-3 text-sm"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-primary)',
                }}
              >
                <p className="m-0">
                  <span style={{ color: 'var(--text-tertiary)' }}>Email</span>{' '}
                  <span className="font-medium">{validation.invitation.email}</span>
                </p>
                <p className="mb-0 mt-2">
                  <span style={{ color: 'var(--text-tertiary)' }}>Role</span>{' '}
                  <span className="font-medium">{formatRole(validation.invitation.role)}</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  className="block text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Full name
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="block text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="block text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Confirm password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>

              {submitError ? (
                <p
                  className="rounded-[var(--radius-control)] border px-3 py-2.5 text-sm"
                  style={{
                    color: 'var(--danger)',
                    borderColor: 'color-mix(in srgb, var(--danger) 35%, var(--border))',
                    background: 'color-mix(in srgb, var(--danger) 12%, var(--surface))',
                  }}
                >
                  {submitError}
                </p>
              ) : null}
              {submitMessage ? (
                <p
                  className="rounded-[var(--radius-control)] border px-3 py-2.5 text-sm"
                  style={{
                    color: 'var(--success)',
                    borderColor: 'color-mix(in srgb, var(--success) 40%, var(--border))',
                    background: 'color-mix(in srgb, var(--success) 12%, var(--surface))',
                  }}
                >
                  {submitMessage}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="mt-2 w-full"
                disabled={submitting}
                loading={submitting}
              >
                {submitting ? 'Accepting…' : 'Accept invitation'}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function InvitePageWrapper() {
  return (
    <Suspense>
      <InvitePage />
    </Suspense>
  );
}
