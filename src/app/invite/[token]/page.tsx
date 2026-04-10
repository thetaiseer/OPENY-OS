'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, CheckCircle, XCircle, Clock, ShieldOff } from 'lucide-react';
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

export default function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
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
    async function validate() {
      try {
        const res = await fetch(`/api/team/invite/${token}`);
        const data = await res.json();
        if (!res.ok) {
          const msg: string = data.error ?? 'Unknown error';
          if (msg.includes('expired'))          setPageState('expired');
          else if (msg.includes('revoked'))     setPageState('revoked');
          else if (msg.includes('already been accepted')) setPageState('already_accepted');
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

      // Redirect to dashboard
      router.replace('/dashboard');
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg, #f9fafb)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-xl overflow-hidden"
        style={{ background: '#ffffff', borderColor: '#e5e7eb' }}
      >
        {/* Header */}
        <div
          className="px-8 py-7 text-center"
          style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)' }}
        >
          <h1 className="text-2xl font-bold text-white tracking-tight">OPENY OS</h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Team Invitation
          </p>
        </div>

        <div className="px-8 py-8">
          {/* Loading */}
          {pageState === 'loading' && (
            <div className="text-center py-8">
              <div
                className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
                style={{ borderColor: '#6366f1', borderTopColor: 'transparent' }}
              />
              <p className="mt-3 text-sm" style={{ color: '#6b7280' }}>Validating your invitation…</p>
            </div>
          )}

          {/* Valid — show form */}
          {pageState === 'valid' && invite && (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="text-center mb-6">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white mx-auto mb-3"
                  style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)' }}
                >
                  {invite.full_name.charAt(0).toUpperCase()}
                </div>
                <p className="text-base font-semibold" style={{ color: '#111827' }}>
                  Welcome, {invite.full_name}!
                </p>
                <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
                  {"You've been invited as"} <span className="font-medium" style={{ color: '#6366f1' }}>{invite.role}</span>
                </p>
                <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{invite.email}</p>
              </div>

              {/* Display name */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                  Your Name
                </label>
                <input
                  ref={displayNameRef}
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg text-sm outline-none"
                  style={{
                    background:  '#f9fafb',
                    border:      '1px solid #d1d5db',
                    color:       '#111827',
                  }}
                  placeholder="Your display name"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                  Create Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-lg text-sm outline-none"
                    style={{
                      background: '#f9fafb',
                      border:     '1px solid #d1d5db',
                      color:      '#111827',
                    }}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: '#9ca3af' }}
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-lg text-sm outline-none"
                    style={{
                      background: '#f9fafb',
                      border:     '1px solid #d1d5db',
                      color:      '#111827',
                    }}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: '#9ca3af' }}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {formError && (
                <p className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
                style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)' }}
              >
                {submitting ? 'Setting up your account…' : 'Join OPENY OS'}
              </button>
            </form>
          )}

          {/* Success (fallback when auto-login fails) */}
          {pageState === 'success' && (
            <div className="text-center py-6">
              <CheckCircle size={48} className="mx-auto mb-4" style={{ color: '#16a34a' }} />
              <h2 className="text-xl font-bold mb-2" style={{ color: '#111827' }}>Account Activated!</h2>
              <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
                Your account is ready. You can now log in to OPENY OS.
              </p>
              <a
                href="/login"
                className="inline-block h-10 px-6 rounded-lg text-sm font-semibold text-white leading-10"
                style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)' }}
              >
                Go to Login →
              </a>
            </div>
          )}

          {/* Expired */}
          {pageState === 'expired' && (
            <StateScreen
              icon={<Clock size={48} style={{ color: '#d97706' }} />}
              title="Invitation Expired"
              message="This invitation link has expired. Please ask an admin to resend your invitation."
            />
          )}

          {/* Revoked */}
          {pageState === 'revoked' && (
            <StateScreen
              icon={<ShieldOff size={48} style={{ color: '#dc2626' }} />}
              title="Invitation Revoked"
              message="This invitation has been revoked. Please contact your workspace admin."
            />
          )}

          {/* Already accepted */}
          {pageState === 'already_accepted' && (
            <StateScreen
              icon={<CheckCircle size={48} style={{ color: '#16a34a' }} />}
              title="Already Accepted"
              message="This invitation has already been used. Please log in."
              action={<a href="/login" className="text-sm font-medium" style={{ color: '#6366f1' }}>Go to Login →</a>}
            />
          )}

          {/* Not found / error */}
          {(pageState === 'not_found' || pageState === 'error') && (
            <StateScreen
              icon={<XCircle size={48} style={{ color: '#dc2626' }} />}
              title="Invalid Invitation"
              message={errorMsg || 'This invitation link is not valid or has been removed.'}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StateScreen({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-6">
      <div className="mx-auto mb-4 flex justify-center">{icon}</div>
      <h2 className="text-xl font-bold mb-2" style={{ color: '#111827' }}>{title}</h2>
      <p className="text-sm" style={{ color: '#6b7280' }}>{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
