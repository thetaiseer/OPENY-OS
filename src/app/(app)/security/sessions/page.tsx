'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
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
import { cn } from '@/lib/cn';

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

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

function isActiveSession(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 10 * 60 * 1000; // 10 minutes
}

function DeviceIcon({ type }: { type: string | null }) {
  const cls = 'shrink-0';
  if (type === 'Mobile') return <Smartphone size={20} className={cls} />;
  if (type === 'Tablet') return <Tablet size={20} className={cls} />;
  return <Monitor size={20} className={cls} />;
}

function StatusBadge({ session }: { session: Session }) {
  if (!session.is_active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        <WifiOff size={10} /> Signed out
      </span>
    );
  }
  if (session.is_current) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-600">
        <Wifi size={10} /> Current device
      </span>
    );
  }
  if (isActiveSession(session.last_seen_at)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
        <Wifi size={10} /> Active now
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600">
      <WifiOff size={10} /> Idle
    </span>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onRevoke,
  revoking,
}: {
  session: Session;
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  const deviceLabel =
    [session.browser, session.os].filter(Boolean).join(' on ') || 'Unknown device';
  const location = [session.city, session.country].filter(Boolean).join(', ') || 'Unknown location';

  return (
    <div
      className={cn(
        'space-y-4 rounded-2xl border p-5 transition-colors',
        session.is_current ? 'bg-[var(--accent-soft)]' : 'bg-[var(--surface)]',
        session.risk_flag
          ? 'border-red-400'
          : session.is_current
            ? 'border-[var(--accent)]'
            : 'border-border',
      )}
    >
      {/* Risk banner */}
      {session.risk_flag && session.is_active && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-500">
          <AlertTriangle size={13} className="shrink-0" />
          Suspicious login — new country or location detected
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5', session.is_current ? 'text-accent' : 'text-secondary')}>
          <DeviceIcon type={session.device_type} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-primary">
              {session.device_type ?? 'Device'} — {deviceLabel}
            </span>
            <StatusBadge session={session} />
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Detail icon={<MapPin size={13} />} label="Location" value={location} />
        <Detail icon={<Globe size={13} />} label="IP Address" value={session.ip_address ?? '—'} />
        <Detail
          icon={<Clock size={13} />}
          label="First login"
          value={formatDate(session.created_at)}
        />
        <Detail
          icon={<Clock size={13} />}
          label="Last active"
          value={
            session.is_active
              ? formatRelative(session.last_seen_at)
              : session.revoked_at
                ? `Signed out ${formatRelative(session.revoked_at)}`
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
            {session.is_current ? 'Sign out this device' : 'Sign out'}
          </Button>
        </div>
      )}
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-secondary">{icon}</span>
      <span className="text-xs text-secondary">{label}:</span>
      <span className="truncate text-xs font-medium text-primary">{value}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const { signOut } = useAuth();

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
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

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
      setSuccessMsg('Session signed out.');
      await loadSessions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
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
      setSuccessMsg('All other devices have been signed out.');
      await loadSessions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke other sessions');
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
            Security
          </span>
        }
        subtitle="Manage your active sessions and review login history."
      />

      {/* Risk alert */}
      {hasRiskFlags && (
        <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-semibold text-red-500">Suspicious login detected</p>
            <p className="mt-0.5 text-xs text-secondary">
              One or more logins were flagged as suspicious (new country or location). If you
              don&apos;t recognise them, sign those devices out immediately.
            </p>
          </div>
        </div>
      )}

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <p className="text-sm text-emerald-600">{successMsg}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-3">
          <AlertTriangle size={16} className="text-red-500" />
          <p className="text-sm text-red-500">{error}</p>
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
              <SectionHeader label="Current device" />
              <SessionCard
                session={currentSession}
                onRevoke={handleRevoke}
                revoking={revoking === currentSession.id}
              />
            </section>
          )}

          {/* Other active sessions */}
          {otherActive.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <SectionHeader label={`Other active sessions (${otherActive.length})`} />
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
                  Sign out all other devices
                </Button>
              </div>
              <div className="space-y-3">
                {otherActive.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onRevoke={handleRevoke}
                    revoking={revoking === s.id}
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
                {sessions.length === 0
                  ? 'No sessions found.'
                  : 'No other active sessions. You\u2019re only logged in from this device.'}
              </p>
            </Card>
          )}

          {/* Login history */}
          {revokedSessions.length > 0 && (
            <section className="space-y-3">
              <SectionHeader label={`Login history (${revokedSessions.length})`} />
              <div className="space-y-3">
                {revokedSessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onRevoke={handleRevoke}
                    revoking={revoking === s.id}
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
          Refresh
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
