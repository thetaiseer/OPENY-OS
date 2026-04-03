'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useLang } from '@/lib/lang-context';
import { CheckCircle, AlertCircle, RefreshCw, Link2, Link2Off, ExternalLink, Loader2 } from 'lucide-react';

// ── Google Drive status types ─────────────────────────────────────────────────

interface DriveStatus {
  connected: boolean;
  email: string | null;
  isAdminAccount: boolean;
}

const ADMIN_EMAIL = 'thetaiseer@gmail.com'; // displayed as the expected admin account

// ── Google Drive Admin Panel ──────────────────────────────────────────────────

function GoogleDrivePanel() {
  const [status, setStatus]       = useState<DriveStatus | null>(null);
  const [loading, setLoading]     = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [message, setMessage]     = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google/status');
      if (res.ok) setStatus(await res.json());
      else setStatus({ connected: false, email: null, isAdminAccount: false });
    } catch {
      setStatus({ connected: false, email: null, isAdminAccount: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleConnect = () => {
    window.open('/api/auth/google', '_blank', 'noopener,noreferrer');
  };

  const handleDisconnect = async () => {
    if (!confirm('Revoke Google Drive access? You will need to reconnect and update the GOOGLE_OAUTH_REFRESH_TOKEN env var.')) return;
    setActionBusy(true);
    setMessage(null);
    try {
      const res  = await fetch('/api/auth/google/disconnect', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        setMessage({ text: json.message ?? 'Token revoked. Update GOOGLE_OAUTH_REFRESH_TOKEN in your env vars and restart the server.', type: 'success' });
        await fetchStatus();
      } else {
        setMessage({ text: json.error ?? 'Disconnect failed', type: 'error' });
      }
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : 'Unexpected error', type: 'error' });
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border p-6 space-y-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Google Drive — Admin Connection</h2>
        <button
          onClick={fetchStatus}
          disabled={loading}
          title="Refresh status"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        </button>
      </div>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        All file uploads go to the admin Google Drive account. Only the admin can connect or disconnect.
        Employees do <strong>not</strong> need their own Google accounts.
      </p>

      {/* Connection status */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Loader2 size={16} className="animate-spin" /> Checking connection…
        </div>
      ) : (
        <div className="space-y-3">
          {/* Status badge */}
          <div
            className="flex items-start gap-3 rounded-xl p-4"
            style={{ background: status?.connected ? 'rgba(22,163,74,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${status?.connected ? 'rgba(22,163,74,0.25)' : 'rgba(239,68,68,0.25)'}` }}
          >
            {status?.connected
              ? <CheckCircle size={18} style={{ color: '#16a34a' }} className="shrink-0 mt-0.5" />
              : <AlertCircle size={18} style={{ color: '#ef4444' }} className="shrink-0 mt-0.5" />}
            <div className="space-y-0.5">
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                {status?.connected ? 'Connected' : 'Not connected'}
              </p>
              {status?.email && (
                <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{status.email}</p>
              )}
              {/* Warn if connected to a non-admin account */}
              {status?.connected && !status.isAdminAccount && (
                <p className="text-xs font-medium mt-1" style={{ color: '#f59e0b' }}>
                  ⚠ Connected account is not {ADMIN_EMAIL}. Please reconnect with the admin account.
                </p>
              )}
              {status?.connected && status.isAdminAccount && (
                <p className="text-xs" style={{ color: '#16a34a' }}>✓ Connected as admin account</p>
              )}
            </div>
          </div>

          {/* Action message */}
          {message && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                background: message.type === 'success' ? 'rgba(22,163,74,0.08)' : 'rgba(239,68,68,0.08)',
                color: message.type === 'success' ? '#15803d' : '#dc2626',
                border: `1px solid ${message.type === 'success' ? 'rgba(22,163,74,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}
            >
              {message.text}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-wrap gap-3">
            {!status?.connected ? (
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                <Link2 size={15} /> Connect Google Drive
              </button>
            ) : (
              <>
                <button
                  onClick={handleConnect}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  <RefreshCw size={15} /> Reconnect
                </button>
                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  <ExternalLink size={15} /> Open Drive
                </a>
                <button
                  onClick={handleDisconnect}
                  disabled={actionBusy}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  {actionBusy ? <Loader2 size={15} className="animate-spin" /> : <Link2Off size={15} />}
                  Disconnect
                </button>
              </>
            )}
          </div>

          {/* Setup hint */}
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            After connecting, copy the refresh token shown and set it as{' '}
            <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--surface-2)', fontFamily: 'monospace' }}>
              GOOGLE_OAUTH_REFRESH_TOKEN
            </code>{' '}
            in your environment variables, then restart the server.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Settings Page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user }          = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();

  const isAdmin = user.role === 'admin';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('settings')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage your preferences</p>
      </div>

      {/* Profile */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Profile</h2>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ background: 'var(--accent)' }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium" style={{ color: 'var(--text)' }}>{user.name}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user.role}</p>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Theme</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Currently: {theme}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="h-9 px-4 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            Switch to {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Language</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Currently: {lang === 'en' ? 'English' : 'Arabic'}
            </p>
          </div>
          <button
            onClick={toggleLang}
            className="h-9 px-4 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            Switch to {lang === 'en' ? 'Arabic' : 'English'}
          </button>
        </div>
      </div>

      {/* Admin-only: Google Drive */}
      {isAdmin && <GoogleDrivePanel />}
    </div>
  );
}
