'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useLang } from '@/lib/lang-context';
import {
  CheckCircle, AlertCircle, RefreshCw, ExternalLink, Loader2, LogOut,
  ShieldCheck, CloudOff, CloudLightning, HardDrive, RotateCcw,
} from 'lucide-react';

// ── Google Drive types ────────────────────────────────────────────────────────

interface DriveStatus {
  connected: boolean;
  configured: boolean;
  email: string | null;
  isAdminAccount: boolean;
}

interface SyncLog {
  id: string;
  synced_at: string;
  files_added: number;
  files_updated: number;
  files_removed: number;
  errors_count: number;
  error_details: string[];
  duration_ms: number | null;
  triggered_by: 'manual' | 'cron';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        background: ok ? 'rgba(22,163,74,0.10)' : 'rgba(239,68,68,0.10)',
        color:      ok ? '#16a34a'               : '#ef4444',
        border:     `1px solid ${ok ? 'rgba(22,163,74,0.25)' : 'rgba(239,68,68,0.25)'}`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: ok ? '#16a34a' : '#ef4444' }}
      />
      {label}
    </span>
  );
}

// ── Google Drive Sync Card ────────────────────────────────────────────────────

function GoogleDriveSyncCard() {
  const [status,      setStatus]      = useState<DriveStatus | null>(null);
  const [syncLog,     setSyncLog]     = useState<SyncLog | null>(null);
  const [loadingConn, setLoadingConn] = useState(true);
  const [loadingSync, setLoadingSync] = useState(true);
  const [syncing,     setSyncing]     = useState(false);
  const [syncError,   setSyncError]   = useState<string | null>(null);
  const [syncMsg,     setSyncMsg]     = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoadingConn(true);
    try {
      const res = await fetch('/api/auth/google/status');
      setStatus(res.ok ? await res.json() : { connected: false, configured: false, email: null, isAdminAccount: false });
    } catch {
      setStatus({ connected: false, configured: false, email: null, isAdminAccount: false });
    } finally {
      setLoadingConn(false);
    }
  }, []);

  const fetchSyncLog = useCallback(async () => {
    setLoadingSync(true);
    try {
      const res = await fetch('/api/assets/sync');
      if (res.ok) {
        const body = await res.json() as { success: boolean; last_sync: SyncLog | null };
        setSyncLog(body.last_sync ?? null);
      } else {
        setSyncLog(null);
      }
    } catch {
      setSyncLog(null);
    } finally {
      setLoadingSync(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchSyncLog();
  }, [fetchStatus, fetchSyncLog]);

  const handleRefresh = () => {
    fetchStatus();
    fetchSyncLog();
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncMsg(null);
    try {
      const res  = await fetch('/api/assets/sync', { method: 'POST' });
      const body = await res.json() as { success: boolean; files_added?: number; files_updated?: number; files_removed?: number; errors_count?: number; error?: string };
      if (!res.ok || !body.success) {
        setSyncError(body.error ?? `Sync failed (HTTP ${res.status})`);
      } else {
        setSyncMsg(`Sync complete — added ${body.files_added ?? 0}, updated ${body.files_updated ?? 0}, removed ${body.files_removed ?? 0}${(body.errors_count ?? 0) > 0 ? `, ${body.errors_count} error(s)` : ''}`);
        void fetchSyncLog();
      }
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-6 space-y-5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Google Drive Sync</h2>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loadingConn || loadingSync || syncing}
          title="Refresh status"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
        >
          {(loadingConn || loadingSync) ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        </button>
      </div>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Syncs assets between Google Drive and the database. Uploads go via OAuth 2.0 — no user login required.
      </p>

      {/* ── Connection status ── */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Connection</p>
        {loadingConn ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 size={15} className="animate-spin" /> Checking…
          </div>
        ) : (
          <div
            className="flex items-start gap-3 rounded-xl p-4"
            style={{
              background: status?.connected ? 'rgba(22,163,74,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${status?.connected ? 'rgba(22,163,74,0.20)' : 'rgba(239,68,68,0.20)'}`,
            }}
          >
            {status?.connected
              ? <CheckCircle size={17} style={{ color: '#16a34a' }} className="shrink-0 mt-0.5" />
              : <CloudOff    size={17} style={{ color: '#ef4444' }} className="shrink-0 mt-0.5" />}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {status?.connected ? 'Connected' : 'Disconnected'}
                </p>
                <StatusBadge ok={!!status?.connected} label={status?.connected ? 'OAuth OK' : 'Not configured'} />
              </div>
              {status?.email && (
                <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{status.email}</p>
              )}
              {!status?.connected && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                  Set <code className="px-1 rounded" style={{ background: 'rgba(239,68,68,0.12)', fontFamily: 'monospace' }}>GOOGLE_OAUTH_CLIENT_ID</code>
                  {', '}
                  <code className="px-1 rounded" style={{ background: 'rgba(239,68,68,0.12)', fontFamily: 'monospace' }}>GOOGLE_OAUTH_CLIENT_SECRET</code>
                  {', and '}
                  <code className="px-1 rounded" style={{ background: 'rgba(239,68,68,0.12)', fontFamily: 'monospace' }}>GOOGLE_OAUTH_REFRESH_TOKEN</code>
                  {' '}in your environment.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Sync status ── */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Last Sync</p>
        {loadingSync ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 size={15} className="animate-spin" /> Loading sync log…
          </div>
        ) : syncLog ? (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                {formatDate(syncLog.synced_at)}
              </p>
              <div className="flex items-center gap-2">
                <StatusBadge ok={syncLog.errors_count === 0} label={syncLog.errors_count === 0 ? 'Success' : `${syncLog.errors_count} error(s)`} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  via {syncLog.triggered_by}
                </span>
              </div>
            </div>

            {/* Counts */}
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: 'Added',   value: syncLog.files_added,   color: '#16a34a' },
                { label: 'Updated', value: syncLog.files_updated, color: 'var(--accent)' },
                { label: 'Removed', value: syncLog.files_removed, color: '#f59e0b' },
              ] as const).map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-lg p-3 text-center"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <p className="text-lg font-bold" style={{ color }}>{value}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Duration */}
            {syncLog.duration_ms != null && (
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Duration: {syncLog.duration_ms < 1000 ? `${syncLog.duration_ms}ms` : `${(syncLog.duration_ms / 1000).toFixed(1)}s`}
              </p>
            )}

            {/* Error details */}
            {syncLog.errors_count > 0 && syncLog.error_details.length > 0 && (
              <div
                className="rounded-lg p-3 space-y-1"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.20)' }}
              >
                <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>Last error(s):</p>
                {syncLog.error_details.slice(0, 3).map((e, i) => (
                  <p key={i} className="text-xs font-mono truncate" style={{ color: '#ef4444' }}>{e}</p>
                ))}
                {syncLog.error_details.length > 3 && (
                  <p className="text-xs" style={{ color: '#ef4444' }}>+{syncLog.error_details.length - 3} more</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No sync has run yet.</p>
        )}
      </section>

      {/* ── Inline feedback ── */}
      {syncMsg && (
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)', color: '#16a34a' }}
        >
          <CheckCircle size={16} className="shrink-0 mt-0.5" />
          {syncMsg}
        </div>
      )}
      {syncError && (
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {syncError}
        </div>
      )}

      {/* ── Actions ── */}
      <section className="flex flex-wrap gap-3">
        <button
          onClick={handleSyncNow}
          disabled={syncing || !status?.connected}
          title={!status?.connected ? 'Google Drive not connected' : undefined}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          {syncing
            ? <><Loader2 size={15} className="animate-spin" /> Syncing…</>
            : <><CloudLightning size={15} /> Sync Now</>}
        </button>

        <button
          onClick={fetchStatus}
          disabled={loadingConn}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          <RotateCcw size={15} className={loadingConn ? 'animate-spin' : undefined} /> Reload Connection
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
      </section>

      {/* ── Diagnostics ── */}
      <section
        className="rounded-xl p-4 space-y-2 text-xs"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <p className="font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Diagnostics</p>
        <DiagRow label="OAuth configured"  value={status?.configured ? 'Yes' : 'No'}   ok={!!status?.configured} />
        <DiagRow label="Connected account" value={status?.email ?? '—'}               ok={!!status?.email} />
        <DiagRow label="Upload enabled"    value={status?.configured ? 'Yes' : 'No'}   ok={!!status?.configured} />
        <DiagRow label="Root folder ID"    value="(set GOOGLE_DRIVE_FOLDER_ID on server)" />
      </section>
    </div>
  );
}

function DiagRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span
        className="font-mono truncate max-w-[180px] text-right"
        style={{ color: ok === false ? '#ef4444' : ok === true ? '#16a34a' : 'var(--text)' }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Settings Page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const isAdmin = role === 'admin';

  const roleDescriptions: Record<string, string> = {
    admin:  'Full access to all data and settings',
    team:   'Access to assigned clients — can upload assets and create tasks',
    client: 'Can view own assets and submit approvals',
  };

  async function handleSignOut() {
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOut();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign out failed. Please try again.';
      setSignOutError(message);
      setSigningOut(false);
    }
  }

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

      {/* Admin-only: Google Drive Sync */}
      {isAdmin && <GoogleDriveSyncCard />}

      {/* Role & Access */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Role & Access</h2>
        </div>
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            {(user.name || user.email).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
              {user.name || user.email}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{user.email}</p>
            <span
              className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {role}
            </span>
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {roleDescriptions[role] ?? 'Your access level is managed by your administrator.'}
        </p>
      </div>

      {/* Sign Out */}
      <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>Session</h2>
        {signOutError && (
          <div
            className="mb-3 px-3 py-2 rounded-lg text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            {signOutError}
          </div>
        )}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <LogOut size={15} /> {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
