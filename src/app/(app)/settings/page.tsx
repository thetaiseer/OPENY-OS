'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useLang } from '@/lib/lang-context';
import { CheckCircle, AlertCircle, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';

// ── Google Drive status types ─────────────────────────────────────────────────

interface DriveStatus {
  connected: boolean;
  email: string | null;
  isAdminAccount: boolean;
}

// ── Google Drive Admin Panel ──────────────────────────────────────────────────

function GoogleDrivePanel() {
  const [status, setStatus]   = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState(true);

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
        All file uploads go to the admin Google Drive via a Service Account. No user login is required.
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
                {status?.connected ? 'Service Account configured' : 'Service Account not configured'}
              </p>
              {status?.email && (
                <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{status.email}</p>
              )}
              {status?.connected && status.isAdminAccount && (
                <p className="text-xs" style={{ color: '#16a34a' }}>✓ Configured as admin service account</p>
              )}
              {!status?.connected && (
                <p className="text-xs" style={{ color: '#ef4444' }}>
                  Set <code style={{ fontFamily: 'monospace' }}>GOOGLE_DRIVE_CLIENT_EMAIL</code> and{' '}
                  <code style={{ fontFamily: 'monospace' }}>GOOGLE_DRIVE_PRIVATE_KEY</code> in your environment variables.
                </p>
              )}
            </div>
          </div>

          {/* Open Drive shortcut */}
          <div className="flex flex-wrap gap-3">
            <a
              href="https://drive.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-opacity hover:opacity-70"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              <ExternalLink size={15} /> Open Drive
            </a>
          </div>

          {/* Setup hint */}
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Authentication uses a Google Service Account.
            Set{' '}
            <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--surface-2)', fontFamily: 'monospace' }}>
              GOOGLE_DRIVE_CLIENT_EMAIL
            </code>
            {' '}and{' '}
            <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--surface-2)', fontFamily: 'monospace' }}>
              GOOGLE_DRIVE_PRIVATE_KEY
            </code>
            {' '}in your environment variables.
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
