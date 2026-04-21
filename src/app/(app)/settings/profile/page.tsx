'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useLang } from '@/lib/lang-context';
import {
  CheckCircle, AlertCircle, Loader2, LogOut,
  ShieldCheck, CloudLightning, HardDrive, RotateCcw,
} from 'lucide-react';

// ── R2 Storage Card ───────────────────────────────────────────────────────────

interface R2Status {
  configured: boolean;
  missingVars: string[];
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
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ok ? '#16a34a' : '#ef4444' }} />
      {label}
    </span>
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

function R2StorageCard() {
  const [status,  setStatus]  = useState<R2Status | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/r2/status');
      if (res.ok) {
        setStatus(await res.json() as R2Status);
      } else {
        setStatus({ configured: false, missingVars: ['Unable to check status'] });
      }
    } catch {
      setStatus({ configured: false, missingVars: ['Network error'] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  return (
    <div
      className="rounded-2xl border p-6 space-y-5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Cloudflare R2 Storage</h2>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          title="Refresh status"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
        </button>
      </div>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Cloudflare R2 is the sole file storage provider. All asset uploads go directly to R2.
      </p>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Configuration</p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 size={15} className="animate-spin" /> Checking…
          </div>
        ) : (
          <div
            className="flex items-start gap-3 rounded-xl p-4"
            style={{
              background:  status?.configured ? 'rgba(22,163,74,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${status?.configured ? 'rgba(22,163,74,0.20)' : 'rgba(239,68,68,0.20)'}`,
            }}
          >
            {status?.configured
              ? <CheckCircle size={17} style={{ color: '#16a34a' }} className="shrink-0 mt-0.5" />
              : <AlertCircle size={17} style={{ color: '#ef4444' }} className="shrink-0 mt-0.5" />}
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {status?.configured ? 'Configured' : 'Not configured'}
                </p>
                <StatusBadge ok={!!status?.configured} label={status?.configured ? 'Ready' : 'Missing env vars'} />
              </div>
              {!status?.configured && (status?.missingVars?.length ?? 0) > 0 && (
                <div className="mt-1 space-y-0.5">
                  <p className="text-xs" style={{ color: '#ef4444' }}>Missing environment variable(s):</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {status!.missingVars.map(v => (
                      <code
                        key={v}
                        className="px-1 rounded text-xs"
                        style={{ background: 'rgba(239,68,68,0.12)', fontFamily: 'monospace', color: '#ef4444' }}
                      >
                        {v}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section
        className="rounded-xl p-4 space-y-2 text-xs"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <p className="font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Diagnostics</p>
        <DiagRow label="Storage provider" value="Cloudflare R2"                                         ok={true} />
        <DiagRow label="R2_ACCOUNT_ID"    value={status?.configured ? '(set)' : 'Not set'}             ok={!!status?.configured} />
        <DiagRow label="R2_ACCESS_KEY_ID" value={status?.configured ? '(set)' : 'Not set'}             ok={!!status?.configured} />
        <DiagRow label="R2_PUBLIC_URL"    value={status?.configured ? '(set)' : 'Not set'}             ok={!!status?.configured} />
        <DiagRow label="Upload enabled"   value={status?.configured ? 'Yes' : 'No (missing env vars)'} ok={!!status?.configured} />
      </section>

      <section className="flex flex-wrap gap-3">
        <a
          href="https://dash.cloudflare.com/?to=/:account/r2"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          <CloudLightning size={15} /> Open Cloudflare R2
        </a>
      </section>
    </div>
  );
}

// ── Settings Page ─────────────────────────────────────────────────────────────

export default function SettingsProfilePage() {
  const { user, role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const isAdmin = role === 'admin';

  const roleDescriptions: Record<string, string> = {
    admin:  'Full access to all data and settings',
    team:   'Access to assigned clients — can upload assets and create tasks',
    client: 'Can view own assets',
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
    <div className="app-page-shell space-y-6">
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">Settings</h1>
          <p className="app-page-subtitle">Profile, appearance, access, and session preferences.</p>
        </div>
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

      {/* Admin-only: R2 Storage */}
      {isAdmin && <R2StorageCard />}

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
