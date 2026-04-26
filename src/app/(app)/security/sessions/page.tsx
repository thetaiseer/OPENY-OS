'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { useLang } from '@/context/lang-context';
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  Shield,
  ShieldAlert,
  LogOut,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Wifi,
  WifiOff,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/layout/PageLayout';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  user_id: string;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  is_active: boolean;
  is_current: boolean;
  last_seen_at: string;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  risk_flag: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string, lang: 'en' | 'ar'): string {
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatRelative(
  iso: string,
  t: (k: string, v?: Record<string, string | number>) => string,
): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return t('relativeJustNow');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('relativeMinutesAgo', { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('relativeHoursAgo', { n: hours });
    const days = Math.floor(hours / 24);
    return t('relativeDaysAgo', { n: days });
  } catch {
    return iso;
  }
}

function isActiveSession(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 10 * 60 * 1000; // 10 minutes
}

function DeviceIcon({ type }: { type: string | null }) {
  const cls = 'shrink-0';
  const n = (type ?? '').toLowerCase();
  if (n === 'mobile') return <Smartphone size={20} className={cls} />;
  if (n === 'tablet') return <Tablet size={20} className={cls} />;
  return <Monitor size={20} className={cls} />;
}

function deviceTypeLabel(type: string | null, t: (k: string) => string): string {
  const n = (type ?? '').toLowerCase();
  if (n === 'mobile') return t('deviceTypeMobile');
  if (n === 'tablet') return t('deviceTypeTablet');
  if (n === 'desktop') return t('deviceTypeDesktop');
  return type?.trim() ? type : t('sessionDeviceFallback');
}

function StatusBadge({
  session,
  t,
}: {
  session: Session;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  if (!session.is_active) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          background: 'rgba(107,114,128,0.10)',
          color: '#6b7280',
          border: '1px solid rgba(107,114,128,0.25)',
        }}
      >
        <WifiOff size={10} /> {t('sessionSignedOutBadge')}
      </span>
    );
  }
  if (session.is_current) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          background: 'rgba(22,163,74,0.10)',
          color: '#16a34a',
          border: '1px solid rgba(22,163,74,0.25)',
        }}
      >
        <Wifi size={10} /> {t('sessionCurrentDeviceBadge')}
      </span>
    );
  }
  if (isActiveSession(session.last_seen_at)) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          background: 'rgba(59,130,246,0.10)',
          color: '#3b82f6',
          border: '1px solid rgba(59,130,246,0.25)',
        }}
      >
        <Wifi size={10} /> {t('sessionActiveNowBadge')}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        background: 'rgba(234,179,8,0.10)',
        color: '#ca8a04',
        border: '1px solid rgba(234,179,8,0.25)',
      }}
    >
      <WifiOff size={10} /> {t('sessionIdleBadge')}
    </span>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onRevoke,
  revoking,
  t,
  lang,
}: {
  session: Session;
  onRevoke: (id: string) => void;
  revoking: boolean;
  t: (k: string, v?: Record<string, string | number>) => string;
  lang: 'en' | 'ar';
}) {
  const parts = [session.browser, session.os].filter(Boolean) as string[];
  const primaryDevice = parts[0];
  const secondaryDevice = parts[1];
  const deviceLabel =
    parts.length === 0
      ? t('sessionUnknownDevice')
      : parts.length === 1
        ? (primaryDevice ?? t('sessionUnknownDevice'))
        : t('sessionOnConnector', {
            a: primaryDevice ?? t('sessionUnknownDevice'),
            b: secondaryDevice ?? t('sessionUnknownDevice'),
          });
  const location =
    [session.city, session.country].filter(Boolean).join(', ') || t('sessionUnknownLocation');

  return (
    <div
      className="space-y-4 rounded-2xl border p-5 transition-colors"
      style={{
        background: session.is_current ? 'var(--accent-soft)' : 'var(--surface)',
        borderColor: session.risk_flag
          ? 'rgba(239,68,68,0.4)'
          : session.is_current
            ? 'var(--accent)'
            : 'var(--border)',
      }}
    >
      {/* Risk banner */}
      {session.risk_flag && session.is_active && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.20)',
          }}
        >
          <AlertTriangle size={13} className="shrink-0" />
          {t('sessionSuspiciousCard')}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5"
          style={{ color: session.is_current ? 'var(--accent)' : 'var(--text-secondary)' }}
        >
          <DeviceIcon type={session.device_type} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {deviceTypeLabel(session.device_type, t)} — {deviceLabel}
            </span>
            <StatusBadge session={session} t={t} />
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Detail icon={<MapPin size={13} />} label={t('detailLocation')} value={location} />
        <Detail
          icon={<Globe size={13} />}
          label={t('detailIpAddress')}
          value={session.ip_address ?? '—'}
        />
        <Detail
          icon={<Clock size={13} />}
          label={t('detailFirstLogin')}
          value={formatDate(session.created_at, lang)}
        />
        <Detail
          icon={<Clock size={13} />}
          label={t('detailLastActive')}
          value={
            session.is_active
              ? formatRelative(session.last_seen_at, t)
              : session.revoked_at
                ? t('sessionSignedOutPrefix', { when: formatRelative(session.revoked_at, t) })
                : '—'
          }
        />
      </div>

      {/* Actions */}
      {session.is_active && (
        <div className="pt-1">
          <Button
            type="button"
            variant={session.is_current ? 'danger' : 'secondary'}
            className="h-8 min-h-0 gap-2 px-3 text-xs"
            onClick={() => onRevoke(session.id)}
            disabled={revoking}
          >
            {revoking ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
            {session.is_current ? t('sessionSignOutThisDevice') : t('sessionSignOut')}
          </Button>
        </div>
      )}
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {label}:
      </span>
      <span className="truncate text-xs font-medium" style={{ color: 'var(--text)' }}>
        {value}
      </span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const { signOut } = useAuth();
  const { t, lang } = useLang();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/sessions');
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data = (await res.json()) as { sessions: Session[] };
      setSessions(data.sessions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failedLoadSessions'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function handleRevoke(id: string) {
    setRevoking(id);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);

      const isCurrentSession = sessions.find((s) => s.id === id)?.is_current;
      if (isCurrentSession) {
        await signOut();
        return;
      }
      setSuccessMsg(t('sessionSignedOutToast'));
      await loadSessions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failedRevokeSession'));
    } finally {
      setRevoking(null);
    }
  }

  async function handleRevokeOthers() {
    setRevokingOthers(true);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/auth/sessions/revoke-others', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setSuccessMsg(t('sessionAllOthersSignedOut'));
      await loadSessions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failedRevokeOthers'));
    } finally {
      setRevokingOthers(false);
    }
  }

  const activeSessions = sessions.filter((s) => s.is_active);
  const revokedSessions = sessions.filter((s) => !s.is_active);
  const currentSession = sessions.find((s) => s.is_current);
  const otherActive = activeSessions.filter((s) => !s.is_current);
  const hasRiskFlags = activeSessions.some((s) => s.risk_flag);

  return (
    <PageShell className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Shield size={24} className="text-[var(--accent)]" />
            {t('security')}
          </span>
        }
        subtitle={t('securityPageSubtitle')}
      />

      {/* Risk alert */}
      {hasRiskFlags && (
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <ShieldAlert size={18} style={{ color: '#ef4444' }} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>
              {t('suspiciousLoginTitle')}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('suspiciousLoginBody')}
            </p>
          </div>
        </div>
      )}

      {/* Success message */}
      {successMsg && (
        <div
          className="flex items-center gap-2 rounded-xl p-3"
          style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}
        >
          <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
          <p className="text-sm" style={{ color: '#16a34a' }}>
            {successMsg}
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="flex items-center gap-2 rounded-xl p-3"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <AlertTriangle size={16} style={{ color: '#ef4444' }} />
          <p className="text-sm" style={{ color: '#ef4444' }}>
            {error}
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : (
        <>
          {/* Current session */}
          {currentSession && (
            <section className="space-y-3">
              <SectionHeader label={t('currentDeviceSection')} />
              <SessionCard
                session={currentSession}
                onRevoke={handleRevoke}
                revoking={revoking === currentSession.id}
                t={t}
                lang={lang}
              />
            </section>
          )}

          {/* Other active sessions */}
          {otherActive.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <SectionHeader
                  label={t('otherActiveSessionsCount', { count: otherActive.length })}
                />
                <Button
                  type="button"
                  variant="danger"
                  className="h-8 min-h-0 gap-2 px-3 text-xs"
                  onClick={handleRevokeOthers}
                  disabled={revokingOthers}
                >
                  {revokingOthers ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <LogOut size={12} />
                  )}
                  {t('sessionSignOutAllOthers')}
                </Button>
              </div>
              <div className="space-y-3">
                {otherActive.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onRevoke={handleRevoke}
                    revoking={revoking === s.id}
                    t={t}
                    lang={lang}
                  />
                ))}
              </div>
            </section>
          )}

          {/* No other sessions */}
          {activeSessions.length <= 1 && (
            <Card padding="md" className="py-6 text-center">
              <Shield size={32} className="mx-auto mb-2 text-[var(--text-secondary)] opacity-40" />
              <p className="text-sm text-[var(--text-secondary)]">
                {sessions.length === 0 ? t('noSessionsFound') : t('onlyThisDeviceSession')}
              </p>
            </Card>
          )}

          {/* Login history */}
          {revokedSessions.length > 0 && (
            <section className="space-y-3">
              <SectionHeader label={t('loginHistoryCount', { count: revokedSessions.length })} />
              <div className="space-y-3">
                {revokedSessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onRevoke={handleRevoke}
                    revoking={revoking === s.id}
                    t={t}
                    lang={lang}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={loadSessions} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {t('refresh')}
        </Button>
      </div>
    </PageShell>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
      {label}
    </h2>
  );
}
