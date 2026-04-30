'use client';

import { useState } from 'react';
import { Eye, EyeOff, KeyRound, CheckCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      // Re-authenticate with current password first
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user?.email) throw new Error('Could not retrieve current user.');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        throw new Error('Current password is incorrect.');
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl border p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="mb-5 flex items-center gap-2">
          <KeyRound size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            New Password
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            autoComplete="current-password"
            disabled={loading}
          />
          <PasswordField
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggle={() => setShowNew((v) => !v)}
            autoComplete="new-password"
            disabled={loading}
            hint="Minimum 8 characters"
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            autoComplete="new-password"
            disabled={loading}
          />

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{
                background: 'var(--surface-muted)',
                color: 'var(--text-primary)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success */}
          {success && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{
                background: 'rgba(22,163,74,0.08)',
                color: 'var(--text-primary)',
                border: '1px solid rgba(22,163,74,0.2)',
              }}
            >
              <CheckCircle size={15} className="mt-0.5 shrink-0" />
              <span>Password updated successfully.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            className="h-10 w-full rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium" style={{ color: 'var(--text)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          required
          className="h-10 w-full rounded-lg pl-4 pr-10 text-sm outline-none transition-colors disabled:opacity-50"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {hint && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}
