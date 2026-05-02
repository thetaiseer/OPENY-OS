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

function translateAccountRole(role: string | undefined, tr: (k: string) => string): string {
  const r = (role ?? '').toLowerCase().replace(/\s+/g, '_');
  if (r === 'owner') return tr('teamRoleOwner');
  if (r === 'admin') return tr('teamRoleAdmin');
  if (r === 'manager') return tr('teamRoleManager');
  if (r === 'team_member') return tr('teamRoleMember');
  if (r === 'viewer') return tr('teamRoleViewer');
  if (r === 'client') return tr('teamRoleClient');
  return role ?? '';
}

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
        color: ok ? 'var(--text-primary)' : 'var(--text-primary)',
        border: `1px solid ${ok ? 'rgba(22,163,74,0.25)' : 'var(--surface-muted)'}`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: ok ? 'var(--text-primary)' : 'var(--text-primary)' }}
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
        className="max-w-[180px] truncate text-end font-mono"
        style={{
          color:
            ok === false
              ? 'var(--text-primary)'
              : ok === true
                ? 'var(--text-primary)'
                : 'var(--text)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function R2StorageCard() {
  const { t } = useLang();
  const [status, setStatus] = useState<R2Status | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/r2/status');
      if (res.ok) {
        setStatus((await res.json()) as R2Status);
      } else {
        setStatus({ configured: false, missingVars: [t('r2UnableCheck')] });
      }
    } catch {
      setStatus({ configured: false, missingVars: [t('r2NetworkError')] });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  return (
    <Card padding="md" className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive size={18} className="text-[var(--accent)]" />
          <SectionTitle as="h2" className="!mb-0 text-base">
            {t('r2StorageTitle')}
          </SectionTitle>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-8 min-h-0 w-8 p-0"
          onClick={fetchStatus}
          disabled={loading}
          title={t('refreshStatus')}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
        </Button>
      </div>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('r2StorageIntro')}
      </p>

      <section className="space-y-2">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('r2Configuration')}
        </p>
        {loading ? (
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Loader2 size={15} className="animate-spin" /> {t('r2Checking')}
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
              <CheckCircle
                size={17}
                style={{ color: 'var(--text-primary)' }}
                className="mt-0.5 shrink-0"
              />
            ) : (
              <AlertCircle
                size={17}
                style={{ color: 'var(--text-primary)' }}
                className="mt-0.5 shrink-0"
              />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {status?.configured ? t('r2Configured') : t('r2NotConfigured')}
                </p>
                <StatusBadge
                  ok={!!status?.configured}
                  label={status?.configured ? t('r2Ready') : t('r2MissingEnvVars')}
                />
              </div>
              {!status?.configured && (status?.missingVars?.length ?? 0) > 0 && (
                <div className="mt-1 space-y-0.5">
                  <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
                    {t('r2MissingEnvVarsTitle')}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(status?.missingVars ?? []).map((v) => (
                      <code
                        key={v}
                        className="rounded px-1 text-xs"
                        style={{
                          background: 'var(--surface-muted)',
                          fontFamily: 'monospace',
                          color: 'var(--text-primary)',
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
          {t('r2Diagnostics')}
        </p>
        <DiagRow label={t('r2StorageProvider')} value="Cloudflare R2" ok={true} />
        <DiagRow
          label="R2_ACCOUNT_ID"
          value={status?.configured ? t('r2ValueSet') : t('r2ValueNotSet')}
          ok={!!status?.configured}
        />
        <DiagRow
          label="R2_ACCESS_KEY_ID"
          value={status?.configured ? t('r2ValueSet') : t('r2ValueNotSet')}
          ok={!!status?.configured}
        />
        <DiagRow
          label="R2_PUBLIC_URL"
          value={status?.configured ? t('r2ValueSet') : t('r2ValueNotSet')}
          ok={!!status?.configured}
        />
        <DiagRow
          label={t('uploadEnabled')}
          value={status?.configured ? t('uploadYes') : t('uploadNoMissing')}
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
          <CloudLightning size={15} /> {t('openCloudflareR2')}
        </a>
      </section>
    </Card>
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

  const roleDescription =
    role === 'admin' || role === 'owner'
      ? t('roleDescAdmin')
      : role === 'team_member' || role === 'manager'
        ? t('roleDescTeam')
        : role === 'client'
          ? t('roleDescClient')
          : t('roleDescDefault');

  async function handleSignOut() {
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOut();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('signOutFailedGeneric');
      setSignOutError(message);
      setSigningOut(false);
    }
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader title={t('settingsPageTitle')} subtitle={t('settingsPageSubtitle')} />

      <Card padding="md">
        <CardHeader className="!mb-4">
          <CardTitle>{t('profileSection')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4 !p-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-lg font-bold text-[var(--accent-foreground)]">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">{user.name}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              {translateAccountRole(user.role, t)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card padding="md">
        <CardHeader className="!mb-4">
          <CardTitle>{t('appearanceSection')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 !p-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--text)]">{t('themeLabel')}</p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {t('themeCurrently', { value: theme })}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-9 shrink-0"
              onClick={toggleTheme}
            >
              {theme === 'light' ? t('switchToDark') : t('switchToLight')}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] pt-4">
            <div>
              <p className="text-sm font-medium text-[var(--text)]">{t('languageLabel')}</p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {t('languageCurrently', {
                  value: lang === 'en' ? t('langEnglish') : t('langArabic'),
                })}
              </p>
            </div>
            <Button type="button" variant="secondary" className="shrink-0" onClick={toggleLang}>
              {lang === 'en' ? t('switchToArabicUi') : t('switchToEnglishUi')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAdmin && <R2StorageCard />}

      <Card padding="md">
        <CardHeader className="!mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[var(--accent)]" />
            <CardTitle>{t('roleAccessSection')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 !p-0">
          <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--accent-foreground)]">
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text)]">
                {user.name || user.email}
              </p>
              <p className="truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
              <span className="mt-1.5 inline-block rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold capitalize text-[var(--accent)]">
                {translateAccountRole(role, t)}
              </span>
            </div>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">{roleDescription}</p>
        </CardContent>
      </Card>

      <Card padding="md">
        <CardHeader className="!mb-3">
          <CardTitle>{t('sessionSection')}</CardTitle>
        </CardHeader>
        <CardContent className="!p-0">
          {signOutError && (
            <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)]">
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
            <LogOut size={15} /> {signingOut ? t('signingOut') : t('logout')}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
