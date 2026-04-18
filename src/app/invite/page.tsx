'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, CheckCircle, XCircle, Clock, ShieldOff, Check, Loader2, Sparkles } from 'lucide-react';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { createClient } from '@/lib/supabase/client';

interface InviteInfo {
  full_name: string;
  email: string;
  role: string;
  expires_at: string;
}

type PageState =
  | 'loading'
  | 'valid'
  | 'not_found'
  | 'expired'
  | 'revoked'
  | 'already_accepted'
  | 'success'
  | 'error';

// Password strength: 0–4
function getPasswordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw))   score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LEVELS: Array<{ label: string; color: string } | null> = [
  null,
  { label: 'Weak',   color: 'var(--color-danger)' },
  { label: 'Fair',   color: 'var(--color-warning)' },
  { label: 'Good',   color: 'var(--color-info)' },
  { label: 'Strong', color: 'var(--color-success)' },
];

const HEADER_BADGE_STYLE = { color: 'var(--accent)', borderColor: 'var(--border)', background: 'var(--accent-soft)' } as const;

function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const strength = getPasswordStrength(password);
  const level = STRENGTH_LEVELS[strength];
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= strength && level ? level.color : 'var(--border)',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
      {level && (
        <p style={{ margin: 0, fontSize: 11, color: level.color, fontWeight: 600 }}>
          {level.label}
        </p>
      )}
    </div>
  );
}

function PasswordRequirements({ password }: { password: string }) {
  const reqs = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase & lowercase letters', met: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'A number', met: /\d/.test(password) },
    { label: 'A special character', met: /[^A-Za-z0-9]/.test(password) },
  ];
  if (!password) return null;
  return (
    <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {reqs.map(r => (
        <li key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: r.met ? 'var(--color-success)' : 'var(--text-tertiary)' }}>
          <Check size={12} style={{ flexShrink: 0, opacity: r.met ? 1 : 0.35 }} />
          {r.label}
        </li>
      ))}
    </ul>
  );
}

export default function InviteAcceptPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const [pageState, setPageState]     = useState<PageState>('loading');
  const [invite, setInvite]           = useState<InviteInfo | null>(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState('');

  const displayNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setPageState('not_found');
      setErrorMsg('No invitation token provided.');
      return;
    }

    async function validate() {
      try {
        const res = await fetch(`/api/team/invite/${token}`);
        const data = await res.json();
        if (!res.ok) {
          const msg: string = data.error ?? 'Unknown error';
          if (msg.includes('expired'))                     setPageState('expired');
          else if (msg.includes('revoked'))                setPageState('revoked');
          else if (msg.includes('already been accepted'))  setPageState('already_accepted');
          else { setPageState('not_found'); setErrorMsg(msg); }
          return;
        }
        setInvite(data as InviteInfo);
        setDisplayName(data.full_name as string);
        setPageState('valid');
      } catch {
        setPageState('error');
        setErrorMsg('Failed to reach the server. Please try again.');
      }
    }
    validate();
  }, [token]);

  useEffect(() => {
    if (pageState === 'valid') {
      displayNameRef.current?.focus();
    }
  }, [pageState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPw) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/team/invite/${token}/accept`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password, displayName: displayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? 'Failed to activate account.');
        return;
      }

      // Auto-login with the newly created credentials
      if (!invite) {
        setPageState('success');
        return;
      }
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email:    invite.email,
        password,
      });

      if (signInError) {
        // Account was created but auto-login failed — fall back to manual login
        setPageState('success');
        return;
      }

      // Redirect to official auth landing
      router.replace('/');
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen os-workspace px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl min-h-[88vh] flex items-center">
        <section
          className="w-full overflow-hidden rounded-[2rem] border"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-xl)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
          }}
        >
          <div className="flex items-center justify-between p-5 sm:p-6 lg:p-7 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <OpenyLogo width={128} height={36} />
              <span className="inline-flex text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border" style={HEADER_BADGE_STYLE}>
                Team Invitation
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--surface-2) 90%, transparent)' }}>
              Secure onboarding
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="relative p-5 sm:p-7 lg:p-9">
              {pageState === 'loading' && (
                <StateScreen
                  icon={<Loader2 size={44} className="animate-spin" style={{ color: 'var(--accent)' }} />}
                  title="Checking invitation"
                  message="Validating your invitation link…"
                  tone="info"
                />
              )}

              {pageState === 'valid' && invite && (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--surface-2) 90%, transparent)' }}>
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)' }}>
                        {(((invite.full_name?.trim() || invite.email?.trim() || 'O').charAt(0)) || 'O').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          Welcome, {invite.full_name}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                          You are joining as <span className="font-semibold" style={{ color: 'var(--accent)' }}>{invite.role}</span>
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{invite.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="openy-label block">Your name</label>
                    <input
                      ref={displayNameRef}
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="input-glass w-full h-11 px-3 text-sm"
                      placeholder="Your display name"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="openy-label block">Create password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="input-glass w-full h-11 px-3 pr-11 text-sm"
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                        style={{ color: 'var(--text-tertiary)' }}
                        tabIndex={-1}
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <PasswordStrengthBar password={password} />
                    <PasswordRequirements password={password} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="openy-label block">Confirm password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPw}
                        onChange={e => setConfirmPw(e.target.value)}
                        className="input-glass w-full h-11 px-3 pr-11 text-sm"
                        style={confirmPw && confirmPw !== password ? { borderColor: 'var(--color-danger)' } : undefined}
                        placeholder="Repeat your password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                        style={{ color: 'var(--text-tertiary)' }}
                        tabIndex={-1}
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirmPw && confirmPw !== password && (
                      <p className="text-xs" style={{ color: 'var(--color-danger)' }}>Passwords do not match.</p>
                    )}
                  </div>

                  {formError && (
                    <div className="rounded-xl px-3 py-2 text-sm border" style={{ background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger-border)', color: 'var(--color-danger)' }}>
                      {formError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !password || password !== confirmPw || getPasswordStrength(password) < 2}
                    className="btn-primary w-full h-11 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={15} />}
                    {submitting ? 'Setting up your account…' : 'Accept Invitation & Join'}
                  </button>
                </form>
              )}

              {pageState === 'success' && (
                <StateScreen
                  icon={<CheckCircle size={44} style={{ color: 'var(--color-success)' }} />}
                  title="You’re in!"
                  message="Your account has been activated and added to the workspace."
                  tone="success"
                  action={<Link href="/" className="btn-primary h-11 px-5 text-sm font-semibold rounded-xl">Go to Login</Link>}
                />
              )}

              {pageState === 'expired' && (
                <StateScreen
                  icon={<Clock size={44} style={{ color: 'var(--color-warning)' }} />}
                  title="Invitation expired"
                  message="This invitation link has expired. Ask your admin to send a new one."
                  tone="warning"
                />
              )}

              {pageState === 'revoked' && (
                <StateScreen
                  icon={<ShieldOff size={44} style={{ color: 'var(--color-danger)' }} />}
                  title="Invitation revoked"
                  message="This invitation was revoked by your workspace admin."
                  tone="danger"
                />
              )}

              {pageState === 'already_accepted' && (
                <StateScreen
                  icon={<CheckCircle size={44} style={{ color: 'var(--color-success)' }} />}
                  title="Already accepted"
                  message="This invitation has already been used. Sign in to continue."
                  tone="success"
                  action={<Link href="/" className="btn-secondary h-11 px-5 text-sm font-semibold rounded-xl">Go to Login</Link>}
                />
              )}

              {(pageState === 'not_found' || pageState === 'error') && (
                <StateScreen
                  icon={<XCircle size={44} style={{ color: 'var(--color-danger)' }} />}
                  title="Invalid invitation"
                  message={errorMsg || 'This invitation link is not valid or has been removed.'}
                  tone="danger"
                />
              )}
            </div>

            <div
              className="relative p-6 sm:p-8 lg:p-10 transition-all duration-500"
              style={{
                background: 'linear-gradient(145deg, rgba(59,130,246,0.94) 0%, rgba(99,102,241,0.94) 46%, rgba(139,92,246,0.9) 100%)',
              }}
            >
              <div className="relative z-10 h-full flex flex-col justify-between gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/80">OPENY OS</p>
                  <h2 className="text-3xl sm:text-4xl font-semibold mt-2 text-white leading-tight">
                    Premium invitation experience
                  </h2>
                  <p className="text-sm sm:text-base mt-3 text-white/90 max-w-md">
                    Join your workspace through a secure, invite-only onboarding flow designed for OPENY OS.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-white/90">
                    Invitation links are secure, time-limited, and tied to your email address.
                  </p>
                  <p className="text-xs text-white/80 flex items-center gap-2">
                    <Check size={12} />
                    Account setup and workspace access are validated in one flow.
                  </p>
                </div>
              </div>
              <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(560px 260px at 80% 10%, rgba(255,255,255,0.35), transparent 65%)' }} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StateScreen({
  icon,
  title,
  message,
  action,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
  tone: 'success' | 'warning' | 'danger' | 'info';
}) {
  const toneStyles = {
    success: { bg: 'var(--color-success-bg)', border: 'var(--color-success-border)', text: 'var(--color-success)' },
    warning: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning-border)', text: 'var(--color-warning)' },
    danger: { bg: 'var(--color-danger-bg)', border: 'var(--color-danger-border)', text: 'var(--color-danger)' },
    info: { bg: 'var(--color-info-bg)', border: 'var(--color-info-border)', text: 'var(--color-info)' },
  }[tone];

  return (
    <div className="text-center py-2 sm:py-6">
      <div className="rounded-2xl border p-5 sm:p-7" style={{ borderColor: toneStyles.border, background: toneStyles.bg }}>
        <div className="mx-auto mb-4 flex justify-center">{icon}</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>{title}</h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        {action && <div className="mt-6 flex justify-center">{action}</div>}
        {!action && (
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider" style={{ color: toneStyles.text }}>
            Invitation status
          </p>
        )}
      </div>
    </div>
  );
}
