'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { useLang } from '@/context/lang-context';
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  LogOut,
  ShieldCheck,
  CloudLightning,
  HardDrive,
  RotateCcw,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageShell, PageHeader, SectionTitle } from '@/components/layout/PageLayout';

// ── R2 Storage Card ───────────────────────────────────────────────────────────

interface R2Status {
  configured: boolean;
  missingVars: string[];
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        background: ok ? 'rgba(22,163,74,0.10)' : 'rgba(239,68,68,0.10)',
        color: ok ? '#16a34a' : '#ef4444',
        border: `1px solid ${ok ? 'rgba(22,163,74,0.25)' : 'rgba(239,68,68,0.25)'}`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: ok ? '#16a34a' : '#ef4444' }}
      />
      {label}
    </span>
  );
}

function DiagRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span
        className="max-w-[180px] truncate text-right font-mono"
        style={{ color: ok === false ? '#ef4444' : ok === true ? '#16a34a' : 'var(--text)' }}
      >
        {value}
      </span>
    </div>
  );
}

function R2StorageCard() {
  const [status, setStatus] = useState<R2Status | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/r2/status');
      if (res.ok) {
        setStatus((await res.json()) as R2Status);
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
    <Card padding="md" className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive size={18} className="text-[var(--accent)]" />
          <SectionTitle as="h2" className="!mb-0 text-base">
            Cloudflare R2 Storage
          </SectionTitle>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-8 min-h-0 w-8 p-0"
          onClick={fetchStatus}
          disabled={loading}
          title="Refresh status"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
        </Button>
      </div>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Cloudflare R2 is the sole file storage provider. All asset uploads go directly to R2.
      </p>

      <section className="space-y-2">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-secondary)' }}
        >
          Configuration
        </p>
        {loading ? (
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Loader2 size={15} className="animate-spin" /> Checking…
          </div>
        ) : (
          <div
            className="flex items-start gap-3 rounded-xl p-4"
            style={{
              background: status?.configured ? 'rgba(22,163,74,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${status?.configured ? 'rgba(22,163,74,0.20)' : 'rgba(239,68,68,0.20)'}`,
            }}
          >
            {status?.configured ? (
              <CheckCircle size={17} style={{ color: '#16a34a' }} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={17} style={{ color: '#ef4444' }} className="mt-0.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {status?.configured ? 'Configured' : 'Not configured'}
                </p>
                <StatusBadge
                  ok={!!status?.configured}
                  label={status?.configured ? 'Ready' : 'Missing env vars'}
                />
              </div>
              {!status?.configured && (status?.missingVars?.length ?? 0) > 0 && (
                <div className="mt-1 space-y-0.5">
                  <p className="text-xs" style={{ color: '#ef4444' }}>
                    Missing environment variable(s):
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(status?.missingVars ?? []).map((v) => (
                      <code
                        key={v}
                        className="rounded px-1 text-xs"
                        style={{
                          background: 'rgba(239,68,68,0.12)',
                          fontFamily: 'monospace',
                          color: '#ef4444',
                        }}
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
        className="space-y-2 rounded-xl p-4 text-xs"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <p
          className="font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-secondary)' }}
        >
          Diagnostics
        </p>
        <DiagRow label="Storage provider" value="Cloudflare R2" ok={true} />
        <DiagRow
          label="R2_ACCOUNT_ID"
          value={status?.configured ? '(set)' : 'Not set'}
          ok={!!status?.configured}
        />
        <DiagRow
          label="R2_ACCESS_KEY_ID"
          value={status?.configured ? '(set)' : 'Not set'}
          ok={!!status?.configured}
        />
        <DiagRow
          label="R2_PUBLIC_URL"
          value={status?.configured ? '(set)' : 'Not set'}
          ok={!!status?.configured}
        />
        <DiagRow
          label="Upload enabled"
          value={status?.configured ? 'Yes' : 'No (missing env vars)'}
          ok={!!status?.configured}
        />
      </section>

      <section className="flex flex-wrap gap-3">
        <a
          href="https://dash.cloudflare.com/?to=/:account/r2"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-opacity hover:opacity-80"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          <CloudLightning size={15} /> Open Cloudflare R2
        </a>
      </section>
    </Card>
  );
}

// ── Settings Page ─────────────────────────────────────────────────────────────

export default function SettingsProfilePage() {
  const { user, role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang } = useLang();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const isAdmin = role === 'admin';

  const roleDescriptions: Record<string, string> = {
    admin: 'Full access to all data and settings',
    team: 'Access to assigned clients — can upload assets and create tasks',
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
    <PageShell className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Profile, appearance, access, and session preferences."
      />

      <Card padding="md">
        <CardHeader className="!mb-4">
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4 !p-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-lg font-bold text-white">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">{user.name}</p>
            <p className="text-sm text-[var(--text-secondary)]">{user.role}</p>
          </div>
        </CardContent>
      </Card>

      <Card padding="md">
        <CardHeader className="!mb-4">
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 !p-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Theme</p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Currently: {theme}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-9 shrink-0"
              onClick={toggleTheme}
            >
              Switch to {theme === 'light' ? 'Dark' : 'Light'}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] pt-4">
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Language</p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Currently: {lang === 'en' ? 'English' : 'Arabic'}
              </p>
            </div>
            <Button type="button" variant="secondary" className="shrink-0" onClick={toggleLang}>
              Switch to {lang === 'en' ? 'Arabic' : 'English'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAdmin && <R2StorageCard />}

      <Card padding="md">
        <CardHeader className="!mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[var(--accent)]" />
            <CardTitle>Role & Access</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 !p-0">
          <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text)]">
                {user.name || user.email}
              </p>
              <p className="truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
              <span className="mt-1.5 inline-block rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold capitalize text-[var(--accent)]">
                {role}
              </span>
            </div>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            {roleDescriptions[role] ?? 'Your access level is managed by your administrator.'}
          </p>
        </CardContent>
      </Card>

      <Card padding="md">
        <CardHeader className="!mb-3">
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent className="!p-0">
          {signOutError && (
            <div className="mb-3 rounded-lg border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.1)] px-3 py-2 text-sm text-[#ef4444]">
              {signOutError}
            </div>
          )}
          <Button
            type="button"
            variant="danger"
            className="h-9"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut size={15} /> {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
